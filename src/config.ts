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
    model: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-5',
  },
  conversation: {
    contextLimit: parseInt(process.env.CONVERSATION_CONTEXT_LIMIT ?? '8', 10),
    timeoutMs: parseInt(process.env.CONVERSATION_TIMEOUT_MS ?? '3600000', 10),
  },
  rateLimit: {
    maxMessages: 5,
    windowMs: 60_000,
  },
  paths: {
    knowledgeBase: './knowledge-base',
    trackerFile: './data/tracker.json',
  },
} as const;
