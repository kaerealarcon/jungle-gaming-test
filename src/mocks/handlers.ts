import { delay, http, HttpResponse } from 'msw';
import { isMatchResult } from '../player/result';
import { paginate, type RegisterMatchRequest } from '../records/contracts';
import { fixturesForConfig, orderedRanking, rankingMatches, readDatabase, registerMatch } from './database';
import { createGameConfig, defaultOptions } from '../game/config';
import { getScenario, nextDelay } from './scenarios';

function pageNumber(url: URL): number | null {
  const page = Number(url.searchParams.get('page') ?? 1);
  return Number.isInteger(page) && page >= 1 ? page : null;
}
async function failure(resource: 'ranking' | 'history' | 'register') {
  const scenario = getScenario();
  await delay(nextDelay(scenario, resource));
  if (scenario === 'connection-error') return HttpResponse.error();
  if (scenario === 'http-400') return HttpResponse.json({ message: 'Invalid request.' }, { status: 400 });
  if (scenario === 'http-500' || scenario === 'unavailable' || scenario === `${resource}-error`) return HttpResponse.json({ message: 'The captain’s log is temporarily unavailable.' }, { status: 503 });
  return null;
}

export const handlers = [
  http.get('*/api/ranking', async ({ request }) => {
    const error = await failure('ranking'); if (error) return error;
    const url = new URL(request.url); const page = pageNumber(url); const key = url.searchParams.get('configuration');
    if (!page || !key) return HttpResponse.json({ message: 'Page and configuration are required.' }, { status: 400 });
    const items = getScenario() === 'empty' ? [] : orderedRanking(rankingMatches(key, getScenario() === 'multiple-pages' ? 15 : 10));
    return HttpResponse.json(paginate(items.map((item, index) => ({ ...item, rank: index + 1 })), page));
  }),
  http.get('*/api/history', async ({ request }) => {
    const scenario = getScenario();
    const url = new URL(request.url); const page = pageNumber(url); const playerId = url.searchParams.get('playerId');
    if (!page || !playerId) return HttpResponse.json({ message: 'Page and player ID are required.' }, { status: 400 });
    const demoHistory = scenario === 'multiple-pages' ? fixturesForConfig(createGameConfig(defaultOptions), 15).map((item, index) => ({ ...item, id: `demo-history-${index}`, playerId, captainName: 'Demo' })) : [];
    // Capture the request's snapshot before latency, so delayed reads can truly be stale.
    const items = scenario === 'empty' ? [] : [...readDatabase().filter(item => item.playerId === playerId), ...demoHistory].sort((a, b) => b.completedAt.localeCompare(a.completedAt) || a.id.localeCompare(b.id));
    const error = await failure('history'); if (error) return error;
    if (scenario === 'malformed-response') return HttpResponse.html('<!doctype html><html><body>Fallback page</body></html>');
    return HttpResponse.json(paginate(items, page));
  }),
  http.post('*/api/matches', async ({ request }) => {
    const error = await failure('register'); if (error) return error;
    let body: Partial<RegisterMatchRequest>;
    try { body = await request.json() as Partial<RegisterMatchRequest>; } catch { return HttpResponse.json({ message: 'Invalid JSON.' }, { status: 400 }); }
    if (!body || typeof body !== 'object' || typeof body.playerId !== 'string' || !body.playerId || !isMatchResult(body.match) || !body.match.captainName || request.headers.get('Idempotency-Key') !== body.match.id) return HttpResponse.json({ message: 'A valid named match and idempotency key are required.' }, { status: 400 });
    try {
      const match = registerMatch(body as RegisterMatchRequest);
      if (getScenario() === 'timeout-after-save') await delay(7000);
      return HttpResponse.json(match, { status: 200 });
    } catch { return HttpResponse.json({ message: 'Unable to persist the match.' }, { status: 503 }); }
  }),
];
