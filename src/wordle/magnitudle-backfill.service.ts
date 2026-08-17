import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, TextChannel } from 'discord.js';
import dayjs from 'dayjs';
import { BotConfigService } from '../bot-config.service';
import { DiscordClientService } from '../discord-client.service';
import { WordleParserService } from './wordle-parser.service';
import { WordleStreakService } from './wordle-streak.service';
import { WordleResult } from './models/wordle-result.schema';
import { MigrationMarker } from './models/migration-marker.schema';

const MARKER_KEY = 'magnitudle-backfill-2026-07-20';
const GAME_TYPE = 'Magnitudle';

/** Bucharest-local start of the day to scan back to. */
const SCAN_SINCE = '2026-07-20 00:00';

/** Discord caps a fetch at 100; this bounds a runaway loop, not real history. */
const PAGE_SIZE = 100;
const MAX_PAGES = 100;

/**
 * One-off import of Magnitudle results posted before the game was supported.
 *
 * Deliberately does not reuse WordleTrackerService.handleMessage: that path
 * rejects anything that is not today's puzzle, reacts to every message (which
 * would spray hundreds of reactions over old messages and hit the reaction
 * rate limit), replies on failure, and can trigger AI commentary.
 */
@Injectable()
export class MagnitudleBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MagnitudleBackfillService.name);

  constructor(
    private readonly discordClient: DiscordClientService,
    private readonly botConfig: BotConfigService,
    private readonly parser: WordleParserService,
    private readonly streaks: WordleStreakService,
    @InjectModel(WordleResult.name)
    private readonly wordleResultModel: Model<WordleResult>,
    @InjectModel(MigrationMarker.name)
    private readonly markerModel: Model<MigrationMarker>,
  ) {}

  onApplicationBootstrap(): void {
    // Fire and forget: a history scan must not hold up the rest of startup.
    void this.run();
  }

  private async run(): Promise<void> {
    try {
      if (await this.markerModel.exists({ key: MARKER_KEY })) {
        this.logger.log(`Backfill "${MARKER_KEY}" already ran; skipping`);
        return;
      }

      const channelId = this.botConfig.getWordleChannelId();
      if (!channelId) {
        this.logger.warn(
          'No wordle channel configured; skipping Magnitudle backfill',
        );
        return;
      }

      if (!(await this.discordClient.whenReady())) {
        this.logger.error(
          'Discord client not ready in time; skipping Magnitudle backfill (will retry next boot)',
        );
        return;
      }

      const channel = await this.discordClient.fetchTextChannel(
        this.botConfig.getDiscordGuildId(),
        channelId,
      );
      if (!channel) {
        this.logger.error(
          'Could not resolve the wordle channel; skipping Magnitudle backfill',
        );
        return;
      }

      const summary = await this.backfill(channel);

      // Written last, so a crash mid-run re-runs rather than silently
      // leaving a half-finished import behind.
      await this.markerModel.create({ key: MARKER_KEY, note: summary });
      this.logger.log(`Magnitudle backfill complete. ${summary}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Magnitudle backfill failed: ${msg}`);
    }
  }

  private async backfill(channel: TextChannel): Promise<string> {
    const since = dayjs.tz(SCAN_SINCE, 'Europe/Bucharest').toDate();
    this.logger.log(
      `Scanning #${channel.name} for ${GAME_TYPE} results since ${since.toISOString()}`,
    );

    const messages = await this.fetchSince(channel, since);

    const docs = new Map<string, Record<string, unknown>>();
    for (const message of messages) {
      if (message.author.bot) continue;

      for (const result of this.parser.parse(
        message.content,
        message.createdAt,
      )) {
        if (result.gameType !== GAME_TYPE) continue;

        // Same user posting twice for one day collapses here, before it can
        // become a duplicate-key write.
        const key = `${message.author.id}:${result.puzzleDay}`;
        if (docs.has(key)) continue;

        docs.set(key, {
          username: message.author.username,
          loggedAt: message.createdAt,
          tries: result.tries,
          maxTries: result.maxTries,
          score: result.score,
          scoreMax: result.scoreMax,
          attempts: result.attempts,
        });
      }
    }

    if (docs.size === 0) {
      return `Scanned ${messages.length} message(s), found no ${GAME_TYPE} results.`;
    }

    const ops = [...docs].map(([key, doc]) => {
      const [userId, puzzleDay] = key.split(':');
      return {
        updateOne: {
          filter: {
            userId,
            gameType: GAME_TYPE,
            puzzleDay: Number(puzzleDay),
          },
          // Never overwrite a result that is already recorded.
          update: { $setOnInsert: doc },
          upsert: true,
        },
      };
    });

    const written = await this.wordleResultModel.bulkWrite(ops, {
      ordered: false,
    });

    const { users } = await this.streaks.recomputeAllFromHistory(GAME_TYPE);

    return (
      `Scanned ${messages.length} message(s), parsed ${docs.size} ${GAME_TYPE} result(s), ` +
      `inserted ${written.upsertedCount} new, updated streaks for ${users} user(s).`
    );
  }

  private async fetchSince(
    channel: TextChannel,
    since: Date,
  ): Promise<Message[]> {
    const collected: Message[] = [];
    let before: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await channel.messages.fetch({
        limit: PAGE_SIZE,
        before,
      });
      if (batch.size === 0) return collected;

      let reachedCutoff = false;
      for (const message of batch.values()) {
        if (message.createdAt < since) {
          reachedCutoff = true;
          continue;
        }
        collected.push(message);
      }

      if (reachedCutoff) return collected;
      before = batch.last()!.id;
    }

    this.logger.warn(
      `Stopped after ${MAX_PAGES} pages without reaching ${since.toISOString()}; ` +
        'the backfill may be incomplete',
    );
    return collected;
  }
}
