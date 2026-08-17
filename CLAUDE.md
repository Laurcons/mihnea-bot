# CLAUDE.md

Guidance for agents working in this repo. See [README.md](README.md) for what the bot does and how to set it up, and [MISTAKES.md](MISTAKES.md) for specific traps that have already caught someone.

## What this is

A NestJS Discord bot for one small Romanian server. Not a product — the users are a handful of friends, and the bot's voice is deliberately crude. Match the existing tone in user-facing strings: lowercase Romanian, no diacritics in AI prompts, plenty of insults. Log messages and comments are in English.

## Layout

```
src/
  main.ts                  bootstrap; installs dayjs plugins
  core.module.ts           @Global — BotConfigService, DiscordClientService, OpenAiService
  bot-config.service.ts    every env var goes through here
  discord-client.service.ts  the single discord.js Client
  openai.service.ts        the only place that calls OpenAI
  persona.ts               the shared "Mihneainatorul" prompt
  wordle/                  puzzle tracking — the largest feature
  kick-poll/               daily kick vote (currently disabled)
  slash-command/           /mihneainator command tree
```

## Conventions

**Dates: always `dayjs`.** Never raw `Date` arithmetic. `utc` and `timezone` plugins are installed in `main.ts`; a standalone script must install them itself. The server's day boundary is **Europe/Bucharest**, not UTC — `getTodayInRomania()` in the parser is the reference.

**Config: only through `BotConfigService`.** Never read `process.env` elsewhere. `getRequired` throws; optional getters return `null`.

**OpenAI: only through `OpenAiService`.** Do not hand-roll a fetch. Use `chat()` for text, `chatJson()` for structured output.

**Discord handlers: register in `onModuleInit`, not the constructor.** Wrap async handlers so a rejection cannot float: `onMessage((m) => void this.handle(m))`.

**Anything touching Discord at startup must `await discordClient.whenReady()`.** `login()` resolving is not the same as the gateway being ready — the guild and channel caches are still empty.

**Mongo: pipeline updates need `updatePipeline: true`.** Mongoose 9 rejects an array update without it, at runtime.

**Errors:** the local `describeError`/`describe` helper pattern (`error instanceof Error ? error.message : String(error)`) is used throughout rather than a shared import.

## Adding a puzzle game

One entry in `GAME_DEFINITIONS` in [wordle-parser.service.ts](src/wordle/wordle-parser.service.ts). Everything downstream is automatic: the slash-command choices, the nightly streak invalidator, and `#todays-<gametype>` channel discovery.

You need a real share message to work from. Ask for one rather than guessing the format — every parser bug in this repo's history came from a guessed regex.

Checklist:
- `anchor` needs a **verified** date/puzzle-number pair. Derive it from a dated message and pin it with a test using `jest.useFakeTimers()`, since `getCurrentPuzzleDay` reads the real clock.
- Add the game's name token to `GAME_NAME_PROBE`, or a format change to that game will go back to failing silently.
- Add a sample header to the `HEADERS` table in the parser spec — a test enforces one per game type.
- Write grid patterns as **alternations with explicit escapes**, never character classes. `[⬜️🟩]` decomposes into three members and matches a stray variation selector on its own. Make variation selectors optional (`️?`): clients disagree about emitting them.
- Cover a win, a loss, and any odd variant. Losses are where formats diverge most.

## Testing

`npx jest`. Tests live beside the code as `*.spec.ts`.

Pure logic is well covered; service-level behaviour much less so. When touching a service, prefer the mock-model pattern in [wordle-streak.service.spec.ts](src/wordle/wordle-streak.service.spec.ts) — construct the service directly with mocks, no Nest test module.

**A build and a lint pass prove very little here.** Neither can see a wrong Mongoose option, a discord.js cache dependency, or a regex that fails on real input. Before claiming something works, run the real input through it.

**Verify a regression test actually fails without the fix.** Revert the fix, watch it go red, restore.

## Lint

`npm run lint` is at **zero errors** — keep it there. Note it runs `eslint --fix`, so it modifies files; do not run it against a stashed or otherwise unexpected tree.

## Git

Commit incrementally, one logical change each. Commit messages explain *why*, and name the concrete failure a fix prevents. Do not push unless asked.
