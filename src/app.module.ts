import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CoreModule } from './core.module';
import { MentionResponderService } from './mention-responder.service';
import { KickPollModule } from './kick-poll/kick-poll.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    CoreModule,
    KickPollModule,
  ],
  controllers: [],
  providers: [MentionResponderService],
})
export class AppModule {}
