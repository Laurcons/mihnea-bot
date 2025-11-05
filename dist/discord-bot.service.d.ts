import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class DiscordBotService implements OnModuleInit {
    private configService;
    private readonly logger;
    private client;
    private readonly guildId;
    private readonly channelId;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    sendDailyPoll(): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
