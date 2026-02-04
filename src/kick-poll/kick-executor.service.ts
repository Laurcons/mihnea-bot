import { Injectable, Logger } from '@nestjs/common';
import { TextChannel } from 'discord.js';
import { DiscordClientService } from '../discord-client.service';
import { BotConfigService } from '../bot-config.service';
import { KickResult } from './kick-poll.types';

const DM_FAILED_MESSAGE =
  '⚠️ Nu am putut trimite DM către @{username}. Dacă îl cunoașteți, trimiteți-i voi linkul să revină:\n{invite_url}';

const DM_CONTENT_TEMPLATE = `{announcement}

---

Ai fost dat afară prin vot popular! Poți reveni pe server folosind acest link (valabil 24h, o singură folosire):
{invite_url}`;

@Injectable()
export class KickExecutorService {
  private readonly logger = new Logger(KickExecutorService.name);

  constructor(
    private readonly discordClient: DiscordClientService,
    private readonly botConfig: BotConfigService,
  ) {}

  async executeKick(
    userId: string,
    username: string,
    announcement: string,
    channel: TextChannel,
  ): Promise<KickResult> {
    const guildId = this.botConfig.getDiscordGuildId();

    try {
      const guild = await this.discordClient.getClient().guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);

      // Create invite before kicking
      const invite = await channel.createInvite({
        maxUses: 1,
        maxAge: 86400, // 24 hours
        unique: true,
        reason: `Rejoin invite for ${username} after kick vote`,
      });

      const inviteUrl = invite.url;

      // Try to send DM
      let dmSent = false;
      try {
        const dmContent = DM_CONTENT_TEMPLATE.replace(
          '{announcement}',
          announcement,
        ).replace('{invite_url}', inviteUrl);

        await member.send(dmContent);
        dmSent = true;
        this.logger.log(`DM sent to ${username}`);
      } catch (dmError) {
        const errorCode = (dmError as { code?: number }).code;
        if (errorCode === 50007) {
          this.logger.warn(`Cannot send DM to ${username} - DMs disabled`);
        } else {
          this.logger.warn(`Failed to send DM to ${username}: ${dmError}`);
        }

        // Post invite in chat since DM failed
        const failedMessage = DM_FAILED_MESSAGE.replace(
          '{username}',
          username,
        ).replace('{invite_url}', inviteUrl);

        await channel.send(failedMessage);
      }

      // Execute kick
      await member.kick('Lost the daily kick vote');
      this.logger.log(`Kicked ${username} from server`);

      return {
        kicked: true,
        dmSent,
        inviteUrl,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to kick ${username}: ${errorMessage}`);

      return {
        kicked: false,
        dmSent: false,
        inviteUrl: '',
        error: errorMessage,
      };
    }
  }

  async isUserInServer(userId: string): Promise<boolean> {
    const guildId = this.botConfig.getDiscordGuildId();

    try {
      const guild = await this.discordClient.getClient().guilds.fetch(guildId);
      await guild.members.fetch(userId);
      return true;
    } catch {
      return false;
    }
  }
}
