import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WordleParserService } from './wordle-parser.service';
import { WordleTrackerService } from './wordle-tracker.service';
import { WordleStatsService } from './wordle-stats.service';

@Module({
  imports: [PrismaModule],
  providers: [WordleParserService, WordleTrackerService, WordleStatsService],
  exports: [WordleStatsService],
})
export class WordleModule {}
