// @ts-check
// Inventory zone IN: visual regression baselines for the markup that the
// Svelte 5 migration forces to rewrite (MatchIDHeader `<tr>/<td>` inside
// `<a>`, unbalanced `<div>`), and for the about/FAQ, stats, explain and
// punch message pages.
//
// BASELINES: none are committed yet. Generate them once on CI (Playwright
// container, same image as the suite) with
//   npx playwright test specs/info-visual.spec.js --update-snapshots
// then commit specs/info-visual.spec.js-snapshots/*.png. Until then every test
// of this file is skipped by requireBaselines() (see helpers/info-visual.js),
// so a regular run stays green.
const { test, expect } = require('@playwright/test');
const { stubStats } = require('../helpers/info-stats');
const { adminUser, stubVersion, loginWithStoredToken, desktopNav, mobileNav } = require('../helpers/info-common');
const { requireBaselines, expectScreenshot } = require('../helpers/info-visual');

// page.route() does not see requests answered by a service worker: keep the
// app service worker (public/sw.js) out of the way of the stubs.
test.use({ serviceWorkers: 'block' });

const explainResult = {
  score: 0.856,
  name: { score: 0.9, first: 1, last: 0.9, legal: 0.8 },
  sex: 1,
  birthDate: 1,
  deathDate: 0.5,
  birthLocation: { score: 1, city: 1, code: 1, departmentCode: 1, country: 1 },
  deathLocation: { score: 0.5, city: 0.5, code: 1, geo: 0.3 }
};

const topOfPage = { clip: { x: 0, y: 0, width: 1280, height: 520 } };

test.describe('visual baselines (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await stubVersion(page);
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('IN-002 / IN-007 header, public theme', async ({ page }) => {
    requireBaselines('header-desktop.png');
    await page.goto('/about');
    await expectScreenshot(page.locator('header.rf-header'), 'header-desktop.png');
  });

  test('IN-003 header, DNUM theme', async ({ page }) => {
    requireBaselines('header-desktop-dnum.png');
    await page.goto('/about');
    await page.keyboard.press('Control+Alt+d');
    await expect(page.getByAltText('DNUM Logo').first()).toBeVisible();
    await expectScreenshot(page.locator('header.rf-header'), 'header-desktop-dnum.png');
  });

  test('IN-011 .. IN-024 desktop "Recherche" menu open, after a search (active display modes)', async ({ page }) => {
    requireBaselines('header-desktop-search-menu.png');
    await page.goto('/search?q=dupont+jean');
    await expect(page.getByText('DUPONT Jean Pierre').first()).toBeVisible();
    await page.mouse.move(5, 880);
    await desktopNav(page).getByRole('button', { name: 'Recherche' }).hover();
    await expect(page.locator('#rf-recherche')).toBeVisible();
    await expectScreenshot(page, 'header-desktop-search-menu.png', topOfPage);
  });

  test('IN-030 .. IN-038 desktop user menu open for the admin (circular badge)', async ({ page }) => {
    requireBaselines('header-desktop-admin-menu.png');
    await loginWithStoredToken(page, adminUser);
    await page.goto('/about');
    await page.mouse.move(5, 880);
    await desktopNav(page).locator('button[aria-controls="rf-admin"]').hover();
    await expect(page.locator('#rf-admin')).toBeVisible();
    await expectScreenshot(page, 'header-desktop-admin-menu.png', topOfPage);
  });

  test('IN-058 / IN-065 about page with the 15 FAQ cards', async ({ page }) => {
    requireBaselines('about-faq.png');
    await page.goto('/about');
    await expect(page.locator('.rf-card')).toHaveCount(15);
    await expectScreenshot(page, 'about-faq.png', { fullPage: true });
  });

  test('IN-072 / IN-089 about page with an open section', async ({ page }) => {
    requireBaselines('about-section-open.png');
    await page.goto('/about#donnees-personnelles');
    const section = page.locator('[id="donnees-personnelles"]');
    await expect(section.locator('.rf-callout')).toBeVisible();
    await expectScreenshot(section, 'about-section-open.png');
  });

  test('IN-059 404 page', async ({ page }) => {
    requireBaselines('not-found.png');
    await page.goto('/notFound');
    await expect(page.locator('.rf-card')).toHaveCount(15);
    await expectScreenshot(page, 'not-found.png', topOfPage);
  });

  test('IN-110 .. IN-131 stats dashboard (stubbed data, charts and maps)', async ({ page }) => {
    requireBaselines('stats-dashboard.png');
    await stubStats(page);
    await page.goto('/stats?scope=month&source=202301');
    await expect(page.locator('path[id="33"]')).toBeVisible();
    await expect(page.locator('path[id="FRA"]')).toBeVisible();
    await expectScreenshot(page, 'stats-dashboard.png', { fullPage: true });
  });

  test('IN-172 .. IN-177 explain page scoring diagram (stubbed compare)', async ({ page }) => {
    requireBaselines('explain-diagram.png');
    await page.route('**/deces/api/v1/compare', route => route.fulfill({ json: explainResult }));
    await page.goto('/explain');
    const diagram = page.locator('svg[viewBox^="0 0 137.94624"]');
    await expect(diagram.getByText('85%', { exact: true })).toBeVisible();
    await expectScreenshot(diagram, 'explain-diagram.png');
  });

  test('IN-196 / IN-198 search page punch message (stubbed /version)', async ({ page }) => {
    requireBaselines('search-punch.png');
    await page.goto('/search');
    const punch = page.locator('.rf-container.rf-text--center').filter({ has: page.getByTitle('Recherche', { exact: true }) });
    await expect(punch).toContainText('enregistrements');
    await expectScreenshot(punch, 'search-punch.png');
  });
});

test.describe('visual baselines (mobile)', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test.beforeEach(async ({ page }) => {
    await stubVersion(page);
  });

  test('IN-040 mobile header with the burger', async ({ page }) => {
    requireBaselines('header-mobile.png');
    await page.goto('/about');
    await expectScreenshot(page.locator('header.rf-header'), 'header-mobile.png');
  });

  test('IN-041 .. IN-048 mobile popin with both submenus open', async ({ page }) => {
    requireBaselines('header-mobile-popin.png');
    await page.goto('/about');
    await page.getByTitle('ouvrir le menu').tap();
    // user submenu first: focusing any popin control collapses the search
    // submenu, which is shared with the desktop menu (IN-012)
    await mobileNav(page).locator('li[aria-controls="rf-admin-popin"] > button').tap();
    await mobileNav(page).getByRole('button', { name: 'Recherche' }).tap();
    await expect(page.locator('#rf-recherche-popin')).toBeVisible();
    await expect(page.locator('#rf-admin-popin')).toBeVisible();
    await expectScreenshot(page, 'header-mobile-popin.png');
  });
});
