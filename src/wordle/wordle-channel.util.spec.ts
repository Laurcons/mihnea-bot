import { channelNameFor, diffAccess } from './wordle-channel.util';
import { WORDLE_GAME_TYPES } from './wordle-parser.service';

describe('channelNameFor', () => {
  it('lowercases the game type behind the prefix', () => {
    expect(channelNameFor('Magnitudle')).toBe('todays-magnitudle');
    expect(channelNameFor('RoWordle')).toBe('todays-rowordle');
    expect(channelNameFor('PolygonleMini')).toBe('todays-polygonlemini');
  });

  it('produces a distinct name for every game type', () => {
    const names = WORDLE_GAME_TYPES.map(channelNameFor);

    expect(new Set(names).size).toBe(names.length);
  });

  // Matching is exact, so the shorter name must not also match the longer one.
  it('does not collide between Polygonle and PolygonleMini', () => {
    expect(channelNameFor('Polygonle')).not.toBe(
      channelNameFor('PolygonleMini'),
    );
  });

  it('only ever produces valid Discord channel names', () => {
    for (const gameType of WORDLE_GAME_TYPES) {
      expect(channelNameFor(gameType)).toMatch(/^[a-z0-9-]{1,100}$/);
    }
  });
});

describe('diffAccess', () => {
  it('grants everyone when the channel is empty', () => {
    expect(diffAccess([], ['a', 'b'])).toEqual({
      toGrant: ['a', 'b'],
      toRevoke: [],
    });
  });

  // The midnight case: nobody has posted for the new puzzle day yet.
  it('revokes everyone when nobody qualifies', () => {
    expect(diffAccess(['a', 'b'], [])).toEqual({
      toGrant: [],
      toRevoke: ['a', 'b'],
    });
  });

  it('does nothing when the channel already matches', () => {
    expect(diffAccess(['a', 'b'], ['b', 'a'])).toEqual({
      toGrant: [],
      toRevoke: [],
    });
  });

  it('applies only the delta', () => {
    expect(diffAccess(['a', 'b'], ['b', 'c'])).toEqual({
      toGrant: ['c'],
      toRevoke: ['a'],
    });
  });

  it('tolerates duplicates on either side', () => {
    expect(diffAccess(['a', 'a'], ['b', 'b'])).toEqual({
      toGrant: ['b'],
      toRevoke: ['a'],
    });
  });
});
