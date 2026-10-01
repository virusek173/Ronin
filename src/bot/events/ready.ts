import { Client, TextChannel } from 'discord.js';
import { logger } from '../../utils/logger';
import { Category } from '../../knowledge/loader';
import { totalFactCount } from '../../knowledge/categories';
import { FactTracker } from '../../knowledge/tracker';
import { ConversationContext } from '../../ai/context';
import { askClaudeSimple } from '../../ai/claude';
import { buildGreetingPrompt } from '../../ai/prompts';
import { getUnannouncedChanges, saveLastAnnouncedId } from '../../knowledge/changelog';
import { config } from '../../config';

export function registerReadyEvent(
  client: Client,
  categories: Category[],
  tracker: FactTracker,
  conversationContext: ConversationContext,
): void {
  client.once('ready', async () => {
    logger.info(`Bot connected as ${client.user?.tag}`);
    logger.info(`Categories loaded: ${categories.length}`);
    logger.info(`Total facts in pool: ${totalFactCount(categories)}`);
    logger.info(`Facts remaining in current cycle: ${tracker.remainingCount}`);

    try {
      const channel = await client.channels.fetch(config.discord.dailyChannelId);
      if (channel instanceof TextChannel) {
        const { entries, latestId } = getUnannouncedChanges();
        const greeting = await askClaudeSimple(buildGreetingPrompt(entries.map(e => e.text)), 500);
        await channel.send(greeting);
        if (entries.length > 0 && latestId !== null) saveLastAnnouncedId(latestId);
        conversationContext.addAssistantMessage(channel.id, greeting);
        conversationContext.addChannelMessage(channel.id, client.user!.displayName, greeting);
      }
    } catch (err) {
      logger.error({ err }, 'Failed to send greeting');
    }
  });
}
