import { Client } from 'discord.js';
import { logger } from '../../utils/logger';
import { Category } from '../../knowledge/loader';
import { totalFactCount } from '../../knowledge/categories';
import { FactTracker } from '../../knowledge/tracker';

export function registerReadyEvent(
  client: Client,
  categories: Category[],
  tracker: FactTracker,
): void {
  client.once('ready', () => {
    logger.info(`Bot connected as ${client.user?.tag}`);
    logger.info(`Categories loaded: ${categories.length}`);
    logger.info(`Total facts in pool: ${totalFactCount(categories)}`);
    logger.info(`Facts remaining in current cycle: ${tracker.remainingCount}`);
  });
}
