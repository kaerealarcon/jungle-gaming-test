import { test, expect, type Page } from '@playwright/test';
import { createGameConfig, defaultOptions } from '../../src/game/config';

const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(async ({ page }) => { expect(pageErrors.get(page)).toEqual([]); });

async function seedResult(page: Page, scenario = 'success') {
  await page.addInitScript(scenario => {
    localStorage.setItem('pirate-battle.mock-scenario.v1', scenario);
    // Matches the current balance snapshot without depending on game time in UI tests.
  }, scenario);
  await page.goto('/');
  const config = createGameConfig(defaultOptions);
  await page.evaluate(config => {
    localStorage.setItem('pirate-battle.last-result.v1', JSON.stringify({ id: 'e2e-result', completedAt: '2026-10-07T12:00:00Z', score: 42, durationSeconds: 120, reason: 'time', config, captainName: '' }));
  }, config);
  await page.reload();
}

test('samples: ranking tabs, pagination, empty and recoverable error', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Captain’s Log' })).toBeVisible();
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `test-results/ranking-${testInfo.project.name}.png`, fullPage: true });
  await expect(page.locator('.menu-log')).toHaveScreenshot('ranking.png', { animations: 'disabled', maxDiffPixels: 100, threshold: 0.15 });
  // Diagnostics are used for error scenarios after the normal-player reference.
  await page.goto('/?mocks=1');
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await expect(page.locator('tbody tr').first().locator('td').first()).toHaveText('06');
  await page.getByRole('tab', { name: 'Match History' }).click();
  await expect(page.getByText('Your completed battles will appear here.')).toBeVisible();
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click();
  await page.getByText('Network demo', { exact: true }).click();
  await page.getByLabel('Scenario', { exact: true }).selectOption('ranking-error');
  await expect(page.getByText('Unable to update. Showing the last loaded battles.')).toBeVisible();
  await page.getByLabel('Scenario', { exact: true }).selectOption('empty');
  await expect(page.getByText('No battles with this configuration yet.')).toBeVisible();
  await page.getByLabel('Scenario', { exact: true }).selectOption('success');
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.getByText('Network demo', { exact: true }).click();
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});

test('results register automatically and refresh preserves history', async ({ page }, testInfo) => {
  await seedResult(page);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Again', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle.outbox.v1') ?? '[]')[0]?.status)).toBe('confirmed');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'CAPTAIN JACK', exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toContainText('42');
  await page.screenshot({ path: `test-results/history-${testInfo.project.name}.png`, fullPage: true });
  await page.mouse.move(0, 0);
  await expect(page.locator('.menu-log')).toHaveScreenshot('history.png', { animations: 'disabled', maxDiffPixels: 100, threshold: 0.15 });
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click();
  await expect(page.locator('tbody tr').first()).toContainText('CAPTAIN JACK');
  await expect(page.locator('tbody tr').first()).toContainText('You');
});

test('registration failure survives refresh and retries without duplicates', async ({ page }) => {
  await seedResult(page, 'timeout-after-save');
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await page.getByText('1 match awaiting registration').click();
  await expect(page.getByText('Request timed out. Your match is kept for retry.')).toBeVisible({ timeout: 20000 });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await page.getByText('1 match awaiting registration').click();
  await expect(page.getByText('Request timed out. Your match is kept for retry.')).toBeVisible();
  await page.evaluate(() => localStorage.setItem('pirate-battle.mock-scenario.v1', 'success'));
  await page.getByRole('button', { name: 'Try Again', exact: true }).click();
  await expect(page.getByText('1 match awaiting registration')).toHaveCount(0);
  await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('rapid tab changes discard delayed data and history pages stay isolated', async ({ page }) => {
  await page.goto('/?mocks=1');
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await page.getByText('Network demo', { exact: true }).click();
  await page.getByLabel('Scenario', { exact: true }).selectOption('out-of-order');
  await page.getByRole('tab', { name: 'Match History' }).click();
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click();
  await page.getByRole('tab', { name: 'Match History' }).click();
  await expect(page.getByText('Your completed battles will appear here.')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Captain', exact: true })).toHaveCount(0);
  await page.getByLabel('Scenario', { exact: true }).selectOption('multiple-pages');
  await expect(page.getByText('Page 1 of 3')).toBeVisible();
  await page.getByText('Network demo', { exact: true }).click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 2 of 3')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(5);
});

test('history opens directly and invalid HTTP 200 responses cannot crash it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?mocks=1');
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.getByText('Your completed battles will appear here.')).toBeVisible();
  await page.getByText('Network demo', { exact: true }).click();
  await page.getByLabel('Scenario', { exact: true }).selectOption('malformed-response');
  await expect(page.getByText('Unable to update. Showing the last loaded battles.')).toBeVisible();
  await page.getByLabel('Scenario', { exact: true }).selectOption('success');
  await expect(page.getByText('Your completed battles will appear here.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('pagination stays synchronized when a three-page list shrinks', async ({ page }) => {
  await page.goto('/?mocks=1');
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await page.getByText('Network demo', { exact: true }).click();
  await page.getByLabel('Scenario', { exact: true }).selectOption('multiple-pages');
  await expect(page.getByText('Page 1 of 3')).toBeVisible();
  await page.getByText('Network demo', { exact: true }).click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 2 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 3 of 3')).toBeVisible();
  await page.getByText('Network demo', { exact: true }).click();
  await page.getByLabel('Scenario', { exact: true }).selectOption('success');
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await page.getByText('Network demo', { exact: true }).click();
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await expect(page.locator('tbody tr').first().locator('td').first()).toHaveText('01');
});

test('320px log keeps all columns and actions inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const width = await page.locator('.log-table-wrap').evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
  await expect(page.getByRole('button', { name: 'Main Menu', exact: true })).toBeVisible();
});

test('pending registration never blocks a new voyage and abandoning adds no record', async ({ page }) => {
  await seedResult(page, 'unavailable');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.canvas-host canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.getByText('1 match awaiting registration')).toBeVisible();
  const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle.outbox.v1') ?? '[]'));
  expect(queued).toHaveLength(1);
  expect(queued[0].request.match.id).toBe('e2e-result');
});

test('legacy unnamed results and missing confirmations recover into recent history', async ({ page }) => {
  await page.goto('/');
  const config = createGameConfig(defaultOptions);
  await page.evaluate(config => {
    const playerId = 'legacy-player';
    const match = { id: 'legacy-unnamed', completedAt: '2026-10-07T12:00:00Z', score: 7, durationSeconds: 61, reason: 'death', config, captainName: '' };
    localStorage.setItem('pirate-battle.player.v1', playerId);
    localStorage.setItem('pirate-battle.captain.v1', 'Sailor');
    localStorage.setItem('pirate-battle.outbox.v1', JSON.stringify([
      { request: { playerId, match }, status: 'waiting-name' },
      { request: { playerId, match: { ...match, id: 'legacy-missing', score: 9, captainName: 'Sailor' } }, status: 'confirmed' },
    ]));
  }, config);
  await page.reload();
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'CAPTAIN JACK', exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('tbody')).toContainText('7');
  await expect(page.locator('tbody')).toContainText('9');
  await page.reload();
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
});

test('a played voyage automatically appears in recent history after ending', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 320, height: 400 });
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  for (let step = 0; step < 370; step++) {
    await page.clock.runFor(500);
    if (await page.evaluate(() => !!localStorage.getItem('pirate-battle.last-result.v1'))) break;
  }
  await expect(page.locator('dialog.mission-dialog[open]')).toBeVisible();
  await expect(page.getByText('Match registered in Ranking and Match History.')).toBeVisible();
  const result = await page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle.last-result.v1') ?? 'null'));
  expect(result.captainName).toBe('CAPTAIN JACK');
  await page.getByRole('dialog').getByRole('button', { name: 'Main Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'CAPTAIN JACK', exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle.mock-matches.v1') ?? '[]').filter((match: { id: string }) => match.id === JSON.parse(localStorage.getItem('pirate-battle.last-result.v1') ?? '{}').id).map((match: { id: string }) => match.id));
  expect(ids).toEqual([result.id]);
});
