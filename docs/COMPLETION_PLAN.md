# Completion plan

This plan closes the remaining original challenge requirements. Implementation proceeds one stage at a time. After each stage, report changes, validation and any remaining limitations, then pause for the user to test and approve moving forward. Fix that stage's issues before starting the next one. Creating this plan does not authorize starting implementation or deployment.

## Stage 1 — deterministic test support and Options/loading E2E

Add isolated test-only seed/time/state observation support that preserves real simulation, inputs, collisions and Pixi rendering. The normal game continues to choose random layouts. Avoid enabling diagnostic controls in normal player flows.

Add Chromium desktop/mobile tests for menu navigation, Options limits/invalid values, saving/refresh persistence, keyboard activation/focus, and the per-match options snapshot. Exercise actual asset loading progress, a controlled texture failure, retry and leaving during asynchronous startup. Complete keyboard/focus checks for these screens.

**Exit criteria:** Tests pass against production preview; test state is isolated and reproducible; normal options/loading behavior remains reviewable manually.

**User review:** Main Menu/Options navigation, saving, validation, returning to the menu and loading/retry experience.

## Stage 2 — navigation, pause and touch E2E

Use the real controls to verify forward movement, left/right rotation, arena bounds, island and hull collision, acceleration/coasting, manual pause, blur/hidden-tab pause, frozen clock/cooldowns and explicit resume with cleared input. Cover desktop/mobile orientations and resizing without changing logical state. Exercise simultaneous touch movement/turning and movement/firing, pointer release/cancel and navigation out of gameplay.

Add repeated start/exit and Strict Mode asynchronous lifecycle checks. Correct focus restoration or accessibility defects found in these flows.

**Exit criteria:** These scenarios pass in Chromium desktop/mobile, including portrait/landscape, without uncaught console errors or input continuing after pause/exit.

**User review:** Steering, collisions, pause/resume, desktop HUD alignment and mobile multi-touch usability.

## Stage 3 — combat, enemies and match lifecycle E2E

Press game controls and verify single front shots, triple parallel broadsides, independent cooldowns, projectile removal, obstacle blocking, owner-specific damage and unique scoring. Assert Chaser/Shooter behavior and safe configured spawn intervals. Exercise real time-expiry/death endings, frozen post-end state, and complete Play Again reset (health, score, clock, entities, cooldowns and layout).

Verify automatic CAPTAIN JACK registration for both endings, abandonment without registration, refresh to menu with preserved history and continued gameplay while a registration is pending. Strengthen the delayed-response regression for an older same-query snapshot racing a newer confirmed registration. Preserve the existing idempotency/recovery tests.

**Exit criteria:** Combat assertions execute real rules through real inputs; both ending reasons and fresh restarts pass without duplicate score or registrations.

**User review:** Weapons, enemy behavior, damage, end screens, restart and recent match history.

## Stage 4 — required visual baselines and complete regression

Create stable desktop/mobile baselines for the main menu, arena and result, alongside existing ranking/history references. Review pause/Options and HUD layouts, keyboard focus, readable labels/errors and orientation changes. Resolve the original menu-instructions requirement with the user: a compact instruction entry may satisfy it, but do not restore the removed Captain Controls block without that decision.

Run the complete suite against the optimized build, including controlled network scenarios. Audit console errors across normal flows and preserve the complete HTML report and failure traces where applicable. Inspect reference images before accepting updates; visual tolerances must not hide meaningful changes.

**Exit criteria:** All required visual references exist and are reviewed; the complete current E2E suite passes on desktop/mobile with no uncaught errors in covered flows.

**User review:** Final screen appearance and the agreed handling of menu instructions.

## Stage 5 — optimized-build performance and memory

Completed reference measurement: see [performance report and reproduction](PERFORMANCE.md). A real 180-second optimized match averaged 60.00 FPS; five additional cycles returned measured scene/simulation/canvas/audio resources to zero with stable DOM/listener counts. This reference is a desktop GPU workload; physical-device responsiveness remains the user's review.

Document the reference hardware, OS/browser, resolution/device density and match configuration. Profile a three-minute match in the optimized build, recording FPS, frame-time p95 and ship/projectile/effect counts. Measure memory/resources after five start/play/exit cycles, distinguishing intentional texture/audio caches from retained scenes/listeners/entities.

Investigate measured regressions and optimize only where evidence justifies changes. Repeat relevant measurements and tests after fixes. Record limitations honestly; 60 FPS is the target, not a guarantee inferred from headless test timing.

**Exit criteria:** Reproducible FPS/p95/entity and five-cycle memory reports, with evidence and resolution or explanation of measured issues.

**User review:** Responsiveness on the user's desktop/mobile and any performance-related changes.

## Stage 6 — final repository and delivery package

Review and remove unnecessary files created during development: temporary scripts, duplicate artifacts, obsolete reports and unused generated files. Preserve supplied assets, required tests, visual references and final delivery evidence. Verify remaining imports and documented commands after cleanup.

Bring README, ARCHITECTURE, AUDIO, NETWORK and validation reports into agreement with current CAPTAIN JACK registration, sound defaults, UI and tests. Document controls/balance, supported orientations, environment requirements and network scenario selection/reset/recovery.

Prepare the versioned repository and include source, lockfile, assets, mocks/fixtures, tests and visual references. Export final test/profiling evidence. Verify installation, build, preview and documented test commands in a fresh isolated checkout without private services. Do not overwrite the user's working directory or publish a repository without authorization.

**Exit criteria:** A reproducible reviewable delivery package/repository, current English documentation, preserved supplied assets, and final reports.

**User review:** Delivery documentation, repository/package.

## Stage 7 — public deployment and public-URL smoke test

Prepare the deployment configuration for Vercel (the original recommendation), or another provider selected by the user. Validate the exact reviewed build locally first. Account/project/domain details are external prerequisites; public publication is a distinct action to authorize when its concrete configuration is ready.

After authorization, publish the reviewed commit/build. Test direct opening and refresh of the public URL, worker/asset loading, desktop/mobile gameplay, a completed registration, ranking/history, and pending recovery under network failure. Confirm the URL and repository version match, and update delivery documentation with the public URL and final verification.

**Exit criteria:** A public functional URL corresponding to the delivered code, with working MSW and documented smoke-test evidence.

**User review:** Public URL on desktop/mobile and final acceptance.

## Sequence and effort

Order: 1 → 2 → 3 → 4 → 5 → 6 → 7. This is a verification/delivery plan, not a redesign. Preserve accepted visuals and current gameplay unless a requirement, failing test, measured issue or user feedback warrants a change.

Stages 1?5 are complete. Stage 6 records the isolated-copy validation and reviewed project in DELIVERY.md and VALIDATION.md. Stage 7 remains dependent on a reviewed deployment configuration and publication authorization.
