import * as cron from 'node-cron';
import { Client, TextChannel } from 'discord.js';
import { logger } from '../utils/logger';
import { Category } from '../knowledge/loader';
import { FactTracker } from '../knowledge/tracker';
import { buildDailyFactPrompt } from '../ai/prompts';
import { askClaudeSimple } from '../ai/claude';
import { config } from '../config';

export function startDailyScheduler(
  client: Client,
  categories: Category[],
  tracker: FactTracker,
): void {
  // Every day at 06:00 Europe/Warsaw
  cron.schedule('0 6 * * *', async () => {
    logger.info('Daily fact cron triggered');

    try {
      const channel = await client.channels.fetch(config.discord.dailyChannelId);
      if (!channel || !(channel instanceof TextChannel)) {
        logger.error({ channelId: config.discord.dailyChannelId }, 'Daily channel not found or not a text channel');
        return;
      }

      const next = tracker.nextFact(categories);
      if (!next) {
        logger.error('Could not get next fact from tracker');
        return;
      }

      const { category, fact } = next;
      logger.info({ category: category.name, remaining: tracker.remainingCount }, 'Sending daily fact');

      const systemPrompt = buildDailyFactPrompt(fact, category);
      const response = await askClaudeSimple(systemPrompt, 500);

      await channel.send(response);
      logger.info('Daily fact sent successfully');
    } catch (err) {
      logger.error({ err }, 'Failed to send daily fact');
    }
  }, {
    timezone: 'Europe/Warsaw',
  });

  logger.info('Daily scheduler started (06:00 Europe/Warsaw)');
}
