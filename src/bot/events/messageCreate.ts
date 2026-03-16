import { Client, Message, TextChannel } from "discord.js";
import { logger } from "../../utils/logger";
import {
  Category,
  findCategoryByKeyword,
  randomFact,
} from "../../knowledge/loader";
import { ConversationContext } from "../../ai/context";
import { askClaude, askClaudeSimple, classifyIntent } from "../../ai/claude";
import {
  buildConversationPrompt,
  buildCategoryListPrompt,
  buildTopicNotFoundPrompt,
} from "../../ai/prompts";
import { config } from "../../config";

// Rate limiter: userId → timestamps of messages
const rateLimiter = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimiter.get(userId) ?? [];
  const recent = timestamps.filter((t) => now - t < config.rateLimit.windowMs);

  if (recent.length >= config.rateLimit.maxMessages) {
    rateLimiter.set(userId, recent);
    return true;
  }

  recent.push(now);
  rateLimiter.set(userId, recent);
  return false;
}

// Patterns to detect "tell me about X" request
const FACT_REQUEST_PATTERNS = [
  /\b(powiedz|opowiedz|powiedz mi|co wiesz|ciekawostk|powiedz coś|coś o)\b/i,
];

// Patterns suggesting user specified a topic/category (has "about X" structure)
const TOPIC_HINT_PATTERNS = [/\b(o |na temat |z kategorii |z działu )/i];

function isAskingForFact(text: string): boolean {
  return FACT_REQUEST_PATTERNS.some((p) => p.test(text));
}

function hasTopicHint(text: string): boolean {
  return TOPIC_HINT_PATTERNS.some((p) => p.test(text));
}

async function sendLongMessage(message: Message, text: string): Promise<void> {
  const LIMIT = 1990;
  if (text.length <= LIMIT) {
    await message.reply(text);
    return;
  }
  // Split on last newline before limit — reply for first chunk, send for rest
  let remaining = text;
  let isFirst = true;
  while (remaining.length > 0) {
    const cutIdx =
      remaining.length <= LIMIT
        ? remaining.length
        : remaining.lastIndexOf("\n", LIMIT);
    const chunk =
      cutIdx > 0 ? remaining.slice(0, cutIdx) : remaining.slice(0, LIMIT);
    if (isFirst) {
      await message.reply(chunk);
      isFirst = false;
    } else {
      await (message.channel as TextChannel).send(chunk);
    }
    remaining = remaining.slice(chunk.length).trimStart();
  }
}

export function registerMessageCreateEvent(
  client: Client,
  categories: Category[],
  conversationContext: ConversationContext,
): void {
  client.on("messageCreate", async (message: Message) => {
    try {
      // Ignore bots (including self)
      if (message.author.bot) return;

      // Check if we should respond: mention or reply to bot
      const isMention = message.mentions.users.has(client.user!.id);
      const isReplyToBot =
        message.reference?.messageId !== undefined &&
        (await message.channel.messages
          .fetch(message.reference.messageId)
          .then((m) => m.author.id === client.user!.id)
          .catch(() => false));

      const channelId = message.channelId;
      const userId = message.author.id;

      // Strip mention from message content
      const rawContent = message.content.replace(/<@!?\d+>/g, "").trim();

      // Always record human messages in channel buffer
      if (rawContent) {
        conversationContext.addChannelMessage(
          channelId,
          message.author.displayName,
          rawContent,
        );
      }

      if (!isMention && !isReplyToBot) return;

      // Rate limit check
      if (isRateLimited(userId)) {
        await message.reply(
          "Yare yare... Spokojnie, grasshopper. Max 5 wiadomości na minutę. Poczekaj chwilę.",
        );
        return;
      }

      logger.info(
        { userId, channelId, content: rawContent.slice(0, 80) },
        "Handling message",
      );

      // Show typing indicator
      if (
        message.channel instanceof TextChannel ||
        message.channel.isTextBased()
      ) {
        await (message.channel as TextChannel).sendTyping().catch(() => {});
      }

      // Build channel context once — always injected so bot has full picture
      const channelContext = conversationContext
        .getChannelBuffer(channelId)
        .filter((m) => m.content !== rawContent);

      // Case 1: asking for category list (LLM classifier)
      if (
        !isAskingForFact(rawContent) &&
        (await classifyIntent(rawContent)) === "CATEGORIES"
      ) {
        const systemPrompt = buildCategoryListPrompt(
          categories,
          channelContext,
        );
        const response = await askClaudeSimple(systemPrompt, 500);
        conversationContext.addUserMessage(channelId, rawContent);
        conversationContext.addAssistantMessage(channelId, response);
        conversationContext.addChannelMessage(
          channelId,
          client.user!.displayName,
          response,
        );
        await message.reply(response);
        return;
      }

      // Case 2: asking for a fact from a specific category
      let injectedFact: { fact: string; category: Category } | null = null;

      if (isAskingForFact(rawContent)) {
        const matched = findCategoryByKeyword(categories, rawContent);

        if (matched) {
          const fact = randomFact(matched);
          injectedFact = { fact, category: matched };
          logger.debug(
            { category: matched.name },
            "Injecting fact into context",
          );
        } else if (hasTopicHint(rawContent)) {
          // User specified a topic that doesn't exist in the knowledge base
          const notFoundMsg = await askClaudeSimple(
            buildTopicNotFoundPrompt(categories, rawContent),
            300,
          );
          conversationContext.addUserMessage(channelId, rawContent);
          conversationContext.addAssistantMessage(channelId, notFoundMsg);
          conversationContext.addChannelMessage(
            channelId,
            client.user!.displayName,
            notFoundMsg,
          );
          await message.reply(notFoundMsg);
          return;
        } else {
          // No category specified — fall through to normal Claude flow
        }
      }

      // Build prompt and get conversation history
      const history = conversationContext.getHistory(channelId);
      const systemPrompt = buildConversationPrompt(
        rawContent,
        injectedFact,
        channelContext,
      );

      const response = await askClaude(systemPrompt, history, rawContent, 600);

      // Update context
      conversationContext.addUserMessage(channelId, rawContent);
      conversationContext.addAssistantMessage(channelId, response);
      conversationContext.addChannelMessage(
        channelId,
        client.user!.displayName,
        response,
      );

      // Send response
      await sendLongMessage(message, response);
    } catch (err) {
      logger.error({ err }, "Error handling messageCreate");
      try {
        await message.reply(
          "Yare yare... coś się zacięło po mojej stronie. Spróbuj jeszcze raz.",
        );
      } catch {
        // ignore reply error
      }
    }
  });
}
