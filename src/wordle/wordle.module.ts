import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WordleResult, WordleResultSchema } from './wordle-result.schema';
import { WordleParserService } from './wordle-parser.service';
import { WordleTrackerService } from './wordle-tracker.service';
import { WordleStatsService } from './wordle-stats.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WordleResult.name, schema: WordleResultSchema },
    ]),
  ],
  providers: [WordleParserService, WordleTrackerService, WordleStatsService],
  exports: [WordleStatsService],
})
export class WordleModule {}
