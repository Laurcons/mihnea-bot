import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PlayerStreak {
  username: string;
  streak: number;
}

@Injectable()
export class WordleStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStreaks(gameType: string): Promise<PlayerStreak[]> {
    const results = await this.prisma.wordleResult.findMany({
      where: { gameType },
      select: { userId: true, username: true, puzzleDay: true },
      orderBy: { puzzleDay: 'asc' },
    });

    const byUser = new Map<string, { username: string; days: number[] }>();
    for (const r of results) {
      if (!byUser.has(r.userId)) {
        byUser.set(r.userId, { username: r.username, days: [] });
      }
      byUser.get(r.userId)!.days.push(r.puzzleDay);
    }

    const streaks: PlayerStreak[] = [];
    for (const { username, days } of byUser.values()) {
      // days is sorted ascending; walk backwards from the last entry
      let streak = 1;
      for (let i = days.length - 1; i > 0; i--) {
        if (days[i] - days[i - 1] === 1) {
          streak++;
        } else {
          break;
        }
      }
      streaks.push({ username, streak });
    }

    streaks.sort((a, b) => b.streak - a.streak);
    return streaks;
  }
}
