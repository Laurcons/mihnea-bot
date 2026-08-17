import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message } from 'discord.js';
import { BotConfigService } from '../bot-config.service';
import { DiscordClientService } from '../discord-client.service';
import { WordleParserService } from './wordle-parser.service';
import { ParsedWordleResult } from './types/wordle.types';
import { WordleResult } from './models/wordle-result.schema';
import { WordleCommentaryService } from './wordle-commentary.service';
import { WordleStreakService } from './wordle-streak.service';
import { WordleChannelAccessService } from './wordle-channel-access.service';

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
    private readonly streaks: WordleStreakService,
    private readonly channelAccess: WordleChannelAccessService,
    @InjectModel(WordleResult.name)
    private readonly wordleResultModel: Model<WordleResult>,
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

    const results = this.parser.parse(message.content, message.createdAt);
    if (results.length === 0) {
      if (this.parser.looksLikeUnparsedResult(message.content)) {
        this.logger.warn(
          `Message looks like a result but parsed to nothing, from ` +
            `${message.author.username} (messageId=${message.id}):\n${message.content}`,
        );
      }
      return;
    }

    const failures: string[] = [];
    const successfulResults: ParsedWordleResult[] = [];

    for (const result of results) {
      const outcome =
        result.score !== null
          ? `score=${result.score}/${result.scoreMax}`
          : `tries=${result.tries ?? 'X'}/${result.maxTries}`;
      this.logger.log(
        `Parsed ${result.gameType} #${result.puzzleDay} from ${message.author.username} ` +
          `(${outcome}, attempts=${result.attempts.length})`,
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
      const shouldReply = Math.random() < 0.01;
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

  async reevaluateMessage(messageId: string): Promise<string> {
    const channel = await this.discordClient.fetchTextChannel(
      this.botConfig.getDiscordGuildId(),
      this.wordleChannelId,
    );
    if (!channel) return '❌ Nu am găsit canalul de wordle.';

    let message: Message;
    try {
      message = await channel.messages.fetch(messageId);
    } catch {
      return '❌ Nu am găsit mesajul cu ID-ul dat.';
    }

    const results = this.parser.parse(message.content, message.createdAt);
    if (results.length === 0)
      return '❌ Nu am găsit niciun rezultat wordle în mesaj.';

    const lines: string[] = [];
    for (const result of results) {
      if (
        !this.botConfig.getIsWordlePuzzleDayIgnored() &&
        !this.parser.isCurrentPuzzle(result.gameType, result.puzzleDay)
      ) {
        lines.push(
          `⚠️ **${result.gameType} #${result.puzzleDay}**: nu îi puzzleul zilei`,
        );
        continue;
      }

      await this.wordleResultModel.deleteOne({
        userId: message.author.id,
        gameType: result.gameType,
        puzzleDay: result.puzzleDay,
      });

      const error = await this.saveResult(message, result);
      if (error) {
        lines.push(`❌ **${result.gameType} #${result.puzzleDay}**: ${error}`);
      } else {
        lines.push(
          `✅ **${result.gameType} #${result.puzzleDay}**: reevaluat cu succes`,
        );
      }
    }

    return lines.join('\n');
  }

  private async saveResult(
    message: Message,
    result: ParsedWordleResult,
  ): Promise<string | null> {
    const { id: userId, username } = message.author;

    // Storing the result and reacting to it are the only things that decide
    // what the user is told. Everything after is post-processing: it must be
    // logged loudly but must never claim the result was lost, because it
    // wasn't. Conflating the two is how a streak-update crash once told users
    // their result had failed while it sat safely in the database.
    try {
      await this.wordleResultModel.create({
        userId,
        username,
        loggedAt: message.createdAt,
        gameType: result.gameType,
        puzzleDay: result.puzzleDay,
        tries: result.tries,
        maxTries: result.maxTries,
        score: result.score,
        scoreMax: result.scoreMax,
        attempts: result.attempts,
      });
    } catch (error: unknown) {
      if (isMongooseDuplicateKeyError(error)) {
        this.logger.warn(
          `Duplicate result ignored: userId=${userId} gameType=${result.gameType} day=${result.puzzleDay}`,
        );
        await this.react(message, '👎');
        return 'ai trimis deja rezultatu aista';
      }

      this.logger.error(
        `Failed to save wordle result: ${describeError(error)} ` +
          `(userId=${userId} gameType=${result.gameType} day=${result.puzzleDay})`,
      );
      await this.react(message, '😵');
      return 'mi-o crepat mațu, zi-i lu bubu să vie';
    }

    this.logger.log(
      `Saved result: userId=${userId} gameType=${result.gameType} day=${result.puzzleDay}`,
    );

    try {
      const todayPuzzleDay = this.parser.getCurrentPuzzleDay(result.gameType);

      if (result.puzzleDay !== todayPuzzleDay) {
        await this.streaks.recomputeFromHistory(
          userId,
          username,
          result.gameType,
        );
      } else {
        await this.streaks.recordResult(
          userId,
          username,
          result.gameType,
          result.puzzleDay,
        );

        // Only today's puzzle unlocks the discussion channel. A late
        // submission for yesterday still counts for the streak but must not
        // grant access.
        void this.channelAccess.grant(userId, result.gameType);
      }
    } catch (error: unknown) {
      this.logger.error(
        `Result stored but post-processing failed: ${describeError(error)} ` +
          `(userId=${userId} gameType=${result.gameType} day=${result.puzzleDay}). ` +
          'Streaks can be rebuilt with: npm run repair:streaks',
      );
    }

    await this.react(message, '✅');
    return null;
  }

  /** A reaction failing must never be mistaken for the result failing. */
  private async react(message: Message, emoji: string): Promise<void> {
    try {
      await message.react(emoji);
    } catch (error: unknown) {
      this.logger.warn(
        `Could not react with ${emoji}: ${describeError(error)}`,
      );
    }
  }
}
