import { Injectable, Logger } from '@nestjs/common';
import { BotConfigService } from './bot-config.service';
import { DiscordClientService } from './discord-client.service';

@Injectable()
export class PollService {
  private readonly logger = new Logger(PollService.name);
  private readonly guildId: string;
  private readonly channelId: string;

  constructor(
    private readonly botConfig: BotConfigService,
    private readonly discordClient: DiscordClientService,
  ) {
    this.guildId = this.botConfig.getDiscordGuildId();
    this.channelId = this.botConfig.getDiscordChannelId();
  }

  async sendDailyPoll(): Promise<void> {
    const channel = await this.discordClient.fetchTextChannel(
      this.guildId,
      this.channelId,
    );

    if (!channel) {
      this.logger.error(`Channel ${this.channelId} not found`);
      return;
    }

    await channel.send('Timpul pentru votul zilnic!');

    await channel.send({
      poll: {
        question: { text: 'il scoatem pe mihnea?' },
        answers: [{ text: 'da' }, { text: 'da' }],
        duration: 1,
        allowMultiselect: false,
      },
    });

    this.logger.log(
      `Daily poll sent successfully at ${new Date().toISOString()}`,
    );
  }

}
