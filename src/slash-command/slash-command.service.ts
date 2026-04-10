import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  REST,
  Routes,
  SlashCommandBuilder,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { BotConfigService } from '../bot-config.service';
import { DiscordClientService } from '../discord-client.service';
import { KickPollDataService } from '../kick-poll/kick-poll-data.service';
import { WordleStatsService } from '../wordle/wordle-stats.service';
import { WordleTrackerService } from '../wordle/wordle-tracker.service';
import { WORDLE_GAME_TYPES } from '../wordle/wordle-parser.service';

@Injectable()
export class SlashCommandService implements OnModuleInit {
  private readonly logger = new Logger(SlashCommandService.name);

  constructor(
    private readonly botConfig: BotConfigService,
    private readonly discordClient: DiscordClientService,
    private readonly kickPollData: KickPollDataService,
    private readonly wordleStats: WordleStatsService,
    private readonly wordleTracker: WordleTrackerService,
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
      )
      .addSubcommandGroup((group) =>
        group
          .setName('wordle')
          .setDescription('Wordle stats')
          .addSubcommand((sub) =>
            sub
              .setName('streaks')
              .setDescription('Afișează streak-ul pentru fiecare user')
              .addStringOption((opt) =>
                opt
                  .setName('gametype')
                  .setDescription('Tipul jocului (default: Wordle)')
                  .setRequired(false)
                  .addChoices(
                    ...WORDLE_GAME_TYPES.map((t) => ({ name: t, value: t })),
                  ),
              ),
          )
          .addSubcommand((sub) =>
            sub
              .setName('reevaluate')
              .setDescription('Reevaluează un mesaj wordle după ID')
              .addStringOption((opt) =>
                opt
                  .setName('messageid')
                  .setDescription('ID-ul mesajului Discord')
                  .setRequired(true),
              ),
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
      } else if (subcommandGroup === 'wordle') {
        await this.handleWordleCommand(interaction, subcommand);
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

  private async handleWordleCommand(
    interaction: import('discord.js').ChatInputCommandInteraction,
    subcommand: string,
  ): Promise<void> {
    if (subcommand === 'reevaluate') {
      await interaction.deferReply({ ephemeral: true });
      const messageId = interaction.options.getString('messageid', true);
      try {
        const result = await this.wordleTracker.reevaluateMessage(messageId);
        await interaction.editReply({ content: result });
      } catch (error) {
        this.logger.error(`Error handling wordle reevaluate command: ${error}`);
        await interaction.editReply({
          content: '❌ A apărut o eroare. Încearcă din nou.',
        });
      }
      return;
    }

    if (subcommand !== 'streaks') return;

    const gameType = interaction.options.getString('gametype') ?? 'Wordle';

    try {
      const streaks = await this.wordleStats.getStreaks(gameType);

      if (streaks.length === 0) {
        await interaction.reply({
          content: `Nu există rezultate pentru **${gameType}**.`,
        });
        return;
      }

      const lines = streaks.map(
        ({ username, currentStreak, biggestStreak }, idx) =>
          `${idx + 1}. **${username}**: ${currentStreak} zi${currentStreak !== 1 ? 'le' : ''}${
            biggestStreak !== currentStreak
              ? `, cel mai mare ${biggestStreak} zi${biggestStreak !== 1 ? 'le' : ''}`
              : ``
          }`,
      );

      await interaction.reply({
        content: `**Streak-uri pentru ${gameType}:**\n${lines.join('\n')}`,
      });
    } catch (error) {
      this.logger.error(`Error handling wordle streaks command: ${error}`);
      await interaction.reply({
        content: '❌ A apărut o eroare. Încearcă din nou.',
        ephemeral: true,
      });
    }
  }
}
