# Ronin — Discord Bot about Japan

## What This Project Is

A sarcastic Discord bot ("Ronin") that teaches a friend group about Japan before their trip. It sends a daily fun fact and responds to mentions/replies with Japan-related knowledge, powered by Claude API. All bot responses are in **Polish** with occasional Japanese phrases.

## Commands

```bash
npm run build     # Compile TypeScript -> dist/
npm start         # Run compiled bot (dist/index.js)
npm run dev       # Dev mode with ts-node-dev (auto-reload)
npm run watch     # TypeScript watch mode (compile only)
```

## Architecture

- **Entry point:** `src/index.ts` — boots everything, registers events, handles graceful shutdown
- **Config:** `src/config.ts` — reads `.env` via dotenv, all env vars validated at startup
- **AI layer** (`src/ai/`):
  - `claude.ts` — Claude API wrapper using streaming (`messages.stream`), two functions: `askClaude` (with history) and `askClaudeSimple` (single prompt)
  - `prompts.ts` — all system prompts and prompt builders. Bot personality is defined here (sarcastic samurai character). **All prompts are in Polish.**
  - `context.ts` — `ConversationContext` class, stores per-channel message history in memory with TTL and size limits
- **Bot layer** (`src/bot/`):
  - `client.ts` — Discord.js client setup with required intents
  - `scheduler.ts` — `node-cron` job for daily fact at configurable time
  - `events/ready.ts` — startup logging + greeting message via Claude
  - `events/messageCreate.ts` — main handler: mention/reply detection, rate limiting, category routing, fact injection, conversation flow
- **Knowledge layer** (`src/knowledge/`):
  - `loader.ts` — parses `knowledge-base/*.md` files into `Category` objects. Each file has `# Kategoria: Name` header and `- fact` bullet points. Also contains `findCategoryByKeyword` with Polish stemming heuristic.
  - `categories.ts` — formatting helpers for category lists
  - `tracker.ts` — `FactTracker` persists to `data/tracker.json`, ensures no-repeat cycle through all 224 facts
- **Utils:** `src/utils/logger.ts` — pino logger

## Key Patterns

- **No database** — tracker state is a JSON file, conversation context is in-memory only
- **Knowledge base is static** — loaded once at startup from markdown files
- **Category matching** uses Polish keyword stems (e.g. "kuchni" matches "kuchnia") with NFD normalization
- **Rate limiting** is in-memory per-user (5 msg/min)
- **Message splitting** handles Discord's 2000-char limit

## Important Notes

- All user-facing text (prompts, error messages, bot responses) is in **Polish**
- Knowledge base files are in Polish with `# Kategoria:` headers — this format is required by the parser
- The bot personality prompt in `prompts.ts` is critical — changes affect all responses
- `data/tracker.json` is gitignored and auto-generated at startup if missing
- `dist/` is gitignored — always `npm run build` before `npm start`
