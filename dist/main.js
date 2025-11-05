"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    logger.log('Discord bot application started');
    logger.log('Bot will send polls daily at 12:00');
    process.on('SIGINT', async () => {
        logger.log('Shutting down...');
        await app.close();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        logger.log('Shutting down...');
        await app.close();
        process.exit(0);
    });
}
bootstrap();
//# sourceMappingURL=main.js.map