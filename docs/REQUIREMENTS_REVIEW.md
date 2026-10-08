# Technical challenge coverage

Current review: 7 October 2026. See [validation](VALIDATION.md), [performance](PERFORMANCE.md) and [delivery](DELIVERY.md).

| Requirement | Implementation / evidence |
| --- | --- |
| Required stack | React, strict TypeScript, PixiJS, Axios, TanStack Query, shared browser/Node MSW handlers and Playwright |
| Controls/weapons | Keyboard/touch, acceleration/coasting, independent cooldowns, single front and parallel triple broadsides |
| Enemies/collision | Chaser pursuit/contact, Shooter routing/fire, safe spawns, terrain/bounds/hulls and unique scoring |
| Time/pause/restart | 60?180 active seconds, both endings, frozen results, manual/blur/visibility pause, explicit resume and full reset |
| Options/persistence | Limits/validation, saved defaults, immutable effective config, durable receipts/outbox, no abandonment record |
| UI/feedback | Supplied samples/art/audio, health/damage/fire/debris/splash/wakes, exactly three random islands |
| Desktop/mobile | Portrait/landscape, simultaneous touch, control placement and rotation preserving state |
| Ranking/history | Five rows/page, full comparable config excluding seed, deterministic ties, CAPTAIN JACK and stable identity |
| Network resilience | Loading/empty/error/cache/retry, cancellation/races, invalid HTTP 200, timeout after commit and pending recovery |
| E2E/references | Real input/physics with isolated test-only seed/time observers and desktop/mobile screen references |
| Performance/memory | Actual optimized 180-second GPU match, raw timing/entity data and five GC/resource lifecycle measurements |
| Source delivery | Source/lockfile/assets/mocks/tests/docs, isolated install/build/test validation and retained local evidence |
| Public URL | Remaining stage 7; no public deployment is claimed |

CAPTAIN JACK is fixed without a name form. Legacy/custom data retains ten-character validation and a heuristic filter; the reserved name is explicitly accepted. Main-menu instructions were removed at the user's request and remain in gameplay. Menu/result buttons are text-only. Audio starts enabled without a toggle. Options has one save-and-return action and no Close. Refresh opens Main Menu while saved registration recovers in the background.

These choices follow the accepted interface; removed main-menu instructions are not claimed as present. Chromium phone emulation does not establish physical Safari/Android behavior or device FPS. Public publication remains a separate final stage.
