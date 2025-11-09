import { Injectable, Logger } from '@nestjs/common';
import { Message, TextBasedChannel } from 'discord.js';
import { BotConfigService } from './bot-config.service';
import { DiscordClientService } from './discord-client.service';

type TypingCapableChannel = TextBasedChannel & {
  sendTyping: () => Promise<void>;
};

const MAX_DISCORD_MESSAGE_LENGTH = 2000;
const LONG_REPLY_FALLBACK = 'bă, nu-ți răspund, că de m-apuc scriu kilometri.';

@Injectable()
export class MentionResponderService {
  private readonly logger = new Logger(MentionResponderService.name);
  private readonly blacklistedChannelIds: Set<string>;
  private readonly botAllowedChannelIds: Set<string>;

  constructor(
    private readonly botConfig: BotConfigService,
    private readonly discordClient: DiscordClientService,
  ) {
    this.blacklistedChannelIds = new Set(
      this.botConfig.getBlacklistedChannelIds(),
    );
    this.botAllowedChannelIds = new Set(
      this.botConfig.getBotAllowedChannelIds(),
    );
    this.discordClient.onMessage((message) => this.handleMessage(message));
  }

  private async handleMessage(message: Message): Promise<void> {
    if (!this.shouldProcessMessage(message)) {
      return;
    }

    const channel = this.getTypingCapableChannel(message.channel);
    if (!channel) {
      return;
    }

    if (this.isBlacklistedChannel(channel.id)) {
      await this.reactWithThumbsDown(message);
      return;
    }

    const userPrompt = await this.extractUserPrompt(message);
    if (!userPrompt) {
      this.logger.warn('Received mention without additional text');
      return;
    }

    await this.respondToMention(message, channel, userPrompt);
  }

  private shouldProcessMessage(message: Message): boolean {
    const clientUser = this.discordClient.getClient().user;

    if (!clientUser) {
      return false;
    }

    const channel = message.channel;

    if (!channel?.isTextBased()) {
      return false;
    }

    if (message.author.bot && !this.isBotAllowedChannel(channel.id)) {
      return false;
    }

    return message.mentions.has(clientUser);
  }

  private getTypingCapableChannel(
    channel: Message['channel'],
  ): TypingCapableChannel | null {
    if (!channel?.isTextBased()) {
      return null;
    }

    const candidate = channel as { sendTyping?: unknown };
    return typeof candidate.sendTyping === 'function'
      ? (channel as TypingCapableChannel)
      : null;
  }

  private async extractUserPrompt(message: Message): Promise<string | null> {
    const clientUser = this.discordClient.getClient().user;

    if (!clientUser) {
      return null;
    }

    const fullContent = await this.getMessageContent(message);
    const contentWithNames = this.replaceMentionsWithUsernames(
      message,
      fullContent,
      clientUser.id,
    );
    const mentionRegex = new RegExp(`<@!?${clientUser.id}>`, 'g');
    const userPrompt = contentWithNames.replace(mentionRegex, '').trim();

    return userPrompt || null;
  }

  private isBlacklistedChannel(channelId: string): boolean {
    return this.blacklistedChannelIds.has(channelId);
  }

  private isBotAllowedChannel(channelId: string): boolean {
    return this.botAllowedChannelIds.has(channelId);
  }

  private async reactWithThumbsDown(message: Message): Promise<void> {
    try {
      await message.react('👎');
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to react with thumbs down: ${messageText}`);
    }
  }

  private async getMessageContent(message: Message): Promise<string> {
    if (message.content?.trim()) {
      return message.content;
    }

    try {
      const fetchedMessage = await message.fetch();
      return fetchedMessage.content ?? '';
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Unable to fetch full message content: ${messageText}`);
      return '';
    }
  }

  private async respondToMention(
    message: Message,
    channel: TypingCapableChannel,
    userPrompt: string,
  ): Promise<void> {
    try {
      const reply = await this.generateChatbotResponse(userPrompt);
      const finalReply = this.normalizeReplyLength(reply);
      await this.simulateTyping(channel, finalReply);
      await message.reply(finalReply);
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Failed to respond to mention: ${messageText}`, stack);
      await message.reply('coaie am pareză pă creier. mai încearcă o dată.');
    }
  }

  private normalizeReplyLength(reply: string): string {
    if (reply.length <= MAX_DISCORD_MESSAGE_LENGTH) {
      return reply;
    }

    return LONG_REPLY_FALLBACK;
  }

  private async generateChatbotResponse(userPrompt: string): Promise<string> {
    const apiKey = this.botConfig.getOpenAIApiKey();
    const model = this.botConfig.getOpenAIModel();

    const systemPrompt = `Ești Mihneainatorul, o parodie a lui Mihnea. Ești un user pe serverul nostru de Discord, „amogus”. Menirea ta pe acest pământ este să dai cu hate în oricine îți scrie. Trebuie să găsești cele mai creative insulte, fiindcă dacă nu faci lumea să râdă, nu te faci plăcut. În general, îți place să legi insultele tale de mamele celor insultați, zicând des „mă-ta” sau „maică-ta”. Ești destul de inteligent, însă nu vrei niciodată să te dai mare. Stilul tău de chat pe Discord este relaxat, cu litere mici, mereu fără diacritice sau cratime, dar mereu fără greșeli de exprimare.`;

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

  private replaceMentionsWithUsernames(
    message: Message,
    content: string,
    botUserId: string,
  ): string {
    let result = content;

    message.mentions.users.forEach((user) => {
      const mentionRegex = new RegExp(`<@!?${user.id}>`, 'g');

      if (user.id === botUserId) {
        result = result.replace(mentionRegex, '');
      } else {
        result = result.replace(mentionRegex, `@${user.username}`);
      }
    });

    return result;
  }

  private async simulateTyping(
    channel: TypingCapableChannel,
    content: string,
  ): Promise<void> {
    const charsPerSecond = 10;
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
        const messageText =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Failed to refresh typing indicator: ${messageText}`);
      });
    }, refreshIntervalMs);

    await new Promise((resolve) => setTimeout(resolve, durationMs));
    clearInterval(refreshInterval);
  }
}
