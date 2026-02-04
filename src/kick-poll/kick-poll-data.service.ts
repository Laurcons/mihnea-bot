import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  KickPollData,
  KickableUser,
  ActivePoll,
  PollResult,
} from './kick-poll.types';
import { BotConfigService } from '../bot-config.service';

const DEFAULT_DATA: KickPollData = {
  kickableUsers: [],
  activePoll: null,
  lastPollResult: null,
};

@Injectable()
export class KickPollDataService implements OnModuleInit {
  private readonly logger = new Logger(KickPollDataService.name);
  private readonly dataFilePath: string;
  private data: KickPollData = DEFAULT_DATA;

  constructor(private readonly botConfig: BotConfigService) {
    this.dataFilePath = path.join(
      this.botConfig.getDataDirectory(),
      'kick-poll-data.json',
    );
  }

  async onModuleInit(): Promise<void> {
    await this.ensureDataDirectory();
    await this.loadData();
  }

  private async ensureDataDirectory(): Promise<void> {
    const dir = path.dirname(this.dataFilePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create data directory: ${error}`);
    }
  }

  private async loadData(): Promise<void> {
    try {
      const content = await fs.readFile(this.dataFilePath, 'utf-8');
      this.data = JSON.parse(content) as KickPollData;
      this.logger.log('Loaded kick poll data from file');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.log('No existing data file, starting fresh');
        this.data = DEFAULT_DATA;
        await this.saveData();
      } else {
        this.logger.error(`Failed to load data: ${error}`);
        this.data = DEFAULT_DATA;
      }
    }
  }

  private async saveData(): Promise<void> {
    try {
      await fs.writeFile(
        this.dataFilePath,
        JSON.stringify(this.data, null, 2),
        'utf-8',
      );
    } catch (error) {
      this.logger.error(`Failed to save data: ${error}`);
    }
  }

  // Kickable Users Methods

  async getKickableUsers(): Promise<KickableUser[]> {
    return [...this.data.kickableUsers];
  }

  async getRandomKickableUser(): Promise<KickableUser | null> {
    if (this.data.kickableUsers.length < 2) {
      return null;
    }
    const randomIndex = Math.floor(
      Math.random() * this.data.kickableUsers.length,
    );
    return this.data.kickableUsers[randomIndex];
  }

  async addKickableUser(userId: string, username: string): Promise<boolean> {
    const exists = this.data.kickableUsers.some(
      (user) => user.userId === userId,
    );
    if (exists) {
      return false;
    }

    this.data.kickableUsers.push({
      userId,
      username,
      optedInAt: new Date().toISOString(),
    });
    await this.saveData();
    return true;
  }

  async removeKickableUser(userId: string): Promise<boolean> {
    const initialLength = this.data.kickableUsers.length;
    this.data.kickableUsers = this.data.kickableUsers.filter(
      (user) => user.userId !== userId,
    );

    if (this.data.kickableUsers.length < initialLength) {
      await this.saveData();
      return true;
    }
    return false;
  }

  async isUserKickable(userId: string): Promise<boolean> {
    return this.data.kickableUsers.some((user) => user.userId === userId);
  }

  // Active Poll Methods

  async getActivePoll(): Promise<ActivePoll | null> {
    return this.data.activePoll;
  }

  async setActivePoll(poll: ActivePoll): Promise<void> {
    this.data.activePoll = poll;
    await this.saveData();
  }

  async clearActivePoll(): Promise<void> {
    this.data.activePoll = null;
    await this.saveData();
  }

  // Poll Result Methods

  async setLastPollResult(result: PollResult): Promise<void> {
    this.data.lastPollResult = result;
    await this.saveData();
  }

  async getLastPollResult(): Promise<PollResult | null> {
    return this.data.lastPollResult;
  }
}
