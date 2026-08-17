import { Injectable, Logger } from '@nestjs/common';
import { ParsedWordleResult } from './types/wordle.types';
import dayjs from 'dayjs';

interface PuzzleDayAnchor {
  /** A known date in YYYY-MM-DD format (Romania timezone). */
  date: string;
  /** The puzzle day number that corresponds to that date. */
  puzzleDay: number;
}

interface WordleGameDefinition {
  gameType: string;
  /**
   * Optional line that must appear immediately before the header (one blank
   * line between is allowed). For games whose share text splits the game name
   * and the scoreline across two lines.
   */
  titleRegex?: RegExp;
  headerRegex: RegExp;
  emojiLineRegex: RegExp;
  /**
   * `referenceDate` is the YYYY-MM-DD Romanian date the result was posted on.
   * Games whose share text carries no puzzle number or date have to fall back
   * to it.
   */
  extractPuzzleDay: (match: RegExpMatchArray, referenceDate: string) => number;
  extractTries: (match: RegExpMatchArray, attempts: string[]) => number | null;
  maxTries: number;
  /** For games scored on a scale rather than a number of guesses. */
  extractScore?: (match: RegExpMatchArray) => number | null;
  maxScore?: number;
  anchor: PuzzleDayAnchor;
}

/**
 * Decorations some games hang off the end of a grid line rather than putting
 * on their own: a share link, or an annotation like " : 1° off" on an Angle
 * loss. Stripped so they never land in the stored grid.
 *
 * Only ever applied to a line the game's own emojiLineRegex already accepted,
 * so these cannot fire on unrelated content.
 */
const ATTEMPT_DECORATIONS = [/\s*https?:\/\/\S+$/, /\s*:\s.*$/];

function cleanAttempt(line: string): string {
  return ATTEMPT_DECORATIONS.reduce(
    (acc, pattern) => acc.replace(pattern, ''),
    line,
  ).trim();
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
    gameType: 'QuordleExtreme',
    headerRegex: /^🥵\s+Daily\s+Extreme\s+(\d+)$/im,
    emojiLineRegex: /^[🟥🔟9️⃣8️⃣7️⃣6️⃣5️⃣4️⃣3️⃣2️⃣1️⃣]+$/u,
    extractPuzzleDay: (m) => parseInt(m[1], 10),
    extractTries: () => null,
    maxTries: 6,
    // Inherited from the Daily Chill entry this was copy-pasted from; if
    // Extreme results still get rejected as "not today's puzzle", this anchor
    // needs re-deriving from a real Daily Extreme share.
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
    extractPuzzleDay: (_, ref) => 1 + daysBetween('2026-01-01', ref),
    extractTries: (_, attempts) => attempts.length,
    maxTries: 26,
    anchor: { date: '2026-01-01', puzzleDay: 1 },
  },
  {
    gameType: 'OwdleHero',
    headerRegex:
      /^Owdle Hero\s+(\d{4}-\d{2}-\d{2})\s.{1,2}\s\((\d+) tries\)$/im,
    emojiLineRegex: /^[🟥🟨🟩]+$/u,
    extractPuzzleDay: (m) => 1 + daysBetween('2026-01-01', m[1]),
    extractTries: (m) => parseInt(m[2], 10),
    maxTries: 100,
    anchor: { date: '2026-01-01', puzzleDay: 1 },
  },
  {
    gameType: 'OwdleConversation',
    headerRegex:
      /^Owdle Conversation\s+(\d{4}-\d{2}-\d{2})\s.{1,2}\s\((\d+) tries\)$/im,
    emojiLineRegex: /^[🟥🟨🟩]+$/u,
    extractPuzzleDay: (m) => 1 + daysBetween('2026-01-01', m[1]),
    extractTries: (m) => parseInt(m[2], 10),
    maxTries: 100,
    anchor: { date: '2026-01-01', puzzleDay: 1 },
  },
  {
    gameType: 'Nerdle',
    headerRegex: /^nerdlegame\s+([\d,]+)\s+([X\d])\/6$/im,
    emojiLineRegex: /^[🟥🟨🟩🟪⬛]+$/u,
    extractPuzzleDay: (m) => parseInt(m[1].replace(/[,.]/g, ''), 10),
    extractTries: (m) => (m[2] === 'X' ? null : parseInt(m[2], 10)),
    maxTries: 6,
    anchor: { date: '2026-04-06', puzzleDay: 1538 },
  },
  {
    gameType: 'Polygonle',
    headerRegex: /^#Polygonle (\d+) (\d)\/(\d).$/im,
    emojiLineRegex: /^[ ⬢︎ ◥︎ ◼︎◤︎◢︎◥︎🟥🟨🟩🟪⬛]+$/u,
    extractPuzzleDay: (m) => parseInt(m[1], 10),
    extractTries: (m) => parseInt(m[2], 10),
    maxTries: 6,
    anchor: { date: '2026-04-11', puzzleDay: 1350 },
  },
  {
    gameType: 'PolygonleMini',
    headerRegex: /^#PolygonleMini (\d+) (\d)\/(\d).$/im,
    emojiLineRegex: /^[ ◆︎  ⬢︎ ◥︎ ◼︎◤︎◢︎◥︎🟥🟨🟩🟪⬛]+$/u,
    extractPuzzleDay: (m) => parseInt(m[1], 10),
    extractTries: (m) => parseInt(m[2], 10),
    maxTries: 6,
    anchor: { date: '2026-04-11', puzzleDay: 1104 },
  },
  {
    // Magnitudle's share text carries no puzzle number and no date, so the
    // puzzle day is derived from when the message was posted. That makes
    // isCurrentPuzzle a no-op for this game: a result posted today always
    // counts as today's. Duplicate protection rests on the unique index.
    gameType: 'Magnitudle',
    titleRegex: /^Magnitudle\s*[-–—]\s*Daily Estimation Game$/i,
    // The parenthetical is not always "N orders of magnitude off" — a perfect
    // score reads "(spot on)" — so it is matched loosely and treated as
    // optional. Safe to be permissive here because titleRegex already pins the
    // game down on the preceding line.
    headerRegex: /^Score:\s*(\d+)\/100(?:\s*\([^)]*\))?$/im,
    emojiLineRegex: /^(?:🟥|◻️)+(?:\s+https?:\/\/\S+)?$/u,
    extractPuzzleDay: (_, ref) => 1 + daysBetween('2026-01-01', ref),
    // Scored out of 100 rather than in guesses; see extractScore.
    extractTries: () => null,
    maxTries: 10,
    extractScore: (m) => parseInt(m[1], 10),
    maxScore: 100,
    anchor: { date: '2026-01-01', puzzleDay: 1 },
  },
  {
    gameType: 'Angle',
    headerRegex: /^#Angle\s+#(\d+)\s+([1-4X])\/4$/im,
    // The arrows are matched with an optional variation selector because
    // clients are inconsistent about emitting it. A loss appends " : 1° off"
    // to the grid, which cleanAttempt strips back off.
    emojiLineRegex: /^(?:[⬆⬇]️?|🎉)+(?:\s*:\s.*)?$/u,
    extractPuzzleDay: (m) => parseInt(m[1], 10),
    extractTries: (m) => (m[2] === 'X' ? null : parseInt(m[2], 10)),
    maxTries: 4,
    // Derived from seven consecutive days of results: 1511 on 2026-08-10
    // through 1517 on 2026-08-16.
    anchor: { date: '2026-08-16', puzzleDay: 1517 },
  },
];

export const WORDLE_GAME_TYPES: string[] = [
  ...new Set(GAME_DEFINITIONS.map((d) => d.gameType)),
];

/**
 * Distinctive name tokens for the supported games, used only to notice
 * messages that look like a result but produced nothing. A game changing its
 * share format is otherwise indistinguishable from ordinary chatter: the
 * message is dropped in silence, and the first sign of trouble is a player
 * asking why their streak broke.
 *
 * Add a token when adding a game. A missing one costs a warning, not a parse.
 */
const GAME_NAME_PROBE =
  /\b(wordle|quordle|daily\s+chill|daily\s+extreme|nerdle|letterle|doctordle|owdle|polygonle|magnitudle|angle)/i;

function toRomanianDate(date: Date): string {
  return dayjs(date).tz('Europe/Bucharest').format('YYYY-MM-DD');
}

function getTodayInRomania(): string {
  return toRomanianDate(new Date());
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

  /**
   * Whether a message that parsed to nothing nonetheless looks like it was
   * meant to be a result, and so is worth flagging rather than ignoring.
   * Requires a digit as well as a game name, since every supported header
   * carries a number and plain chatter usually does not.
   */
  looksLikeUnparsedResult(content: string): boolean {
    return GAME_NAME_PROBE.test(content) && /\d/.test(content);
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

  /**
   * `postedAt` is when the message was sent — used by games whose share text
   * carries no puzzle identifier. Pass the real message timestamp (rather than
   * letting it default to now) so reevaluations and backfills of older
   * messages resolve to the right puzzle day.
   */
  parse(content: string, postedAt: Date = new Date()): ParsedWordleResult[] {
    const lines = content.split('\n').map((l) => l.trim());
    const referenceDate = toRomanianDate(postedAt);
    const results: ParsedWordleResult[] = [];
    let i = 0;

    while (i < lines.length) {
      let matched = false;

      for (const definition of GAME_DEFINITIONS) {
        // Definitions with a titleRegex have their scoreline on a later line;
        // one blank line between the two is allowed.
        let headerLine = i;
        if (definition.titleRegex) {
          if (!definition.titleRegex.test(lines[i])) continue;
          headerLine = i + 1;
          if (headerLine < lines.length && lines[headerLine] === '') {
            headerLine++;
          }
          if (headerLine >= lines.length) continue;
        }

        const headerMatch = lines[headerLine].match(definition.headerRegex);
        if (!headerMatch) continue;

        const puzzleDay = definition.extractPuzzleDay(
          headerMatch,
          referenceDate,
        );

        // Skip one optional empty line between header and tries block
        let triesStart = headerLine + 1;
        if (triesStart < lines.length && lines[triesStart] === '') {
          triesStart++;
        }

        // Collect contiguous emoji lines
        const attempts: string[] = [];
        let j = triesStart;
        while (j < lines.length && definition.emojiLineRegex.test(lines[j])) {
          attempts.push(cleanAttempt(lines[j]));
          j++;
        }

        const tries = definition.extractTries(headerMatch, attempts);
        results.push({
          gameType: definition.gameType,
          puzzleDay,
          tries,
          maxTries: definition.maxTries,
          score: definition.extractScore?.(headerMatch) ?? null,
          scoreMax: definition.maxScore ?? null,
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
