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

interface BackfillSpec {
  /** Marker key. Never change one after it has run, or the import repeats. */
  key: string;
  gameType: string;
  /** Bucharest-local start of the day to scan back to. */
  since: string;
}

/**
 * Adding a game late means its earlier results were never recorded. Each entry
 * imports one game's history once; the marker keeps it from repeating.
 */
const BACKFILLS: BackfillSpec[] = [
  {
    key: 'magnitudle-backfill-2026-07-20',
    gameType: 'Magnitudle',
    since: '2026-07-20 00:00',
  },
  {
    key: 'angle-backfill-2026-07-17',
    gameType: 'Angle',
    since: '2026-07-17 00:00',
  },
];

/** Discord caps a fetch at 100; this bounds a runaway loop, not real history. */
const PAGE_SIZE = 100;
const MAX_PAGES = 100;

/**
 * One-off imports of results posted before their game was supported.
 *
 * Deliberately does not reuse WordleTrackerService.handleMessage: that path
 * rejects anything that is not today's puzzle, reacts to every message (which
 * would spray hundreds of reactions over old messages and hit the reaction
 * rate limit), replies on failure, and can trigger AI commentary.
 */
@Injectable()
export class WordleBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WordleBackfillService.name);

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
      const pending: BackfillSpec[] = [];
      for (const spec of BACKFILLS) {
        if (await this.markerModel.exists({ key: spec.key })) continue;
        pending.push(spec);
      }

      if (pending.length === 0) return;

      this.logger.log(
        `Pending backfills: ${pending.map((s) => s.gameType).join(', ')}`,
      );

      const channelId = this.botConfig.getWordleChannelId();
      if (!channelId) {
        this.logger.warn('No wordle channel configured; skipping backfills');
        return;
      }

      if (!(await this.discordClient.whenReady())) {
        this.logger.error(
          'Discord client not ready in time; skipping backfills (will retry next boot)',
        );
        return;
      }

      const channel = await this.discordClient.fetchTextChannel(
        this.botConfig.getDiscordGuildId(),
        channelId,
      );
      if (!channel) {
        this.logger.error(
          'Could not resolve the wordle channel; skipping backfills',
        );
        return;
      }

      // One pass over history covering every pending window, rather than
      // re-reading the channel once per game.
      const cutoffs = pending.map((spec) => this.cutoff(spec.since));
      const earliest = new Date(Math.min(...cutoffs.map((d) => d.getTime())));

      this.logger.log(
        `Scanning #${channel.name} back to ${earliest.toISOString()}`,
      );
      const messages = await this.fetchSince(channel, earliest);
      this.logger.log(`Fetched ${messages.length} message(s)`);

      for (const spec of pending) {
        await this.applyOne(spec, messages);
      }
    } catch (error: unknown) {
      this.logger.error(`Wordle backfill failed: ${describe(error)}`);
    }
  }

  private async applyOne(
    spec: BackfillSpec,
    messages: Message[],
  ): Promise<void> {
    try {
      const since = this.cutoff(spec.since);
      const docs = new Map<string, Record<string, unknown>>();

      for (const message of messages) {
        if (message.author.bot) continue;
        if (message.createdAt < since) continue;

        for (const result of this.parser.parse(
          message.content,
          message.createdAt,
        )) {
          if (result.gameType !== spec.gameType) continue;

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

      let summary: string;
      if (docs.size === 0) {
        summary = `Found no ${spec.gameType} results.`;
      } else {
        const ops = [...docs].map(([key, doc]) => {
          const [userId, puzzleDay] = key.split(':');
          return {
            updateOne: {
              filter: {
                userId,
                gameType: spec.gameType,
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
        const { users } = await this.streaks.recomputeAllFromHistory(
          spec.gameType,
        );

        summary =
          `Parsed ${docs.size} ${spec.gameType} result(s), ` +
          `inserted ${written.upsertedCount} new, updated streaks for ${users} user(s).`;
      }

      // Written last, so a crash mid-run re-runs rather than silently leaving
      // a half-finished import behind.
      await this.markerModel.create({ key: spec.key, note: summary });
      this.logger.log(`${spec.gameType} backfill complete. ${summary}`);
    } catch (error: unknown) {
      // One game failing must not abandon the others.
      this.logger.error(`${spec.gameType} backfill failed: ${describe(error)}`);
    }
  }

  private cutoff(since: string): Date {
    return dayjs.tz(since, 'Europe/Bucharest').toDate();
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

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
