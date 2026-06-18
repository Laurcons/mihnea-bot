import { Injectable, Logger } from '@nestjs/common';
import { Message, TextBasedChannel } from 'discord.js';
import { BotConfigService } from './bot-config.service';
import { DiscordClientService } from './discord-client.service';
import fs from 'fs';
import net from 'node:net';

type TypingCapableChannel = TextBasedChannel & {
  sendTyping: () => Promise<void>;
};

@Injectable()
export class MentionResponderService {
  private readonly logger = new Logger(MentionResponderService.name);
  private readonly whitelistPath = '/etc/nftables/whitelist.txt';
  private whitelistedIps: Set<string>;
  private readonly whitelistChannel: string | null;

  private isValidIp(ip: string): boolean {
    return net.isIP(ip) !== 0;
  }

  constructor(
    private readonly botConfig: BotConfigService,
    private readonly discordClient: DiscordClientService,
  ) {
    this.whitelistChannel = botConfig.getWhitelistChannel();
    if (this.whitelistChannel) {
      this.logger.log(`Whitelist maintainance enabled.`);

      try {
        this.whitelistedIps = new Set(
          fs
            .readFileSync(this.whitelistPath)
            .toString('utf-8')
            .split('\n')
            .filter((ip) => this.isValidIp(ip)),
        );
      } catch (error) {
        const messageText =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Disabling whitelist maintainance due to failing to read whitelist: ${messageText}`,
        );
        this.whitelistChannel = null;
      }
      this.discordClient.onMessage((message) => this.handleMessage(message));
    } else {
      this.logger.log(`Whitelist maintainance disabled.`);
    }
  }

  private async handleMessage(message: Message): Promise<void> {
    if (!this.shouldProcessMessage(message)) {
      return;
    }
    const channel = this.getTypingCapableChannel(message.channel);
    if (!channel) {
      return;
    }

    const content = await this.getMessageContent(message);
    if (!this.isValidIp(content)) {
      return this.reactWithThumbsDown(message);
    } else {
      this.whitelistedIps.add(content);
      const data = [...this.whitelistedIps].sort().join('\n') + '\n';
      fs.writeFileSync(this.whitelistPath, data);
      return this.reactWithThumbsUp(message);
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

    if (message.author.bot || this.whitelistChannel !== channel.id) {
      return false;
    }

    return true;
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

  private async reactWithThumbsDown(message: Message): Promise<void> {
    try {
      await message.react('👎');
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to react with thumbs down: ${messageText}`);
    }
  }

  private async reactWithThumbsUp(message: Message): Promise<void> {
    try {
      await message.react('👍');
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to react with thumbs up: ${messageText}`);
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
}
