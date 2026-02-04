import { Global, Module } from '@nestjs/common';
import { BotConfigService } from './bot-config.service';
import { DiscordClientService } from './discord-client.service';

@Global()
@Module({
  providers: [BotConfigService, DiscordClientService],
  exports: [BotConfigService, DiscordClientService],
})
export class CoreModule {}
