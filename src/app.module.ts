import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CoreModule } from './core.module';
import { MentionResponderService } from './mention-responder.service';
import { KickPollModule } from './kick-poll/kick-poll.module';
import { WordleModule } from './wordle/wordle.module';
import { SlashCommandModule } from './slash-command/slash-command.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    CoreModule,
    KickPollModule,
    WordleModule,
    SlashCommandModule,
  ],
  controllers: [],
  providers: [MentionResponderService],
})
export class AppModule {}
