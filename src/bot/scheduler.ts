import * as cron from "node-cron";
import { Client, TextChannel } from "discord.js";
import { logger } from "../utils/logger";
import { Category } from "../knowledge/loader";
import { FactTracker } from "../knowledge/tracker";
import { ConversationContext } from "../ai/context";
import {
  buildDailyFactPromptPostTrip,
  buildDailyMemoryPrompt,
} from "../ai/prompts";
import { askClaudeSimple } from "../ai/claude";
import { config } from "../config";
import {
  loadDiaryEntry,
  loadTestOffset,
  saveTestOffset,
} from "../knowledge/diary";

export function startDailyScheduler(
  client: Client,
  categories: Category[],
  tracker: FactTracker,
  conversationContext: ConversationContext,
): void {
  const testMode = config.diary.testMode;
  const expression = testMode ? "* * * * *" : config.scheduler.cronExpression;

  cron.schedule(
    expression,
    async () => {
      logger.info({ expression, testMode }, "Daily cron triggered");

      try {
        const channel = await client.channels.fetch(
          config.discord.dailyChannelId,
        );
        if (!channel || !(channel instanceof TextChannel)) {
          logger.error(
            { channelId: config.discord.dailyChannelId },
            "Daily channel not found or not a text channel",
          );
          return;
        }

        let dayOffset: number;
        if (testMode) {
          dayOffset = loadTestOffset();
          saveTestOffset(dayOffset + 1);
        } else {
          const startDate = new Date(config.diary.startDate);
          startDate.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          dayOffset = Math.floor(
            (today.getTime() - startDate.getTime()) / 86_400_000,
          );
        }

        const diaryEntry = dayOffset >= 0 ? loadDiaryEntry(dayOffset) : null;

        let systemPrompt: string;
        if (diaryEntry) {
          logger.info(
            { dayNumber: diaryEntry.dayNumber, dayOffset },
            "Sending daily memory",
          );
          systemPrompt = buildDailyMemoryPrompt(
            diaryEntry.content,
            diaryEntry.dayNumber,
          );
        } else {
          const next = tracker.nextFact(categories);
          if (!next) {
            logger.error("Could not get next fact from tracker");
            return;
          }
          const { category, fact } = next;
          logger.info(
            { category: category.name, remaining: tracker.remainingCount },
            "Sending daily fact (post-trip)",
          );
          systemPrompt = buildDailyFactPromptPostTrip(fact, category);
        }

        const response = await askClaudeSimple(systemPrompt, 400);

        await channel.send(response);
        conversationContext.addAssistantMessage(channel.id, response);
        conversationContext.addChannelMessage(
          channel.id,
          client.user!.displayName,
          response,
        );
        logger.info("Daily message sent successfully");
      } catch (err) {
        logger.error({ err }, "Failed to send daily fact");
      }
    },
    {
      timezone: "Europe/Warsaw",
    },
  );

  logger.info({ expression }, "Daily scheduler started");
}
