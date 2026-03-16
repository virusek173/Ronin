import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { logger } from '../utils/logger';

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

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
  });

  const response = await stream.finalMessage();
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text in Claude response');
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
  const result = await askClaude(
    'Classify the user\'s message. Reply with exactly one word: CATEGORIES if they are asking for a list of available topics/categories, OTHER for anything else.',
    [],
    userMessage,
    5,
  );
  return result.trim().toUpperCase().startsWith('CATEGORIES') ? 'CATEGORIES' : 'OTHER';
}
