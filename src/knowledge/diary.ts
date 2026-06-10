import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface DiaryEntry {
  content: string;
  dayNumber: number;
}

function parseDayNumber(filename: string): number {
  const match = filename.match(/[Dd]zień\s+(\d+)/);
  return match ? parseInt(match[1], 10) : -1;
}

function parseDatePrefix(filename: string): string | null {
  const match = filename.match(/^(\d{4}\.\d{2}\.\d{2})/);
  return match ? match[1] : null;
}

let cachedEntries: DiaryEntry[] | null = null;

function loadAllEntries(): DiaryEntry[] {
  if (cachedEntries) return cachedEntries;

  const diaryPath = config.diary.path;

  if (!fs.existsSync(diaryPath)) {
    logger.warn({ diaryPath }, 'Diary directory not found');
    return (cachedEntries = []);
  }

  const files = fs.readdirSync(diaryPath)
    .filter(f => f.endsWith('.md') && parseDatePrefix(f) !== null && /[Dd]zień/.test(f));

  files.sort((a, b) => {
    const da = parseDatePrefix(a)!;
    const db = parseDatePrefix(b)!;
    return da.localeCompare(db);
  });

  cachedEntries = files.map(filename => {
    const fullPath = path.join(diaryPath, filename);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const dayNumber = parseDayNumber(filename);
    return { content, dayNumber };
  });

  logger.info({ count: cachedEntries.length }, 'Diary entries loaded');
  return cachedEntries;
}

export function loadDiaryEntry(dayOffset: number): DiaryEntry | null {
  const entries = loadAllEntries();
  if (dayOffset < 0 || dayOffset >= entries.length) return null;
  return entries[dayOffset];
}

export function diaryEntryCount(): number {
  return loadAllEntries().length;
}
