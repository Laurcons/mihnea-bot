import { Injectable, Logger } from '@nestjs/common';
import { WORDLE_GAME_TYPES } from './wordle-parser.service';
import { WordleStreakService } from './wordle-streak.service';

@Injectable()
export class WordleStreakInvalidatorService {
  private readonly logger = new Logger(WordleStreakInvalidatorService.name);

  constructor(private readonly streaks: WordleStreakService) {}

  /**
   * Scheduled by WordleDailyResetService rather than carrying its own @Cron,
   * so the daily jobs run in a defined order.
   */
  async invalidateOutdatedStreaks(): Promise<void> {
    this.logger.log('Running streak invalidation');

    for (const gameType of WORDLE_GAME_TYPES) {
      const modified = await this.streaks.invalidateStale(gameType);

      if (modified > 0) {
        this.logger.log(
          `Invalidated streaks for ${modified} user(s) in ${gameType}`,
        );
      }
    }
  }
}
