import { Injectable, Logger } from '@nestjs/common';
import { Message } from 'discord.js';
import { BotConfigService } from '../bot-config.service';
import { ParsedWordleResult } from './types/wordle.types';

const BASE_SYSTEM_PROMPT =
  'Ești Mihneainatorul, o parodie a lui Mihnea. Ești un user pe serverul nostru de Discord, „amogus". Menirea ta pe acest pământ este să dai cu hate în oricine îți scrie. Trebuie să găsești cele mai creative insulte, fiindcă dacă nu faci lumea să râdă, nu te faci plăcut. În general, îți place să legi insultele tale de mamele celor insultați, zicând des „mă-ta" sau „maică-ta". Ești destul de inteligent, însă nu vrei niciodată să te dai mare. Stilul tău de chat pe Discord este relaxat, cu litere mici, mereu fără diacritice sau cratime, dar mereu fără greșeli de exprimare.';

@Injectable()
export class WordleCommentaryService {
  private readonly logger = new Logger(WordleCommentaryService.name);

  constructor(private readonly botConfig: BotConfigService) {}

  async generateAndSendCommentary(
    message: Message,
    result: ParsedWordleResult,
  ): Promise<void> {
    try {
      const commentary = await this.generateCommentary(
        message.author.username,
        result,
      );
      await message.reply(commentary);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to generate wordle commentary: ${msg}`);
    }
  }

  private buildSystemInstruction(result: ParsedWordleResult): string {
    const { tries, maxTries } = result;

    if (tries === null) {
      return 'Userul a pierdut complet, nu a reusit sa ghiceasca. Fii cum esti tu si adreseaza-i ceva.';
    }

    if (tries === 1) {
      return 'Userul a ghicit din prima incercare. Fa un comentariu de genul ca mama lui l-a crescut bine si e destept, sarcastic dar oarecum laudativ fata de mama lui.';
    }

    if (tries === maxTries) {
      return `Userul a reusit abia la ultima incercare posibila (${maxTries} din ${maxTries}). Fa un comentariu cu o comparatie cu mama lui, sugerand ca desi si ea termina greu lucrurile sau are dificultati similare, userul e mai rau.`;
    }

    return `Userul a castigat in ${tries} din ${maxTries} incercari. Fii sarcastic si baga si mama lui in vorba.`;
  }

  private async generateCommentary(
    username: string,
    result: ParsedWordleResult,
  ): Promise<string> {
    const apiKey = this.botConfig.getOpenAIApiKey();
    const model = this.botConfig.getOpenAIModel();

    const caseInstruction = this.buildSystemInstruction(result);
    const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\nComentezi rezultatele de Wordle ale userilor de pe server. ${caseInstruction} Raspunde scurt, maxim 1-2 propozitii.`;

    const triesDisplay =
      result.tries !== null
        ? `${result.tries}/${result.maxTries}`
        : `X/${result.maxTries}`;
    const userPrompt = `@${username} a postat rezultatul la ${result.gameType}: ${triesDisplay}. Comenteaza.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${errorBody}`,
      );
      throw new Error('Failed to generate commentary from OpenAI');
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const reply = payload.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error('OpenAI returned an empty response');
    }

    return reply;
  }
}
