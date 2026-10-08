# Architecture

## Boundaries and time

React owns menus, forms, HUD snapshots and native dialogs. PixiJS renders arena, entities, effects and ship health. NavigationSimulation owns gameplay and active time independently of browser APIs. NavigationInput combines independent keyboard/pointer sources for simultaneous touch actions. React receives changed score, hull, displayed second and lifecycle state rather than per-frame positions. Network operations affect only log data.

Simulation uses seconds with bounded substeps up to 120 Hz and a 100 ms frame cap. Acceleration and coasting are configurable. Pause clears input and freezes time, cooldowns, spawns and entities; blur/visibility pause automatically and resume requires action. createGameConfig snapshots options/balance; pause changes apply to the next match.

## Terrain, collisions and combat

Each match generates exactly three separated islands using a random seed, bounded attempts and a safe fallback. Rendering, collisions and navigation read the same per-match layout. Ship circles collide with rounded island rectangles, arena limits and live hulls. Blocking stops translation but permits turning. Destroyed entities leave attack/collision systems.

Seeded spawns enforce player/island/hull clearance and a brief grace period. Default matches begin with both enemy types. A visibility graph around expanded island corners supplies routes; turns are limited and Shooter fire requires range, line of sight and aim alignment. Chaser contact damages once, consumes the Chaser and awards no point.

Projectiles carry ownership and range/lifetime, hit only opposing ships and are removed on the first collision. Independent weapon cooldowns permit simultaneous weapons. Destroying an enemy awards one point. Health is clamped, the low-health warning is emitted once and time/death endings stop all updates. Circular hulls/rounded islands and current balance are approximations for gameplay testing.

## Rendering and cleanup

Arena asynchronously loads reusable textures before combat with progress/error/retry. Keyed sprite maps create/destroy entity/effect views. Clipped health fills use logical atlas metadata; enemies stay red. Damage selects art, fire and impact feedback; explosions include wood and water misses splash. Wakes sample actual displacement and fade when ships stop.

ResizeObserver scales one logical arena without changing coordinates; portrait rotates presentation and counter-rotates health bars. Density is capped at 2. Ocean is restricted to playable water, with compatible coast tiles and mirrored grass outside. Restart/exit destroys listeners, input bindings, ticker, observer, views and generated render textures, destroying arena-owned atlas crops without destroying shared cached source textures. Async guards handle Strict Mode teardown.

SoundManager unlocks Web Audio on gestures, caches decoded WAVs, caps voices and manages ocean/sailing loops. Simulation events trigger audio through the renderer. Generation/identity guards prevent delayed loads restarting disposed loops. Arena cleanup stops sounds; app cleanup closes the context. Audio errors never block gameplay.

## Local results and remote state

Completed matches create a unique ID, date, score, precise active duration, reason and cloned actual configuration including seed. Opening or refreshing always starts at Main Menu; saved results recover registration in the background without resuming Pixi. Abandonment creates nothing. The stable local player ID is separate from the captain name. New results use CAPTAIN JACK with no name form. Legacy/custom records retain a 10-character limit and heuristic term filter; the reserved CAPTAIN JACK name is explicitly accepted. Options/results validate on load; unavailable storage reports errors while gameplay remains accessible.

RecordsProvider owns TanStack Query and registration outside arena lifecycle. Queries key resource, configuration/player and page; Axios consumes AbortSignal with a four-second timeout. Opening tabs refetches. Registration cancels old reads before invalidating both tabs; failed background updates retain cached tables. Ranking excludes only random seed from configuration comparison and sorts by score descending, then completion date/ID ascending. Lists have five matches per page.

The persistent outbox retains requests across navigation, new matches and refresh. Missing names use CAPTAIN JACK, legacy unnamed entries migrate to pending, and completed matches register automatically. Queued entries dispatch through useMutation, failures expose retry, sending entries reload as pending. Once dispatched, payloads are immutable per ID. Transient requests retry once; 4xx do not retry automatically. Online reconnection retries failures. Durable confirmation precedes list invalidation. Startup verifies confirmed receipts against all server history pages, replaying only absent records with their original IDs to repair acknowledgments from older builds. Match History uses the fixed CAPTAIN JACK display heading.

MSW browser/Node handlers share typed contracts, fixtures and persistence. One database supplies both lists, keyed by match ID. Repeated POSTs return the original record even after timeout following commit. Records persist before acknowledgment. Worker startup failure affects only log requests. The generated worker ships in production. [docs/NETWORK.md](docs/NETWORK.md) details endpoints, cache, persistence, scenarios and reset behavior.

## Verification and later delivery

Simulation/name/storage checks run without a browser. API checks exercise actual Axios-to-MSW calls. Playwright uses Chromium desktop/mobile, deterministic fixtures, visual snapshots, tabs/pages, 320px layout, errors, late responses, refresh, idempotency and pending-registration gameplay independence. Traces/screenshots are retained on failure. Gameplay/visual E2E coverage and the three-minute/five-cycle profile are implemented. See docs/VALIDATION.md and docs/PERFORMANCE.md for measured evidence and limits. Public deployment is the remaining delivery stage.
