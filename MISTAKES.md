# MISTAKES.md

A log of mistakes made while working on this repo, kept so the next agent does not repeat them.

**Add an entry when you catch yourself getting something wrong** — whether it reached production, was caught by a test, or you noticed it mid-edit. Near-misses are worth recording: they show where the traps are. Be specific and blunt. Vague lessons ("be careful with dates") are useless; name the actual call, the actual assumption, and the actual failure.

Format: what happened, why, and the rule that would have prevented it.

---

## Removing an option because it "looks like a no-op"

**What.** During a refactor, `updatePipeline: true` was dropped from a `findOneAndUpdate`, with a commit message confidently calling it a no-op. Mongoose 9 rejects array updates without it. Every result submitted for today's puzzle threw — *after* the row was inserted — so users were told their result failed while it sat safely in the database, and the throw skipped the channel-access grant too.

**Why.** The option looked redundant, the build passed, the lint passed, and no test touched that call. "I don't see what this does" was treated as "this does nothing."

**Rule.** An option you don't understand is a question, not dead weight. Check the library's source or docs before deleting it. Where a call has no test, the build proves only that it compiles.

---

## Treating build + lint as verification

**What.** Repeatedly claimed work was verified on the strength of `npm run build` and `npm run lint` passing.

**Why.** They're fast, they're green, and they feel like a check.

**Rule.** Neither can see a wrong Mongoose option, a discord.js cache dependency, a regex that fails on real input, or a wrong anchor date. They prove the code compiles and is tidy. Run real input through the real code path — a script against `dist/`, or a test with an actual sample — before saying something works. And state plainly what you could *not* verify.

---

## Guessing a format from too few samples

**What.** Magnitudle's scoreline regex required `(N orders of magnitude off)` literally, derived from three example messages. A perfect score reads `(spot on)`. The whole message failed to parse and was dropped in silence.

**Why.** Three samples all shared a structure that turned out to be incidental, and the edge case — the best possible result — is exactly the one least likely to appear in a random sample.

**Rule.** Ask which variants exist: a perfect score, a total loss, hard mode. Losses and perfect scores are where share formats diverge most. When a sub-part of a pattern is not load-bearing for identification, match it loosely — here `titleRegex` already pinned the game down, so the parenthetical never needed to be strict.

---

## Assuming a cache is populated

**What.** `permissionOverwrites.edit(userId, ...)` was called without an explicit `type`. discord.js then resolves the id against its User and Role caches purely to infer which it is, and throws `Supplied parameter is not a User nor a Role` when the user is not cached.

**Why.** It worked in the path that was thought through — a user who has just posted is cached from their own message — and failed in the boot path, where nothing is cached yet.

**Rule.** Startup code runs against empty caches. When an API can be given an explicit type or id rather than relying on resolution, give it. Ask "what is in the cache at this point?" for anything running before the bot has seen traffic.

---

## Writing a test that depends on today's date

**What.** An anchor test asserted `puzzleDay === parser.getCurrentPuzzleDay('Angle') - 1`. Correct on the day it was written, broken the next morning.

**Why.** The assertion was derived from the current date instead of pinning an absolute one.

**Rule.** `getCurrentPuzzleDay` reads the real clock. Freeze it with `jest.useFakeTimers().setSystemTime(...)` and assert absolute values, restoring real timers in a `finally`.

---

## Running `npm run lint` on a tree you don't own

**What.** `git stash`ed the working tree to compare the lint baseline against `main`, ran `npm run lint`, and it modified files — because the script is `eslint --fix`. `git stash pop` then refused with a merge conflict.

**Why.** `lint` reads as a read-only check. It is not.

**Rule.** `npm run lint` writes. Never run it against a stashed, checked-out or otherwise borrowed tree. Use `npx eslint <paths>` without `--fix` to inspect.

---

## Naming a helper `describe` in a file with tests nearby

**What.** Added a local `function describe(error: unknown)` error-formatting helper. It collided with Jest's global `describe`, producing a confusing type error pointing into `@types/jest`.

**Why.** Copied the helper name from a service that happened not to trip it.

**Rule.** Use `describeError`. Jest's globals (`describe`, `it`, `expect`, `test`) are ambient in every file in this project.

---

## Using `\b` on compound identifiers

**What.** The unparsed-result probe was written as `/\b(wordle|quordle|...)\b/i`. The trailing `\b` meant `RoWordle`, `PolygonleMini` and `OwdleHero` never matched, and the Quordle variants' real share text (`😎 Daily Chill 613`) contains no `quordle` token at all.

**Why.** The pattern was written against the `gameType` constants rather than against real share text.

**Rule.** Match against what actually arrives, not against internal identifiers. A test caught this one only because it iterated `WORDLE_GAME_TYPES` — a table of real sample headers now guards it properly.

---

## Trying to string-match source containing invisible characters

**What.** Several failed attempts to edit the Polygonle grid regexes by exact string match. They contain em-spaces (U+2004-2006) and variation selectors (U+FE0E) that do not survive being copied around.

**Why.** The characters are invisible in every view of the file.

**Rule.** For source with invisible characters, dump the codepoints first, then rewrite the region with a script using explicit `\uXXXX` escapes. Keep it escaped afterwards so the next person can see what is there.
