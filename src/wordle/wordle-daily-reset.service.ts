import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WordleStreakInvalidatorService } from './wordle-streak-invalidator.service';
import { WordleChannelAccessService } from './wordle-channel-access.service';

/**
 * Owns the single midnight job so the daily tasks run in a defined order
 * rather than as independent crons firing at the same instant.
 */
@Injectable()
export class WordleDailyResetService {
  private readonly logger = new Logger(WordleDailyResetService.name);

  constructor(
    private readonly streakInvalidator: WordleStreakInvalidatorService,
    private readonly channelAccess: WordleChannelAccessService,
  ) {}

  @Cron('0 0 * * *', { timeZone: 'Europe/Bucharest' })
  async runDailyReset(): Promise<void> {
    this.logger.log('Running daily wordle reset');

    // Sequential and independently guarded: a failure in one step must not
    // skip the other.
    try {
      await this.streakInvalidator.invalidateOutdatedStreaks();
    } catch (error: unknown) {
      this.logger.error(`Streak invalidation failed: ${describe(error)}`);
    }

    try {
      // Nobody has posted for the new puzzle day yet, so this clears every
      // channel.
      await this.channelAccess.reconcileAll();
    } catch (error: unknown) {
      this.logger.error(`Channel reset failed: ${describe(error)}`);
    }

    this.logger.log('Daily wordle reset complete');
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
