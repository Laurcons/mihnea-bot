import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { KickPollService } from './kick-poll.service';
import { BotConfigService } from '../bot-config.service';

/**
 * The daily kick vote is retired. Rather than commenting the schedules out —
 * where they rotted unreviewed, still carrying UTC-only crons that drifted an
 * hour every summer — they stay live and are gated on KICK_POLL_ENABLED,
 * which defaults to false. Re-enabling is an env change, not archaeology.
 */
@Injectable()
export class KickPollSchedulerService {
  private readonly logger = new Logger(KickPollSchedulerService.name);

  constructor(
    private readonly kickPollService: KickPollService,
    private readonly botConfig: BotConfigService,
  ) {}

  @Cron('0 18 * * *', { timeZone: 'Europe/Bucharest' })
  async handleDailyPoll(): Promise<void> {
    if (!this.botConfig.getIsKickPollEnabled()) return;

    this.logger.log('Starting daily kick poll');
    try {
      await this.kickPollService.sendDailyPoll();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to execute daily poll: ${errorMessage}`, stack);
    }
  }

  // A minute after the poll's one-hour duration expires, so the last votes are
  // counted. The original schedule had the same offset.
  @Cron('1 19 * * *', { timeZone: 'Europe/Bucharest' })
  async handlePollResult(): Promise<void> {
    if (!this.botConfig.getIsKickPollEnabled()) return;

    this.logger.log('Processing kick poll result');
    try {
      await this.kickPollService.processPollResult();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to process poll result: ${errorMessage}`,
        stack,
      );
    }
  }
}
