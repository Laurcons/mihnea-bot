import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from 'discord.js';
import { BotConfigService } from './bot-config.service';
import { DiscordClientService } from './discord-client.service';

@Injectable()
export class ReactionDefenseService implements OnModuleInit {
  private readonly logger = new Logger(ReactionDefenseService.name);

  constructor(
    private readonly discordClient: DiscordClientService,
    private readonly botConfig: BotConfigService,
  ) {}

  onModuleInit(): void {
    const hostileId = this.botConfig.getHostileReactionBotId();
    if (!hostileId) {
      this.logger.warn(
        'HOSTILE_REACTION_BOT_ID not set; reaction defense disabled',
      );
      return;
    }
    this.discordClient.onReactionAdd(async (reaction, user) => {
      await this.handleReaction(reaction, user, hostileId);
    });
  }

  private async handleReaction(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
    hostileId: string,
  ): Promise<void> {
    if (user.id !== hostileId) return;
    if (reaction.emoji.name !== '🖕') return;
    try {
      await reaction.remove();
    } catch (error) {
      this.logger.warn(`Failed to remove hostile reaction: ${error}`);
    }
  }
}
