import { Module } from '@nestjs/common';
import { KickPollModule } from '../kick-poll/kick-poll.module';
import { WordleModule } from '../wordle/wordle.module';
import { SlashCommandService } from './slash-command.service';

@Module({
  imports: [KickPollModule, WordleModule],
  providers: [SlashCommandService],
})
export class SlashCommandModule {}
