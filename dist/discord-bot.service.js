"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var DiscordBotService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordBotService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const discord_js_1 = require("discord.js");
let DiscordBotService = DiscordBotService_1 = class DiscordBotService {
    configService;
    logger = new common_1.Logger(DiscordBotService_1.name);
    client;
    guildId;
    channelId;
    constructor(configService) {
        this.configService = configService;
        const guildId = this.configService.get('DISCORD_GUILD_ID');
        const channelId = this.configService.get('DISCORD_CHANNEL_ID');
        if (!guildId) {
            throw new Error('DISCORD_GUILD_ID is required');
        }
        if (!channelId) {
            throw new Error('DISCORD_CHANNEL_ID is required');
        }
        this.guildId = guildId;
        this.channelId = channelId;
    }
    async onModuleInit() {
        const token = this.configService.get('DISCORD_BOT_TOKEN');
        if (!token) {
            this.logger.error('DISCORD_BOT_TOKEN is not set');
            throw new Error('DISCORD_BOT_TOKEN is required');
        }
        if (!this.guildId) {
            this.logger.error('DISCORD_GUILD_ID is not set');
            throw new Error('DISCORD_GUILD_ID is required');
        }
        if (!this.channelId) {
            this.logger.error('DISCORD_CHANNEL_ID is not set');
            throw new Error('DISCORD_CHANNEL_ID is required');
        }
        this.client = new discord_js_1.Client({
            intents: [discord_js_1.GatewayIntentBits.Guilds, discord_js_1.GatewayIntentBits.GuildMessages],
        });
        this.client.once('clientReady', () => {
            if (this.client.user) {
                this.logger.log(`Discord bot logged in as ${this.client.user.tag}`);
            }
        });
        await this.client.login(token);
    }
    async sendDailyPoll() {
        try {
            const guild = await this.client.guilds.fetch(this.guildId);
            const channel = (await guild.channels.fetch(this.channelId));
            if (!channel) {
                this.logger.error(`Channel ${this.channelId} not found`);
                return;
            }
            await channel.send('Timpul pentru votul zilnic!');
            await channel.send({
                poll: {
                    question: {
                        text: 'il scoatem pe mihnea?',
                    },
                    answers: [{ text: 'da' }, { text: 'da' }],
                    duration: 1,
                    allowMultiselect: false,
                },
            });
            this.logger.log(`Daily poll sent successfully at ${new Date().toISOString()}`);
        }
        catch (error) {
            this.logger.error(`Failed to send daily poll: ${error.message}`, error.stack);
            throw error;
        }
    }
    async onModuleDestroy() {
        if (this.client) {
            await this.client.destroy();
            this.logger.log('Discord bot disconnected');
        }
    }
};
exports.DiscordBotService = DiscordBotService;
exports.DiscordBotService = DiscordBotService = DiscordBotService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], DiscordBotService);
//# sourceMappingURL=discord-bot.service.js.map