import * as fs from 'fs';
import * as path from 'path';
import { Category } from './loader';
import { logger } from '../utils/logger';

interface TrackerState {
  remaining: string[];   // "CategoryName:factIndex" entries not yet sent
  sent: string[];        // already sent in current cycle
}

const EMPTY_STATE: TrackerState = { remaining: [], sent: [] };

export class FactTracker {
  private state: TrackerState;
  private filePath: string;

  constructor(filePath: string, categories: Category[]) {
    this.filePath = filePath;
    this.state = this.load(categories);
  }

  private buildAllKeys(categories: Category[]): string[] {
    const keys: string[] = [];
    for (const cat of categories) {
      for (let i = 0; i < cat.facts.length; i++) {
        keys.push(`${cat.name}:${i}`);
      }
    }
    return keys;
  }

  private load(categories: Category[]): TrackerState {
    const allKeys = this.buildAllKeys(categories);

    if (!fs.existsSync(this.filePath)) {
      const state = this.freshCycle(allKeys);
      this.persist(state);
      return state;
    }

    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const saved: TrackerState = JSON.parse(raw);

      // Validate and fill in any new facts added since last run
      const remainingSet = new Set([...saved.remaining, ...saved.sent]);
      for (const key of allKeys) {
        if (!remainingSet.has(key)) {
          saved.remaining.push(key);
        }
      }

      // If somehow remaining is empty (completed cycle), reset
      if (saved.remaining.length === 0) {
        return this.freshCycle(allKeys);
      }

      return saved;
    } catch {
      logger.warn({ file: this.filePath }, 'Tracker file corrupted, starting fresh cycle');
      const state = this.freshCycle(allKeys);
      this.persist(state);
      return state;
    }
  }

  private freshCycle(allKeys: string[]): TrackerState {
    const shuffled = [...allKeys].sort(() => Math.random() - 0.5);
    return { remaining: shuffled, sent: [] };
  }

  private persist(state: TrackerState): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      logger.error({ err }, 'Failed to persist tracker state');
    }
  }

  nextFact(categories: Category[]): { category: Category; fact: string } | null {
    if (this.state.remaining.length === 0) {
      const allKeys = this.buildAllKeys(categories);
      this.state = this.freshCycle(allKeys);
      logger.info('Tracker cycle completed, starting fresh');
    }

    const key = this.state.remaining.shift()!;
    this.state.sent.push(key);
    this.persist(this.state);

    const [categoryName, idxStr] = key.split(':');
    const category = categories.find(c => c.name === categoryName);
    if (!category) return null;

    const idx = parseInt(idxStr, 10);
    const fact = category.facts[idx];
    if (!fact) return null;

    return { category, fact };
  }

  get remainingCount(): number {
    return this.state.remaining.length;
  }

  save(): void {
    this.persist(this.state);
  }
}
