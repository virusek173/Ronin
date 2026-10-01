import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface ChangelogEntry {
  id: number;
  text: string;
}

// Latest entries shown at once, so a long gap between restarts doesn't
// turn the greeting into a wall of text.
const MAX_ANNOUNCED = 5;

function loadEntries(): ChangelogEntry[] {
  try {
    if (!fs.existsSync(config.paths.changelogFile)) return [];
    const raw = fs.readFileSync(config.paths.changelogFile, 'utf-8');
    const entries: ChangelogEntry[] = [];
    for (const block of raw.split(/^## /m).slice(1)) {
      const [header, ...rest] = block.split('\n');
      const id = parseInt(header.trim(), 10);
      const text = rest.join('\n').trim();
      if (!Number.isNaN(id) && text) entries.push({ id, text });
    }
    return entries.sort((a, b) => a.id - b.id);
  } catch (err) {
    logger.warn({ err }, 'Failed to read changelog file');
    return [];
  }
}

function loadLastAnnouncedId(): number | null {
  try {
    if (!fs.existsSync(config.paths.announcedChangesFile)) return null;
    const raw = fs.readFileSync(config.paths.announcedChangesFile, 'utf-8');
    const id = JSON.parse(raw).lastId;
    return typeof id === 'number' ? id : null;
  } catch {
    logger.warn('Failed to read announced changes file');
    return null;
  }
}

export function saveLastAnnouncedId(id: number): void {
  try {
    const dir = path.dirname(config.paths.announcedChangesFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(config.paths.announcedChangesFile, JSON.stringify({ lastId: id }), 'utf-8');
  } catch (err) {
    logger.error({ err }, 'Failed to save announced changes state');
  }
}

// Entries newer than the last announced one. With no state file yet we
// announce nothing and just record the current latest, so a fresh setup
// doesn't dump the whole history on the channel.
export function getUnannouncedChanges(): { entries: ChangelogEntry[]; latestId: number | null } {
  const all = loadEntries();
  const latestId = all.length ? all[all.length - 1].id : null;
  if (latestId === null) return { entries: [], latestId };

  const lastAnnounced = loadLastAnnouncedId();
  if (lastAnnounced === null) {
    saveLastAnnouncedId(latestId);
    return { entries: [], latestId };
  }

  return {
    entries: all.filter(e => e.id > lastAnnounced).slice(-MAX_ANNOUNCED),
    latestId,
  };
}
