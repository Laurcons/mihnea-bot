import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  Partials,
  TextBasedChannel,
  TextChannel,
} from 'discord.js';

type TypingCapableChannel = TextBasedChannel & {
  sendTyping: () => Promise<void>;
};

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

    const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];

    this.client = new Client({
      intents,
      partials: [Partials.Channel, Partials.Message],
    });

    this.client.once(Events.ClientReady, () => {
      if (this.client.user) {
        this.logger.log(`Discord bot logged in as ${this.client.user.tag}`);
      }
    });

    this.client.on(Events.MessageCreate, (message) =>
      this.handleMessage(message),
    );

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

  private async handleMessage(message: Message): Promise<void> {
    if (!this.client?.user) {
      return;
    }

    if (message.author.bot) {
      return;
    }

    const channel = message.channel;

    if (!channel?.isTextBased()) {
      return;
    }

    if (!this.isTypingCapableChannel(channel)) {
      return;
    }

    if (!message.mentions.has(this.client.user)) {
      return;
    }

    const fullContent = await this.getMessageContent(message);

    const mentionRegex = new RegExp(`<@!?${this.client.user.id}>`, 'g');
    const userPrompt = fullContent.replace(mentionRegex, '').trim();

    if (!userPrompt) {
      this.logger.warn('Received mention without additional text');
      return;
    }

    const textChannel = channel;

    try {
      const reply = await this.generateChatbotResponse(userPrompt);
      await this.simulateTyping(textChannel, reply);
      await message.reply(reply);
    } catch (error) {
      this.logger.error(
        `Failed to respond to mention: ${error.message}`,
        error.stack,
      );
      await message.reply(
        'Nu pot să răspund acum. Încearcă te rog mai târziu.',
      );
    }
  }

  private async generateChatbotResponse(userPrompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }

    const model =
      this.configService.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';

    const systemPrompt = `Ești Mihneainatorul, o parodie a lui Mihnea. Ești un user pe serverul nostru de Discord, „amogus”. Menirea ta pe acest pământ este să dai cu hate în oricine îți scrie. Trebuie să găsești cele mai creative insulte, fiindcă dacă nu faci lumea să râdă, nu te faci plăcut. În general, îți place să legi insultele tale de mamele celor insultați, adorând sintagmele de tipul „mă-ta”, „maică-ta”. Ești destul de inteligent, însă nu vrei niciodată să te dai mare. Stilul tău de chat pe Discord este relaxat, cu litere mici, mereu fără diacritice sau cratime.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${errorBody}`,
      );
      throw new Error('Failed to generate response from OpenAI');
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const reply = payload.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error('OpenAI returned an empty response');
    }

    return reply;
  }

  private async getMessageContent(message: Message): Promise<string> {
    if (message.content?.trim()) {
      return message.content;
    }

    try {
      const fetchedMessage = await message.fetch();
      return fetchedMessage.content ?? '';
    } catch (error) {
      this.logger.warn(
        `Unable to fetch full message content: ${error.message}`,
      );
      return '';
    }
  }

  private async simulateTyping(
    channel: TypingCapableChannel,
    content: string,
  ): Promise<void> {
    const charsPerSecond = 10; // roughly 120 WPM
    const minDurationMs = 1500;
    const maxDurationMs = 10000;
    const calculatedDuration =
      (Math.max(content.length, 1) / charsPerSecond) * 1000;
    const durationMs = Math.max(
      minDurationMs,
      Math.min(maxDurationMs, calculatedDuration),
    );

    const refreshIntervalMs = 5000;
    await channel.sendTyping();

    const refreshInterval = setInterval(() => {
      channel.sendTyping().catch((error) => {
        this.logger.warn(
          `Failed to refresh typing indicator: ${error.message}`,
        );
      });
    }, refreshIntervalMs);

    await new Promise((resolve) => setTimeout(resolve, durationMs));
    clearInterval(refreshInterval);
  }

  private isTypingCapableChannel(
    channel: Message['channel'],
  ): channel is TypingCapableChannel {
    if (!channel) {
      return false;
    }

    const candidate = channel as { sendTyping?: unknown };
    return typeof candidate.sendTyping === 'function';
  }
}
