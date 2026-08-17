import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
  Message,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  Partials,
  TextChannel,
  User,
} from 'discord.js';
import { BotConfigService } from './bot-config.service';

type MessageHandler = (message: Message) => void;
type InteractionHandler = (interaction: Interaction) => void;
type ReactionHandler = (
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
) => void;

@Injectable()
export class DiscordClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordClientService.name);
  private readonly client: Client;
  private readonly ready: Promise<void>;
  private markReady!: () => void;

  constructor(private readonly botConfig: BotConfigService) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
      partials: [Partials.Channel, Partials.Message, Partials.Reaction],
    });

    this.ready = new Promise<void>((resolve) => {
      this.markReady = resolve;
    });
  }

  async onModuleInit(): Promise<void> {
    const token = this.botConfig.getDiscordBotToken();

    this.client.once(Events.ClientReady, () => {
      if (this.client.user) {
        this.logger.log(`Discord bot logged in as ${this.client.user.tag}`);
      }
      this.markReady();
    });

    await this.client.login(token);
  }

  /**
   * Resolves once the gateway is ready. login() resolving is not enough —
   * guild and channel caches are still empty at that point — so anything that
   * touches Discord at startup (rather than in response to a user) has to wait
   * on this.
   */
  async whenReady(timeoutMs = 60_000): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });

    try {
      return await Promise.race([this.ready.then(() => true), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.destroy();
    this.logger.log('Discord bot disconnected');
  }

  onMessage(handler: MessageHandler): void {
    this.client.on(Events.MessageCreate, handler);
  }

  onInteraction(handler: InteractionHandler): void {
    this.client.on(Events.InteractionCreate, handler);
  }

  onReactionAdd(handler: ReactionHandler): void {
    this.client.on(Events.MessageReactionAdd, handler);
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

    return channel;
  }
}
