import { test, expect, type Page } from '@playwright/test';

const read = (page: Page) => page.evaluate(() => window.__pirateTest!.snapshot());
const advance = (page: Page, seconds: number) => page.evaluate(seconds => window.__pirateTest!.advance(seconds), seconds);
const pageErrors = new WeakMap<Page, string[]>();

async function start(page: Page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => Boolean(window.__pirateTest))).toBe(true);
  await expect(page.getByRole('main', { name: 'Combat practice' })).toBeFocused();
}
async function turn(page: Page, angle: number) {
  const state = await read(page);
  const delta = Math.atan2(Math.sin(angle - state.ship.angle), Math.cos(angle - state.ship.angle));
  const key = delta < 0 ? 'a' : 'd';
  await page.keyboard.down(key);
  await advance(page, Math.abs(delta) / state.config.player.rotationSpeed);
  await page.keyboard.up(key);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []; pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__pirateSetup = { seed: 12345, manualTime: true };
    localStorage.setItem('pirate-battle.options.v1', JSON.stringify({ sessionSeconds: 180, spawnSeconds: 30 }));
  });
  await page.goto('/');
});
test.afterEach(async ({ page }) => { expect(pageErrors.get(page)).toEqual([]); });

test('real keyboard acceleration, coasting and both turn directions', async ({ page }) => {
  await start(page);
  const initial = await read(page);
  await page.keyboard.down('w'); await advance(page, 0.05);
  const slow = await read(page);
  expect(slow.ship.speed).toBeGreaterThan(0); expect(slow.ship.speed).toBeLessThan(initial.config.player.speed);
  expect(slow.ship.y).toBeLessThan(initial.ship.y);
  await advance(page, 0.35);
  const full = await read(page); expect(full.ship.speed).toBeCloseTo(initial.config.player.speed);
  await page.keyboard.up('w'); await advance(page, 0.05);
  const coast = await read(page);
  expect(coast.ship.speed).toBeGreaterThan(0); expect(coast.ship.speed).toBeLessThan(full.ship.speed);
  expect(coast.ship.y).toBeLessThan(full.ship.y);
  await advance(page, 0.7); expect((await read(page)).ship.speed).toBe(0);
  await page.keyboard.down('a'); await advance(page, 0.2); await page.keyboard.up('a');
  const left = await read(page); expect(left.ship.angle).toBeLessThan(initial.ship.angle);
  await page.keyboard.down('d'); await advance(page, 0.4); await page.keyboard.up('d');
  expect((await read(page)).ship.angle).toBeGreaterThan(initial.ship.angle);
});

test('islands block sustained forward input without crossing the shoreline', async ({ page }) => {
  await start(page);
  const state = await read(page);
  const island = [...state.islands].sort((a, b) => Math.hypot(a.x + a.width / 2 - 640, a.y + a.height / 2 - 400) - Math.hypot(b.x + b.width / 2 - 640, b.y + b.height / 2 - 400))[0]!;
  await turn(page, Math.atan2(island.x + island.width / 2 - state.ship.x, state.ship.y - island.y - island.height / 2));
  await page.keyboard.down('w');
  const samples = await page.evaluate(() => Array.from({ length: 80 }, () => {
    window.__pirateTest!.advance(0.05); return window.__pirateTest!.snapshot();
  }));
  const positions = samples.map(current => current.ship);
  for (const current of samples) {
    const dx = Math.max(Math.abs(current.ship.x - island.x - island.width / 2) - (island.width / 2 - island.corner), 0);
    const dy = Math.max(Math.abs(current.ship.y - island.y - island.height / 2) - (island.height / 2 - island.corner), 0);
    expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(island.corner + state.config.player.radius - 0.001);
  }
  await page.keyboard.up('w');
  expect(Math.hypot(positions[0]!.x - positions[79]!.x, positions[0]!.y - positions[79]!.y)).toBeGreaterThan(40);
  expect(positions[79]).toEqual(positions[78]);
  const end = positions[79]!;
  const dx = Math.max(Math.abs(end.x - island.x - island.width / 2) - (island.width / 2 - island.corner), 0);
  const dy = Math.max(Math.abs(end.y - island.y - island.height / 2) - (island.height / 2 - island.corner), 0);
  expect(Math.hypot(dx, dy) - island.corner - state.config.player.radius).toBeLessThan(2);
});

test('open-water route stops at arena bounds', async ({ page }) => {
  await start(page);
  const state = await read(page); const radius = state.config.player.radius;
  // Find a clear ray from the actual seeded layout, rather than bypassing islands.
  let angle: number | undefined;
  for (let step = 0; step < 72 && angle === undefined; step++) {
    const candidate = step * Math.PI / 36;
    let clear = true;
    for (let distance = 0; distance < 1500; distance += 5) {
      const x = 640 + Math.sin(candidate) * distance, y = 400 - Math.cos(candidate) * distance;
      if (x < radius || x > 1280 - radius || y < radius || y > 800 - radius) break;
      if (state.islands.some(island => x > island.x - radius && x < island.x + island.width + radius && y > island.y - radius && y < island.y + island.height + radius)) { clear = false; break; }
    }
    if (clear) angle = candidate;
  }
  expect(angle).toBeDefined(); await turn(page, angle!);
  await page.keyboard.down('w'); await advance(page, 9); await page.keyboard.up('w');
  const end = await read(page);
  expect(end.ship.x).toBeGreaterThanOrEqual(radius); expect(end.ship.x).toBeLessThanOrEqual(1280 - radius);
  expect(end.ship.y).toBeGreaterThanOrEqual(radius); expect(end.ship.y).toBeLessThanOrEqual(800 - radius);
  expect(Math.min(end.ship.x - radius, 1280 - radius - end.ship.x, end.ship.y - radius, 800 - radius - end.ship.y)).toBeLessThan(10);
});

test('pursuing hulls stay separated and Chaser contact cannot pass through', async ({ page }) => {
  await start(page);
  const samples = await page.evaluate(() => {
    const samples = [];
    for (let frame = 0; frame < 300; frame++) {
      window.__pirateTest!.advance(0.05); const state = window.__pirateTest!.snapshot(); samples.push(state);
      if (!state.enemies.some(enemy => enemy.kind === 'chaser')) break;
    }
    return samples;
  });
  for (const state of samples) {
    for (const enemy of state.enemies) {
      expect(Math.hypot(enemy.x - state.ship.x, enemy.y - state.ship.y)).toBeGreaterThanOrEqual(enemy.radius + state.config.player.radius - 0.001);
      for (const other of state.enemies) if (other.id > enemy.id) expect(Math.hypot(enemy.x - other.x, enemy.y - other.y)).toBeGreaterThanOrEqual(enemy.radius + other.radius - 0.001);
    }
  }
  expect(samples.at(-1)!.enemies.some(enemy => enemy.kind === 'chaser')).toBe(false);
  expect((await read(page)).ship.health).toBeLessThan(100);
});

test('manual and blur pauses freeze state and clear held inputs on explicit resume', async ({ page }) => {
  await start(page);
  await page.keyboard.down('w'); await page.keyboard.down('Space'); await advance(page, 0.1);
  await page.keyboard.press('Escape');
  const dialog = page.getByRole('dialog', { name: 'Paused', exact: true });
  await expect(dialog).toBeVisible(); const paused = await read(page);
  for (let tab = 0; tab < 6; tab++) {
    await page.keyboard.press('Tab');
    // Native dialog tab order may briefly move to browser chrome (body),
    // but must never focus an interactive control in the inert game behind it.
    expect(await dialog.evaluate(element => element.contains(document.activeElement) || document.activeElement === document.body)).toBe(true);
  }
  await advance(page, 3); expect(await read(page)).toEqual(paused);
  await page.keyboard.up('w'); await page.keyboard.up('Space');
  await dialog.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByRole('main', { name: 'Combat practice' })).toBeFocused();
  await advance(page, 0.8); const resumed = await read(page);
  expect(resumed.ship.speed).toBe(0); expect(resumed.cooldowns.fireFront).toBe(0);
  await page.keyboard.down('w');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(dialog).toBeVisible(); const blurred = await read(page);
  await advance(page, 2); expect(await read(page)).toEqual(blurred);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect((await read(page)).paused).toBe(true);
  await dialog.getByRole('button', { name: 'Resume', exact: true }).click();
  await advance(page, 0.8); expect((await read(page)).ship.speed).toBe(0);
  await page.keyboard.up('w');
});

test('hidden-document notification freezes gameplay until explicit resume', async ({ page }) => {
  await start(page); await page.keyboard.down('w'); await advance(page, 0.1);
  // Headless Chromium keeps every tab visible. Emulate only the browser visibility
  // signal; the application's actual listener and simulation remain unchanged.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const dialog = page.getByRole('dialog', { name: 'Paused', exact: true });
  await expect(dialog).toBeVisible(); const hidden = await read(page);
  await advance(page, 2); expect(await read(page)).toEqual(hidden);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect((await read(page)).paused).toBe(true);
  await dialog.getByRole('button', { name: 'Resume', exact: true }).click();
  await advance(page, 0.8); expect((await read(page)).ship.speed).toBe(0);
  await page.keyboard.up('w');
});

test('orientation changes preserve logical state; repeated exits clear scenes and input', async ({ page }, testInfo) => {
  test.setTimeout(90000); // Five full scene initializations share this lifecycle case.
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  const initial = await read(page);
  const originalViewport = testInfo.project.use.viewport!;
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, originalViewport]) {
    await page.setViewportSize(viewport);
    expect(await read(page)).toEqual(initial);
    await expect(page.locator('canvas')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  for (let cycle = 0; cycle < 4; cycle++) {
    await page.keyboard.down('w'); await advance(page, 0.1);
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.evaluate(() => Boolean(window.__pirateTest))).toBe(false);
    await page.keyboard.up('w'); await start(page);
    expect((await read(page)).ship.speed).toBe(0); expect((await read(page)).elapsed).toBe(0);
  }
  expect(errors).toEqual([]);
});

test.describe('simultaneous touch input', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('movement with turning/firing, release, cancellation and pause', async ({ page, context }) => {
    await start(page);
    const cdp = await context.newCDPSession(page);
    const point = async (name: string, id: number) => {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(box).not.toBeNull(); return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2, id };
    };
    const sail = await point('↑ Sail', 1), right = await point('Right ↷', 2), fire = await point('Space · Front', 3);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [sail, right] });
    await advance(page, 0.2); const moving = await read(page);
    expect(moving.ship.speed).toBeGreaterThan(0); expect(moving.ship.angle).toBeGreaterThan(0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [right] });
    await advance(page, 0.1); expect((await read(page)).ship.angle).toBeCloseTo(moving.ship.angle);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [sail, fire] });
    await advance(page, 0.05); const fired = await read(page);
    expect(fired.ship.speed).toBeGreaterThan(moving.ship.speed);
    expect(fired.projectiles.some(projectile => projectile.owner === 'player')).toBe(true);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await advance(page, 0.8); expect((await read(page)).ship.speed).toBe(0);
    await page.getByRole('button', { name: '↑ Sail', exact: true }).evaluate(button => {
      button.addEventListener('lostpointercapture', () => { (button as HTMLElement).dataset.captureLost = 'true'; }, { once: true });
      button.addEventListener('gotpointercapture', event => {
        const pointer = event as PointerEvent;
        button.releasePointerCapture(pointer.pointerId);
      }, { once: true });
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [sail] });
    // Establish native capture, then process its release on the next pointer event.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...sail, x: sail.x + 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...sail, x: sail.x + 2 }] });
    await expect(page.getByRole('button', { name: '↑ Sail', exact: true })).toHaveAttribute('data-capture-lost', 'true');
    await advance(page, 0.2); expect((await read(page)).ship.speed).toBe(0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [sail] });
    await advance(page, 0.1); await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.getByRole('dialog').getByRole('button', { name: 'Resume', exact: true }).click();
    await advance(page, 0.8); expect((await read(page)).ship.speed).toBe(0);
    await cdp.detach();
  });
});
