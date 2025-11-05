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
var PollSchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PollSchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const discord_bot_service_1 = require("./discord-bot.service");
let PollSchedulerService = PollSchedulerService_1 = class PollSchedulerService {
    discordBotService;
    logger = new common_1.Logger(PollSchedulerService_1.name);
    constructor(discordBotService) {
        this.discordBotService = discordBotService;
    }
    async onModuleInit() {
    }
    async handleDailyPoll() {
        this.logger.log('Starting daily poll at 12:00');
        try {
            await this.discordBotService.sendDailyPoll();
        }
        catch (error) {
            this.logger.error(`Failed to execute daily poll: ${error.message}`, error.stack);
        }
    }
};
exports.PollSchedulerService = PollSchedulerService;
__decorate([
    (0, schedule_1.Cron)('0 12 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PollSchedulerService.prototype, "handleDailyPoll", null);
exports.PollSchedulerService = PollSchedulerService = PollSchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [discord_bot_service_1.DiscordBotService])
], PollSchedulerService);
//# sourceMappingURL=poll-scheduler.service.js.map