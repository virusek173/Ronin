import { Category } from './loader';

export function formatCategoryList(categories: Category[]): string {
  const lines = categories.map(cat => `${cat.emoji} **${cat.name}** — ${cat.facts.length} ciekawostek`);
  return lines.join('\n');
}

export function totalFactCount(categories: Category[]): number {
  return categories.reduce((sum, c) => sum + c.facts.length, 0);
}
