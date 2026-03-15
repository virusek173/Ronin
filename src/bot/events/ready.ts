import { Client, TextChannel } from 'discord.js';
import { logger } from '../../utils/logger';
import { Category } from '../../knowledge/loader';
import { totalFactCount } from '../../knowledge/categories';
import { FactTracker } from '../../knowledge/tracker';
import { askClaudeSimple } from '../../ai/claude';
import { buildGreetingPrompt } from '../../ai/prompts';
import { config } from '../../config';

export function registerReadyEvent(
  client: Client,
  categories: Category[],
  tracker: FactTracker,
): void {
  client.once('ready', async () => {
    logger.info(`Bot connected as ${client.user?.tag}`);
    logger.info(`Categories loaded: ${categories.length}`);
    logger.info(`Total facts in pool: ${totalFactCount(categories)}`);
    logger.info(`Facts remaining in current cycle: ${tracker.remainingCount}`);

    try {
      const channel = await client.channels.fetch(config.discord.dailyChannelId);
      if (channel instanceof TextChannel) {
        const greeting = await askClaudeSimple(buildGreetingPrompt(), 80);
        await channel.send(greeting);
      }
    } catch (err) {
      logger.error({ err }, 'Failed to send greeting');
    }
  });
}
