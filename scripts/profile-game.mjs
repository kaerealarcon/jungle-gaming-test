import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';

const origin = 'http://127.0.0.1:5176';
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5176', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
let browser;
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * fraction) - 1)] ?? 0;
const mean = values => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
try {
  for (let retry = 0; retry < 100; retry++) {
    if (preview.exitCode !== null) throw new Error('Preview failed; check port 5176.');
    if (await fetch(origin).then(response => response.ok).catch(() => false)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  // Chromium's headless default selects SwiftShader here; request the hardware backend.
  const launchArgs = process.platform === 'win32' ? ['--enable-gpu', '--use-angle=d3d11'] : ['--enable-gpu'];
  browser = await chromium.launch({ headless: true, args: launchArgs });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__pirateProfileSeed = 3;
    localStorage.setItem('pirate-battle.options.v1', JSON.stringify({ sessionSeconds: 180, spawnSeconds: 30 }));
  });
  await page.goto(origin);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const start = async () => {
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => Boolean(window.__pirateProfile?.state()));
    if (await page.evaluate(() => window.__pirateProfile.state().paused)) throw new Error('Unexpected initial pause');
  };
  const stop = async () => {
    const dialog = page.locator('dialog[open]');
    const scope = await dialog.count() ? dialog : page.locator('.arena-chrome');
    await scope.getByRole('button', { name: 'Main Menu', exact: true }).click();
  };
  const memory = async label => {
    await page.waitForTimeout(2000); // Let UI audio and pending cleanup finish before explicit GC.
    await cdp.send('HeapProfiler.collectGarbage');
    const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value]));
    return { label, heapBytes: metrics.JSHeapUsedSize, ...await cdp.send('Memory.getDOMCounters'),
      ...await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, ...window.__pirateProfile.resources() })) };
  };
  // Warm shared textures and all decoded audio before comparing lifecycle memory.
  await start(); await page.waitForTimeout(3000); await stop();
  const baseline = await memory('warm baseline');
  await start();
  const renderer = await page.locator('canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER), vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl?.getParameter(gl.VENDOR), width: canvas.width, height: canvas.height };
  });
  // Operate actual keyboard listeners in real time. No time/health/entity setters.
  await page.evaluate(() => {
    const held = new Set();
    const set = (code, down) => {
      if (held.has(code) === down) return;
      if (down) held.add(code); else held.delete(code);
      (down ? document.querySelector('.arena-screen') : window).dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    };
    const steer = () => {
      const state = window.__pirateProfile.state();
      if (!state || state.endedReason) {
        for (const code of [...held]) set(code, false); return;
      }
      const enemy = state.enemies.filter(enemy => enemy.health > 0).sort((a, b) => Math.hypot(a.x - state.ship.x, a.y - state.ship.y) - Math.hypot(b.x - state.ship.x, b.y - state.ship.y))[0];
      let desired = enemy ? Math.atan2(enemy.x - state.ship.x, state.ship.y - enemy.y) : state.ship.angle;
      if (enemy) {
        const distance = Math.hypot(enemy.x - state.ship.x, enemy.y - state.ship.y);
        // Pick a clear ray inside the hull's angular width when terrain grazes its center.
        const offsets = [0, -0.04, 0.04, -0.08, 0.08];
        const offset = offsets.find(offset => {
          if (Math.abs(Math.sin(offset) * distance) > enemy.radius - 5) return false;
          for (let travel = 38; travel < distance - enemy.radius; travel += 8) {
            const x = state.ship.x + Math.sin(desired + offset) * travel;
            const y = state.ship.y - Math.cos(desired + offset) * travel;
            if (state.islands.some(island => {
              const dx = Math.max(Math.abs(x - island.x - island.width / 2) - (island.width / 2 - island.corner), 0);
              const dy = Math.max(Math.abs(y - island.y - island.height / 2) - (island.height / 2 - island.corner), 0);
              return Math.hypot(dx, dy) < island.corner + 8;
            })) return false;
          }
          return true;
        });
        if (offset !== undefined) desired += offset;
      }
      const delta = Math.atan2(Math.sin(desired - state.ship.angle), Math.cos(desired - state.ship.angle));
      set('KeyA', Boolean(enemy) && delta < -0.025);
      set('KeyD', Boolean(enemy) && delta > 0.025);
      set('Space', !enemy || Math.abs(delta) < 0.12);
      set('KeyQ', true); set('KeyE', true);
      requestAnimationFrame(steer);
    };
    requestAnimationFrame(steer);
  });
  const started = Date.now();
  while (true) {
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => window.__pirateProfile.state());
    if (Math.floor(state.elapsed / 20) > Math.floor((state.elapsed - 1) / 20)) console.log(`Active match: ${state.elapsed.toFixed(1)}s, score ${state.score}, hull ${state.ship.health}`);
    if (state.endedReason) {
      if (state.elapsed < 179.9) {
        await mkdir('docs/evidence', { recursive: true });
        await writeFile('docs/evidence/performance-incomplete.json', JSON.stringify({ state, renderer, measurement: await page.evaluate(() => window.__pirateProfile.measurements().at(-1)) }, null, 2));
        throw new Error(`Reference match ended early at ${state.elapsed}s (${state.endedReason}); do not report this as three minutes.`);
      }
      break;
    }
    if (Date.now() - started > 240000) throw new Error('Match exceeded wall-time budget or paused unexpectedly');
  }
  const raw = await page.evaluate(() => window.__pirateProfile.measurements().at(-1));
  await page.getByText('Match registered in Ranking and Match History.').waitFor();
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/performance-result.png' });
  await stop();
  const cycles = [await memory('after three-minute match')];
  for (let cycle = 1; cycle <= 5; cycle++) {
    await start(); await page.keyboard.down('w'); await page.keyboard.down('Space');
    await page.waitForTimeout(5000);
    await page.keyboard.up('w'); await page.keyboard.up('Space'); await stop();
    cycles.push(await memory(`cycle ${cycle}`));
    console.log(`Memory cycle ${cycle}: ${(cycles.at(-1).heapBytes / 1048576).toFixed(2)} MiB, ${cycles.at(-1).jsEventListeners} listeners`);
  }
  const summary = {
    fps: 1000 / mean(raw.intervals), frameP95Ms: percentile(raw.intervals, 0.95), frameP99Ms: percentile(raw.intervals, 0.99),
    updateP95Ms: percentile(raw.updateTimes, 0.95), frames: raw.intervals.length,
    maxShips: raw.peaks.ships, maxProjectiles: raw.peaks.projectiles, maxEffects: raw.peaks.effects,
  };
  const report = { capturedAt: new Date().toISOString(), environment: { cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, ramBytes: os.totalmem(), os: `${os.type()} ${os.release()} ${os.arch()}`, browser: browser.version(), headless: true, launchArgs, viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, renderer },
    workload: 'Optimized profile build; seed 3; 180s / 30s spawns; stationary keyboard captain aims at closest living enemy on each animation callback and fires all batteries; real clock and unchanged rules.',
    summary, raw, baseline, cycles, errors };
  await writeFile('docs/evidence/performance.json', JSON.stringify(report, null, 2));
  const clean = cycles.every(cycle => cycle.activeScenes === 0 && cycle.retainedSimulations === 0 && cycle.canvases === 0 && cycle.audioSources === 0 && cycle.audioLoops === 0 && cycle.atlasResizeListeners === baseline.atlasResizeListeners);
  console.log(JSON.stringify({ summary, cleanResources: clean, errors }, null, 2));
  if (!clean || errors.length) throw new Error('Resource cleanup or page errors require investigation; evidence saved.');
} finally {
  await browser?.close();
  preview.kill();
}
