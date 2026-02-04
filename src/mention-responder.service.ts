import { Injectable, Logger } from '@nestjs/common';
import { Message, TextBasedChannel } from 'discord.js';
import { BotConfigService } from './bot-config.service';
import { DiscordClientService } from './discord-client.service';

type TypingCapableChannel = TextBasedChannel & {
  sendTyping: () => Promise<void>;
};

const BASE_SYSTEM_PROMPT =
  'Ești Mihneainatorul, o parodie a lui Mihnea. Ești un user pe serverul nostru de Discord, „amogus”. Menirea ta pe acest pământ este să dai cu hate în oricine îți scrie. Trebuie să găsești cele mai creative insulte, fiindcă dacă nu faci lumea să râdă, nu te faci plăcut. În general, îți place să legi insultele tale de mamele celor insultați, zicând des „mă-ta” sau „maică-ta”. Ești destul de inteligent, însă nu vrei niciodată să te dai mare. Stilul tău de chat pe Discord este relaxat, cu litere mici, mereu fără diacritice sau cratime, dar mereu fără greșeli de exprimare.';
const MAX_DISCORD_MESSAGE_LENGTH = 2000;
const LONG_REPLY_FALLBACK = 'bă, nu-ți răspund, că de m-apuc scriu kilometri.';

@Injectable()
export class MentionResponderService {
  private readonly logger = new Logger(MentionResponderService.name);
  private readonly blacklistedChannelIds: Set<string>;
  private readonly botAllowedChannelIds: Set<string>;
  private readonly adminUserId: string | null;
  private readonly usersBeingProcessed: Set<string> = new Set();

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
    this.adminUserId = this.botConfig.getAdminUserId();
    this.discordClient.onMessage((message) => this.handleMessage(message));
  }

  private async handleMessage(message: Message): Promise<void> {
    if (!this.shouldProcessMessage(message)) {
      return;
    }

    const userId = message.author.id;
    const isAdmin = userId === this.adminUserId;

    if (!isAdmin && this.usersBeingProcessed.has(userId)) {
      this.logger.debug(`Ignoring message from ${message.author.username} - already processing`);
      return;
    }

    const channel = this.getTypingCapableChannel(message.channel);
    if (!channel) {
      return;
    }

    this.usersBeingProcessed.add(userId);

    try {
      if (await this.tryHandleAdminComeback(message, channel)) {
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
    } finally {
      this.usersBeingProcessed.delete(userId);
    }
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

    return this.extractPromptContent(message, clientUser.id);
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
    await this.respondWithPrompt(message, channel, userPrompt);
  }

  private normalizeReplyLength(reply: string): string {
    if (reply.length <= MAX_DISCORD_MESSAGE_LENGTH) {
      return reply;
    }

    return LONG_REPLY_FALLBACK;
  }

  private async generateChatbotResponse(
    userPrompt: string,
    additionalInstructions?: string,
  ): Promise<string> {
    const apiKey = this.botConfig.getOpenAIApiKey();
    const model = this.botConfig.getOpenAIModel();

    const systemPrompt = this.buildSystemPrompt(additionalInstructions);

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

  private async respondWithPrompt(
    replyTarget: Message,
    channel: TypingCapableChannel,
    userPrompt: string,
    options?: { systemInstructions?: string; errorReplyTarget?: Message },
  ): Promise<void> {
    try {
      const reply = await this.generateChatbotResponse(
        userPrompt,
        options?.systemInstructions,
      );
      const finalReply = this.normalizeReplyLength(reply);
      await this.simulateTyping(channel, finalReply);
      await replyTarget.reply(finalReply);
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Failed to respond to mention: ${messageText}`, stack);
      const fallbackTarget = options?.errorReplyTarget ?? replyTarget;
      await fallbackTarget.reply('coaie am pareză pă creier. mai încearcă o dată.');
    }
  }

  private buildSystemPrompt(additionalInstructions?: string): string {
    if (!additionalInstructions) {
      return BASE_SYSTEM_PROMPT;
    }

    return `${BASE_SYSTEM_PROMPT}\n\n${additionalInstructions}`;
  }

  private async tryHandleAdminComeback(
    message: Message,
    fallbackChannel: TypingCapableChannel,
  ): Promise<boolean> {
    const clientUser = this.discordClient.getClient().user;

    if (!clientUser) {
      return false;
    }

    if (!this.isAdminComebackMessage(message, clientUser.id)) {
      return false;
    }

    const referencedMessage = await this.fetchReferencedMessage(message);

    if (!referencedMessage) {
      this.logger.warn('Admin comeback triggered without a referenced message');
      return false;
    }


    const targetChannel =
      this.getTypingCapableChannel(referencedMessage.channel) ?? fallbackChannel;

    const adminInstruction = await this.extractAdminInstruction(message);
    if (!adminInstruction) {
      this.logger.warn(
        `Admin comeback triggered without instruction text (messageId=${message.id})`,
      );
      return false;
    }

    const referencedContent = await this.getMessageContent(referencedMessage);
    const sanitizedContent = this.replaceMentionsWithUsernames(
      referencedMessage,
      referencedContent,
      clientUser.id,
    ).trim();
    const userPrompt = sanitizedContent || referencedContent.trim();

    if (!userPrompt) {
      this.logger.warn(
        `Referenced message produced empty prompt after sanitizing (messageId=${referencedMessage.id}, author=${referencedMessage.author.username}, sanitizedLength=${sanitizedContent.length}, rawLength=${referencedContent.length})`,
      );
      return false;
    }

    const additionalInstructions = this.buildAdminInstructions(
      referencedMessage.author.username,
      adminInstruction,
    );

    await this.respondWithPrompt(referencedMessage, targetChannel, userPrompt, {
      systemInstructions: additionalInstructions,
      errorReplyTarget: message,
    });

    return true;
  }

  private isAdminComebackMessage(
    message: Message,
    botUserId: string,
  ): boolean {
    if (!this.adminUserId) {
      return false;
    }

    if (message.author.id !== this.adminUserId) {
      return false;
    }

    const referencesUserMessage = Boolean(message.reference?.messageId);
    const mentionsBot = message.mentions.has(botUserId);

    return referencesUserMessage && mentionsBot;
  }

  private async fetchReferencedMessage(
    message: Message,
  ): Promise<Message | null> {
    if (!message.reference?.messageId) {
      return null;
    }

    try {
      const referenced = await message.fetchReference();
      return referenced.partial ? await referenced.fetch() : referenced;
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Unable to fetch referenced message: ${messageText}`);
      return null;
    }
  }

  private async extractAdminInstruction(
    message: Message,
  ): Promise<string | null> {
    const clientUser = this.discordClient.getClient().user;

    if (!clientUser) {
      return null;
    }

    return this.extractPromptContent(message, clientUser.id);
  }

  private async extractPromptContent(
    message: Message,
    botUserId: string,
  ): Promise<string | null> {
    const fullContent = await this.getMessageContent(message);
    const contentWithNames = this.replaceMentionsWithUsernames(
      message,
      fullContent,
      botUserId,
    );
    const mentionRegex = new RegExp(`<@!?${botUserId}>`, 'g');
    const prompt = contentWithNames.replace(mentionRegex, '').trim();
    const fallback = fullContent.trim();

    return prompt || (fallback ? fallback : null);
  }

  private buildAdminInstructions(
    personUsername: string,
    adminMessage: string,
  ): string {
    return `Ești pus în situația în care trebuie să te iei de @${personUsername}, la comanda creatorului tău. Creatorul tău ți-a spus "${adminMessage}". Vei primi mesajul persoanei de care trebuie să te iei, tu trebuie să formulezi un răspuns.`;
  }
}
