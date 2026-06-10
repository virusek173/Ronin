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

export function loadTestOffset(): number {
  try {
    if (fs.existsSync(config.paths.diaryOffsetFile)) {
      const raw = fs.readFileSync(config.paths.diaryOffsetFile, 'utf-8');
      return JSON.parse(raw).offset ?? 0;
    }
  } catch {
    logger.warn('Failed to read diary offset file, starting from 0');
  }
  return 0;
}

export function saveTestOffset(offset: number): void {
  try {
    const dir = path.dirname(config.paths.diaryOffsetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(config.paths.diaryOffsetFile, JSON.stringify({ offset }), 'utf-8');
  } catch (err) {
    logger.error({ err }, 'Failed to save diary offset');
  }
}
