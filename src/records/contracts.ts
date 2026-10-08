import type { MatchResult } from '../player/result';

export interface PlayerIdentity { id: string }
export interface RegisteredMatch extends MatchResult { playerId: string; configurationKey: string }
export interface RankingEntry extends RegisteredMatch { rank: number }
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
export interface RegisterMatchRequest { playerId: string; match: MatchResult }

// Include every balance parameter; the per-match random seed is not a difficulty setting.
export function configurationKey(config: MatchResult['config']): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'seed').sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
    return value;
  };
  return JSON.stringify(canonical(config));
}

export function paginate<T>(items: T[], page: number, pageSize = 5): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const boundedPage = Math.min(Math.max(1, page), totalPages);
  return { items: items.slice((boundedPage - 1) * pageSize, boundedPage * pageSize), page: boundedPage, pageSize, total: items.length, totalPages };
}
