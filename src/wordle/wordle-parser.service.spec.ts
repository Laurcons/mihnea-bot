import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
  WordleParserService,
  WORDLE_GAME_TYPES,
} from './wordle-parser.service';

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

  describe('Angle', () => {
    const postedAt = new Date('2026-08-16T12:00:00Z');

    it('parses a win with the share link on its own line', () => {
      const content = [
        '#Angle #1517 4/4',
        '⬆️⬇️⬆️🎉',
        'https://www.angle.wtf/',
      ].join('\n');

      expect(parser.parse(content, postedAt)).toEqual([
        {
          gameType: 'Angle',
          puzzleDay: 1517,
          tries: 4,
          maxTries: 4,
          score: null,
          scoreMax: null,
          attempts: ['⬆️⬇️⬆️🎉'],
        },
      ]);
    });

    it('parses a first-guess win', () => {
      const [result] = parser.parse('#Angle #1511 1/4\n🎉', postedAt);

      expect(result.tries).toBe(1);
      expect(result.attempts).toEqual(['🎉']);
    });

    // A loss appends " : 1° off" to the grid line, which would otherwise stop
    // the line matching and drop the grid entirely.
    it('parses a loss and strips the degrees-off annotation', () => {
      const content = ['#Angle #1514 X/4', '⬇️⬇️⬇️⬆️ : 1° off'].join('\n');

      const [result] = parser.parse(content, postedAt);

      expect(result.tries).toBeNull();
      expect(result.puzzleDay).toBe(1514);
      expect(result.attempts).toEqual(['⬇️⬇️⬇️⬆️']);
    });

    it('accepts arrows without the variation selector', () => {
      const [result] = parser.parse('#Angle #1516 3/4\n⬆⬇🎉', postedAt);

      expect(result.tries).toBe(3);
      expect(result.attempts).toHaveLength(1);
    });

    // Anchor sanity. Time is frozen because getCurrentPuzzleDay reads the
    // real clock, which would make this pass today and fail tomorrow.
    it.each([
      ['2026-08-10', 1511],
      ['2026-08-16', 1517],
      ['2026-08-17', 1518],
    ])('reports puzzle %s as #%i', (date, expected) => {
      jest.useFakeTimers().setSystemTime(new Date(`${date}T12:00:00Z`));

      try {
        expect(parser.getCurrentPuzzleDay('Angle')).toBe(expected);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  // A game changing its share format used to be indistinguishable from
  // ordinary chatter: the message was dropped in silence.
  describe('looksLikeUnparsedResult', () => {
    it.each([
      ['Score: 100/100 (spot on)\nMagnitudle - Daily Estimation Game'],
      ['#Angle #1517 9/9'],
      ['Wordle 1749 7/6'],
    ])('flags %j as a probable result', (content) => {
      expect(parser.looksLikeUnparsedResult(content)).toBe(true);
    });

    it.each([
      ['salut ce faceti'],
      ['ma duc sa joc wordle mai tarziu'], // a game name, but no number
      ['am luat 5 la mate'], // a number, but no game name
      [''],
    ])('does not flag %j', (content) => {
      expect(parser.looksLikeUnparsedResult(content)).toBe(false);
    });

    // One representative header per game. Guards against adding a game and
    // forgetting its probe token — which would silently reinstate the
    // drop-in-silence behaviour for that game only.
    const HEADERS: Record<string, string> = {
      Wordle: 'Wordle 1749 4/6',
      RoWordle: '🇷🇴 Wordle-RO 1553 4/6',
      QuordleClassic: '🙂 Daily Quordle 1530',
      QuordleChill: '😎 Daily Chill 613',
      QuordleExtreme: '🥵 Daily Extreme 613',
      Doctordle: 'Doctordle #261',
      Letterle: 'Letterle 5/26',
      OwdleHero: 'Owdle Hero 2026-04-03 ✅ (3 tries)',
      OwdleConversation: 'Owdle Conversation 2026-04-03 ✅ (3 tries)',
      Nerdle: 'nerdlegame 1538 3/6',
      Polygonle: '#Polygonle 1350 3/6.',
      PolygonleMini: '#PolygonleMini 1104 3/6.',
      Magnitudle: 'Magnitudle - Daily Estimation Game\nScore: 88/100',
      Angle: '#Angle #1517 4/4',
    };

    it('has a sample header for every registered game type', () => {
      expect(Object.keys(HEADERS).sort()).toEqual(
        [...WORDLE_GAME_TYPES].sort(),
      );
    });

    it.each(Object.entries(HEADERS))(
      'flags a %s header',
      (_gameType, header) => {
        expect(parser.looksLikeUnparsedResult(header)).toBe(true);
      },
    );
  });

  // The grid patterns for these games were rewritten from character classes
  // to alternations; these pin that the rewrite kept them parsing. Written
  // with escapes because the originals mixed keycap sequences, variation
  // selectors and em-spaces that are invisible in a source file.
  describe('rewritten grid patterns', () => {
    const postedAt = new Date('2026-04-11T12:00:00Z');

    it('parses a Quordle keycap grid', () => {
      const grid = `\u{1F7E5}4️⃣\u{1F51F}`;
      const [result] = parser.parse(
        `\u{1F642} Daily Quordle 1530\n${grid}`,
        postedAt,
      );

      expect(result.gameType).toBe('QuordleClassic');
      expect(result.attempts).toEqual([grid]);
    });

    it('parses a Quordle keycap grid without variation selectors', () => {
      const grid = `\u{1F7E5}4⃣`;
      const [result] = parser.parse(
        `\u{1F642} Daily Quordle 1530\n${grid}`,
        postedAt,
      );

      expect(result.attempts).toEqual([grid]);
    });

    it('parses a Letterle grid', () => {
      const grid = `⬜️⬜️\u{1F7E9}`;
      const [result] = parser.parse(`Letterle 3/26\n${grid}`, postedAt);

      expect(result.gameType).toBe('Letterle');
      expect(result.attempts).toEqual([grid]);
    });

    it('parses a Polygonle shape row and colour row', () => {
      const shapes = `\u2B22\uFE0E\u2004\u25E5\uFE0E\u2005\u25FC\uFE0E`;
      const colours = `\u{1F7E5}\u{1F7E8}\u{1F7E9}`;
      const [result] = parser.parse(
        `#Polygonle 1350 3/6.\n${shapes}\n${colours}`,
        postedAt,
      );

      expect(result.gameType).toBe('Polygonle');
      expect(result.attempts).toEqual([shapes, colours]);
    });

    it('parses a PolygonleMini grid containing a diamond', () => {
      const shapes = `\u25C6\uFE0E\u2005\u2B22\uFE0E`;
      const [result] = parser.parse(
        `#PolygonleMini 1104 2/6.\n${shapes}`,
        postedAt,
      );

      expect(result.gameType).toBe('PolygonleMini');
      expect(result.attempts).toEqual([shapes]);
    });

    // The old character classes decomposed into individual members, so a bare
    // variation selector counted as a valid grid line.
    it('no longer accepts a lone variation selector as a grid', () => {
      const [result] = parser.parse(`Letterle 3/26\n️`, postedAt);

      expect(result.attempts).toEqual([]);
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
