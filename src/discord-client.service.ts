import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Message,
  Partials,
  TextChannel,
} from 'discord.js';
import { BotConfigService } from './bot-config.service';

type MessageHandler = (message: Message) => void;

@Injectable()
export class DiscordClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordClientService.name);
  private readonly client: Client;

  constructor(private readonly botConfig: BotConfigService) {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      partials: [Partials.Channel, Partials.Message],
    });
  }

  async onModuleInit(): Promise<void> {
    const token = this.botConfig.getDiscordBotToken();

    this.client.once(Events.ClientReady, () => {
      if (this.client.user) {
        this.logger.log(`Discord bot logged in as ${this.client.user.tag}`);
      }
    });

    await this.client.login(token);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.destroy();
    this.logger.log('Discord bot disconnected');
  }

  onMessage(handler: MessageHandler): void {
    this.client.on(Events.MessageCreate, handler);
  }

  getClient(): Client {
    return this.client;
  }

  async fetchTextChannel(
    guildId: string,
    channelId: string,
  ): Promise<TextChannel | null> {
    const guild = await this.client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      return null;
    }

    return channel as TextChannel;
  }

}
