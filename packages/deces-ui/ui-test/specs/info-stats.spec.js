// @ts-check
// Inventory zone IN: /stats consultation dashboard (Stats.svelte) with
// stubbed /stats/*.json (the CI stack has no stats volume), real chart.js
// rendering and the real geojson files served by nginx.
const { test, expect } = require('@playwright/test');
const { stubStats, stubStatsMissing } = require('../helpers/info-stats');
const { stubVersion } = require('../helpers/info-common');

// page.route() does not see requests answered by a service worker: keep the
// app service worker (public/sw.js) out of the way of the stubs.
test.use({ serviceWorkers: 'block' });

const unavailable = (page) => page.getByText('Les statistiques seront bientôt disponibles ...');
const selects = (page) => page.locator('select.rf-select[name="select"]');
const chartTile = (page, title) => page.locator('.rf-tile').filter({ has: page.locator('h4.rf-tile__title', { hasText: title }) });

test.describe('stats dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await stubVersion(page);
  });

  test('IN-136 /stats is reachable directly without login', async ({ page }) => {
    await stubStats(page);
    await page.goto('/stats');
    await expect(page).toHaveURL(/\/stats\?source=day&scope=today$/);
    await expect(page.getByText('Statistiques de consultation')).toBeVisible();
    await expect(page.getByText('Connexion')).toHaveCount(0);
  });

  test('IN-104 without stats data (SPA fallback instead of JSON) the unavailable message is shown', async ({ page }) => {
    await stubStatsMissing(page);
    await page.goto('/stats');
    await expect(unavailable(page)).toBeVisible();
    await expect(selects(page)).toHaveCount(0);
  });

  test('IN-137 a 429 from nginx on /stats/*.json shows the unavailable message', async ({ page }) => {
    await stubStats(page, { status: 429 });
    await page.goto('/stats');
    await expect(unavailable(page)).toBeVisible();
  });

  test('IN-106 / IN-111 / IN-115 default scope, KPI tiles and "Cycle" options', async ({ page }) => {
    const requested = await stubStats(page);
    await page.goto('/stats');
    await expect(page.locator('.rf-tile__body.rf-text--center').first()).toContainText('12.3k');
    await expect(page.locator('.rf-tile__body.rf-text--center').first()).toContainText('Visiteurs');
    expect(requested).toEqual(expect.arrayContaining(['catalog', 'day']));
    await expect(selects(page).nth(0)).toHaveValue('today');
    await expect(selects(page).nth(0).locator('option:not([hidden])')).toHaveText([
      'Complet', 'Aujourd\'hui', 'Jour', 'Mois', 'Semaine',
      'Aujourd\'hui (détail)', 'Jour (détail)', 'Mois (détail)', 'Semaine (détail)'
    ]);
    await expect(selects(page).nth(1)).toBeDisabled();
  });

  test('IN-107 / IN-117 / IN-118 a deep link restores scope and period; changing the scope picks the latest period', async ({ page }) => {
    const requested = await stubStats(page);
    await page.goto('/stats?scope=month&source=202301');
    await expect(selects(page).nth(0)).toHaveValue('month');
    await expect(selects(page).nth(1)).toHaveValue('202301');
    expect(requested).toContain('202301');
    await selects(page).nth(0).selectOption('week');
    await expect(selects(page).nth(1)).toHaveValue('2023S02');
    await expect(page).toHaveURL(/\?source=2023S02&scope=week$/);
    await expect(selects(page).nth(1).locator('option:not([hidden])')).toHaveText(['Semaine S02 2023', 'Semaine S01 2023']);
  });

  test('IN-121 / IN-125 charts are drawn; a URL filter hides "Sites sources"', async ({ page }) => {
    await stubStats(page);
    await page.goto('/stats?scope=month&source=202301');
    const visitors = chartTile(page, 'Visiteurs');
    await expect(visitors.locator('canvas')).toBeVisible();
    // chart.js has drawn something: the canvas has a non-zero backing size
    expect(await visitors.locator('canvas').evaluate(c => c.width * c.height)).toBeGreaterThan(0);
    await expect(chartTile(page, 'Sites sources')).toBeVisible();
    await expect(chartTile(page, 'Heure de visite')).toBeVisible();
    await selects(page).nth(2).selectOption('api: search POST');
    await expect(chartTile(page, 'Sites sources')).toHaveCount(0);
  });

  test('IN-124 the expand toggle widens a chart to 12 columns and 500 px (desktop)', async ({ page }) => {
    await stubStats(page);
    await page.goto('/stats');
    const visitors = chartTile(page, 'Visiteurs');
    const column = visitors.locator('xpath=..');
    await expect(column).toHaveClass(/rf-col-xl-6/);
    await visitors.locator('.rf-tile__icon').click();
    await expect(column).toHaveClass(/rf-col-xl-12/);
    await expect(visitors.locator('canvas')).toHaveAttribute('style', /max-height: 500px/);
    await visitors.locator('.rf-tile__icon').click();
    await expect(column).toHaveClass(/rf-col-xl-6/);
  });

  test('IN-157 France map tooltip on hover (department name and value)', async ({ page }) => {
    await stubStats(page);
    await page.goto('/stats');
    const map = chartTile(page, 'Par département');
    const gironde = map.locator('path[id="33"]');
    await expect(gironde).toBeVisible();
    const tooltip = map.locator('g.tooltip').filter({ hasText: 'Gironde' });
    await expect(tooltip).toHaveAttribute('opacity', '0');
    await gironde.hover({ force: true });
    await expect(tooltip).toHaveAttribute('opacity', '0.9');
    await expect(tooltip).toContainText('Visiteurs: 30');
  });

  test('IN-161 world map tooltip on hover (ISO3 id and visitors)', async ({ page }) => {
    await stubStats(page);
    await page.goto('/stats');
    const map = chartTile(page, 'Par pays');
    const france = map.locator('path[id="FRA"]');
    await expect(france).toBeVisible();
    // the FRA shape includes overseas territories: the centre of its bounding
    // box is over the sea, so dispatch the hover instead of moving the mouse
    await france.dispatchEvent('mouseenter');
    const tooltip = map.locator('g.tooltip').filter({ hasText: 'FRA' });
    await expect(tooltip).toHaveAttribute('opacity', '0.9');
    await expect(tooltip).toContainText('Visiteurs:40');
  });
});
