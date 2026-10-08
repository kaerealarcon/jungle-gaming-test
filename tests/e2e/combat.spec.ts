import { test, expect, type Page } from '@playwright/test';
import { createGameConfig } from '../../src/game/config';

const read = (page: Page) => page.evaluate(() => window.__pirateTest!.snapshot());
const advance = (page: Page, seconds: number) => page.evaluate(seconds => window.__pirateTest!.advance(seconds), seconds);
const errors = new WeakMap<Page, string[]>();
async function start(page: Page, spawn = 30, scenario = 'success', seed = 3) {
  await page.addInitScript(({ spawn, scenario, seed }) => {
    window.__pirateSetup = { seed, manualTime: true };
    localStorage.setItem('pirate-battle.options.v1', JSON.stringify({ sessionSeconds: 60, spawnSeconds: spawn }));
    localStorage.setItem('pirate-battle.mock-scenario.v1', scenario);
  }, { spawn, scenario, seed });
  await page.goto('/'); await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => Boolean(window.__pirateTest))).toBe(true);
}
async function turn(page: Page, angle: number) {
  const state = await read(page);
  const delta = Math.atan2(Math.sin(angle - state.ship.angle), Math.cos(angle - state.ship.angle));
  const key = delta < 0 ? 'a' : 'd';
  await page.keyboard.down(key); await advance(page, Math.abs(delta) / state.config.player.rotationSpeed); await page.keyboard.up(key);
}
async function samples(page: Page, seconds: number) {
  return page.evaluate(seconds => Array.from({ length: Math.ceil(seconds / 0.025) }, () => {
    window.__pirateTest!.advance(0.025); return window.__pirateTest!.snapshot();
  }), seconds);
}
async function fightToExpiry(page: Page) {
  return page.evaluate(() => {
    const bridge = window.__pirateTest!;
    const section = document.querySelector<HTMLElement>('.arena-screen')!;
    const held = new Set<string>();
    const setKey = (code: string, down: boolean) => {
      if (down === held.has(code)) return;
      if (down) held.add(code); else held.delete(code);
      (down ? section : window).dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    };
    const scores: number[] = [];
    const kills: number[] = [];
    const damage: number[] = [];
    for (let frame = 0; frame < 2401; frame++) {
      const state = bridge.snapshot(); if (state.endedReason) break;
      const enemy = state.enemies.sort((a, b) => Math.hypot(a.x - state.ship.x, a.y - state.ship.y) - Math.hypot(b.x - state.ship.x, b.y - state.ship.y))[0];
      let delta = 0;
      if (enemy) {
        const desired = Math.atan2(enemy.x - state.ship.x, state.ship.y - enemy.y);
        delta = Math.atan2(Math.sin(desired - state.ship.angle), Math.cos(desired - state.ship.angle));
      }
      // A deterministic test captain operates the actual DOM keyboard listeners.
      // No entity placement, health, weapons, AI or end-state setters are used.
      setKey('KeyA', Boolean(enemy) && delta < -0.03);
      setKey('KeyD', Boolean(enemy) && delta > 0.03);
      setKey('Space', Boolean(enemy) && Math.abs(delta) < 0.12);
      bridge.advance(0.025);
      const next = bridge.snapshot(); scores.push(next.score);
      for (const enemy of state.enemies) {
        const survivor = next.enemies.find(current => current.id === enemy.id);
        if (survivor && survivor.health < enemy.health) damage.push(enemy.health - survivor.health);
        if (!survivor && next.score > state.score) { kills.push(enemy.id); damage.push(enemy.health); }
      }
    }
    for (const code of [...held]) setKey(code, false);
    return { state: bridge.snapshot(), scores, kills, damage };
  });
}

test.beforeEach(async ({ page }) => {
  const captured: string[] = []; errors.set(page, captured); page.on('pageerror', error => captured.push(error.message));
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

test('front and parallel broadsides have separate cooldowns and release stops firing', async ({ page }) => {
  await start(page);
  await page.keyboard.down('Space'); await page.keyboard.down('q'); await page.keyboard.down('e');
  await advance(page, 0.025); const first = await read(page);
  const shots = first.projectiles.filter(shot => shot.owner === 'player'); expect(shots).toHaveLength(7);
  for (const angle of [-Math.PI / 2, Math.PI / 2]) {
    const side = shots.filter(shot => Math.abs(shot.angle - angle) < 0.001);
    expect(side).toHaveLength(3);
    const offsets = side.map(shot => shot.y).sort((a, b) => a - b);
    expect(offsets[1]! - offsets[0]!).toBeCloseTo(first.config.combat.broadsideSpacing);
    expect(offsets[2]! - offsets[1]!).toBeCloseTo(first.config.combat.broadsideSpacing);
  }
  expect(shots.filter(shot => shot.angle === 0)).toHaveLength(1);
  await advance(page, 0.2); expect((await read(page)).projectiles.filter(shot => shot.owner === 'player')).toHaveLength(7);
  await advance(page, 0.2); const next = await read(page);
  expect(next.projectiles.filter(shot => shot.owner === 'player' && shot.angle === 0)).toHaveLength(2);
  expect(next.cooldowns.fireLeft).toBeLessThan(first.cooldowns.fireLeft);
  expect(next.cooldowns.fireRight).toBeCloseTo(next.cooldowns.fireLeft);
  await page.keyboard.up('Space'); await page.keyboard.up('q'); await page.keyboard.up('e');
  await advance(page, 2.1); const released = await read(page);
  expect(released.projectiles.filter(shot => shot.owner === 'player')).toHaveLength(0);
  expect(Object.values(released.cooldowns)).toEqual([0, 0, 0]);
  await page.keyboard.down('q'); await advance(page, 0.025); await page.keyboard.up('q');
  const port = await read(page);
  expect(port.cooldowns.fireLeft).toBeGreaterThan(0);
  expect(port.cooldowns.fireRight).toBe(0); expect(port.cooldowns.fireFront).toBe(0);
  await advance(page, 0.15);
  await page.keyboard.down('e'); await advance(page, 0.025); await page.keyboard.up('e');
  const starboard = await read(page);
  expect(starboard.cooldowns.fireRight).toBeGreaterThan(starboard.cooldowns.fireLeft);
  expect(starboard.cooldowns.fireLeft).toBeLessThan(port.cooldowns.fireLeft);
  await page.keyboard.down('Space'); await advance(page, 0.025); await page.keyboard.up('Space');
  const front = await read(page);
  expect(front.cooldowns.fireFront).toBeGreaterThan(0);
  expect(front.cooldowns.fireLeft).toBeLessThan(starboard.cooldowns.fireLeft);
  expect(front.cooldowns.fireRight).toBeLessThan(starboard.cooldowns.fireRight);
});

test('cannonballs stop at islands and disappear after the first impact', async ({ page }) => {
  await start(page); const initial = await read(page);
  const island = [...initial.islands].sort((a, b) => Math.hypot(a.x + a.width / 2 - 640, a.y + a.height / 2 - 400) - Math.hypot(b.x + b.width / 2 - 640, b.y + b.height / 2 - 400))[0]!;
  await turn(page, Math.atan2(island.x + island.width / 2 - 640, 400 - island.y - island.height / 2));
  await page.keyboard.down('Space'); await advance(page, 0.025); await page.keyboard.up('Space');
  const projectile = (await read(page)).projectiles.find(shot => shot.owner === 'player')!;
  expect(projectile).toBeDefined(); const frames = await samples(page, 1.6);
  const hit = frames.flatMap(frame => frame.effects).find(effect => effect.kind === 'impact' &&
    effect.x >= island.x - 8 && effect.x <= island.x + island.width + 8 && effect.y >= island.y - 8 && effect.y <= island.y + island.height + 8);
  expect(hit).toBeDefined();
  const lost = frames.findIndex(frame => !frame.projectiles.some(shot => shot.id === projectile.id));
  expect(lost).toBeGreaterThanOrEqual(0);
  expect(frames.slice(lost).every(frame => !frame.projectiles.some(shot => shot.id === projectile.id))).toBe(true);
});

test('expired broadside shots make a water splash and are removed', async ({ page }) => {
  await start(page); const initial = await read(page);
  let ray: number | undefined;
  for (let index = 0; index < 72 && ray === undefined; index++) {
    const angle = index * Math.PI / 36;
    let clear = true;
    for (let distance = 28; distance <= 510; distance += 5) {
      const x = 640 + Math.sin(angle) * distance, y = 400 - Math.cos(angle) * distance;
      if (x < 30 || x > 1250 || y < 30 || y > 770 || initial.islands.some(island => x > island.x - 30 && x < island.x + island.width + 30 && y > island.y - 30 && y < island.y + island.height + 30)) { clear = false; break; }
    }
    if (clear) ray = angle;
  }
  expect(ray).toBeDefined(); await turn(page, ray! - Math.PI / 2);
  await page.keyboard.down('e'); await advance(page, 0.025); await page.keyboard.up('e');
  const frames = await samples(page, 1.5);
  expect(frames.some(frame => frame.effects.some(effect => effect.kind === 'splash'))).toBe(true);
  expect(frames.at(-1)!.projectiles.filter(shot => shot.owner === 'player')).toHaveLength(0);
});

test('both AI types, safe interval spawning and enemy-only player damage', async ({ page }) => {
  await start(page, 3); const initial = await read(page);
  expect(initial.enemies.map(enemy => enemy.kind)).toEqual(['chaser', 'shooter']);
  await advance(page, 2.99); const before = await read(page);
  expect(before.enemies.every(enemy => initial.enemies.some(old => old.id === enemy.id))).toBe(true);
  await advance(page, 0.02); const after = await read(page);
  const spawned = after.enemies.filter(enemy => !initial.enemies.some(old => old.id === enemy.id)); expect(spawned).toHaveLength(1);
  for (const enemy of spawned) {
    expect(Math.hypot(enemy.x - after.ship.x, enemy.y - after.ship.y)).toBeGreaterThanOrEqual(after.config.spawn.minPlayerDistance);
    expect(after.enemies.filter(other => other.id !== enemy.id).every(other => Math.hypot(enemy.x - other.x, enemy.y - other.y) >= enemy.radius + other.radius + after.config.spawn.clearance)).toBe(true);
    expect(after.islands.every(island => {
      const dx = Math.max(Math.abs(enemy.x - island.x - island.width / 2) - (island.width / 2 - island.corner), 0);
      const dy = Math.max(Math.abs(enemy.y - island.y - island.height / 2) - (island.height / 2 - island.corner), 0);
      return Math.hypot(dx, dy) >= island.corner + enemy.radius;
    })).toBe(true);
  }
  const frames = await samples(page, 15);
  expect(frames.some(frame => frame.projectiles.some(shot => shot.owner === 'enemy'))).toBe(true);
  expect(frames.at(-1)!.ship.health).toBeLessThan(initial.ship.health);
  expect(frames.every(frame => frame.score === 0 && frame.enemies.every(enemy => enemy.health === enemy.maxHealth || (enemy.kind === 'chaser' && enemy.health === 0)))).toBe(true);
  const health = [after.ship.health, ...frames.map(frame => frame.ship.health)];
  expect(health.some((value, index) => index > 0 && health[index - 1]! - value === after.config.weapons.enemy.damage)).toBe(true);
  expect(frames.some(frame => !frame.enemies.some(enemy => enemy.id === initial.enemies[0]!.id))).toBe(true);
});

test('real time expiry, unique scoring, frozen result and complete Play Again reset', async ({ page }) => {
  await start(page); const initial = await read(page);
  const completed = await fightToExpiry(page);
  expect(completed.state.endedReason).toBe('time'); expect(completed.state.elapsed).toBe(60);
  expect(completed.state.score).toBe(3); expect(completed.state.ship.health).toBeGreaterThan(0);
  expect(completed.kills).toHaveLength(3); expect(new Set(completed.kills).size).toBe(3);
  expect(completed.damage.length).toBeGreaterThan(0);
  expect(completed.damage.every(value => value === completed.state.config.weapons.front.damage)).toBe(true);
  for (let i = 1; i < completed.scores.length; i++) expect(completed.scores[i]! - completed.scores[i - 1]!).toBeGreaterThanOrEqual(0);
  expect(completed.scores.filter((score, index) => index > 0 && score !== completed.scores[index - 1])).toHaveLength(3);
  const dialog = page.getByRole('dialog', { name: 'Time Up', exact: true }); await expect(dialog).toBeVisible();
  await page.keyboard.down('w'); await page.keyboard.down('Space'); await advance(page, 3);
  expect(await read(page)).toEqual(completed.state); await page.keyboard.up('w'); await page.keyboard.up('Space');
  await expect(page.getByText('Match registered in Ranking and Match History.')).toBeVisible();
  const result = await page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle.last-result.v1')!));
  expect(result.captainName).toBe('CAPTAIN JACK'); expect(result.reason).toBe('time'); expect(result.score).toBe(3);
  expect(result.config).toEqual(completed.state.config);
  await page.evaluate(() => { window.__pirateSetup!.seed = 4; });
  await dialog.getByRole('button', { name: 'Play Again', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  const restarted = await read(page);
  expect(restarted.ship.health).toBe(100); expect(restarted.ship.speed).toBe(0);
  expect(restarted.score).toBe(0); expect(restarted.elapsed).toBe(0); expect(restarted.endedReason).toBeNull();
  expect(restarted.enemies).toHaveLength(2); expect(restarted.projectiles).toHaveLength(0); expect(restarted.effects).toHaveLength(0);
  expect(Object.values(restarted.cooldowns)).toEqual([0, 0, 0]); expect(restarted.islands).not.toEqual(initial.islands);
  await advance(page, 0.1); expect((await read(page)).ship.speed).toBe(0);
  expect((await fightToExpiry(page)).state.endedReason).toBe('time');
  await expect(page.getByText('Match registered in Ranking and Match History.')).toBeVisible();
  const second = await page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle.last-result.v1')!));
  expect(second.id).not.toBe(result.id);
  await page.getByRole('dialog').getByRole('button', { name: 'Main Menu', exact: true }).click();
  await page.reload(); await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Again', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2); await expect(page.locator('tbody')).toContainText('Time Up');
});

test('real death persists and pending registration permits a clean abandoned voyage', async ({ page }) => {
  await start(page, 30, 'unavailable', 1); await advance(page, 60); const ended = await read(page);
  expect(ended.endedReason).toBe('death'); expect(ended.ship.health).toBe(0); expect(ended.elapsed).toBeLessThan(60);
  const dialog = page.getByRole('dialog', { name: 'Ship Lost', exact: true }); await expect(dialog).toBeVisible();
  await advance(page, 3); expect(await read(page)).toEqual(ended);
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle.last-result.v1')!));
  expect(original.reason).toBe('death'); expect(original.captainName).toBe('CAPTAIN JACK');
  await dialog.getByRole('button', { name: 'Play Again', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  expect((await read(page)).ship.health).toBe(100);
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  await page.reload(); await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle.outbox.v1') ?? '[]')[0]?.status)).toBe('failed');
  await page.evaluate(() => { localStorage.setItem('pirate-battle.mock-scenario.v1', 'success'); window.dispatchEvent(new Event('online')); });
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1); await expect(page.locator('tbody')).toContainText('Defeated');
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle.mock-matches.v1')!).filter((match: { playerId: string }) => match.playerId === localStorage.getItem('pirate-battle.player.v1')).map((match: { id: string }) => match.id));
  expect(ids).toEqual([original.id]);
});

test('a late snapshot of the same history query cannot erase a confirmed match', async ({ page }) => {
  const config = createGameConfig({ sessionSeconds: 60, spawnSeconds: 30 });
  await page.clock.install();
  await page.addInitScript(config => {
    localStorage.setItem('pirate-battle.player.v1', 'race-player');
    localStorage.setItem('pirate-battle.mock-scenario.v1', 'stale-history');
    const match = { id: 'race-match', completedAt: '2026-10-07T12:00:00Z', score: 3, durationSeconds: 60, reason: 'time', config, captainName: 'CAPTAIN JACK' };
    localStorage.setItem('pirate-battle.outbox.v1', JSON.stringify([{ request: { playerId: 'race-player', match }, status: 'failed', error: 'Offline' }]));
  }, config);
  await page.goto('/');
  const historyUrls: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/api/history')) historyUrls.push(request.url()); });
  const firstRead = page.waitForRequest(request => new URL(request.url()).pathname.endsWith('/api/history'));
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await firstRead;
  await expect(page.getByText('Loading battles…')).toBeVisible();
  await page.clock.runFor(100); // Allow the first handler to capture the empty database.
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.clock.runFor(700);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.clock.runFor(3300); // Let the original three-second response complete.
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByText('Your completed battles will appear here.')).toHaveCount(0);
  expect(historyUrls.length).toBeGreaterThanOrEqual(2);
  expect(new Set(historyUrls).size).toBe(1);
  const database = await page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle.mock-matches.v1')!));
  expect(database.filter((match: { id: string }) => match.id === 'race-match')).toHaveLength(1);
});
