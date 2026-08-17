/**
 * Pure streak arithmetic, shared by the runtime service and the offline
 * repair script. Deliberately free of Nest/Mongoose imports so the script can
 * use it without bootstrapping the app (and logging the bot into Discord).
 */

export interface ComputedStreak {
  lastPuzzleDay: number;
  currentStreak: number;
  biggestStreak: number;
}

/**
 * A streak is live only while the player could still keep it going: they
 * played today, or they played yesterday and today is not over yet. Anything
 * older is a broken streak worth 0.
 *
 * This is the same predicate the nightly invalidation cron applies, so the
 * cron can no longer disagree with what was written at submission time.
 */
export function isStreakStale(
  lastPuzzleDay: number,
  todayPuzzleDay: number,
): boolean {
  return lastPuzzleDay < todayPuzzleDay - 1;
}

/**
 * Computes streak stats from a player's full history for one game.
 *
 * `puzzleDays` may be unsorted and may contain duplicates. Returns null for an
 * empty history so callers can skip the write entirely.
 */
export function computeStreak(
  puzzleDays: number[],
  todayPuzzleDay: number,
): ComputedStreak | null {
  const days = [...new Set(puzzleDays)].sort((a, b) => a - b);
  if (days.length === 0) return null;

  // Biggest streak: forward scan over the whole history. The previous
  // implementation only ever took max(stored, currentStreak), which
  // understated it whenever results arrived out of order.
  let biggestStreak = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] === days[i - 1] + 1) {
      run++;
      if (run > biggestStreak) biggestStreak = run;
    } else {
      run = 1;
    }
  }

  const lastPuzzleDay = days[days.length - 1];

  // Current streak: walk back from the most recent result, but only if that
  // result is recent enough to still count.
  let currentStreak = 0;
  if (!isStreakStale(lastPuzzleDay, todayPuzzleDay)) {
    currentStreak = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (days[i] !== days[i - 1] + 1) break;
      currentStreak++;
    }
  }

  return { lastPuzzleDay, currentStreak, biggestStreak };
}
