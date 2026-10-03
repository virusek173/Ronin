import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { logger } from '../utils/logger';

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

// Sonnet 5.5 thinks before answering by default, and thinking tokens count
// against max_tokens — with our small limits (20–600) the visible reply got
// cut off or came back empty. This model rejects `thinking: disabled` and
// wants `between_tools` instead, which turns pre-answer thinking off.
// (The SDK types don't know this value yet, hence the cast.)
function thinkingParams(): Record<string, unknown> {
  return /-5-5/.test(config.anthropic.model) ? { thinking: { type: 'between_tools' } } : {};
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function askClaude(
  systemPrompt: string,
  history: ClaudeMessage[],
  userMessage: string,
  maxTokens = 600,
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  logger.debug({ model: config.anthropic.model, messageCount: messages.length }, 'Calling Claude API');

  const stream = await client.messages.stream({
    model: config.anthropic.model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
    ...thinkingParams(),
  } as Anthropic.MessageStreamParams);

  const response = await stream.finalMessage();
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text in Claude response');
  }

  if (response.stop_reason === 'max_tokens') {
    logger.warn(
      { maxTokens, outputTokens: response.usage.output_tokens },
      'Claude response was truncated by max_tokens — message was likely cut off mid-sentence',
    );
  }

  logger.debug(
    { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    'Claude API response received'
  );

  return textBlock.text;
}

export async function askClaudeSimple(systemPrompt: string, maxTokens = 600): Promise<string> {
  return askClaude(systemPrompt, [], 'Wykonaj swoje zadanie zgodnie z powyższymi instrukcjami.', maxTokens);
}

export async function classifyIntent(userMessage: string): Promise<'CATEGORIES' | 'OTHER'> {
  try {
    const result = await askClaude(
      'Classify the user\'s message. Reply with exactly one word: CATEGORIES if they are asking for a list of available topics/categories, OTHER for anything else.',
      [],
      userMessage,
      20,
    );
    return result.trim().toUpperCase().startsWith('CATEGORIES') ? 'CATEGORIES' : 'OTHER';
  } catch (err) {
    logger.warn({ err }, 'classifyIntent failed, defaulting to OTHER so the message still gets a real reply');
    return 'OTHER';
  }
}
