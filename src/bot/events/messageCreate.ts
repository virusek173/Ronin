import { Client, Message, TextChannel, ThreadChannel } from "discord.js";
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
  FRIENDLY_USER_NOTE,
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
      const friendly = !!config.specialUsers.friendlyUserId && userId === config.specialUsers.friendlyUserId;

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
        { userId, channelId, content: rawContent.slice(0, 80), friendly },
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
      let channelContext = conversationContext
        .getChannelBuffer(channelId)
        .filter((m) => m.content !== rawContent);

      // If we're in a thread, prepend the thread starter message as extra context
      if (message.channel.isThread()) {
        const starterMessage = await (message.channel as ThreadChannel)
          .fetchStarterMessage()
          .catch(() => null);
        if (starterMessage) {
          const starterEntry = {
            author: starterMessage.author.displayName,
            content: starterMessage.content.replace(/<@!?\d+>/g, "").trim(),
          };
          const alreadyPresent = channelContext.some(
            (m) => m.content === starterEntry.content,
          );
          if (!alreadyPresent && starterEntry.content) {
            channelContext = [starterEntry, ...channelContext];
          }
        }
      }

      // If empty mention, build effective content from channel context
      let effectiveContent = rawContent;
      if (!effectiveContent) {
        if (channelContext.length > 0) {
          const contextLines = channelContext.map(m => `${m.author}: ${m.content}`).join('\n');
          effectiveContent = `(Użytkownik przywołał mnie bez dodatkowej treści. Oto co było pisane na kanale:\n${contextLines}\nZareaguj na tę rozmowę.)`;
        } else {
          effectiveContent = '(Użytkownik przywołał mnie bez treści — przywitaj się krótko.)';
        }
      }

      // Append friendly note to message content (not system prompt)
      if (friendly) {
        effectiveContent += FRIENDLY_USER_NOTE;
      }

      // Case 1: asking for category list (LLM classifier)
      if (
        !isAskingForFact(effectiveContent) &&
        (await classifyIntent(effectiveContent)) === "CATEGORIES"
      ) {
        const systemPrompt = buildCategoryListPrompt(
          categories,
          channelContext,
        );
        const response = await askClaudeSimple(systemPrompt, 500);
        conversationContext.addUserMessage(channelId, effectiveContent);
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

      if (isAskingForFact(effectiveContent)) {
        const matched = findCategoryByKeyword(categories, effectiveContent);

        if (matched) {
          const fact = randomFact(matched);
          injectedFact = { fact, category: matched };
          logger.debug(
            { category: matched.name },
            "Injecting fact into context",
          );
        } else if (hasTopicHint(effectiveContent)) {
          // User specified a topic that doesn't exist in the knowledge base
          const notFoundMsg = await askClaudeSimple(
            buildTopicNotFoundPrompt(categories, effectiveContent),
            300,
          );
          conversationContext.addUserMessage(channelId, effectiveContent);
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
        effectiveContent,
        injectedFact,
        channelContext,
      );

      const response = await askClaude(systemPrompt, history, effectiveContent, 600);

      // Update context
      conversationContext.addUserMessage(channelId, effectiveContent);
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
