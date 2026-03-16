import * as cron from 'node-cron';
import { Client, TextChannel } from 'discord.js';
import { logger } from '../utils/logger';
import { Category } from '../knowledge/loader';
import { FactTracker } from '../knowledge/tracker';
import { ConversationContext } from '../ai/context';
import { buildDailyFactPrompt } from '../ai/prompts';
import { askClaudeSimple } from '../ai/claude';
import { config } from '../config';

export function startDailyScheduler(
  client: Client,
  categories: Category[],
  tracker: FactTracker,
  conversationContext: ConversationContext,
): void {
  const expression = config.scheduler.cronExpression;
  cron.schedule(expression, async () => {
    logger.info({ expression }, 'Daily fact cron triggered');

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
      const response = await askClaudeSimple(systemPrompt, 250);

      await channel.send(response);
      conversationContext.addAssistantMessage(channel.id, response);
      conversationContext.addChannelMessage(channel.id, client.user!.displayName, response);
      logger.info('Daily fact sent successfully');
    } catch (err) {
      logger.error({ err }, 'Failed to send daily fact');
    }
  }, {
    timezone: 'Europe/Warsaw',
  });

  logger.info({ expression }, 'Daily scheduler started');
}
