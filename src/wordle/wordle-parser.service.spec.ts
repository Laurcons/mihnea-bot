import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { WordleParserService } from './wordle-parser.service';

// main.ts installs these at bootstrap; the parser reads "today" through them.
dayjs.extend(utc);
dayjs.extend(timezone);

describe('WordleParserService', () => {
  const parser = new WordleParserService();

  describe('Magnitudle', () => {
    // 2026-07-20 in Bucharest, against the 2026-01-01 = day 1 anchor.
    const postedAt = new Date('2026-07-20T12:00:00Z');
    const expectedPuzzleDay = 201;

    it('parses a result with the share link on its own line', () => {
      const content = [
        'Magnitudle - Daily Estimation Game',
        '',
        'Score: 88/100 (0.5 orders of magnitude off)',
        '',
        '🟥🟥🟥🟥🟥🟥🟥🟥🟥◻️',
        '',
        'https://magnitudle.com/daily',
      ].join('\n');

      expect(parser.parse(content, postedAt)).toEqual([
        {
          gameType: 'Magnitudle',
          puzzleDay: expectedPuzzleDay,
          tries: null,
          maxTries: 10,
          score: 88,
          scoreMax: 100,
          attempts: ['🟥🟥🟥🟥🟥🟥🟥🟥🟥◻️'],
        },
      ]);
    });

    it('parses a result with the share link appended to the grid line', () => {
      const content = [
        'Magnitudle - Daily Estimation Game',
        '',
        'Score: 65/100 (1.4 orders of magnitude off)',
        '',
        '🟥🟥🟥🟥🟥🟥🟥◻️◻️◻️ https://magnitudle.com/daily',
      ].join('\n');

      const [result] = parser.parse(content, postedAt);

      expect(result.score).toBe(65);
      // The trailing URL must not leak into the stored grid.
      expect(result.attempts).toEqual(['🟥🟥🟥🟥🟥🟥🟥◻️◻️◻️']);
    });

    it('parses a low score', () => {
      const content = [
        'Magnitudle - Daily Estimation Game',
        '',
        'Score: 40/100 (2.4 orders of magnitude off)',
        '',
        '🟥🟥🟥🟥◻️◻️◻️◻️◻️◻️ https://magnitudle.com/daily',
      ].join('\n');

      const [result] = parser.parse(content, postedAt);

      expect(result.score).toBe(40);
      expect(result.tries).toBeNull();
    });

    // A perfect score reads "(spot on)" rather than "N orders of magnitude
    // off", which the original pattern required literally.
    it('parses a perfect score', () => {
      const content = [
        'Magnitudle - Daily Estimation Game',
        '',
        'Score: 100/100 (spot on)',
        '',
        '🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥 https://magnitudle.com/daily',
      ].join('\n');

      const [result] = parser.parse(content, postedAt);

      expect(result.score).toBe(100);
      expect(result.scoreMax).toBe(100);
      expect(result.attempts).toEqual(['🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥']);
    });

    it('parses a singular "1 order of magnitude off"', () => {
      const content = [
        'Magnitudle - Daily Estimation Game',
        '',
        'Score: 70/100 (1 order of magnitude off)',
        '',
        '🟥🟥🟥🟥🟥🟥🟥◻️◻️◻️',
      ].join('\n');

      expect(parser.parse(content, postedAt)[0].score).toBe(70);
    });

    it('parses a scoreline with no parenthetical at all', () => {
      const content = [
        'Magnitudle - Daily Estimation Game',
        '',
        'Score: 55/100',
        '',
        '🟥🟥🟥🟥🟥◻️◻️◻️◻️◻️',
      ].join('\n');

      expect(parser.parse(content, postedAt)[0].score).toBe(55);
    });

    it('derives the puzzle day from when the message was posted', () => {
      const content = [
        'Magnitudle - Daily Estimation Game',
        '',
        'Score: 88/100 (0.5 orders of magnitude off)',
        '',
        '🟥🟥🟥🟥🟥🟥🟥🟥🟥◻️',
      ].join('\n');

      const earlier = parser.parse(content, new Date('2026-07-20T12:00:00Z'));
      const later = parser.parse(content, new Date('2026-07-21T12:00:00Z'));

      expect(later[0].puzzleDay).toBe(earlier[0].puzzleDay + 1);
    });

    it('uses the Bucharest date, not UTC', () => {
      const content = [
        'Magnitudle - Daily Estimation Game',
        '',
        'Score: 88/100 (0.5 orders of magnitude off)',
        '',
        '🟥🟥🟥🟥🟥🟥🟥🟥🟥◻️',
      ].join('\n');

      // 22:30 UTC on the 20th is already 01:30 on the 21st in Bucharest.
      const [result] = parser.parse(content, new Date('2026-07-20T22:30:00Z'));

      expect(result.puzzleDay).toBe(expectedPuzzleDay + 1);
    });

    it('ignores the title line without a following scoreline', () => {
      const content = ['Magnitudle - Daily Estimation Game', '', 'salut'].join(
        '\n',
      );

      expect(parser.parse(content, postedAt)).toEqual([]);
    });
  });

  describe('other games', () => {
    const postedAt = new Date('2026-04-03T12:00:00Z');

    it('parses Wordle and strips the thousands separator', () => {
      const content = ['Wordle 1,749 4/6', '', '⬛⬛⬛⬛⬛', '🟩🟩🟩🟩🟩'].join(
        '\n',
      );

      const [result] = parser.parse(content, postedAt);

      expect(result.gameType).toBe('Wordle');
      expect(result.puzzleDay).toBe(1749);
      expect(result.tries).toBe(4);
      expect(result.score).toBeNull();
    });

    it('records a Wordle loss as null tries', () => {
      const content = ['Wordle 1749 X/6', '', '⬛⬛⬛⬛⬛'].join('\n');

      expect(parser.parse(content, postedAt)[0].tries).toBeNull();
    });

    // Regression: the puzzle day was parsed with a bare parseInt, so a
    // comma-formatted number came out as 1.
    it('strips the thousands separator from a Nerdle puzzle day', () => {
      const content = ['nerdlegame 1,538 3/6', '', '🟩🟩🟩🟩🟩🟩🟩🟩'].join(
        '\n',
      );

      const [result] = parser.parse(content, postedAt);

      expect(result.gameType).toBe('Nerdle');
      expect(result.puzzleDay).toBe(1538);
      expect(result.tries).toBe(3);
    });

    // Regression: parseInt('X') produced NaN, which Mongoose rejected with a
    // CastError, so the result was never saved.
    it('records a Nerdle loss as null tries rather than NaN', () => {
      const content = ['nerdlegame 1538 X/6', '', '🟥🟥🟥🟥🟥🟥🟥🟥'].join(
        '\n',
      );

      expect(parser.parse(content, postedAt)[0].tries).toBeNull();
    });

    // Regression: Daily Extreme was tagged QuordleChill, so both games shared
    // one key in the {userId, gameType, puzzleDay} unique index.
    it('gives Quordle Chill and Extreme distinct game types', () => {
      const chill = parser.parse('😎 Daily Chill 613', postedAt);
      const extreme = parser.parse('🥵 Daily Extreme 613', postedAt);

      expect(chill[0].gameType).toBe('QuordleChill');
      expect(extreme[0].gameType).toBe('QuordleExtreme');
    });

    it('parses several results from one message', () => {
      const content = [
        'Wordle 1749 4/6',
        '',
        '🟩🟩🟩🟩🟩',
        '',
        'nerdlegame 1538 3/6',
        '',
        '🟩🟩🟩🟩🟩🟩🟩🟩',
      ].join('\n');

      expect(parser.parse(content, postedAt).map((r) => r.gameType)).toEqual([
        'Wordle',
        'Nerdle',
      ]);
    });

    it('returns nothing for an unrelated message', () => {
      expect(parser.parse('salut ce faceti', postedAt)).toEqual([]);
    });
  });
});
