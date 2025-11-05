import { OnModuleInit } from '@nestjs/common';
import { DiscordBotService } from './discord-bot.service';
export declare class PollSchedulerService implements OnModuleInit {
    private readonly discordBotService;
    private readonly logger;
    constructor(discordBotService: DiscordBotService);
    onModuleInit(): Promise<void>;
    handleDailyPoll(): Promise<void>;
}
