#!/usr/bin/env ts-node

/**
 * Backfill migration: builds the discordusers collection from existing wordleresults.
 *
 * For each (userId, gameType) pair, computes:
 *   - lastPuzzleDay  : most recent puzzle day submitted
 *   - currentStreak  : consecutive days counting back from lastPuzzleDay
 *   - biggestStreak  : longest consecutive run ever
 *
 * Usage:
 *   npx ts-node scripts/backfill-discord-users.ts
 */

import 'dotenv/config';
import mongoose, { Schema, model } from 'mongoose';

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
// Streak computation helpers
// ---------------------------------------------------------------------------

function computeStreaks(sortedDays: number[]): {
  currentStreak: number;
  biggestStreak: number;
  lastPuzzleDay: number;
} {
  if (sortedDays.length === 0) {
    return { currentStreak: 0, biggestStreak: 0, lastPuzzleDay: 0 };
  }

  // Biggest streak: scan forward
  let biggestStreak = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    if (sortedDays[i] - sortedDays[i - 1] === 1) {
      run++;
      if (run > biggestStreak) biggestStreak = run;
    } else {
      run = 1;
    }
  }

  // Current streak: walk backwards from the last day
  let currentStreak = 1;
  for (let i = sortedDays.length - 1; i > 0; i--) {
    if (sortedDays[i] - sortedDays[i - 1] === 1) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    currentStreak,
    biggestStreak,
    lastPuzzleDay: sortedDays[sortedDays.length - 1],
  };
}

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

  // Fetch only the fields we need
  const results = await WordleResultModel.find()
    .select('userId username gameType puzzleDay')
    .lean();

  console.log(`Fetched ${results.length} wordle results.`);

  // Group by userId → gameType → sorted puzzle days
  // Also track the most recent username per user
  type GameDays = Map<string, number[]>; // gameType → days
  const byUser = new Map<string, { username: string; games: GameDays }>();

  for (const r of results) {
    const userId = r.userId as string;
    const username = r.username as string;
    const gameType = r.gameType as string;
    const puzzleDay = r.puzzleDay as number;

    if (!byUser.has(userId)) {
      byUser.set(userId, { username, games: new Map() });
    }
    const entry = byUser.get(userId)!;
    // Keep the most recent username (last one wins; results aren't sorted, but
    // for username this is fine — a subsequent upsert from the live app will
    // correct it if needed)
    entry.username = username;

    if (!entry.games.has(gameType)) {
      entry.games.set(gameType, []);
    }
    entry.games.get(gameType)!.push(puzzleDay);
  }

  console.log(`Found ${byUser.size} unique users.`);

  // Build bulk upsert operations
  const ops: Parameters<typeof DiscordUserModel.bulkWrite>[0] = [];
  for (const [discordId, { username, games }] of byUser) {
    const wordleStats: Record<string, object> = {};

    for (const [gameType, days] of games) {
      days.sort((a, b) => a - b);
      wordleStats[gameType] = computeStreaks(days);
    }

    ops.push({
      updateOne: {
        filter: { discordId },
        update: { $set: { discordId, username, wordleStats } },
        upsert: true,
      },
    });
  }

  if (ops.length === 0) {
    console.log('No users to backfill. Exiting.');
  } else {
    console.log(`Running ${ops.length} upsert operation(s)...`);
    const result = await DiscordUserModel.bulkWrite(ops);
    console.log(
      `Done. Upserted: ${result.upsertedCount}, modified: ${result.modifiedCount}.`,
    );
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
