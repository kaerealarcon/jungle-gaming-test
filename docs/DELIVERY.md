# Local project verification

Work continues directly in this source project. Source, lockfile, all 520 assets, worker, fixtures, tests, documentation and visual/performance evidence remain in the workspace.

## Commands

Use Node.js 22.12+ (validated with Node 24). In PowerShell use npm.cmd/npx.cmd if script execution is restricted.

- npm ci
- npx playwright install chromium
- npm run typecheck:e2e
- npm run lint
- npm run test:simulation
- npm run test:records
- npm run build:e2e
- Set $env:PW_PREVIEW = '1', then npm.cmd run test:e2e -- --update-snapshots=none
- Remove-Item Env:PW_PREVIEW, then npm.cmd run build
- npm.cmd run preview -- --host 127.0.0.1 --port 5175 --strictPort

Open http://127.0.0.1:5175. Check Main Menu/refresh, Options, keyboard/touch steering/fire, pause/resume, completed match and history. Localhost/HTTPS is required for the mock Service Worker. No private backend or credentials are needed. Network scenarios are documented in NETWORK.md.

The retained report is docs/evidence/e2e-report/index.html; open with npx playwright show-report docs/evidence/e2e-report. New runs create playwright-report separately. PERFORMANCE.md defines the three-minute/five-cycle reference measurement and limitations. Windows Chromium screenshots can differ on other OS/fonts; inspect before deliberately accepting new references. Physical-phone testing remains useful.

## Balance

src/game/config.ts is authoritative. Default session/spawn: 120s/5s; limits 60?180s/1?30s. Arena: 1280x800. Player health/speed: 100/180, acceleration/coasting: 0.4s/0.65s. Chaser health/contact damage: 40/25. Shooter health/range: 60/350. Front damage/cooldown: 20/0.4s; broadside: 15 per projectile/1s; enemy: 10/1.5s. Match snapshots preserve actual settings and seed.

Publication is stage 7 and has not started. No public URL is claimed.
