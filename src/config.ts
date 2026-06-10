import * as dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  discord: {
    token: requireEnv('DISCORD_TOKEN'),
    clientId: requireEnv('DISCORD_CLIENT_ID'),
    dailyChannelId: requireEnv('DAILY_CHANNEL_ID'),
  },
  anthropic: {
    apiKey: requireEnv('ANTHROPIC_API_KEY'),
    model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5',
  },
  conversation: {
    contextLimit: parseInt(process.env.CONVERSATION_CONTEXT_LIMIT ?? '8', 10),
    timeoutMs: parseInt(process.env.CONVERSATION_TIMEOUT_MS ?? '3600000', 10),
  },
  rateLimit: {
    maxMessages: 5,
    windowMs: 60_000,
  },
  scheduler: {
    cronExpression: process.env.CRON_EXPRESSION ?? '0 6 * * *',
  },
  paths: {
    knowledgeBase: './knowledge-base',
    trackerFile: './data/tracker.json',
    channelBufferFile: './data/channel-buffer.json',
    diaryOffsetFile: './data/diary-offset.json',
  },
  trip: {
    departureDate: process.env.TRIP_DEPARTURE_DATE ?? null,
  },
  diary: {
    startDate: process.env.DIARY_START_DATE ?? '2026-06-11',
    path: process.env.DIARY_PATH ?? './Dziennik',
    testMode: process.env.DIARY_TEST_MODE === 'true',
  },
  specialUsers: {
    friendlyUserId: process.env.FRIENDLY_USER_ID ?? null,
  },
} as const;
