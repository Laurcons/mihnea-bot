import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DiscordUser } from './models/discord-user.schema';

export interface PlayerStreak {
  username: string;
  currentStreak: number;
  biggestStreak: number;
}

@Injectable()
export class WordleStatsService {
  constructor(
    @InjectModel(DiscordUser.name)
    private readonly discordUserModel: Model<DiscordUser>,
  ) {}

  async getStreaks(gameType: string): Promise<PlayerStreak[]> {
    const key = `wordleStats.${gameType}`;
    const users = await this.discordUserModel
      .find({ [key]: { $exists: true } })
      .select(`username ${key}`)
      .lean();

    return users
      .map((u) => {
        const stats = (
          u.wordleStats as unknown as Record<
            string,
            { currentStreak: number; biggestStreak: number }
          >
        )[gameType];
        return {
          username: u.username,
          currentStreak: stats.currentStreak,
          biggestStreak: stats.biggestStreak,
        };
      })
      .filter((u) => u.currentStreak > 0)
      .sort((a, b) => b.currentStreak - a.currentStreak);
  }
}
