import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChannelType, OverwriteType, TextChannel } from 'discord.js';
import { BotConfigService } from '../bot-config.service';
import { DiscordClientService } from '../discord-client.service';
import {
  WordleParserService,
  WORDLE_GAME_TYPES,
} from './wordle-parser.service';
import { WordleResult } from './models/wordle-result.schema';
import { channelNameFor, diffAccess } from './wordle-channel.util';

const GRANT_REASON = 'Posted the daily result';
const REVOKE_REASON = 'Daily reset';

/**
 * Gates the per-game discussion channels: posting a result for today's puzzle
 * unlocks #todays-<gametype> until the nightly reset.
 *
 * Access is derived rather than tracked — the set of users who should see a
 * channel is exactly the set with a stored result at today's puzzle day. That
 * makes every operation a reconciliation against the database, so a missed
 * midnight, a manual edit or a restart all self-heal, and the backfill cannot
 * accidentally let anyone in (its rows carry old puzzle days).
 *
 * The bot never creates channels. A game type without a matching channel is a
 * supported configuration, not an error.
 */
@Injectable()
export class WordleChannelAccessService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WordleChannelAccessService.name);
  /** gameType -> channelId, for the game types that actually have a channel. */
  private readonly channels = new Map<string, string>();

  constructor(
    private readonly discordClient: DiscordClientService,
    private readonly botConfig: BotConfigService,
    private readonly parser: WordleParserService,
    @InjectModel(WordleResult.name)
    private readonly wordleResultModel: Model<WordleResult>,
  ) {}

  onApplicationBootstrap(): void {
    // Fire and forget: channel discovery must not hold up the rest of startup.
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    try {
      if (!(await this.discordClient.whenReady())) {
        this.logger.error(
          'Discord client not ready in time; wordle channel access is inactive until the next boot',
        );
        return;
      }

      await this.discoverChannels();

      // Self-heals a midnight the bot slept through, plus any manual drift.
      await this.reconcileAll();
    } catch (error: unknown) {
      this.logger.error(
        `Failed to initialise wordle channel access: ${describe(error)}`,
      );
    }
  }

  private async discoverChannels(): Promise<void> {
    const guild = await this.discordClient
      .getClient()
      .guilds.fetch(this.botConfig.getDiscordGuildId());
    const all = await guild.channels.fetch();

    const byName = new Map<string, string>();
    for (const channel of all.values()) {
      if (channel && channel.type === ChannelType.GuildText) {
        byName.set(channel.name.toLowerCase(), channel.id);
      }
    }

    this.channels.clear();
    const found: string[] = [];
    const absent: string[] = [];

    for (const gameType of WORDLE_GAME_TYPES) {
      const name = channelNameFor(gameType);
      const channelId = byName.get(name);

      if (channelId) {
        this.channels.set(gameType, channelId);
        found.push(`#${name}`);
      } else {
        absent.push(`#${name}`);
      }
    }

    // Without this line a typo in a channel name is indistinguishable from a
    // game type deliberately having no channel.
    this.logger.log(
      `Wordle channels found (${found.length}): ${found.join(', ') || 'none'}`,
    );
    this.logger.log(`No channel for: ${absent.join(', ') || 'none'}`);
  }

  /**
   * Fast path for a freshly accepted result: one API call, no reconciliation.
   */
  async grant(userId: string, gameType: string): Promise<void> {
    const channel = await this.resolve(gameType);
    if (!channel) return;

    try {
      await channel.permissionOverwrites.edit(
        userId,
        { ViewChannel: true },
        { reason: GRANT_REASON },
      );
      this.logger.log(`Granted ${userId} access to #${channel.name}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to grant ${userId} access to #${channel.name}: ${describe(error)}`,
      );
    }
  }

  async reconcileAll(): Promise<void> {
    for (const gameType of this.channels.keys()) {
      await this.reconcile(gameType);
    }
  }

  /**
   * Brings a channel's member overwrites in line with who has posted today.
   * Role overwrites are never touched, so a moderator role keeps its access.
   */
  async reconcile(gameType: string): Promise<void> {
    const channel = await this.resolve(gameType);
    if (!channel) return;

    let desired: string[];
    try {
      desired = await this.usersWithTodaysResult(gameType);
    } catch (error: unknown) {
      this.logger.error(
        `Could not determine who should see #${channel.name}: ${describe(error)}`,
      );
      return;
    }

    const current = channel.permissionOverwrites.cache
      .filter((overwrite) => overwrite.type === OverwriteType.Member)
      .map((overwrite) => overwrite.id);

    const { toGrant, toRevoke } = diffAccess(current, desired);
    if (toGrant.length === 0 && toRevoke.length === 0) return;

    // Deliberately one request per user rather than permissionOverwrites.set():
    // set() is a channel PATCH, which shares the far stricter channel-update
    // rate limit. Each user is also isolated so one departed member cannot
    // stall the rest of the sweep.
    let granted = 0;
    for (const userId of toGrant) {
      try {
        await channel.permissionOverwrites.edit(
          userId,
          { ViewChannel: true },
          { reason: GRANT_REASON },
        );
        granted++;
      } catch (error: unknown) {
        this.logger.warn(
          `Could not grant ${userId} on #${channel.name}: ${describe(error)}`,
        );
      }
    }

    let revoked = 0;
    for (const userId of toRevoke) {
      try {
        await channel.permissionOverwrites.delete(userId, REVOKE_REASON);
        revoked++;
      } catch (error: unknown) {
        this.logger.warn(
          `Could not revoke ${userId} on #${channel.name}: ${describe(error)}`,
        );
      }
    }

    this.logger.log(
      `Reconciled #${channel.name}: +${granted} -${revoked} (${desired.length} qualified)`,
    );
  }

  private async usersWithTodaysResult(gameType: string): Promise<string[]> {
    const puzzleDay = this.parser.getCurrentPuzzleDay(gameType);
    return this.wordleResultModel.distinct('userId', {
      gameType,
      puzzleDay,
    });
  }

  private async resolve(gameType: string): Promise<TextChannel | null> {
    const channelId = this.channels.get(gameType);
    if (!channelId) return null;

    try {
      return await this.discordClient.fetchTextChannel(
        this.botConfig.getDiscordGuildId(),
        channelId,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Could not fetch the channel for ${gameType}: ${describe(error)}`,
      );
      return null;
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
