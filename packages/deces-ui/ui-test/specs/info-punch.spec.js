// @ts-check
// Inventory zone IN: PunchMessage.svelte (search page footer) fed by /version.
const { test, expect } = require('@playwright/test');
const { stubVersion, versionPayload } = require('../helpers/info-common');

// page.route() does not see requests answered by a service worker: keep the
// app service worker (public/sw.js) out of the way of the stubs.
test.use({ serviceWorkers: 'block' });

const punchline = (page) => page.getByTitle('Recherche', { exact: true });

test.describe('punch message', () => {
  test('IN-196 the public punchline links to /search', async ({ page }) => {
    await stubVersion(page);
    await page.goto('/search');
    await expect(punchline(page)).toContainText('Recherchez parmi 27 millions de décès depuis 1970');
    await expect(punchline(page)).toHaveAttribute('href', '/search');
    await punchline(page).click();
    await expect(page).toHaveURL(/\/search$/);
  });

  test('IN-198 / IN-199 data and version info from /version (stubbed)', async ({ page }) => {
    await stubVersion(page);
    await page.goto('/search');
    const info = page.locator('p.rf-text--xs').filter({ hasText: 'enregistrements' });
    await expect(info).toContainText(`${versionPayload.uniqRecordsCount} enregistrements, mise à jour le ${versionPayload.updateDate}`);
    await expect(info).toContainText(`dernier décès enregistré le ${versionPayload.lastRecordDate} (${versionPayload.lastDataset})`);
    await expect(info).toContainText(`-api/${versionPayload.backend}`);
    await expect(page.getByText('API indisponible (êtes vous hors ligne ?)')).toHaveCount(0);
  });

  test('IN-198 data info from the real backend /version', async ({ page }) => {
    const response = page.waitForResponse(r => r.url().endsWith('/deces/api/v1/version'));
    await page.goto('/search');
    const json = await (await response).json();
    const info = page.locator('p.rf-text--xs').filter({ hasText: 'enregistrements' });
    await expect(info).toContainText(`${json.uniqRecordsCount} enregistrements`);
    await expect(info).toContainText(`-api/${json.backend}`);
  });

  test('IN-200 "API indisponible" when /version cannot be reached', async ({ page }) => {
    await page.route('**/deces/api/v1/version', route => route.abort());
    await page.goto('/search');
    const warning = page.getByText('API indisponible (êtes vous hors ligne ?)');
    await expect(warning).toBeVisible();
    await expect(warning).toHaveClass(/rf-color--rm/);
  });
});
