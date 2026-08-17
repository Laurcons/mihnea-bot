import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { BotConfigService } from './bot-config.service';

dayjs.extend(utc);
dayjs.extend(timezone);

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.createApplicationContext(AppModule);

  logger.log('Discord bot application started');

  // Reported from config rather than hardcoded: this line claimed the kick
  // poll ran daily for as long as its schedules sat commented out.
  const kickPollEnabled = app.get(BotConfigService).getIsKickPollEnabled();
  logger.log(
    kickPollEnabled
      ? 'Kick poll enabled: poll at 18:00, results at 19:01 (Europe/Bucharest)'
      : 'Kick poll disabled (set KICK_POLL_ENABLED=true to enable)',
  );

  // Keep the application running
  const shutdown = async () => {
    logger.log('Shutting down...');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

bootstrap().catch((error: unknown) => {
  // Without this a boot failure surfaced only as an unhandled rejection.
  new Logger('Bootstrap').error(
    `Failed to start: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
  );
  process.exit(1);
});
