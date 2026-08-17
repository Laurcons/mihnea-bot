#!/usr/bin/env ts-node

/**
 * Streak repair: recomputes discordusers streak stats from wordleresults.
 *
 * For each (userId, gameType) pair present in the results collection:
 *   - lastPuzzleDay  : most recent puzzle day submitted
 *   - currentStreak  : consecutive days back from lastPuzzleDay, or 0 if that
 *                      result is too old for the streak to still be live
 *   - biggestStreak  : longest consecutive run ever
 *
 * Authoritative: stored values are overwritten, not merged, so this also
 * corrects streaks that were previously inflated. Game keys with no results
 * are left untouched.
 *
 * Talks to Mongo directly rather than bootstrapping Nest, because the app
 * module logs the bot into Discord on init. The streak arithmetic itself is
 * shared with the runtime via wordle-streak.util.
 *
 * Usage:
 *   npm run repair:streaks
 */

import 'dotenv/config';
import mongoose, { Schema, model } from 'mongoose';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { computeStreak } from '../src/wordle/wordle-streak.util';
import { WordleParserService } from '../src/wordle/wordle-parser.service';

// The parser reads "today" through these plugins; main.ts installs them at
// bootstrap, so a standalone script has to do it too.
dayjs.extend(utc);
dayjs.extend(timezone);

// ---------------------------------------------------------------------------
// Schemas (kept minimal — only the fields this script cares about)
// ---------------------------------------------------------------------------

const WordleResultSchema = new Schema({
  userId: String,
  username: String,
  gameType: String,
  puzzleDay: Number,
});

const WordleStatsSchema = new Schema(
  {
    lastPuzzleDay: Number,
    currentStreak: Number,
    biggestStreak: Number,
  },
  { _id: false },
);

const DiscordUserSchema = new Schema(
  {
    discordId: { type: String, required: true, unique: true },
    username: String,
    wordleStats: { type: Map, of: WordleStatsSchema },
  },
  { timestamps: true },
);

const WordleResultModel = model('WordleResult', WordleResultSchema);
const DiscordUserModel = model('DiscordUser', DiscordUserSchema);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) {
    console.error('MONGODB_URL is not set in environment');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUrl);
  console.log('Connected.');

  const parser = new WordleParserService();

  const grouped = await WordleResultModel.aggregate<{
    _id: { userId: string; gameType: string };
    username: string;
    puzzleDays: number[];
  }>([
    { $sort: { puzzleDay: 1 } },
    {
      $group: {
        _id: { userId: '$userId', gameType: '$gameType' },
        username: { $last: '$username' },
        puzzleDays: { $push: '$puzzleDay' },
      },
    },
  ]);

  console.log(`Found ${grouped.length} (user, game) pair(s).`);

  // Results can outlive their game definition, and getCurrentPuzzleDay throws
  // for unknown types — skip those rather than aborting the whole run.
  const todayByGame = new Map<string, number | null>();
  const currentPuzzleDay = (gameType: string): number | null => {
    if (!todayByGame.has(gameType)) {
      try {
        todayByGame.set(gameType, parser.getCurrentPuzzleDay(gameType));
      } catch {
        console.warn(`  ! no game definition for "${gameType}", skipping`);
        todayByGame.set(gameType, null);
      }
    }
    return todayByGame.get(gameType)!;
  };

  const updates = new Map<
    string,
    { username: string; set: Record<string, unknown> }
  >();
  let skipped = 0;

  for (const group of grouped) {
    const { userId, gameType } = group._id;

    const todayPuzzleDay = currentPuzzleDay(gameType);
    if (todayPuzzleDay === null) {
      skipped++;
      continue;
    }

    const stats = computeStreak(group.puzzleDays, todayPuzzleDay);
    if (stats === null) continue;

    const entry = updates.get(userId) ?? { username: group.username, set: {} };
    entry.username = group.username;
    entry.set[`wordleStats.${gameType}`] = stats;
    updates.set(userId, entry);
  }

  if (updates.size === 0) {
    console.log('Nothing to update. Exiting.');
  } else {
    const ops = [...updates].map(([discordId, { username, set }]) => ({
      updateOne: {
        filter: { discordId },
        update: { $set: { discordId, username, ...set } },
        upsert: true,
      },
    }));

    console.log(`Updating ${ops.length} user(s)...`);
    const result = await DiscordUserModel.bulkWrite(ops);
    console.log(
      `Done. Upserted: ${result.upsertedCount}, modified: ${result.modifiedCount}` +
        (skipped > 0 ? `, skipped ${skipped} pair(s) with no definition.` : '.'),
    );
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
