import { isValidOptions, type GameConfig } from '../game/config';
import { validateCaptainName } from '../player/name';

export interface MatchResult {
  id: string;
  completedAt: string;
  score: number;
  durationSeconds: number;
  reason: 'time' | 'death';
  config: GameConfig;
  captainName: string;
}
const key = 'pirate-battle.last-result.v1';
export function isMatchResult(raw: unknown): raw is MatchResult {
  if (!raw || typeof raw !== 'object') return false;
  const value = raw as Partial<MatchResult>;
  return typeof value.id === 'string' && value.id.length > 0
    && typeof value.completedAt === 'string' && Number.isFinite(Date.parse(value.completedAt))
    && typeof value.score === 'number' && Number.isInteger(value.score) && value.score >= 0
    && typeof value.durationSeconds === 'number' && value.durationSeconds >= 0
    && (value.reason === 'time' || value.reason === 'death')
    && typeof value.captainName === 'string' && (!value.captainName || !validateCaptainName(value.captainName))
    && !!value.config && isValidOptions({ sessionSeconds: value.config.sessionSeconds, spawnSeconds: value.config.spawn?.intervalSeconds })
    && value.durationSeconds <= value.config.sessionSeconds;
}
export function saveMatchResult(result: MatchResult): boolean {
  try { if (!isMatchResult(result)) return false; localStorage.setItem(key, JSON.stringify(result)); return true; } catch { return false; }
}
export function loadMatchResult(): MatchResult | null {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null'); return isMatchResult(value) ? value : null; } catch { return null; }
}
