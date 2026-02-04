import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  REST,
  Routes,
  SlashCommandBuilder,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { BotConfigService } from '../bot-config.service';
import { DiscordClientService } from '../discord-client.service';
import { KickPollDataService } from './kick-poll-data.service';

@Injectable()
export class SlashCommandService implements OnModuleInit {
  private readonly logger = new Logger(SlashCommandService.name);

  constructor(
    private readonly botConfig: BotConfigService,
    private readonly discordClient: DiscordClientService,
    private readonly kickPollData: KickPollDataService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerCommands();
    this.setupInteractionHandler();
  }

  private async registerCommands(): Promise<void> {
    const commands = this.buildCommands();
    const rest = new REST({ version: '10' }).setToken(
      this.botConfig.getDiscordBotToken(),
    );

    try {
      this.logger.log('Registering slash commands...');

      await rest.put(
        Routes.applicationGuildCommands(
          this.botConfig.getDiscordClientId(),
          this.botConfig.getDiscordGuildId(),
        ),
        { body: commands },
      );

      this.logger.log('Slash commands registered successfully');
    } catch (error) {
      this.logger.error(`Failed to register slash commands: ${error}`);
    }
  }

  private buildCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    const mihneainatorCommand = new SlashCommandBuilder()
      .setName('mihneainator')
      .setDescription('Comenzi Mihneainator')
      .addSubcommandGroup((group) =>
        group
          .setName('kickvote')
          .setDescription('Comenzi pentru votul zilnic de kick')
          .addSubcommand((sub) =>
            sub
              .setName('optin')
              .setDescription('Înscrie-te la votul zilnic de kick'),
          )
          .addSubcommand((sub) =>
            sub
              .setName('optout')
              .setDescription('Retrage-te de la votul zilnic de kick'),
          ),
      );

    return [mihneainatorCommand.toJSON()];
  }

  private setupInteractionHandler(): void {
    this.discordClient.onInteraction(async (interaction) => {
      if (!interaction.isChatInputCommand()) {
        return;
      }

      if (interaction.commandName !== 'mihneainator') {
        return;
      }

      const subcommandGroup = interaction.options.getSubcommandGroup();
      const subcommand = interaction.options.getSubcommand();

      if (subcommandGroup === 'kickvote') {
        await this.handleKickVoteCommand(interaction, subcommand);
      }
    });
  }

  private async handleKickVoteCommand(
    interaction: import('discord.js').ChatInputCommandInteraction,
    subcommand: string,
  ): Promise<void> {
    const userId = interaction.user.id;
    const username = interaction.user.username;

    try {
      if (subcommand === 'optin') {
        const added = await this.kickPollData.addKickableUser(userId, username);

        if (added) {
          await interaction.reply({
            content:
              '✅ Te-ai înscris la votul zilnic de kick! Succes... o să ai nevoie.',
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: '⚠️ Ești deja înscris la votul zilnic de kick.',
            ephemeral: true,
          });
        }
      } else if (subcommand === 'optout') {
        const removed = await this.kickPollData.removeKickableUser(userId);

        if (removed) {
          await interaction.reply({
            content: '✅ Te-ai retras de la votul zilnic de kick. Lașule.',
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: '⚠️ Nu ești înscris la votul zilnic de kick.',
            ephemeral: true,
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error handling kickvote command: ${error}`);
      await interaction.reply({
        content: '❌ A apărut o eroare. Încearcă din nou.',
        ephemeral: true,
      });
    }
  }
}
