import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message } from 'discord.js';
import { BotConfigService } from '../bot-config.service';
import { DiscordClientService } from '../discord-client.service';
import { WordleParserService } from './wordle-parser.service';
import { ParsedWordleResult } from './types/wordle.types';
import { WordleResult } from './models/wordle-result.schema';
import { DiscordUser } from './models/discord-user.schema';
import { WordleCommentaryService } from './wordle-commentary.service';

function isMongooseDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: number }).code === 11000
  );
}

@Injectable()
export class WordleTrackerService implements OnModuleInit {
  private readonly logger = new Logger(WordleTrackerService.name);
  private wordleChannelId: string = '';

  constructor(
    private readonly discordClient: DiscordClientService,
    private readonly botConfig: BotConfigService,
    private readonly parser: WordleParserService,
    private readonly commentary: WordleCommentaryService,
    @InjectModel(WordleResult.name)
    private readonly wordleResultModel: Model<WordleResult>,
    @InjectModel(DiscordUser.name)
    private readonly discordUserModel: Model<DiscordUser>,
  ) {}

  onModuleInit(): void {
    const cid = this.botConfig.getWordleChannelId();
    if (!cid) return;
    this.wordleChannelId = cid;
    this.discordClient.onMessage((message) => void this.handleMessage(message));
  }

  private async handleMessage(message: Message): Promise<void> {
    if (message.author.bot) return;
    if (message.channelId !== this.wordleChannelId) return;

    const results = this.parser.parse(message.content);
    if (results.length === 0) return;

    const failures: string[] = [];
    const successfulResults: ParsedWordleResult[] = [];

    for (const result of results) {
      this.logger.log(
        `Parsed ${result.gameType} #${result.puzzleDay} from ${message.author.username} ` +
          `(tries=${result.tries ?? 'X'}/${result.maxTries}, attempts=${result.attempts.length})`,
      );

      if (
        !this.botConfig.getIsWordlePuzzleDayIgnored() &&
        !this.parser.isCurrentPuzzle(result.gameType, result.puzzleDay)
      ) {
        this.logger.warn(
          `Rejected out-of-range puzzle: ${result.gameType} #${result.puzzleDay} from ${message.author.username}`,
        );
        failures.push(
          `**${result.gameType} #${result.puzzleDay}**: nu îi puzzleul zilei`,
        );
        continue;
      }

      const error = await this.saveResult(message, result);
      if (error !== null) {
        failures.push(`**${result.gameType} #${result.puzzleDay}**: ${error}`);
      } else {
        successfulResults.push(result);
      }
    }

    if (successfulResults.length > 0) {
      const chosen =
        successfulResults[Math.floor(Math.random() * successfulResults.length)];
      const shouldReply = Math.random() < 0.1;
      if (shouldReply) {
        void this.commentary.generateAndSendCommentary(message, chosen);
      }
    }

    if (failures.length > 0) {
      if (results.length === 1) {
        await message.reply(`ceva nu-i bine la rezultatu tău.\n${failures[0]}`);
      } else {
        await message.reply(
          `ceva nu-i bine la câteva rezultate:\n${failures.map((f) => `- ${f}`).join('\n')}`,
        );
      }
    }
  }

  private async upsertUserStreak(
    userId: string,
    username: string,
    gameType: string,
    puzzleDay: number,
  ): Promise<void> {
    const sp = `wordleStats.${gameType}`;
    await this.discordUserModel.findOneAndUpdate(
      { discordId: userId },
      [
        {
          $set: {
            username,
            [sp]: {
              lastPuzzleDay: puzzleDay,
              currentStreak: {
                $cond: [
                  { $eq: [`$${sp}.lastPuzzleDay`, puzzleDay - 1] },
                  { $add: [{ $ifNull: [`$${sp}.currentStreak`, 0] }, 1] },
                  1,
                ],
              },
              biggestStreak: {
                $max: [
                  { $ifNull: [`$${sp}.biggestStreak`, 0] },
                  {
                    $cond: [
                      { $eq: [`$${sp}.lastPuzzleDay`, puzzleDay - 1] },
                      { $add: [{ $ifNull: [`$${sp}.currentStreak`, 0] }, 1] },
                      1,
                    ],
                  },
                ],
              },
            },
          },
        },
      ],
      { upsert: true, updatePipeline: true },
    );
  }

  private async recalculateStreakFromHistory(
    userId: string,
    username: string,
    gameType: string,
  ): Promise<void> {
    const cursor = this.wordleResultModel
      .find({ userId, gameType })
      .sort({ puzzleDay: -1 })
      .cursor({ batchSize: 10 });

    let currentStreak = 0;
    let lastPuzzleDay: number | null = null;
    let prevPuzzleDay: number | null = null;

    try {
      for await (const result of cursor) {
        if (lastPuzzleDay === null) {
          lastPuzzleDay = result.puzzleDay;
          prevPuzzleDay = result.puzzleDay;
          currentStreak = 1;
        } else if (result.puzzleDay === prevPuzzleDay! - 1) {
          currentStreak++;
          prevPuzzleDay = result.puzzleDay;
        } else {
          break;
        }
      }
    } finally {
      await cursor.close();
    }

    if (lastPuzzleDay === null) return;

    const sp = `wordleStats.${gameType}`;
    await this.discordUserModel.findOneAndUpdate(
      { discordId: userId },
      [
        {
          $set: {
            username,
            [sp]: {
              lastPuzzleDay,
              currentStreak,
              biggestStreak: {
                $max: [{ $ifNull: [`$${sp}.biggestStreak`, 0] }, currentStreak],
              },
            },
          },
        },
      ],
      { upsert: true },
    );
  }

  private async saveResult(
    message: Message,
    result: ParsedWordleResult,
  ): Promise<string | null> {
    const { id: userId, username } = message.author;

    try {
      await this.wordleResultModel.create({
        userId,
        username,
        loggedAt: new Date(),
        gameType: result.gameType,
        puzzleDay: result.puzzleDay,
        tries: result.tries,
        maxTries: result.maxTries,
        attempts: result.attempts,
      });

      this.logger.log(
        `Saved result: userId=${userId} gameType=${result.gameType} day=${result.puzzleDay}`,
      );

      const todayPuzzleDay = this.parser.getCurrentPuzzleDay(result.gameType);

      if (result.puzzleDay !== todayPuzzleDay) {
        await this.recalculateStreakFromHistory(
          userId,
          username,
          result.gameType,
        );
      } else {
        await this.upsertUserStreak(
          userId,
          username,
          result.gameType,
          result.puzzleDay,
        );
      }
      await message.react('✅');
      return null;
    } catch (error: unknown) {
      if (isMongooseDuplicateKeyError(error)) {
        this.logger.warn(
          `Duplicate result ignored: userId=${userId} gameType=${result.gameType} day=${result.puzzleDay}`,
        );
        await message.react('👎');
        return 'ai trimis deja rezultatu aista';
      } else {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to save wordle result: ${msg}`);
        await message.react('😵');
        return 'mi-o crepat mațu, zi-i lu bubu să vie';
      }
    }
  }
}
