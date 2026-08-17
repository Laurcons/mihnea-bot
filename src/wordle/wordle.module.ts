import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WordleResult,
  WordleResultSchema,
} from './models/wordle-result.schema';
import { DiscordUser, DiscordUserSchema } from './models/discord-user.schema';
import {
  MigrationMarker,
  MigrationMarkerSchema,
} from './models/migration-marker.schema';
import { WordleBackfillService } from './wordle-backfill.service';
import { WordleParserService } from './wordle-parser.service';
import { WordleTrackerService } from './wordle-tracker.service';
import { WordleStatsService } from './wordle-stats.service';
import { WordleStreakInvalidatorService } from './wordle-streak-invalidator.service';
import { WordleStreakService } from './wordle-streak.service';
import { WordleCommentaryService } from './wordle-commentary.service';
import { WordleChannelAccessService } from './wordle-channel-access.service';
import { WordleDailyResetService } from './wordle-daily-reset.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WordleResult.name, schema: WordleResultSchema },
      { name: DiscordUser.name, schema: DiscordUserSchema },
      { name: MigrationMarker.name, schema: MigrationMarkerSchema },
    ]),
  ],
  providers: [
    WordleParserService,
    WordleTrackerService,
    WordleStatsService,
    WordleStreakService,
    WordleStreakInvalidatorService,
    WordleCommentaryService,
    WordleChannelAccessService,
    WordleDailyResetService,
    WordleBackfillService,
  ],
  exports: [WordleStatsService, WordleTrackerService],
})
export class WordleModule {}
