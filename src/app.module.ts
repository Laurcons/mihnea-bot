import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BotConfigService } from './bot-config.service';
import { DiscordClientService } from './discord-client.service';
import { MentionResponderService } from './mention-responder.service';
import { PollSchedulerService } from './poll-scheduler.service';
import { PollService } from './poll.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [
    BotConfigService,
    DiscordClientService,
    MentionResponderService,
    PollService,
    PollSchedulerService,
  ],
})
export class AppModule {}
