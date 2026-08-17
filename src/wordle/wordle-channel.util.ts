/**
 * Pure helpers for the per-game discussion channels. Kept free of discord.js
 * so the naming and diff rules can be tested without a gateway connection.
 */

export const CHANNEL_PREFIX = 'todays-';

/**
 * Discord channel names are lowercase, so the game type is simply lowercased:
 * PolygonleMini -> todays-polygonlemini. Matching is exact, never by prefix,
 * so Polygonle and PolygonleMini cannot collide.
 */
export function channelNameFor(gameType: string): string {
  return `${CHANNEL_PREFIX}${gameType.toLowerCase()}`;
}

export interface AccessDiff {
  toGrant: string[];
  toRevoke: string[];
}

/**
 * Works out the minimum set of overwrite changes to turn `current` into
 * `desired`. Only member overwrites should ever be passed as `current` —
 * role overwrites are left alone, which is what lets a moderator role keep
 * standing access through the nightly sweep.
 */
export function diffAccess(
  current: readonly string[],
  desired: readonly string[],
): AccessDiff {
  const currentSet = new Set(current);
  const desiredSet = new Set(desired);

  return {
    toGrant: [...desiredSet].filter((id) => !currentSet.has(id)),
    toRevoke: [...currentSet].filter((id) => !desiredSet.has(id)),
  };
}
