import { Injectable } from '@nestjs/common';
import { ParsedWordleResult } from './wordle.types';

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
    headerRegex: /^Owdle Hero\s+(\d{4}-\d{2}-\d{2})\s.{1,2}\s\((\d) tries\)$/im,
    emojiLineRegex: /^[🟥🟨🟩]+$/u,
    extractPuzzleDay: (m) => daysBetween('2026-01-01', m[1]),
    extractTries: (m) => parseInt(m[2]),
    maxTries: 100,
    anchor: { date: '2026-01-01', puzzleDay: 1 },
  },
  {
    gameType: 'OwdleConversation',
    headerRegex:
      /^Owdle Conversation\s+(\d{4}-\d{2}-\d{2})\s.{1,2}\s\((\d) tries\)$/im,
    emojiLineRegex: /^[🟥🟨🟩]+$/u,
    extractPuzzleDay: (m) => daysBetween('2026-01-01', m[1]),
    extractTries: (m) => parseInt(m[2]),
    maxTries: 100,
    anchor: { date: '2026-01-01', puzzleDay: 1 },
  },
];

export const WORDLE_GAME_TYPES: string[] = [
  ...new Set(GAME_DEFINITIONS.map((d) => d.gameType)),
];

const ROMANIA_TIMEZONE = 'Europe/Bucharest';
const PUZZLE_DAY_TOLERANCE = 1;

function getTodayInRomania(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ROMANIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  // en-CA locale produces the YYYY-MM-DD format Intl guarantees
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(fromDate + 'T00:00:00Z');
  const to = new Date(toDate + 'T00:00:00Z');
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function calculateTodayPuzzleDay(anchor: PuzzleDayAnchor): number {
  const today = getTodayInRomania();
  return anchor.puzzleDay + daysBetween(anchor.date, today);
}

@Injectable()
export class WordleParserService {
  isCurrentPuzzle(gameType: string, puzzleDay: number): boolean {
    const definition = GAME_DEFINITIONS.find((d) => d.gameType === gameType);
    if (!definition) return false;
    const todayPuzzleDay = calculateTodayPuzzleDay(definition.anchor);
    return Math.abs(puzzleDay - todayPuzzleDay) <= PUZZLE_DAY_TOLERANCE;
  }

  parse(content: string): ParsedWordleResult | null {
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    for (const definition of GAME_DEFINITIONS) {
      const headerIndex = lines.findIndex((line) =>
        definition.headerRegex.test(line),
      );

      if (headerIndex === -1) {
        continue;
      }

      const headerMatch = lines[headerIndex].match(definition.headerRegex)!;
      const puzzleDay = definition.extractPuzzleDay(headerMatch);

      const attempts = lines
        .slice(headerIndex + 1)
        .filter((line) => definition.emojiLineRegex.test(line));

      const tries = definition.extractTries(headerMatch, attempts);

      return {
        gameType: definition.gameType,
        puzzleDay,
        tries,
        maxTries: definition.maxTries,
        attempts,
      };
    }

    return null;
  }
}
