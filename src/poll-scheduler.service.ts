import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PollService } from './poll.service';

@Injectable()
export class PollSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(PollSchedulerService.name);

  constructor(private readonly pollService: PollService) {}

  async onModuleInit() {
    // this.handleDailyPoll();
  }

  @Cron('0 18 * * *')
  async handleDailyPoll() {
    this.logger.log('Starting daily poll at 18:00');
    try {
      await this.pollService.sendDailyPoll();
    } catch (error) {
      this.logger.error(
        `Failed to execute daily poll: ${error.message}`,
        error.stack,
      );
    }
  }
}
