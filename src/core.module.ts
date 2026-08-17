import { Global, Module } from '@nestjs/common';
import { BotConfigService } from './bot-config.service';
import { DiscordClientService } from './discord-client.service';
import { OpenAiService } from './openai.service';

@Global()
@Module({
  providers: [BotConfigService, DiscordClientService, OpenAiService],
  exports: [BotConfigService, DiscordClientService, OpenAiService],
})
export class CoreModule {}
