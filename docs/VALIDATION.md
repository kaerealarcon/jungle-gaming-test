# Final local validation

The clean-install check ran on 7 October 2026 with Windows 11 and Node.js 24. A subsequent end-to-end review on 8 October uses the same locked dependencies directly in the workspace. The original isolated copy started without node_modules, dist or test caches. Source/assets/tests/lockfile hashes matched the working project. No private backend, credentials or environment secrets were used.

## Final results

- Strict application/E2E TypeScript, lint, simulation/result checks and Axios/shared-MSW records checks passed in the isolated copy.
- Optimized-preview full suite: **69 passed, 3 skipped, zero failures**, 6.0 minutes, with --update-snapshots=none. The three skips are phone-only landscape cases on the desktop project.
- All 14 existing Windows Chromium references compared successfully; no baseline was regenerated to accept cleanup.
- Every case checks uncaught page exceptions. Normal visual cases additionally check console errors; controlled network/texture failures retain expected error/recovery behavior.
- Normal production builds passed in both isolated and working directories. Bundle searches excluded profile/E2E observation, seed and manual-time globals.
- Normal-production desktop and touch-landscape smoke checks passed: Main Menu/refresh, actual worker-backed ranking/history, play, pause and exit, canvas disposal, no diagnostic globals or uncaught exceptions.

The complete retained report is [e2e-report/index.html](evidence/e2e-report/index.html), including responsive HUD/landscape attachments. Open with npx playwright show-report docs/evidence/e2e-report. New test runs generate playwright-report separately. The workspace retains this evidence; [DELIVERY.md](DELIVERY.md) provides installation/build/test commands.

## Browser coverage

| Suite | Desktop/mobile coverage |
| --- | --- |
| Options/loading | Invalid/fractional/empty values, limits, steppers, keyboard focus, save/refresh, corrupt/unavailable storage, immutable current-match config, real delayed/failed texture requests, retry and async exit |
| Navigation | Acceleration/coasting, both turns, islands/bounds/hulls, Chaser contact, manual/blur/hidden pause, frozen time and cleared inputs, resize/orientation, repeated scene exits, simultaneous touch, release/cancel/lost capture |
| Combat/lifecycle | Single front/triple parallel broadsides, independent cooldowns, ownership/damage, first-impact removal, water expiry splashes, both AI types/safe spawn intervals, actual time/death endings, unique scoring, frozen results, complete restart and abandoned-match isolation |
| Records | Shrinking-list page synchronization, tabs/pages/default two-page ranking, empty/error/cache recovery, invalid HTTP 200, delayed reads, same-query stale-history race, automatic CAPTAIN JACK, legacy migration, refresh to menu/history preservation, timeout-after-commit retry without duplicates, pending registration without blocking play |
| Visual/accessibility | Menu/Options/arena/pause/result/ranking/history, heading focus, accessible validation, tab arrows, desktop/portrait HUD and short landscape controls |
| Phone landscape | 844x390, 667x320, 568x260 screens, actual simultaneous sailing/fire, controls outside shores, reachable pause/result actions and rotation without state changes |

Game tests use actual DOM input and actual physics/rendering. The e2e-only observer controls deterministic seed/manual time and reads state; it does not teleport entities, set health or inject endings. Texture-route cases block Service Workers only in their isolated contexts; records cases exercise the real worker.

## Performance and limits

The [performance report](PERFORMANCE.md) and [raw evidence](evidence/performance.json) document a real 180-second optimized RTX 4060 match: 60.00 average callback FPS, 17.90 ms frame p95, 0.20 ms update p95, peaks of 3 ships/16 projectiles/15 effects. Five further start/play/exit cycles returned measured scenes, weakly observed simulations, canvases and playing audio to zero with stable DOM/listener counts. Numeric profile archives and shared caches intentionally remain; this does not prove absence of every native/GPU leak.

Headless Chromium keeps background tabs visible, so the hidden-document case emulates document.hidden and dispatches visibilitychange to the real listener. Review real tab switching/minimizing manually: pause must persist until explicit Resume. Chromium phone layouts do not prove physical Safari/Android behavior or device FPS. Main-menu instructions remain in gameplay, following the accepted interface. See [challenge coverage](REQUIREMENTS_REVIEW.md) for user-directed choices.

## Cleanup and package

Removed obsolete startup-result/name-form/sound-toggle/helper styles, unused Play/Settings imports, the unused mute setter and incomplete profile output. Restart remains because loading Retry uses its icon. All 520 supplied assets, required scripts/tests, worker, 14 reference PNGs and final evidence are preserved. Asset inventory and contact sheets were regenerated; missing tile-map/catalog links are repaired. ESLint ignores generated delivery/validation/report folders.

The isolated dependency/build/report folders and stale local test output are removed after exporting evidence. Normal dist remains available for preview and stays Git-ignored. The project remains in the workspace. No remote repository or public URL is created. Public deployment remains stage 7.

## Pre-deploy review ? 8 October

Corrected malformed null registration bodies to return HTTP 400 and synchronized selected page with a server-clamped page when a list shrinks. The full 69-case run includes both desktop/mobile page-shrink regressions. Node API tests send null/array/string/empty-object JSON and verify HTTP 400.

A subsequent resource review found missing destruction of arena-owned atlas crop textures. They now detach their source resize listeners on error/exit while preserving the cached base source. The new 180-second/five-cycle profile measures exactly one atlas resize listener at every settled exit, with zero surviving simulations/canvases/playing audio. The full browser report precedes this texture cleanup; focused lifecycle/loading/visual checks after the cleanup are recorded below.

Removed the obsolete packaging script/command and associated source-archive instructions; work continues directly in the project. Deployment configuration has not begun.

Post-texture-cleanup regression: **12/12 passed** in optimized preview (1.3 minutes), covering real expiry/restart, repeated scene exits/orientation, texture failure/retry, pending load cancellation and unchanged arena/pause/result references on desktop/mobile. [Focused report](evidence/texture-regression-report/index.html). Both reports are retained because they cover distinct phases of this review.

Final normal production build and two-cycle desktop/touch-landscape smoke checks passed on 8 October: worker-backed ranking, play/pause/exit, fresh reload to menu and zero uncaught exceptions. Production diagnostics are excluded.
