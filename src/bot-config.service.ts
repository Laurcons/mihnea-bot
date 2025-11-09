import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BotConfigService {
  private readonly logger = new Logger(BotConfigService.name);

  constructor(private readonly configService: ConfigService) {}

  getDiscordBotToken(): string {
    return this.getRequired('DISCORD_BOT_TOKEN');
  }

  getDiscordGuildId(): string {
    return this.getRequired('DISCORD_GUILD_ID');
  }

  getDiscordChannelId(): string {
    return this.getRequired('DISCORD_CHANNEL_ID');
  }

  getOpenAIApiKey(): string {
    return this.getRequired('OPENAI_API_KEY');
  }

  getOpenAIModel(): string {
    return this.configService.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
  }

  getBlacklistedChannelIds(): string[] {
    const raw = this.configService.get<string>('DISCORD_BLACKLISTED_CHANNEL_IDS');

    if (!raw) {
      return [];
    }

    return raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  getBotAllowedChannelIds(): string[] {
    const raw = this.configService.get<string>(
      'DISCORD_ALLOWED_BOT_CHANNEL_IDS',
    );

    if (!raw) {
      return [];
    }

    return raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private getRequired(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      this.logger.error(`${key} is not set`);
      throw new Error(`${key} is required`);
    }

    return value;
  }
}
