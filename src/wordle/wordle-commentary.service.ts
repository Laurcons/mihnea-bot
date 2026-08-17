import { Injectable, Logger } from '@nestjs/common';
import { Message } from 'discord.js';
import { OpenAiService } from '../openai.service';
import { MIHNEAINATOR_PERSONA } from '../persona';
import { ParsedWordleResult } from './types/wordle.types';

@Injectable()
export class WordleCommentaryService {
  private readonly logger = new Logger(WordleCommentaryService.name);

  constructor(private readonly openAi: OpenAiService) {}

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
    const { tries, maxTries, score, scoreMax } = result;

    // Scored games have to be handled before the tries branches: they carry
    // tries === null, which would otherwise read as a total loss, and their
    // scale runs the opposite way (higher is better).
    if (score !== null && scoreMax !== null && scoreMax > 0) {
      const pct = (score / scoreMax) * 100;

      if (pct >= 100) {
        return `Userul a nimerit perfect, scor maxim ${score} din ${scoreMax}. Fa un comentariu sarcastic dar laudativ, sugerand ca sigur a avut noroc sau ca mama lui i-a suflat raspunsul.`;
      }

      if (pct >= 90) {
        return `Userul a nimerit aproape perfect, cu un scor de ${score} din ${scoreMax}. Fa un comentariu sarcastic dar oarecum laudativ, sugerand ca a mostenit ceva creier de la mama lui.`;
      }

      if (pct >= 60) {
        return `Userul a luat un scor decent, ${score} din ${scoreMax}, dar nimic de laudat. Fii sarcastic si baga si mama lui in vorba.`;
      }

      if (pct >= 30) {
        return `Userul a luat un scor mediocru, ${score} din ${scoreMax}. Ironizeaza-l ca habar n-are sa aprecieze marimi si baga si mama lui in vorba.`;
      }

      return `Userul a luat un scor jalnic, ${score} din ${scoreMax}, adica a fost departe rau. Fii cum esti tu si adreseaza-i ceva despre cat de departe a fost, comparand cu mama lui.`;
    }

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
    const caseInstruction = this.buildSystemInstruction(result);

    const resultDisplay =
      result.score !== null && result.scoreMax !== null
        ? `${result.score}/${result.scoreMax}`
        : result.tries !== null
          ? `${result.tries}/${result.maxTries}`
          : `X/${result.maxTries}`;

    return this.openAi.chat({
      system: `${MIHNEAINATOR_PERSONA}\n\nComentezi rezultatele de Wordle ale userilor de pe server. ${caseInstruction} Raspunde scurt, maxim 1-2 propozitii.`,
      user: `@${username} a postat rezultatul la ${result.gameType}: ${resultDisplay}. Comenteaza.`,
    });
  }
}
