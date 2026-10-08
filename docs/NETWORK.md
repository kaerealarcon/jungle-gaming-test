# Captain's log network layer

Axios sends HTTP requests; TanStack Query owns queries and mutations; MSW intercepts the REST boundary. Shared handlers run in the browser and Node tests. The worker is copied into `public/` and is included in the production build. No real backend or private service is required. MSW needs localhost or HTTPS. If it cannot start, game/options remain accessible and the log reports an error.

## Contracts

- `GET /api/ranking?configuration=<canonical-config>&page=1`: `Page<RankingEntry>` with global rank, five matches per page.
- `GET /api/history?playerId=<local-id>&page=1`: `Page<RegisteredMatch>`, newest first.
- `POST /api/matches`: `{ playerId, match }`, with `Idempotency-Key: <match.id>`. Returns the registered match, including on repeat requests.

Every match includes ID, player ID/name, completion date, score, effective active duration, end reason and full gameplay configuration. Ranking compares the complete configuration, excluding only the random layout/spawn seed. Ties resolve by score descending, completion date ascending and ID ascending. History uses a stable local player ID rather than a changeable name. Other players come from deterministic fixtures; empty rankings are valid when a new configuration has no matches.

## Persistence and recovery

`pirate-battle.player.v1` identifies this browser's player. `pirate-battle.outbox.v1` retains queued, sending, failed and confirmed registration status. New matches register automatically with the fixed name CAPTAIN JACK; the result has no name form. This reserved name is accepted explicitly, while validation of legacy/custom data retains its existing limits. Old waiting-name entries migrate to pending and register automatically. Match History always displays CAPTAIN JACK in its header. Entries in flight are restored as pending after refresh; failed entries expose manual retry. Online reconnection retries failed entries. The same match ID and frozen payload are reused on every retry. Startup always opens Main Menu and recovers saved-result registration in the background. On startup, confirmed receipts are checked against paginated server history; any missing records are replayed with the same ID, recovering acknowledgments from older builds without duplicates. The mock database uses `pirate-battle.mock-matches.v1` and persists both ranking/history from one source.

POST retries once for transient errors, not 4xx. Axios times out after four seconds. A timeout after commit preserves the pending request: retry returns the existing match, not another entry. No match is queued on abandonment. Storage failures are reported; in-memory gameplay stays available, but durable pending recovery is impossible if the browser denies storage.

Query keys include resource, configuration or player ID, and page. Each HTTP read consumes TanStack Query's AbortSignal. Successful registration cancels outdated reads and invalidates both lists; opening either tab refetches while retaining cached data. Failed background refreshes keep the cached table and show an error. Pages/tabs never reuse another query's data.

## Network demonstration

Open `/?mocks=1` to expose **Network demo**. These implementation controls are absent from the normal player flow and also work in the published build.

| Scenario | Behavior |
| --- | --- |
| success | 250 ms, ten fixture opponents (two pages) for the selected configuration, plus your actual registered matches |
| empty | Empty list responses |
| multiple-pages | Default ranking plus 15 clearly identified Demo history fixtures |
| slow | Two-second latency |
| variable | Repeating 100/700/250/1200 ms delays |
| out-of-order | Alternating 1800/100 ms delays |
| stale-history | History snapshots are captured before latency; the first read waits 3000 ms, later reads 100 ms, registration 250 ms. Exercises a stale same-query response racing a new confirmation. |
| timeout | Seven-second latency, exceeding the client timeout |
| connection-error | Network failure |
| http-400 / http-500 | Request rejection / server failure |
| ranking-error / history-error | Failure isolated to that list |
| malformed-response | History returns HTML with HTTP 200; response validation rejects it without crashing the UI |
| timeout-after-save | POST persists the match, then delays its response seven seconds |
| unavailable | All log endpoints return 503; gameplay remains local |

Choose success to restore service, then use **Retry pending matches** or the result/log retry action. **Reset demo data** restores server fixtures and removes local results/outbox entries, preserving identity/options; it is disabled while registration is in flight. Scenario choice persists after refresh. Timing uses deterministic sequences, not random delays.

## Verification

`npm run test:records` exercises the actual shared MSW handlers with Axios: matching configuration, pagination, history isolation, durable outbox, idempotency, errors and recovery after a committed request times out.

`npm run test:e2e` runs Chromium desktop/mobile tests and visual snapshots of Ranking/Match History. It covers tabs, pagination, empty/error/recovery, 320px layout, result registration and refresh, late requests, history pagination, timeout recovery, and starting/abandoning another voyage while a submission is pending. References are in `tests/e2e/records.spec.ts-snapshots/`; update intentionally with `npm run test:e2e -- --update-snapshots`.

To exercise the optimized test build on PowerShell, run `npm run build:e2e`, set `$env:PW_PREVIEW = '1'`, then run `npm run test:e2e`. The worker and APIs remain enabled in preview/production. The full suite also covers controls, combat, endings, pause, scene cleanup and both mobile orientations. See VALIDATION.md and PERFORMANCE.md for current results. Run npm run build afterward to restore the normal production build.

Implementation references: [MSW worker startup](https://mswjs.io/api/setup-worker/start), [TanStack Query mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations), and [Axios cancellation](https://axios-http.com/docs/cancellation).
