import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { ClaudeMessage } from './claude';
import { logger } from '../utils/logger';

export interface ChannelMessage {
  author: string;
  content: string;
}

interface ChannelBufferState {
  [channelId: string]: ChannelMessage[];
}

const CHANNEL_BUFFER_LIMIT = 20;

export class ConversationContext {
  private contexts = new Map<string, ClaudeMessage[]>();
  private channelBuffer = new Map<string, ChannelMessage[]>();
  private readonly bufferFilePath: string;

  constructor(bufferFilePath: string) {
    this.bufferFilePath = bufferFilePath;
    this.loadBuffer();
  }

  private loadBuffer(): void {
    if (!fs.existsSync(this.bufferFilePath)) return;
    try {
      const raw = fs.readFileSync(this.bufferFilePath, 'utf-8');
      const state: ChannelBufferState = JSON.parse(raw);
      for (const [channelId, messages] of Object.entries(state)) {
        this.channelBuffer.set(channelId, messages);
      }
    } catch {
      logger.warn({ file: this.bufferFilePath }, 'Channel buffer file corrupted, starting fresh');
    }
  }

  private persistBuffer(): void {
    try {
      const dir = path.dirname(this.bufferFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const state: ChannelBufferState = {};
      for (const [channelId, messages] of this.channelBuffer.entries()) {
        state[channelId] = messages;
      }
      fs.writeFileSync(this.bufferFilePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      logger.error({ err }, 'Failed to persist channel buffer');
    }
  }

  getHistory(channelId: string): ClaudeMessage[] {
    const entries = this.contexts.get(channelId) ?? [];
    const limit = config.conversation.contextLimit;
    return entries.slice(-limit);
  }

  addUserMessage(channelId: string, content: string): void {
    this.addEntry(channelId, 'user', content);
  }

  addAssistantMessage(channelId: string, content: string): void {
    this.addEntry(channelId, 'assistant', content);
  }

  private addEntry(channelId: string, role: 'user' | 'assistant', content: string): void {
    const entries = this.contexts.get(channelId) ?? [];
    entries.push({ role, content });

    const limit = config.conversation.contextLimit * 2;
    if (entries.length > limit) {
      entries.splice(0, entries.length - limit);
    }

    this.contexts.set(channelId, entries);
  }

  addChannelMessage(channelId: string, author: string, content: string): void {
    const buffer = this.channelBuffer.get(channelId) ?? [];
    buffer.push({ author, content });
    if (buffer.length > CHANNEL_BUFFER_LIMIT) {
      buffer.splice(0, buffer.length - CHANNEL_BUFFER_LIMIT);
    }
    this.channelBuffer.set(channelId, buffer);
    this.persistBuffer();
  }

  getChannelBuffer(channelId: string): ChannelMessage[] {
    return this.channelBuffer.get(channelId) ?? [];
  }

  clear(channelId: string): void {
    this.contexts.delete(channelId);
  }
}
