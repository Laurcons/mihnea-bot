import { Module } from '@nestjs/common';
import { KickPollDataService } from './kick-poll-data.service';
import { KickPollAiService } from './kick-poll-ai.service';
import { KickPollService } from './kick-poll.service';
import { KickPollSchedulerService } from './kick-poll-scheduler.service';
import { KickExecutorService } from './kick-executor.service';

@Module({
  providers: [
    KickPollDataService,
    KickPollAiService,
    KickPollService,
    KickPollSchedulerService,
    KickExecutorService,
  ],
  exports: [KickPollService, KickPollDataService],
})
export class KickPollModule {}
