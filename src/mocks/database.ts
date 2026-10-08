import { createGameConfig, defaultOptions, isValidOptions, type GameConfig } from '../game/config';
import { isMatchResult } from '../player/result';
import { configurationKey, type RegisteredMatch, type RegisterMatchRequest } from '../records/contracts';

const key = 'pirate-battle.mock-matches.v1';
const captains = ['Flint', 'Sparrow', 'StormRider', 'SeaWolf', 'BlackPearl', 'Morgan', 'RedSail', 'Coral', 'Silver', 'Drake', 'Tide', 'Shark', 'Anchor', 'Raven', 'Seabreeze'];
export function fixtures(): RegisteredMatch[] {
  return [defaultOptions, { sessionSeconds: 120, spawnSeconds: 3 }, { sessionSeconds: 60, spawnSeconds: 30 }].flatMap(options => fixturesForConfig(createGameConfig(options)));
}

export function fixturesForConfig(config: GameConfig, count = 10): RegisteredMatch[] {
  const configKey = configurationKey(config);
  return captains.slice(0, count).map((captainName, index) => ({ id: `fixture-${configKey}-${index}`, playerId: `fixture-player-${index}`, captainName, completedAt: new Date(Date.UTC(2026, 8, 8, 21, 42 - index * 4)).toISOString(), score: [38, 32, 24, 21, 19, 18, 17, 16, 15, 14, 12, 11, 10, 9, 8][index]!, durationSeconds: config.sessionSeconds, reason: 'time' as const, config, configurationKey: configKey }));
}

export function rankingMatches(configKey: string, count = 10): RegisteredMatch[] {
  const actual = readDatabase().filter(item => item.configurationKey === configKey && !item.playerId.startsWith('fixture-player-'));
  try {
    const raw = JSON.parse(configKey) as Partial<GameConfig>;
    const options = { sessionSeconds: raw.sessionSeconds, spawnSeconds: raw.spawn?.intervalSeconds };
    if (!isValidOptions(options)) return actual;
    const config = createGameConfig(options);
    if (configurationKey(config) !== configKey) return actual;
    // Generate opponents for the selected difficulty, keeping all real records intact.
    return [...actual, ...fixturesForConfig(config, count)];
  } catch { return actual; }
}

let memory: RegisteredMatch[] | undefined;
export function readDatabase(): RegisteredMatch[] {
  if (memory) return memory;
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (Array.isArray(stored)) return memory = stored.filter((item): item is RegisteredMatch => {
      if (!isMatchResult(item)) return false;
      const registered = item as Partial<RegisteredMatch>;
      return typeof registered.playerId === 'string' && registered.configurationKey === configurationKey(item.config);
    });
  } catch { /* A broken mock database is rebuilt from deterministic fixtures. */ }
  return memory = fixtures();
}

function persist(items: RegisteredMatch[]) {
  // A failed storage write must not be acknowledged as a durable registration.
  localStorage.setItem(key, JSON.stringify(items));
  memory = items;
}

export function registerMatch(request: RegisterMatchRequest): RegisteredMatch {
  const items = readDatabase();
  const existing = items.find(item => item.id === request.match.id);
  if (existing) {
    if (existing.playerId !== request.playerId) throw new Error('Match ID belongs to another player.');
    return existing;
  }
  const registered = { ...structuredClone(request.match), playerId: request.playerId, configurationKey: configurationKey(request.match.config) };
  persist([...items, registered]);
  return registered;
}

export function resetDatabase(): void { persist(fixtures()); }
export function forgetDatabaseForTests(): void { memory = undefined; }

export function orderedRanking(items: RegisteredMatch[]): RegisteredMatch[] {
  return [...items].sort((a, b) => b.score - a.score || a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id));
}
