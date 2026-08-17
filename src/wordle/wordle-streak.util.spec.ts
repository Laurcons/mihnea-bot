import { computeStreak, isStreakStale } from './wordle-streak.util';

describe('isStreakStale', () => {
  const today = 100;

  it('treats a result from today as live', () => {
    expect(isStreakStale(100, today)).toBe(false);
  });

  it('treats a result from yesterday as live, since today is not over', () => {
    expect(isStreakStale(99, today)).toBe(false);
  });

  it('treats anything older as broken', () => {
    expect(isStreakStale(98, today)).toBe(true);
  });
});

describe('computeStreak', () => {
  const today = 100;

  it('returns null for an empty history', () => {
    expect(computeStreak([], today)).toBeNull();
  });

  it('counts a run ending today', () => {
    expect(computeStreak([98, 99, 100], today)).toEqual({
      lastPuzzleDay: 100,
      currentStreak: 3,
      biggestStreak: 3,
    });
  });

  it('counts a run ending yesterday as still live', () => {
    expect(computeStreak([97, 98, 99], today)).toEqual({
      lastPuzzleDay: 99,
      currentStreak: 3,
      biggestStreak: 3,
    });
  });

  it('zeroes the current streak once the last result is too old', () => {
    expect(computeStreak([96, 97, 98], today)).toEqual({
      lastPuzzleDay: 98,
      currentStreak: 0,
      biggestStreak: 3,
    });
  });

  it('restarts the current streak after a gap', () => {
    expect(computeStreak([90, 91, 92, 99, 100], today)).toEqual({
      lastPuzzleDay: 100,
      currentStreak: 2,
      biggestStreak: 3,
    });
  });

  // The old implementation only ever took max(stored, currentStreak), so a
  // long past run was lost whenever the current one was shorter.
  it('reports the longest historical run even when the current one is shorter', () => {
    expect(computeStreak([80, 81, 82, 83, 84, 99, 100], today)).toEqual({
      lastPuzzleDay: 100,
      currentStreak: 2,
      biggestStreak: 5,
    });
  });

  it('keeps the biggest streak after the current one breaks', () => {
    expect(computeStreak([80, 81, 82, 83, 84], today)).toEqual({
      lastPuzzleDay: 84,
      currentStreak: 0,
      biggestStreak: 5,
    });
  });

  it('handles unsorted input', () => {
    expect(computeStreak([100, 98, 99], today)).toEqual({
      lastPuzzleDay: 100,
      currentStreak: 3,
      biggestStreak: 3,
    });
  });

  it('ignores duplicate puzzle days', () => {
    expect(computeStreak([99, 100, 100, 99], today)).toEqual({
      lastPuzzleDay: 100,
      currentStreak: 2,
      biggestStreak: 2,
    });
  });

  it('handles a single result', () => {
    expect(computeStreak([100], today)).toEqual({
      lastPuzzleDay: 100,
      currentStreak: 1,
      biggestStreak: 1,
    });
  });
});
