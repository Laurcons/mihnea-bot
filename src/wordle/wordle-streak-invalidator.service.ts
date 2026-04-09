import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DiscordUser } from './discord-user.schema';
import {
  WordleParserService,
  WORDLE_GAME_TYPES,
} from './wordle-parser.service';

@Injectable()
export class WordleStreakInvalidatorService {
  private readonly logger = new Logger(WordleStreakInvalidatorService.name);

  constructor(
    @InjectModel(DiscordUser.name)
    private readonly discordUserModel: Model<DiscordUser>,
    private readonly parser: WordleParserService,
  ) {}

  @Cron('0 0 * * *', { timeZone: 'Europe/Bucharest' })
  async invalidateOutdatedStreaks(): Promise<void> {
    this.logger.log('Running streak invalidation cron job');

    for (const gameType of WORDLE_GAME_TYPES) {
      const currentDay = this.parser.getCurrentPuzzleDay(gameType);
      const yesterday = currentDay - 1;

      const result = await this.discordUserModel.updateMany(
        { [`wordleStats.${gameType}.lastPuzzleDay`]: { $lt: yesterday } },
        { $set: { [`wordleStats.${gameType}.currentStreak`]: 0 } },
      );

      if (result.modifiedCount > 0) {
        this.logger.log(
          `Invalidated streaks for ${result.modifiedCount} user(s) in ${gameType}`,
        );
      }
    }
  }
}
