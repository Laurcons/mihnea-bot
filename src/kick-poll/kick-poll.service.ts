import { Injectable, Logger } from '@nestjs/common';
import { TextChannel } from 'discord.js';
import { BotConfigService } from '../bot-config.service';
import { DiscordClientService } from '../discord-client.service';
import { KickPollDataService } from './kick-poll-data.service';
import { KickPollAiService } from './kick-poll-ai.service';
import { KickExecutorService } from './kick-executor.service';
import { ActivePoll } from './kick-poll.types';

const OPT_IN_REMINDER =
  '\n\nVrei să participi la votul zilnic? Folosește `/mihneainator kickvote` pentru a te înscrie sau a te retrage.';

@Injectable()
export class KickPollService {
  private readonly logger = new Logger(KickPollService.name);

  constructor(
    private readonly botConfig: BotConfigService,
    private readonly discordClient: DiscordClientService,
    private readonly kickPollData: KickPollDataService,
    private readonly kickPollAi: KickPollAiService,
    private readonly kickExecutor: KickExecutorService,
  ) {}

  async sendDailyPoll(): Promise<void> {
    const channel = await this.getChannel();
    if (!channel) {
      this.logger.error('Could not fetch poll channel');
      return;
    }

    // Check if there are enough kickable users
    const kickableUsers = await this.kickPollData.getKickableUsers();
    if (kickableUsers.length < 2) {
      this.logger.log(
        `Not enough kickable users (${kickableUsers.length}), skipping poll`,
      );
      return;
    }

    // Select random user
    const selectedUser = await this.kickPollData.getRandomKickableUser();
    if (!selectedUser) {
      this.logger.error('Failed to select random user');
      return;
    }

    // Verify user is still in server
    const isInServer = await this.kickExecutor.isUserInServer(
      selectedUser.userId,
    );
    if (!isInServer) {
      this.logger.warn(
        `Selected user ${selectedUser.username} is no longer in server, aborting poll`,
      );
      // Remove them from kickable list
      await this.kickPollData.removeKickableUser(selectedUser.userId);
      return;
    }

    // Generate AI content
    this.logger.log(`Generating poll content for ${selectedUser.username}`);
    const aiContent = await this.kickPollAi.generatePollContent(
      selectedUser.username,
    );

    // Send poll
    const pollMessage = await channel.send({
      poll: {
        question: { text: aiContent.question },
        answers: [
          { text: aiContent.positiveOption },
          { text: aiContent.negativeOption },
        ],
        duration: 1, // 1 hour
        allowMultiselect: false,
      },
    });

    // Save active poll state
    const now = new Date();
    const endsAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

    const activePoll: ActivePoll = {
      messageId: pollMessage.id,
      channelId: channel.id,
      targetUserId: selectedUser.userId,
      targetUsername: selectedUser.username,
      startedAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
      aiContent,
    };

    await this.kickPollData.setActivePoll(activePoll);

    this.logger.log(
      `Daily kick poll sent for ${selectedUser.username}, ends at ${endsAt.toISOString()}`,
    );
  }

  async processPollResult(): Promise<void> {
    const activePoll = await this.kickPollData.getActivePoll();
    if (!activePoll) {
      this.logger.log('No active poll to process');
      return;
    }

    const channel = await this.getChannel();
    if (!channel) {
      this.logger.error('Could not fetch poll channel');
      return;
    }

    // Fetch the poll message
    let pollMessage;
    try {
      pollMessage = await channel.messages.fetch(activePoll.messageId);
    } catch (error) {
      this.logger.error(`Could not fetch poll message: ${error}`);
      await this.kickPollData.clearActivePoll();
      return;
    }

    // Get vote counts
    const poll = pollMessage.poll;
    if (!poll) {
      this.logger.error('Message does not have a poll');
      await this.kickPollData.clearActivePoll();
      return;
    }

    // Poll answers are 1-indexed in Discord.js
    const positiveVotes = poll.answers.get(1)?.voteCount ?? 0;
    const negativeVotes = poll.answers.get(2)?.voteCount ?? 0;

    this.logger.log(
      `Poll results for ${activePoll.targetUsername}: positive=${positiveVotes}, negative=${negativeVotes}`,
    );

    // Positive wins only if strictly greater
    const positiveWins = positiveVotes > negativeVotes;

    if (positiveWins) {
      // Execute kick
      const kickResult = await this.kickExecutor.executeKick(
        activePoll.targetUserId,
        activePoll.targetUsername,
        activePoll.aiContent.positiveAnnouncement,
        channel,
      );

      // Send announcement
      const announcement =
        activePoll.aiContent.positiveAnnouncement + OPT_IN_REMINDER;
      await channel.send(announcement);

      // Save result
      await this.kickPollData.setLastPollResult({
        targetUserId: activePoll.targetUserId,
        targetUsername: activePoll.targetUsername,
        wasKicked: kickResult.kicked,
        dmSent: kickResult.dmSent,
        processedAt: new Date().toISOString(),
      });

      if (!kickResult.kicked) {
        this.logger.error(
          `Failed to kick ${activePoll.targetUsername}: ${kickResult.error}`,
        );
        await channel.send(
          `⚠️ Nu am putut să-l dau afară pe ${activePoll.targetUsername}. Probabil nu am permisiuni suficiente.`,
        );
      }
    } else {
      // User is spared
      const announcement =
        activePoll.aiContent.negativeAnnouncement + OPT_IN_REMINDER;
      await channel.send(announcement);

      // Save result
      await this.kickPollData.setLastPollResult({
        targetUserId: activePoll.targetUserId,
        targetUsername: activePoll.targetUsername,
        wasKicked: false,
        dmSent: false,
        processedAt: new Date().toISOString(),
      });

      this.logger.log(`${activePoll.targetUsername} was spared by the vote`);
    }

    // Clear active poll
    await this.kickPollData.clearActivePoll();
  }

  private async getChannel(): Promise<TextChannel | null> {
    const guildId = this.botConfig.getDiscordGuildId();
    const channelId = this.botConfig.getDiscordChannelId();

    return this.discordClient.fetchTextChannel(guildId, channelId);
  }
}
