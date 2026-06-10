# Ronin

Sarcastic Discord bot about Japan. From June 11, 2026, sends daily trip memories instead of facts. Answers questions and holds contextual conversations — powered by Claude API.

---

## Features

- **Daily morning message** — every day at 6:00 AM (Europe/Warsaw) the bot posts to a designated channel:
  - **Phase 1 — Trip memories** (from `DIARY_START_DATE`): posts one diary entry per day in chronological order, with an enthusiastic/celebratory tone. 20 entries total.
  - **Phase 2 — Daily facts** (after memories run out): cycles through 224 facts across 8 categories. No repeats until all are exhausted.
- **Conversational interaction** — responds to `@Ronin` mentions or replies to its messages. Maintains per-channel conversation context.
- **Category-specific facts** — `@Ronin tell me something about cuisine` draws a random fact from the matching category.
- **Category list** — `@Ronin what categories do you have?` returns the full list with emoji and fact counts.
- **Rate limiting** — max 5 messages per minute per user.

---

## Knowledge Base

8 categories, 224 facts total:

| Category | File | Facts | Emoji |
|---|---|---|---|
| History | `historia.md` | 37 | 🏯 |
| Culture | `kultura.md` | 31 | 🎭 |
| Cuisine | `kuchnia.md` | 34 | 🍱 |
| Language | `jezyk.md` | 22 | 🗾 |
| Technology | `technologia.md` | 25 | ⚙️ |
| Nature | `natura.md` | 25 | 🌸 |
| Daily Life | `codzienne-zycie.md` | 25 | 🏙️ |
| Mythology | `mitologia.md` | 25 | ⛩️ |

To add a new category, create a `.md` file in `knowledge-base/` with the header `# Kategoria: Name`. The bot loads all files automatically on startup.

---

## Trip Diary

Daily memories are loaded from a local `Dziennik/` directory (gitignored — not in the repo). Files must follow the naming convention:

```
YYYY.MM.DD Japonia dzień N.md
```

The bot reads **full file content** for each entry and presents it through Claude with an enthusiastic tone. Files are sorted by date prefix; the bot picks the entry matching `today - DIARY_START_DATE` as the day offset.

---

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js >= 20 + TypeScript |
| Discord | `discord.js` v14 |
| AI | `@anthropic-ai/sdk` — model `claude-haiku-4-5` (configurable) |
| Scheduler | `node-cron` |
| Logging | `pino` + `pino-pretty` |
| Tracking | `data/tracker.json` |

---

## Project Structure

```
ronin/
├── knowledge-base/       # Knowledge base (MD files)
│   ├── historia.md
│   ├── kultura.md
│   ├── kuchnia.md
│   ├── jezyk.md
│   ├── technologia.md
│   ├── natura.md
│   ├── codzienne-zycie.md
│   └── mitologia.md
├── Dziennik/             # Trip diary entries (gitignored, local only)
│   └── YYYY.MM.DD Japonia dzień N.md
├── data/
│   └── tracker.json      # Fact cycle state (auto-generated)
├── src/
│   ├── index.ts          # Entry point
│   ├── config.ts         # Configuration from .env
│   ├── bot/
│   │   ├── client.ts         # Discord.js client
│   │   ├── scheduler.ts      # Cron job — daily memory or fact
│   │   └── events/
│   │       ├── ready.ts          # On ready — startup logs
│   │       └── messageCreate.ts  # Mention/reply handler
│   ├── ai/
│   │   ├── claude.ts         # Claude API wrapper (streaming)
│   │   ├── prompts.ts        # System prompts and bot personality
│   │   └── context.ts        # Per-channel conversation context
│   ├── knowledge/
│   │   ├── loader.ts         # MD file parser + category matching
│   │   ├── categories.ts     # Category formatting helpers
│   │   ├── tracker.ts        # Sent facts tracking
│   │   └── diary.ts          # Trip diary loader
│   └── utils/
│       └── logger.ts         # Pino logger
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Getting Started

### 1. Prerequisites

- Node.js >= 20
- [Discord Developer Portal](https://discord.com/developers/applications) account
- [Anthropic API](https://console.anthropic.com) key

### 2. Create the bot on Discord Developer Portal

1. **New Application** -> name it "Ronin"
2. **Bot** tab -> **Reset Token** -> copy the token
3. Under **Privileged Gateway Intents**, enable **Message Content Intent**
4. **OAuth2 -> URL Generator**:
   - Scope: `bot`
   - Permissions: `Send Messages`, `Read Message History`, `View Channels`
   - Use the generated URL to invite the bot to your server

### 3. Configuration

```bash
cp .env.example .env
```

Fill in `.env`:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
DAILY_CHANNEL_ID=channel_id_for_daily_facts
ANTHROPIC_API_KEY=your_anthropic_key
```

> **DAILY_CHANNEL_ID** — in Discord, right-click the channel -> **Copy ID**. Requires Developer Mode enabled (Settings -> Advanced).

### 4. Install and Run

**Production:**
```bash
npm install
npm run build
npm start
```

**Development:**
```bash
npm install
npm run dev
```

### 5. Verify

A successful startup looks like:

```
INFO: Loaded 8 categories
INFO: Tracker initialized { remaining: 224 }
INFO: Diary entries loaded { count: 20 }
INFO: Daily scheduler started (06:00 Europe/Warsaw)
INFO: Bot connected as Ronin#XXXX
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DISCORD_TOKEN` | Yes | — | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Yes | — | Application ID from Discord Developer Portal |
| `DAILY_CHANNEL_ID` | Yes | — | Channel ID for daily messages |
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key |
| `CLAUDE_MODEL` | No | `claude-haiku-4-5` | Claude model to use |
| `CONVERSATION_CONTEXT_LIMIT` | No | `8` | Number of recent messages kept in context |
| `CONVERSATION_TIMEOUT_MS` | No | `3600000` | Conversation context timeout (ms), default 1h |
| `CRON_EXPRESSION` | No | `0 6 * * *` | Cron schedule for daily messages |
| `DIARY_START_DATE` | No | `2026-06-11` | Date from which diary replay begins (YYYY-MM-DD) |
| `DIARY_PATH` | No | `./Dziennik` | Path to diary entries directory |
| `LOG_LEVEL` | No | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `TZ` | No | `Europe/Warsaw` | Timezone |

---

## Example Interactions

```
@Ronin tell me something about cuisine
→ Naruhodo... Cuisine, is it? The wasabi you get in 99% of restaurants
  outside Japan is just dyed horseradish. Real wasabi costs about $50 per root. 🍣

@Ronin what categories do you have?
→ Here are my domains of knowledge, grasshopper:
  🏯 History — 37 facts
  🎭 Culture — 31 facts
  ...

@Ronin tell me about sports
→ Sports? That's not in my arsenal. But I do have:
  🏯 History, 🎭 Culture, 🍱 Cuisine...
```

> **Note:** The bot communicates in Polish. Examples above are translated for reference.
