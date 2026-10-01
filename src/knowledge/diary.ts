import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface DiaryEntry {
  content: string;
  dayNumber: number;
  date: string;
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
    const date = parseDatePrefix(filename)!;
    return { content, dayNumber, date };
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

// Number of extra days, appended after the real diary entries, used to post
// a multi-part trip summary once the diary has played through in full —
// before permanently switching over to regular daily facts.
export const SUMMARY_DAYS = 8;

export function getAllEntriesAsText(): string {
  return loadAllEntries()
    .map(e => `--- Dzień ${e.dayNumber} (${e.date}) ---\n${e.content}`)
    .join('\n\n');
}

const OBSERVATIONS_FILENAME = 'Ogólne obserwacje w Japonii.md';

// Freeform observation notes (etiquette, tech, daily life) kept alongside
// the day-by-day diary but outside the YYYY.MM.DD naming convention, so the
// regular loader skips them. Used as grounding material for summary days
// about culture/technology so the bot doesn't have to invent details.
export function loadGeneralObservations(): string | null {
  try {
    const filePath = path.join(config.diary.path, OBSERVATIONS_FILENAME);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    logger.warn({ err }, 'Failed to read general observations file');
    return null;
  }
}

const TRIP_MEMORY_DIRNAME = 'Pamiec';
let cachedTripMemory: string | null | undefined;

// Curated summaries (places, food, anecdotes, chronology) kept in a Pamiec/
// subfolder of the diary. Gives the bot a trustworthy picture of what the
// group really did, instead of leaning on a pre-trip plan.
export function loadTripMemory(): string | null {
  if (cachedTripMemory !== undefined) return cachedTripMemory;
  try {
    const dir = path.join(config.diary.path, TRIP_MEMORY_DIRNAME);
    if (!fs.existsSync(dir)) return (cachedTripMemory = null);
    const parts = fs.readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .map(f => fs.readFileSync(path.join(dir, f), 'utf-8').trim());
    cachedTripMemory = parts.length ? parts.join('\n\n') : null;
  } catch (err) {
    logger.warn({ err }, 'Failed to read trip memory files');
    cachedTripMemory = null;
  }
  return cachedTripMemory;
}

// Real calendar date of the last diary entry (i.e. when the trip actually
// ended), used for phrasing like "wrócili X temu" — independent of the
// looping day counter used to pick which entry to post.
export function getTripEndDate(): Date | null {
  const entries = loadAllEntries();
  if (entries.length === 0) return null;
  const lastDate = entries[entries.length - 1].date;
  const [year, month, day] = lastDate.split('.').map(Number);
  return new Date(year, month - 1, day);
}

// Persistent day counter: starts at 0 on first run, advances by one on
// every cron firing, and is wrapped (mod entry count) by the caller so the
// diary replays from the beginning once the last entry is reached.
export function loadDiaryOffset(): number {
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

export function saveDiaryOffset(offset: number): void {
  try {
    const dir = path.dirname(config.paths.diaryOffsetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(config.paths.diaryOffsetFile, JSON.stringify({ offset }), 'utf-8');
  } catch (err) {
    logger.error({ err }, 'Failed to save diary offset');
  }
}
