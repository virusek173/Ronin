import * as cron from "node-cron";
import { Client, TextChannel } from "discord.js";
import { logger } from "../utils/logger";
import { Category } from "../knowledge/loader";
import { FactTracker } from "../knowledge/tracker";
import { ConversationContext } from "../ai/context";
import {
  buildDailyFactPromptPostTrip,
  buildDailyMemoryPrompt,
  buildTripSummaryPrompt,
} from "../ai/prompts";
import { askClaudeSimple } from "../ai/claude";
import { config } from "../config";
import {
  diaryEntryCount,
  getAllEntriesAsText,
  loadDiaryEntry,
  loadDiaryOffset,
  loadGeneralObservations,
  saveDiaryOffset,
  SUMMARY_DAYS,
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

        // Persistent day counter: day 0 on first run, then +1 on every
        // firing. Days 0..entryCount-1 are real diary entries, the next
        // SUMMARY_DAYS are a multi-part trip summary, and once both are
        // exhausted the counter is left alone — from then on it's regular
        // daily facts, permanently (no looping back to the diary).
        const entryCount = diaryEntryCount();
        const totalSpecialDays = entryCount > 0 ? entryCount + SUMMARY_DAYS : 0;

        let diaryEntry = null as ReturnType<typeof loadDiaryEntry>;
        let summaryThemeIndex = -1;

        if (totalSpecialDays > 0) {
          const offset = loadDiaryOffset();
          if (offset < totalSpecialDays) {
            if (offset < entryCount) {
              diaryEntry = loadDiaryEntry(offset);
            } else {
              summaryThemeIndex = offset - entryCount;
            }
            saveDiaryOffset(offset + 1);
          }
        }

        let systemPrompt: string;
        if (diaryEntry) {
          logger.info(
            { dayNumber: diaryEntry.dayNumber },
            "Sending daily memory",
          );
          systemPrompt = buildDailyMemoryPrompt(
            diaryEntry.content,
            diaryEntry.dayNumber,
          );
        } else if (summaryThemeIndex >= 0) {
          logger.info({ summaryThemeIndex }, "Sending trip summary");
          const allEntriesText = getAllEntriesAsText();
          const observations = loadGeneralObservations();
          systemPrompt = buildTripSummaryPrompt(
            allEntriesText,
            observations,
            summaryThemeIndex,
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
