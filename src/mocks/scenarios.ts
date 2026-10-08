export const scenarioNames = ['success', 'empty', 'multiple-pages', 'slow', 'variable', 'out-of-order', 'stale-history', 'timeout', 'connection-error', 'http-400', 'http-500', 'ranking-error', 'history-error', 'malformed-response', 'timeout-after-save', 'unavailable'] as const;
export type Scenario = typeof scenarioNames[number];
const key = 'pirate-battle.mock-scenario.v1';
let sequence = 0;
let historySequence = 0;
let override: Scenario | undefined;
export function getScenario(): Scenario {
  if (override) return override;
  try {
    const raw = localStorage.getItem(key);
    return scenarioNames.includes(raw as Scenario) ? raw as Scenario : 'success';
  } catch { return 'success'; }
}
export function setScenario(scenario: Scenario) { override = scenario; sequence = 0; historySequence = 0; try { localStorage.setItem(key, scenario); } catch { /* In-memory scenario remains usable. */ } }
export function nextDelay(scenario: Scenario, resource?: string): number {
  if (scenario === 'stale-history' && resource === 'history') return historySequence++ === 0 ? 3000 : 100;
  const request = sequence++;
  if (scenario === 'timeout') return 7000;
  if (scenario === 'slow') return 2000;
  if (scenario === 'variable') return [100, 700, 250, 1200][request % 4]!;
  if (scenario === 'out-of-order') return request % 2 === 0 ? 1800 : 100;
  return 250;
}
