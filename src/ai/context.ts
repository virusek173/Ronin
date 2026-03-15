import { config } from '../config';
import { ClaudeMessage } from './claude';

interface ConversationEntry extends ClaudeMessage {
  timestamp: number;
}

export class ConversationContext {
  private contexts = new Map<string, ConversationEntry[]>();

  getHistory(channelId: string): ClaudeMessage[] {
    const now = Date.now();
    const entries = this.contexts.get(channelId) ?? [];

    // Filter out stale entries
    const fresh = entries.filter(e => now - e.timestamp < config.conversation.timeoutMs);
    if (fresh.length !== entries.length) {
      this.contexts.set(channelId, fresh);
    }

    // Return last N entries (pairs), keeping even count (user+assistant pairs)
    const limit = config.conversation.contextLimit;
    const sliced = fresh.slice(-limit);

    return sliced.map(({ role, content }) => ({ role, content }));
  }

  addUserMessage(channelId: string, content: string): void {
    this.addEntry(channelId, 'user', content);
  }

  addAssistantMessage(channelId: string, content: string): void {
    this.addEntry(channelId, 'assistant', content);
  }

  private addEntry(channelId: string, role: 'user' | 'assistant', content: string): void {
    const entries = this.contexts.get(channelId) ?? [];
    entries.push({ role, content, timestamp: Date.now() });

    // Trim to max limit
    const limit = config.conversation.contextLimit * 2;
    if (entries.length > limit) {
      entries.splice(0, entries.length - limit);
    }

    this.contexts.set(channelId, entries);
  }

  clear(channelId: string): void {
    this.contexts.delete(channelId);
  }
}
