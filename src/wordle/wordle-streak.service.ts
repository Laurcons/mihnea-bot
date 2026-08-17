import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WordleResult } from './models/wordle-result.schema';
import { DiscordUser } from './models/discord-user.schema';
import { WordleParserService } from './wordle-parser.service';
import { computeStreak, isStreakStale } from './wordle-streak.util';

@Injectable()
export class WordleStreakService {
  private readonly logger = new Logger(WordleStreakService.name);

  constructor(
    @InjectModel(WordleResult.name)
    private readonly wordleResultModel: Model<WordleResult>,
    @InjectModel(DiscordUser.name)
    private readonly discordUserModel: Model<DiscordUser>,
    private readonly parser: WordleParserService,
  ) {}

  /**
   * Fast path for a result submitted for today's puzzle: extends the stored
   * streak in place instead of rescanning history.
   */
  async recordResult(
    userId: string,
    username: string,
    gameType: string,
    puzzleDay: number,
  ): Promise<void> {
    const sp = `wordleStats.${gameType}`;
    const stored = { $ifNull: [`$${sp}.currentStreak`, 0] };
    const extended = {
      $switch: {
        branches: [
          // Normal case: yesterday's result is on record, so extend.
          {
            case: { $eq: [`$${sp}.lastPuzzleDay`, puzzleDay - 1] },
            then: { $add: [stored, 1] },
          },
          // Same day re-recorded (a /reevaluate deletes and re-saves). Must be
          // idempotent, otherwise reevaluating today's message resets the
          // streak to 1.
          {
            case: { $eq: [`$${sp}.lastPuzzleDay`, puzzleDay] },
            then: { $max: [stored, 1] },
          },
        ],
        default: 1,
      },
    };

    await this.discordUserModel.findOneAndUpdate(
      { discordId: userId },
      [
        {
          $set: {
            username,
            [sp]: {
              lastPuzzleDay: puzzleDay,
              currentStreak: extended,
              biggestStreak: {
                $max: [{ $ifNull: [`$${sp}.biggestStreak`, 0] }, extended],
              },
            },
          },
        },
      ],
      { upsert: true },
    );
  }

  /**
   * Authoritative recompute for one player and game from stored results.
   * Used for out-of-order submissions, reevaluations and backfills, where the
   * incremental path would produce the wrong answer.
   */
  async recomputeFromHistory(
    userId: string,
    username: string,
    gameType: string,
  ): Promise<void> {
    const todayPuzzleDay = this.currentPuzzleDayOrNull(gameType);
    if (todayPuzzleDay === null) return;

    const rows = await this.wordleResultModel
      .find({ userId, gameType })
      .select('puzzleDay')
      .lean();

    const stats = computeStreak(
      rows.map((r) => r.puzzleDay),
      todayPuzzleDay,
    );
    if (stats === null) return;

    await this.discordUserModel.findOneAndUpdate(
      { discordId: userId },
      { $set: { username, [`wordleStats.${gameType}`]: stats } },
      { upsert: true },
    );
  }

  /**
   * Recomputes every (player, game) pair present in the results collection.
   * Backs the offline repair script and the tail end of a backfill.
   *
   * Only touches game keys that actually have results — a stats entry for a
   * game whose results were all deleted is left alone rather than zeroed.
   */
  async recomputeAllFromHistory(
    gameType?: string,
  ): Promise<{ users: number; entries: number }> {
    const grouped = await this.wordleResultModel.aggregate<{
      _id: { userId: string; gameType: string };
      username: string;
      puzzleDays: number[];
    }>([
      ...(gameType ? [{ $match: { gameType } }] : []),
      { $sort: { puzzleDay: 1 } },
      {
        $group: {
          _id: { userId: '$userId', gameType: '$gameType' },
          username: { $last: '$username' },
          puzzleDays: { $push: '$puzzleDay' },
        },
      },
    ]);

    const todayByGame = new Map<string, number | null>();
    const updates = new Map<
      string,
      { username: string; set: Record<string, unknown> }
    >();

    for (const group of grouped) {
      const { userId, gameType: game } = group._id;

      if (!todayByGame.has(game)) {
        todayByGame.set(game, this.currentPuzzleDayOrNull(game));
      }
      const todayPuzzleDay = todayByGame.get(game)!;
      if (todayPuzzleDay === null) continue;

      const stats = computeStreak(group.puzzleDays, todayPuzzleDay);
      if (stats === null) continue;

      const entry = updates.get(userId) ?? {
        username: group.username,
        set: {},
      };
      entry.username = group.username;
      entry.set[`wordleStats.${game}`] = stats;
      updates.set(userId, entry);
    }

    if (updates.size === 0) return { users: 0, entries: 0 };

    const ops = [...updates].map(([discordId, { username, set }]) => ({
      updateOne: {
        filter: { discordId },
        update: { $set: { discordId, username, ...set } },
        upsert: true,
      },
    }));

    await this.discordUserModel.bulkWrite(ops);

    const entries = [...updates.values()].reduce(
      (sum, u) => sum + Object.keys(u.set).length,
      0,
    );
    return { users: updates.size, entries };
  }

  /**
   * Zeroes streaks that went stale through inaction since the last write.
   */
  async invalidateStale(gameType: string): Promise<number> {
    const todayPuzzleDay = this.currentPuzzleDayOrNull(gameType);
    if (todayPuzzleDay === null) return 0;

    const result = await this.discordUserModel.updateMany(
      {
        [`wordleStats.${gameType}.lastPuzzleDay`]: { $lt: todayPuzzleDay - 1 },
        [`wordleStats.${gameType}.currentStreak`]: { $ne: 0 },
      },
      { $set: { [`wordleStats.${gameType}.currentStreak`]: 0 } },
    );

    return result.modifiedCount;
  }

  isStale(lastPuzzleDay: number, gameType: string): boolean {
    const todayPuzzleDay = this.currentPuzzleDayOrNull(gameType);
    if (todayPuzzleDay === null) return false;
    return isStreakStale(lastPuzzleDay, todayPuzzleDay);
  }

  /**
   * Results can outlive their game definition (renamed or removed game types),
   * and getCurrentPuzzleDay throws for unknown ones. Skip those rather than
   * failing a whole recompute.
   */
  private currentPuzzleDayOrNull(gameType: string): number | null {
    try {
      return this.parser.getCurrentPuzzleDay(gameType);
    } catch {
      this.logger.warn(
        `No game definition for "${gameType}"; skipping streak computation`,
      );
      return null;
    }
  }
}
