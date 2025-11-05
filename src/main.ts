import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.createApplicationContext(AppModule);

  logger.log('Discord bot application started');
  logger.log('Bot will send polls daily at 12:00');

  // Keep the application running
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
