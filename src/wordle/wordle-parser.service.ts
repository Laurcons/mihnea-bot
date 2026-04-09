import { Injectable, Logger } from '@nestjs/common';
import { ParsedWordleResult } from './wordle.types';
import dayjs from 'dayjs';

interface PuzzleDayAnchor {
  /** A known date in YYYY-MM-DD format (Romania timezone). */
  date: string;
  /** The puzzle day number that corresponds to that date. */
  puzzleDay: number;
}

interface WordleGameDefinition {
  gameType: string;
  headerRegex: RegExp;
  emojiLineRegex: RegExp;
  extractPuzzleDay: (match: RegExpMatchArray) => number;
  extractTries: (match: RegExpMatchArray, attempts: string[]) => number | null;
  maxTries: number;
  anchor: PuzzleDayAnchor;
}

// Puzzle #1 launch dates used as anchors.
// Verify/update puzzleDay values if the game ever resets or skips numbers.
const GAME_DEFINITIONS: WordleGameDefinition[] = [
  {
    gameType: 'Wordle',
    headerRegex: /^Wordle\s+([\d,.]+)\s+([1-6X])\/6\*?$/im,
    emojiLineRegex: /^[🟩🟨⬛🟦⬜]+$/u,
    extractPuzzleDay: (m) => parseInt(m[1].replace(/[,.]/g, ''), 10),
    extractTries: (m) => (m[2] === 'X' ? null : parseInt(m[2], 10)),
    maxTries: 6,
    anchor: { date: '2026-04-03', puzzleDay: 1749 },
  },
  {
    gameType: 'RoWordle',
    headerRegex: /^🇷🇴 Wordle-RO\s+(\d+)\s+([1-6X])\/6\*?$/im,
    emojiLineRegex: /^[🟩🟨⬛🟦⬜]+$/u,
    extractPuzzleDay: (m) => parseInt(m[1], 10),
    extractTries: (m) => (m[2] === 'X' ? null : parseInt(m[2], 10)),
    maxTries: 6,
    anchor: { date: '2026-04-03', puzzleDay: 1553 },
  },
  {
    gameType: 'QuordleClassic',
    headerRegex: /^🙂\s+Daily\s+Quordle\s+(\d+)$/im,
    emojiLineRegex: /^[🟥🔟9️⃣8️⃣7️⃣6️⃣5️⃣4️⃣3️⃣2️⃣1️⃣]+$/u,
    extractPuzzleDay: (m) => parseInt(m[1], 10),
    extractTries: () => null,
    maxTries: 10,
    anchor: { date: '2026-04-03', puzzleDay: 1530 },
  },
  {
    gameType: 'QuordleChill',
    headerRegex: /^😎\s+Daily\s+Chill\s+(\d+)$/im,
    emojiLineRegex: /^[🟥🔟9️⃣8️⃣7️⃣6️⃣5️⃣4️⃣3️⃣2️⃣1️⃣]+$/u,
    extractPuzzleDay: (m) => parseInt(m[1], 10),
    extractTries: () => null,
    maxTries: 10,
    anchor: { date: '2026-04-03', puzzleDay: 613 },
  },
  {
    gameType: 'QuordleChill',
    headerRegex: /^🥵\s+Daily\s+Extreme\s+(\d+)$/im,
    emojiLineRegex: /^[🟥🔟9️⃣8️⃣7️⃣6️⃣5️⃣4️⃣3️⃣2️⃣1️⃣]+$/u,
    extractPuzzleDay: (m) => parseInt(m[1], 10),
    extractTries: () => null,
    maxTries: 6,
    anchor: { date: '2026-04-03', puzzleDay: 613 },
  },
  {
    gameType: 'Doctordle',
    headerRegex: /^Doctordle\s+#(\d+)$/im,
    emojiLineRegex: /^[ 🏥🟥🟩⬛]+$/u,
    extractPuzzleDay: (m) => parseInt(m[1], 10),
    extractTries: () => null,
    maxTries: 9,
    anchor: { date: '2026-04-03', puzzleDay: 261 },
  },
  {
    gameType: 'Letterle',
    headerRegex: /^Letterle\s+(\d+)\/26$/im,
    emojiLineRegex: /^[⬜️🟩]+$/u,
    extractPuzzleDay: () => daysBetween('2026-01-01', getTodayInRomania()),
    extractTries: (_, attempts) => attempts.length,
    maxTries: 26,
    anchor: { date: '2026-01-01', puzzleDay: 1 },
  },
  {
    gameType: 'OwdleHero',
    headerRegex:
      /^Owdle Hero\s+(\d{4}-\d{2}-\d{2})\s.{1,2}\s\((\d+) tries\)$/im,
    emojiLineRegex: /^[🟥🟨🟩]+$/u,
    extractPuzzleDay: (m) => daysBetween('2026-01-01', m[1]),
    extractTries: (m) => parseInt(m[2], 10),
    maxTries: 100,
    anchor: { date: '2026-01-01', puzzleDay: 1 },
  },
  {
    gameType: 'OwdleConversation',
    headerRegex:
      /^Owdle Conversation\s+(\d{4}-\d{2}-\d{2})\s.{1,2}\s\((\d+) tries\)$/im,
    emojiLineRegex: /^[🟥🟨🟩]+$/u,
    extractPuzzleDay: (m) => daysBetween('2026-01-01', m[1]),
    extractTries: (m) => parseInt(m[2], 10),
    maxTries: 100,
    anchor: { date: '2026-01-01', puzzleDay: 1 },
  },
  {
    gameType: 'Nerdle',
    headerRegex: /^nerdlegame\s+([\d,]+)\s+([X\d])\/6$/im,
    emojiLineRegex: /^[🟥🟨🟩🟪⬛]+$/u,
    extractPuzzleDay: (m) => parseInt(m[1], 10),
    extractTries: (m) => parseInt(m[2], 10),
    maxTries: 6,
    anchor: { date: '2026-04-06', puzzleDay: 1538 },
  },
];

export const WORDLE_GAME_TYPES: string[] = [
  ...new Set(GAME_DEFINITIONS.map((d) => d.gameType)),
];

function getTodayInRomania(): string {
  return dayjs().tz('Europe/Bucharest').format('YYYY-MM-DD');
}

function daysBetween(fromDate: string, toDate: string): number {
  return dayjs.utc(toDate).diff(dayjs.utc(fromDate), 'day');
}

function calculateTodayPuzzleDay(anchor: PuzzleDayAnchor): number {
  const today = getTodayInRomania();
  return anchor.puzzleDay + daysBetween(anchor.date, today);
}

@Injectable()
export class WordleParserService {
  getCurrentPuzzleDay(gameType: string): number {
    const definition = GAME_DEFINITIONS.find((d) => d.gameType === gameType);
    if (!definition) throw new Error(`Incorrect game type: ${gameType}`);
    return calculateTodayPuzzleDay(definition.anchor);
  }

  isCurrentPuzzle(gameType: string, puzzleDay: number): boolean {
    const definition = GAME_DEFINITIONS.find((d) => d.gameType === gameType);
    if (!definition) return false;
    const todayPuzzleDay = calculateTodayPuzzleDay(definition.anchor);

    if (puzzleDay === todayPuzzleDay) return true;

    // Yesterday's puzzle accepted only within the 2-hour midnight leeway
    if (puzzleDay === todayPuzzleDay - 1) {
      return dayjs().tz('Europe/Bucharest').hour() < 2;
    }

    return false;
  }

  parse(content: string): ParsedWordleResult[] {
    const lines = content.split('\n').map((l) => l.trim());
    const results: ParsedWordleResult[] = [];
    let i = 0;

    while (i < lines.length) {
      let matched = false;

      for (const definition of GAME_DEFINITIONS) {
        const headerMatch = lines[i].match(definition.headerRegex);
        if (!headerMatch) continue;

        const puzzleDay = definition.extractPuzzleDay(headerMatch);

        // Skip one optional empty line between header and tries block
        let triesStart = i + 1;
        if (triesStart < lines.length && lines[triesStart] === '') {
          triesStart++;
        }

        // Collect contiguous emoji lines
        const attempts: string[] = [];
        let j = triesStart;
        while (j < lines.length && definition.emojiLineRegex.test(lines[j])) {
          attempts.push(lines[j]);
          j++;
        }

        const tries = definition.extractTries(headerMatch, attempts);
        results.push({
          gameType: definition.gameType,
          puzzleDay,
          tries,
          maxTries: definition.maxTries,
          attempts,
        });

        i = j;
        matched = true;
        break;
      }

      if (!matched) {
        i++;
      }
    }

    return results;
  }
}
