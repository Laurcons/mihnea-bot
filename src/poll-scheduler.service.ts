import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DiscordBotService } from './discord-bot.service';

@Injectable()
export class PollSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(PollSchedulerService.name);

  constructor(private readonly discordBotService: DiscordBotService) {}

  async onModuleInit() {
    // this.handleDailyPoll();
  }

  // Run every day at 12:00
  @Cron('0 12 * * *')
  async handleDailyPoll() {
    this.logger.log('Starting daily poll at 12:00');
    try {
      await this.discordBotService.sendDailyPoll();
    } catch (error) {
      this.logger.error(
        `Failed to execute daily poll: ${error.message}`,
        error.stack,
      );
    }
  }
}
