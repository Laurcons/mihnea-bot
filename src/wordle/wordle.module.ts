import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WordleResult,
  WordleResultSchema,
} from './models/wordle-result.schema';
import { DiscordUser, DiscordUserSchema } from './models/discord-user.schema';
import { WordleParserService } from './wordle-parser.service';
import { WordleTrackerService } from './wordle-tracker.service';
import { WordleStatsService } from './wordle-stats.service';
import { WordleStreakInvalidatorService } from './wordle-streak-invalidator.service';
import { WordleCommentaryService } from './wordle-commentary.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WordleResult.name, schema: WordleResultSchema },
      { name: DiscordUser.name, schema: DiscordUserSchema },
    ]),
  ],
  providers: [
    WordleParserService,
    WordleTrackerService,
    WordleStatsService,
    WordleStreakInvalidatorService,
    WordleCommentaryService,
  ],
  exports: [WordleStatsService],
})
export class WordleModule {}
