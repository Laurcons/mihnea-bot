import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { KickPollService } from './kick-poll.service';

@Injectable()
export class KickPollSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(KickPollSchedulerService.name);

  constructor(private readonly kickPollService: KickPollService) {}

  async onModuleInit() {
    // Uncomment to test on startup:
    // await this.handleDailyPoll();
  }

  @Cron('0 16 * * *')
  async handleDailyPoll() {
    this.logger.log('Starting daily kick poll at 18:00');
    try {
      await this.kickPollService.sendDailyPoll();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to execute daily poll: ${errorMessage}`, stack);
    }
  }

  @Cron('1 17 * * *')
  async handlePollResult() {
    this.logger.log('Processing poll result at 19:00');
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
