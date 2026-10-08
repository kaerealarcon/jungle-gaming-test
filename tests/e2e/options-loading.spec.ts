import { test, expect, type Page } from '@playwright/test';

const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(async ({ page }) => { expect(pageErrors.get(page)).toEqual([]); });

async function setup(page: Page) {
  await page.addInitScript(() => { window.__pirateSetup = { seed: 12345, manualTime: true }; });
  await page.goto('/');
}
async function ready(page: Page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => Boolean(window.__pirateTest))).toBe(true);
}

test('Options validation, boundaries, save/refresh and keyboard focus', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Options', exact: true })).toBeFocused();
  const session = page.getByLabel('Game session time', { exact: true });
  const spawn = page.getByLabel('Enemy spawn time', { exact: true });
  for (const value of ['', '59', '181', '60.5']) {
    await session.fill(value);
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
    await expect(session).toBeFocused();
    await expect(session).toHaveAttribute('aria-invalid', 'true');
  }
  await session.fill('60');
  for (const value of ['', '0', '31', '1.5']) {
    await spawn.fill(value);
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
    await expect(spawn).toBeFocused();
    await expect(spawn).toHaveAttribute('aria-invalid', 'true');
  }
  await spawn.fill('1');
  await expect(page.getByRole('button', { name: 'Decrease session time' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Decrease spawn time' })).toBeDisabled();
  await session.fill('180'); await spawn.fill('30');
  await expect(page.getByRole('button', { name: 'Increase session time' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Increase spawn time' })).toBeDisabled();
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(session).toHaveValue('180'); await expect(spawn).toHaveValue('30');
  await session.fill('90');
  await expect(page.getByRole('button', { name: 'Close Options and discard unsaved changes' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Main Menu', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Options', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(session).toHaveValue('90');
});

test('storage failure retains drafts and corrupt options fall back safely', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pirate-battle.options.v1', '{broken');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'pirate-battle.options.v1') throw new Error('Storage denied');
      original.call(this, key, value);
    };
  });
  await setup(page);
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(page.getByLabel('Game session time', { exact: true })).toHaveValue('120');
  await page.getByLabel('Game session time', { exact: true }).fill('90');
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  await expect(page.getByText('Unable to save options.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Game session time', { exact: true })).toHaveValue('90');
});

test('current match keeps its snapshot; next match uses saved Options', async ({ page }) => {
  await setup(page); await ready(page);
  const first = await page.evaluate(() => window.__pirateTest!.snapshot());
  await page.evaluate(() => window.__pirateTest!.advance(1));
  await expect.poll(() => page.evaluate(() => window.__pirateTest!.snapshot().elapsed)).toBeCloseTo(1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Options', exact: true }).click();
  await page.getByLabel('Game session time', { exact: true }).fill('90');
  await page.getByLabel('Enemy spawn time', { exact: true }).fill('7');
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  expect(await page.evaluate(() => window.__pirateTest!.snapshot().config)).toEqual(first.config);
  await dialog.getByRole('button', { name: 'Main Menu', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__pirateTest))).toBe(false);
  await ready(page);
  const next = await page.evaluate(() => window.__pirateTest!.snapshot());
  expect(next.config.sessionSeconds).toBe(90); expect(next.config.spawn.intervalSeconds).toBe(7);
  expect(next.islands).toEqual(first.islands); expect(next.elapsed).toBe(0);
});

test.describe('actual texture loading lifecycle', () => {
  test.use({ serviceWorkers: 'block' });
  test('texture failure offers a working retry', async ({ page }) => {
    await setup(page);
    await page.route('**/ship_1*.png', route => route.abort());
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Unable to load the arena' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeDisabled();
    await page.unroute('**/ship_1*.png');
    await page.getByRole('button', { name: 'Try Again', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    await expect(page.locator('canvas')).toHaveCount(1);
  });
  test('progress reflects pending assets; exiting cancels scene attachment', async ({ page }) => {
    await setup(page);
    let release!: () => void;
    let handled!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const completed = new Promise<void>(resolve => { handled = resolve; });
    await page.route('**/ship_1*.png', async route => { await pending; await route.continue(); handled(); });
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const progress = page.getByRole('progressbar', { name: 'Loading arena assets' });
    await expect(progress).toBeVisible();
    await expect.poll(async () => Number(await progress.getAttribute('value'))).toBeGreaterThan(0);
    expect(Number(await progress.getAttribute('value'))).toBeLessThan(100);
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
    release(); await completed; await page.unroute('**/ship_1*.png');
    await ready(page);
    await expect(page.locator('canvas')).toHaveCount(1);
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => Boolean(window.__pirateTest))).toBe(false);
  });
});
