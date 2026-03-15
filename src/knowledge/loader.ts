import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface Category {
  name: string;
  filename: string;
  emoji: string;
  facts: string[];
  keywords: string[];
}

const EMOJI_MAP: Record<string, string> = {
  historia: '🏯',
  kultura: '🎭',
  kuchnia: '🍱',
  'język': '🗾',
  technologia: '⚙️',
  natura: '🌸',
  'codzienne życie': '🏙️',
  codzienne: '🏙️',
  mitologia: '⛩️',
};

const KEYWORDS_MAP: Record<string, string[]> = {
  historia: ['historia', 'historyczn', 'samuraj', 'shogun', 'szogunat', 'edo', 'meiji', 'tokugawa', 'feudaln', 'siogunat'],
  kultura: ['kultura', 'kulturow', 'tradycja', 'tradycyjn', 'teatr', 'kabuki', 'geisha', 'ceremonia', 'sztuka', 'anime', 'manga', 'sumo'],
  kuchnia: ['kuchni', 'jedzen', 'jedzić', 'jeść', 'sushi', 'ramen', 'soba', 'udon', 'sake', 'matcha', 'wasabi', 'tempura', 'miso', 'tofu', 'obiad', 'kolacja'],
  'język': ['języku', 'język', 'japonski', 'japoński', 'kanji', 'hiragana', 'katakana', 'słowo', 'pisown', 'mów'],
  technologia: ['technolog', 'robot', 'elektronik', 'toyota', 'sony', 'honda', 'nintendo', 'innowacj', 'przemysł', 'technik'],
  natura: ['natur', 'przyrod', 'sakura', 'wiśni', 'góra', 'fuji', 'las', 'ocean', 'zwierz', 'roślin', 'pory roku', 'śnieg'],
  'codzienne życie': ['codzien', 'życi', 'społeczeństwo', 'szkoł', 'prac', 'transport', 'mieszkan', 'onsen', 'sentō'],
  mitologia: ['mitologi', 'mit', 'legend', 'bóg', 'bogini', 'kami', 'shinto', 'buddyz', 'świątyni', 'yokai', 'demon'],
};

function parseCategoryFile(filePath: string, filename: string): Category | null {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Extract category name from header
  const headerMatch = lines[0]?.match(/^# Kategoria:\s*(.+)$/);
  if (!headerMatch) {
    logger.warn({ filePath }, 'Cannot parse category header');
    return null;
  }

  const name = headerMatch[1].trim();
  const nameLower = name.toLowerCase();

  // Extract facts (bullet points)
  const facts = lines
    .filter(line => line.startsWith('- '))
    .map(line => line.slice(2).trim())
    .filter(fact => fact.length > 0);

  // Determine emoji
  let emoji = '📚';
  for (const [key, em] of Object.entries(EMOJI_MAP)) {
    if (nameLower.includes(key)) {
      emoji = em;
      break;
    }
  }

  // Determine keywords
  let keywords: string[] = [nameLower];
  for (const [key, kws] of Object.entries(KEYWORDS_MAP)) {
    if (nameLower.includes(key) || key.includes(nameLower)) {
      keywords = [...keywords, ...kws];
      break;
    }
  }

  return { name, filename, emoji, facts, keywords };
}

export function loadKnowledgeBase(dirPath: string): Category[] {
  const categories: Category[] = [];

  if (!fs.existsSync(dirPath)) {
    throw new Error(`Knowledge base directory not found: ${dirPath}`);
  }

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

  for (const filename of files) {
    const filePath = path.join(dirPath, filename);
    const category = parseCategoryFile(filePath, filename);
    if (category && category.facts.length > 0) {
      categories.push(category);
    }
  }

  logger.info(
    { categories: categories.map(c => `${c.name}(${c.facts.length})`).join(', ') },
    `Loaded ${categories.length} categories`
  );

  return categories;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function findCategoryByKeyword(categories: Category[], query: string): Category | null {
  const q = normalize(query);
  const queryWords = q.split(/\s+/).filter(w => w.length >= 4);

  for (const category of categories) {
    for (const keyword of category.keywords) {
      const kw = normalize(keyword);

      // Exact substring match
      if (q.includes(kw)) return category;

      // Stem match: check if any query word shares a stem with the keyword
      // (handles Polish declension: "historii" matches "historia", "kuchni" matches "kuchnia")
      for (const word of queryWords) {
        const stemLen = Math.max(4, Math.min(word.length, kw.length) - 2);
        if (word.slice(0, stemLen) === kw.slice(0, stemLen)) {
          return category;
        }
      }
    }
  }
  return null;
}

export function randomFact(category: Category): string {
  const idx = Math.floor(Math.random() * category.facts.length);
  return category.facts[idx];
}
