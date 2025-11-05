import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, GatewayIntentBits, TextChannel } from 'discord.js';

@Injectable()
export class DiscordBotService implements OnModuleInit {
  private readonly logger = new Logger(DiscordBotService.name);
  private client: Client;
  private readonly guildId: string;
  private readonly channelId: string;

  constructor(private configService: ConfigService) {
    const guildId = this.configService.get<string>('DISCORD_GUILD_ID');
    const channelId = this.configService.get<string>('DISCORD_CHANNEL_ID');

    if (!guildId) {
      throw new Error('DISCORD_GUILD_ID is required');
    }
    if (!channelId) {
      throw new Error('DISCORD_CHANNEL_ID is required');
    }

    this.guildId = guildId;
    this.channelId = channelId;
  }

  async onModuleInit() {
    const token = this.configService.get<string>('DISCORD_BOT_TOKEN');

    if (!token) {
      this.logger.error('DISCORD_BOT_TOKEN is not set');
      throw new Error('DISCORD_BOT_TOKEN is required');
    }

    if (!this.guildId) {
      this.logger.error('DISCORD_GUILD_ID is not set');
      throw new Error('DISCORD_GUILD_ID is required');
    }

    if (!this.channelId) {
      this.logger.error('DISCORD_CHANNEL_ID is not set');
      throw new Error('DISCORD_CHANNEL_ID is required');
    }

    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });

    this.client.once('clientReady', () => {
      if (this.client.user) {
        this.logger.log(`Discord bot logged in as ${this.client.user.tag}`);
      }
    });

    await this.client.login(token);
  }

  async sendDailyPoll(): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(this.guildId);
      const channel = (await guild.channels.fetch(
        this.channelId,
      )) as TextChannel;

      if (!channel) {
        this.logger.error(`Channel ${this.channelId} not found`);
        return;
      }

      // Send the announcement message
      await channel.send('Timpul pentru votul zilnic!');

      // Create and send the poll using Discord's native poll feature
      await channel.send({
        poll: {
          question: {
            text: 'il scoatem pe mihnea?',
          },
          answers: [{ text: 'da' }, { text: 'da' }],
          duration: 1, // 1 hour
          allowMultiselect: false,
        },
      });

      this.logger.log(
        `Daily poll sent successfully at ${new Date().toISOString()}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send daily poll: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.destroy();
      this.logger.log('Discord bot disconnected');
    }
  }
}
