import { config } from './config';
import { logger } from './utils/logger';
import { createDiscordClient } from './bot/client';
import { loadKnowledgeBase } from './knowledge/loader';
import { FactTracker } from './knowledge/tracker';
import { ConversationContext } from './ai/context';
import { registerReadyEvent } from './bot/events/ready';
import { registerMessageCreateEvent } from './bot/events/messageCreate';
import { startDailyScheduler } from './bot/scheduler';
import * as path from 'path';
import * as fs from 'fs';

async function main(): Promise<void> {
  logger.info('Starting Ronin bot...');

  // Ensure data directory exists
  const dataDir = path.dirname(config.paths.trackerFile);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Load knowledge base
  const knowledgeBasePath = path.resolve(config.paths.knowledgeBase);
  const categories = loadKnowledgeBase(knowledgeBasePath);

  if (categories.length === 0) {
    logger.error('No categories loaded from knowledge base — aborting');
    process.exit(1);
  }

  // Initialize tracker
  const trackerPath = path.resolve(config.paths.trackerFile);
  const tracker = new FactTracker(trackerPath, categories);
  logger.info({ remaining: tracker.remainingCount }, 'Tracker initialized');

  // Initialize conversation context
  const bufferFilePath = path.resolve(config.paths.channelBufferFile);
  const conversationContext = new ConversationContext(bufferFilePath);

  // Initialize Discord client
  const client = createDiscordClient();

  // Register events
  registerReadyEvent(client, categories, tracker, conversationContext);
  registerMessageCreateEvent(client, categories, conversationContext);

  // Start daily scheduler (after client is created)
  startDailyScheduler(client, categories, tracker, conversationContext);

  // Graceful shutdown
  function shutdown(signal: string): void {
    logger.info({ signal }, 'Shutting down...');
    tracker.save();
    client.destroy();
    logger.info('Ronin bot stopped');
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled rejection');
  });

  // Login to Discord
  logger.info('Connecting to Discord...');
  await client.login(config.discord.token);
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
