import { test, expect, type Page } from '@playwright/test';

const errors = new WeakMap<Page, string[]>();
async function stable(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.mouse.move(0, 0);
}
async function capture(page: Page, name: string) {
  await stable(page);
  await expect(page).toHaveScreenshot(name, { animations: 'disabled', maxDiffPixels: 100, threshold: 0.15 });
}
async function start(page: Page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => Boolean(window.__pirateTest))).toBe(true);
  await stable(page);
}
test.beforeEach(async ({ page }) => {
  const captured: string[] = []; errors.set(page, captured); page.on('pageerror', error => captured.push(error.message));
  page.on('console', message => { if (message.type() === 'error') captured.push(message.text()); });
  await page.addInitScript(() => { window.__pirateSetup = { seed: 3, manualTime: true }; });
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

test('menu and Options references, keyboard navigation and readable validation', async ({ page }) => {
  await page.goto('/'); await capture(page, 'menu.png');
  const options = page.getByRole('button', { name: 'Options', exact: true });
  await options.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Options', exact: true })).toBeFocused();
  await capture(page, 'options.png');
  await page.getByLabel('Game session time', { exact: true }).fill('59');
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  const field = page.getByLabel('Game session time', { exact: true });
  await expect(field).toBeFocused(); await expect(field).toHaveAccessibleDescription('Enter a whole number between 60 and 180 seconds.');
  await expect(page.locator('#session-error')).toBeVisible();
  await field.fill('120'); await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  await expect(options).toBeFocused();
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Captain’s Log' })).toBeFocused();
  await page.getByRole('tab', { name: 'Ranking', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Match History' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Match History' })).toHaveAttribute('aria-selected', 'true');
});

test('arena and pause references, Options in pause and responsive HUD', async ({ page }, testInfo) => {
  await page.goto('/'); await start(page); await capture(page, 'arena.png');
  const initial = await page.evaluate(() => window.__pirateTest!.snapshot());
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Paused', exact: true }); await expect(dialog).toBeVisible();
  await capture(page, 'pause.png');
  await dialog.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Options', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Close Options and discard unsaved changes' })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Resume', exact: true }).click();
  for (const viewport of [{ width: 320, height: 640 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport); await stable(page);
    expect(await page.evaluate(() => window.__pirateTest!.snapshot())).toEqual(initial);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const counters = await page.locator('.hud-counter').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect(); return { left: box.left, right: box.right, width: box.width, scroll: element.scrollWidth, client: element.clientWidth };
    }));
    expect(counters).toHaveLength(2); expect(counters[0]!.right).toBeLessThanOrEqual(counters[1]!.left);
    for (const counter of counters) { expect(counter.left).toBeGreaterThanOrEqual(0); expect(counter.right).toBeLessThanOrEqual(viewport.width); expect(counter.scroll).toBeLessThanOrEqual(counter.client + 1); }
    const home = await page.getByRole('button', { name: 'Main Menu', exact: true }).boundingBox();
    const pause = await page.getByRole('button', { name: 'Pause', exact: true }).boundingBox();
    expect(home!.x + home!.width).toBeLessThanOrEqual(viewport.width); expect(pause!.x + pause!.width).toBeLessThanOrEqual(viewport.width);
    if (viewport.width > viewport.height && testInfo.project.use.hasTouch) {
      const mapWidth = await page.locator('.arena-screen').evaluate(element => parseFloat((element as HTMLElement).style.getPropertyValue('--play-area-width')));
      expect(mapWidth).toBeGreaterThan(viewport.width * 0.5);
      // Touch targets must remain beside the playable field in this short layout.
      const left = await page.getByRole('button', { name: 'Right ↷', exact: true }).boundingBox();
      const right = await page.getByRole('button', { name: 'Q · Port', exact: true }).boundingBox();
      expect(left!.x + left!.width).toBeLessThan((viewport.width - mapWidth) / 2);
      expect(right!.x).toBeGreaterThan((viewport.width + mapWidth) / 2);
    }
    const path = testInfo.outputPath(`hud-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path });
    await testInfo.attach(`HUD ${viewport.width}x${viewport.height}`, { path, contentType: 'image/png' });
  }
});

test('actual result reference and refresh returns to the menu', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('pirate-battle.options.v1', JSON.stringify({ sessionSeconds: 60, spawnSeconds: 30 })); });
  await page.goto('/'); await start(page);
  await page.evaluate(() => window.__pirateTest!.advance(60));
  await expect(page.getByRole('dialog', { name: 'Time Up', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Time Up', exact: true })).toBeFocused();
  await expect(page.getByText('Match registered in Ranking and Match History.')).toBeVisible();
  await capture(page, 'result.png');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Again', exact: true })).toHaveCount(0);
  await capture(page, 'menu.png');
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
});
