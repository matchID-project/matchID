// @ts-check
// Inventory zone IN: mobile header (burger + popin menu) of MatchIDHeader.svelte,
// at a phone viewport where the DSFR CSS hides the desktop navigation.
// Interactions use taps (touch), as on a phone. Links of the "Recherche"
// submenu are activated with a dispatched click: focusing one of them
// collapses the submenu shared with the desktop menu (pinned by the unit test
// "IN-012 focus in the mobile popin collapses the shared search submenu"),
// and whether the browser click still lands depends on its hit-testing; the
// suspected defect is kept as the IN-043 fixme below.
const { test, expect } = require('@playwright/test');
const { stubStats } = require('../helpers/info-stats');
const {
  adminUser, plainUser, stubVersion, loginWithStoredToken, searchReferencePerson, mobileNav, desktopNav
} = require('../helpers/info-common');

// page.route() does not see requests answered by a service worker: keep the
// app service worker (public/sw.js) out of the way of the stubs.
test.use({ serviceWorkers: 'block' });

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

const burger = (page) => page.getByTitle('ouvrir le menu');
const popin = (page) => page.locator('#header-nav-popin');
const searchSubmenu = (page) => page.locator('#rf-recherche-popin');
const userSubmenu = (page) => page.locator('#rf-admin-popin');
const userToggle = (page) => mobileNav(page).locator('li[aria-controls="rf-admin-popin"] > button');

const openPopin = async (page) => {
  await burger(page).tap();
  await expect(popin(page)).toHaveClass(/rf-header__popin--expanded/);
  await expect(mobileNav(page)).toBeVisible();
};

test.describe('header (mobile)', () => {
  test.beforeEach(async ({ page }) => {
    await stubVersion(page);
  });

  test('IN-040 the burger button is shown on mobile, the desktop navigation is hidden', async ({ page }) => {
    await page.goto('/search');
    await expect(burger(page)).toBeVisible();
    await expect(burger(page)).toHaveAttribute('aria-controls', 'header-nav-popin');
    await expect(page.locator('[role="navigation"][aria-label="Menu principal"]')).toBeHidden();
    await expect(desktopNav(page)).toHaveCount(0);
    await expect(page.locator('.rf-service__tagline').getByText('libre', { exact: true })).toBeHidden();
    await expect(page.locator('.rf-service__tagline').getByText('depuis 1970', { exact: true })).toBeHidden();
  });

  test('IN-041 / IN-042 the burger opens the popin, "Fermer" closes it', async ({ page }) => {
    await page.goto('/search');
    await expect(mobileNav(page)).toBeHidden();
    await openPopin(page);
    await popin(page).getByTitle('Fermer').tap();
    await expect(popin(page)).not.toHaveClass(/rf-header__popin--expanded/);
    await expect(mobileNav(page)).toBeHidden();
  });

  test('IN-043 / IN-044 "Recherche" submenu and search modes Simple / Avancé', async ({ page }) => {
    await page.goto('/search');
    await openPopin(page);
    const toggle = mobileNav(page).getByRole('button', { name: 'Recherche' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(searchSubmenu(page)).toBeVisible();
    await searchSubmenu(page).getByRole('link', { name: 'recherche Avancé' }).dispatchEvent('click');
    await expect(page.locator('#ln')).toBeVisible();
    await expect(popin(page)).not.toHaveClass(/rf-header__popin--expanded/);
    await openPopin(page);
    await mobileNav(page).getByRole('button', { name: 'Recherche' }).tap();
    await searchSubmenu(page).getByRole('link', { name: 'recherche Simple' }).dispatchEvent('click');
    await expect(page.locator('#q')).toBeVisible();
  });

  test('IN-045 mobile display modes are inert before a search, then switch the view', async ({ page }) => {
    await page.goto('/search');
    await openPopin(page);
    await mobileNav(page).getByRole('button', { name: 'Recherche' }).tap();
    const table = () => searchSubmenu(page).getByRole('link', { name: 'Tableur', exact: true });
    await expect(table().locator('xpath=ancestor::li[1]')).toHaveClass(/rf-inactive/);

    await searchReferencePerson(page);
    await openPopin(page);
    await mobileNav(page).getByRole('button', { name: 'Recherche' }).tap();
    await expect(searchSubmenu(page).getByRole('link', { name: /^(Simple|Complet|Tableur|Statistiques|Géographique)$/ })).toHaveCount(5);
    await table().dispatchEvent('click');
    await expect(page).toHaveURL(/[?&]view=table(&|$)/);
    // ResultsHeader renders another (non-striped) table.rf-table
    await expect(page.locator('table.rf-table.rf-table--striped')).toBeVisible();
    await expect(page.locator('table.rf-table.rf-table--striped')).toContainText(/dupont/i);
  });

  test('IN-046 / IN-047 mobile "Appariement" and "À propos" links navigate and close the popin', async ({ page }) => {
    await page.goto('/search');
    await openPopin(page);
    await mobileNav(page).getByRole('link', { name: 'Appariement' }).tap();
    await expect(page).toHaveURL(/\/link$/);
    await expect(popin(page)).not.toHaveClass(/rf-header__popin--expanded/);
    await openPopin(page);
    await mobileNav(page).getByRole('link', { name: 'À propos' }).tap();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole('heading', { level: 2, name: 'À propos' })).toBeVisible();
  });

  test('IN-048 / IN-049 user submenu and login modal', async ({ page }) => {
    await page.goto('/search');
    await openPopin(page);
    await userToggle(page).tap();
    await expect(userToggle(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(userSubmenu(page)).toBeVisible();
    await userSubmenu(page).getByRole('link', { name: 'S\'identifier' }).tap();
    await expect(page.getByText('Connexion').first()).toBeVisible();
    await expect(page.locator('input#email')).toBeVisible();
  });

  test('IN-050 / IN-051 a plain user gets "Corrections" and "API Key", not "Appariements" (admin only on mobile)', async ({ page }) => {
    await loginWithStoredToken(page, plainUser);
    await page.goto('/search');
    await openPopin(page);
    await userToggle(page).tap();
    await expect(userSubmenu(page).getByRole('link', { name: 'Se déconnecter' })).toBeVisible();
    await expect(userSubmenu(page).getByRole('link', { name: 'Corrections' })).toBeVisible();
    await expect(userSubmenu(page).getByRole('link', { name: 'API Key' })).toBeVisible();
    await expect(userSubmenu(page).getByRole('link', { name: 'Appariements' })).toHaveCount(0);
  });

  test('IN-051 / IN-052 the admin gets "Appariements" and "Statistiques" (/stats) on mobile', async ({ page }) => {
    await stubStats(page);
    await loginWithStoredToken(page, adminUser);
    await page.goto('/search');
    await openPopin(page);
    await userToggle(page).tap();
    await expect(userSubmenu(page).getByRole('link', { name: 'Appariements' })).toHaveAttribute('href', '/jobs');
    const stats = userSubmenu(page).locator('a[title="Statistiques"]');
    await expect(stats).toHaveAttribute('href', '/stats');
    await stats.tap();
    await expect(page).toHaveURL(/\/stats(\?.*)?$/);
  });

  // Suspected BUG (not verified on the stack): in a narrow desktop window,
  // a mouse click on a link of the mobile "Recherche" submenu first focuses
  // it, the focus handler (MatchIDHeader.svelte:537-543) collapses the
  // submenu shared with the desktop menu, and the click may land elsewhere.
  test.fixme('IN-043 BUG: a mouse click on a mobile search mode link switches the mode', async ({ page }) => {
    await page.goto('/search');
    await burger(page).click();
    await mobileNav(page).getByRole('button', { name: 'Recherche' }).click();
    await searchSubmenu(page).getByRole('link', { name: 'recherche Avancé' }).click();
    await expect(page.locator('#ln')).toBeVisible();
  });
});
