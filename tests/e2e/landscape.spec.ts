import { test, expect, type Locator } from '@playwright/test';

async function insideViewport(locator: Locator) {
  const bounds = await locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: innerWidth, height: innerHeight };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
}

for (const viewport of [{ width: 844, height: 390 }, { width: 667, height: 320 }, { width: 568, height: 260 }]) {
  test(`landscape ${viewport.width}x${viewport.height}: screens, touch and rotation`, async ({ page, context }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, 'Phone layout');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      window.__pirateSetup = { seed: 3, manualTime: true };
      localStorage.setItem('pirate-battle.options.v1', JSON.stringify({ sessionSeconds: 60, spawnSeconds: 30 }));
    });
    await page.goto('/');
    await insideViewport(page.getByRole('button', { name: 'Play', exact: true }));
    await insideViewport(page.getByRole('button', { name: 'Match History', exact: true }));
    await page.getByRole('button', { name: 'Options', exact: true }).tap();
    await insideViewport(page.getByLabel('Enemy spawn time', { exact: true }));
    await insideViewport(page.getByRole('button', { name: 'Main Menu', exact: true }));
    await page.getByRole('button', { name: 'Main Menu', exact: true }).tap();
    await page.getByRole('button', { name: 'Play', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    await expect.poll(() => page.evaluate(() => Boolean(window.__pirateTest))).toBe(true);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const mapWidth = await page.locator('.arena-screen').evaluate(element => parseFloat((element as HTMLElement).style.getPropertyValue('--play-area-width')));
    const left = await page.getByRole('button', { name: 'Right ↷', exact: true }).boundingBox();
    const right = await page.getByRole('button', { name: 'Q · Port', exact: true }).boundingBox();
    expect(left!.x + left!.width).toBeLessThan((viewport.width - mapWidth) / 2);
    expect(right!.x).toBeGreaterThan((viewport.width + mapWidth) / 2);
    for (const button of await page.locator('.arena-chrome button, .arena-control-deck button').all()) await insideViewport(button);
    const cdp = await context.newCDPSession(page);
    const sail = await page.getByRole('button', { name: '↑ Sail', exact: true }).boundingBox();
    const fire = await page.getByRole('button', { name: 'Space · Front', exact: true }).boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [sail!, fire!].map((box, id) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2, id })) });
    await page.evaluate(() => window.__pirateTest!.advance(0.1));
    const moving = await page.evaluate(() => window.__pirateTest!.snapshot());
    expect(moving.ship.speed).toBeGreaterThan(0);
    expect(moving.projectiles.some(projectile => projectile.owner === 'player')).toBe(true);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    await page.getByRole('button', { name: 'Pause', exact: true }).tap();
    const pause = page.getByRole('dialog', { name: 'Paused', exact: true });
    await insideViewport(pause);
    await insideViewport(pause.getByRole('button', { name: 'Main Menu', exact: true }));
    await pause.getByRole('button', { name: 'Options', exact: true }).tap();
    await insideViewport(page.getByRole('dialog').getByRole('button', { name: 'Back', exact: true }));
    await page.getByRole('dialog').getByRole('button', { name: 'Back', exact: true }).tap();
    await pause.getByRole('button', { name: 'Resume', exact: true }).tap();
    const state = await page.evaluate(() => window.__pirateTest!.snapshot());
    await page.setViewportSize({ width: 390, height: 664 });
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => window.__pirateTest!.snapshot())).toEqual(state);
    const path = testInfo.outputPath('landscape-arena.png');
    await page.screenshot({ path });
    await testInfo.attach('Landscape arena', { path, contentType: 'image/png' });
    await page.evaluate(() => window.__pirateTest!.advance(60));
    const result = page.locator('dialog.mission-dialog[open]');
    await expect(result).toBeVisible();
    await expect(page.getByText('Match registered in Ranking and Match History.')).toBeVisible();
    await insideViewport(result);
    await insideViewport(result.getByRole('button', { name: 'Play Again', exact: true }));
    const resultPath = testInfo.outputPath('landscape-result.png');
    await page.screenshot({ path: resultPath });
    await testInfo.attach('Landscape result', { path: resultPath, contentType: 'image/png' });
    await result.getByRole('button', { name: 'Main Menu', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
