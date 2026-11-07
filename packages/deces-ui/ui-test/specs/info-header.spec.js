// @ts-check
// Inventory zone IN: desktop header and menus (MatchIDHeader.svelte).
// The unit tests (test/unit/info/MatchIDHeader.test.js) pin the structure;
// these specs check the behaviour that needs a real browser and CSS (hover,
// keyboard focus, visibility, navigation against the running stack).
const { test, expect } = require('@playwright/test');
const { stubStats } = require('../helpers/info-stats');
const {
  adminUser, plainUser, stubVersion, loginWithStoredToken, searchReferencePerson, desktopNav
} = require('../helpers/info-common');

// page.route() does not see requests answered by a service worker: keep the
// app service worker (public/sw.js) out of the way of the stubs.
test.use({ serviceWorkers: 'block' });

const searchMenu = (page) => page.locator('#rf-recherche');
const userMenu = (page) => page.locator('#rf-admin');
const searchButton = (page) => desktopNav(page).getByRole('button', { name: 'Recherche' });
const userButton = (page) => desktopNav(page).locator('button[aria-controls="rf-admin"]');
// the results table (ResultsHeader renders another, non-striped table.rf-table)
const resultsTable = (page) => page.locator('table.rf-table.rf-table--striped');
const item = (locator) => locator.locator('xpath=ancestor::li[1]');

// The dropdowns open on mouseenter AND toggle on click, so a Playwright
// click (hover + click) would open and close them at once: open them by
// moving the mouse away first, then hovering the button.
const openByHover = async (page, button, menu) => {
  await page.mouse.move(5, 700);
  await expect(menu).toBeHidden();
  await button.hover();
  await expect(menu).toBeVisible();
};
const openSearchMenu = (page) => openByHover(page, searchButton(page), searchMenu(page));
const openUserMenu = (page) => openByHover(page, userButton(page), userMenu(page));

test.describe('header (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await stubVersion(page);
  });

  test('IN-001 the header renders on every route', async ({ page }) => {
    await stubStats(page);
    for (const path of ['/search', '/link', '/about', '/stats', '/explain', '/id/does-not-exist', '/notFound']) {
      await test.step(path, async () => {
        await page.goto(path);
        await expect(page.locator('header.rf-header')).toBeVisible();
        await expect(page.locator('.rf-service__title')).toHaveText('Fichier des décès');
        await expect(desktopNav(page)).toBeVisible();
        await expect(page.getByTitle('ouvrir le menu')).toBeHidden();
      });
    }
  });

  test('IN-010 the "Recherche" dropdown opens on hover and closes when the mouse leaves', async ({ page }) => {
    await page.goto('/about');
    await openSearchMenu(page);
    await expect(searchButton(page)).toHaveAttribute('aria-expanded', 'true');
    await page.mouse.move(5, 700);
    await expect(searchMenu(page)).toBeHidden();
    await expect(searchButton(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('IN-011 a click on "Recherche" (without hover) toggles the dropdown', async ({ page }) => {
    await page.goto('/about');
    await page.mouse.move(5, 700);
    await searchButton(page).dispatchEvent('click');
    await expect(searchMenu(page)).toBeVisible();
    await searchButton(page).dispatchEvent('click');
    await expect(searchMenu(page)).toBeHidden();
  });

  test('IN-012 keyboard focus inside the search menu opens it, focus elsewhere closes it', async ({ page }) => {
    await page.goto('/about');
    await page.mouse.move(5, 700);
    await searchButton(page).focus();
    await expect(searchMenu(page)).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(searchMenu(page).getByRole('link', { name: 'recherche Simple' })).toBeFocused();
    await expect(searchMenu(page)).toBeVisible();
    await desktopNav(page).getByRole('link', { name: 'Appariement' }).focus();
    await expect(searchMenu(page)).toBeHidden();
  });

  test('IN-013 "Simple" from another route goes to the simple search', async ({ page }) => {
    await page.goto('/about');
    await openSearchMenu(page);
    await searchMenu(page).getByRole('link', { name: 'recherche Simple' }).click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.locator('#q')).toBeVisible();
    await page.mouse.move(5, 700);
    await expect(searchMenu(page)).toBeHidden();
  });

  test('IN-014 / IN-015 "Avancé" switches the form to the advanced fields and is highlighted', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('#q')).toBeVisible();
    await openSearchMenu(page);
    await expect(item(searchMenu(page).getByRole('link', { name: 'recherche Simple' }))).toHaveClass(/rf-menu__item--active/);
    await searchMenu(page).getByRole('link', { name: 'recherche Avancé' }).click();
    await expect(page.locator('#ln')).toBeVisible();
    await expect(page).toHaveURL(/advanced=true/);
    await openSearchMenu(page);
    await expect(item(searchMenu(page).getByRole('link', { name: 'recherche Avancé' }))).toHaveClass(/rf-menu__item--active/);
  });

  test('IN-017 / IN-023 display modes are greyed and inert before a search', async ({ page }) => {
    await page.goto('/search');
    await openSearchMenu(page);
    const table = searchMenu(page).getByRole('link', { name: 'Tableur', exact: true });
    await expect(item(table)).toHaveClass(/rf-inactive/);
    await table.click();
    await expect(page).not.toHaveURL(/view=/);
    await expect(resultsTable(page)).toHaveCount(0);
  });

  test('IN-018 .. IN-022 display modes after a search: table, agg, geo, card-expand, card', async ({ page }) => {
    await searchReferencePerson(page);
    const pick = async (name) => {
      await openSearchMenu(page);
      await searchMenu(page).getByRole('link', { name, exact: true }).click();
      // the pointer is still over the menu item after the click: leave it
      await page.mouse.move(5, 700);
      await expect(searchMenu(page)).toBeHidden();
    };

    await test.step('IN-020 Tableur renders the results table', async () => {
      await pick('Tableur');
      await expect(page).toHaveURL(/[?&]view=table(&|$)/);
      await expect(resultsTable(page)).toBeVisible();
      await expect(resultsTable(page)).toContainText(/dupont/i);
    });

    await test.step('IN-021 Statistiques renders the aggregations', async () => {
      await pick('Statistiques');
      await expect(page).toHaveURL(/[?&]view=agg(&|$)/);
      await expect(page.locator('.rf-tile__title').first()).toBeVisible({ timeout: 30_000 });
    });

    await test.step('IN-022 Géographique loads the Geo chunk and renders the map', async () => {
      await pick('Géographique');
      await expect(page).toHaveURL(/[?&]view=geo(&|$)/);
      await expect(page.locator('.leaflet-container')).toBeVisible();
    });

    await test.step('IN-019 Complet renders the cards in expanded mode', async () => {
      await pick('Complet');
      await expect(page).toHaveURL(/[?&]view=card-expand(&|$)/);
      await expect(page.getByText('DUPONT Jean Pierre').first()).toBeVisible();
    });

    await test.step('IN-018 / IN-024 Simple goes back to the cards, drops view= and is highlighted', async () => {
      await pick('Simple');
      await expect(page).not.toHaveURL(/view=/);
      await expect(page.getByText('DUPONT Jean Pierre').first()).toBeVisible();
      await openSearchMenu(page);
      await expect(item(searchMenu(page).getByRole('link', { name: 'Simple', exact: true }))).toHaveClass(/rf-menu__item--active/);
    });
  });

  test('IN-027 "Appariement" navigates to /link and is highlighted there', async ({ page }) => {
    await page.goto('/search');
    const link = desktopNav(page).getByRole('link', { name: 'Appariement' });
    await link.click();
    await expect(page).toHaveURL(/\/link$/);
    await expect(item(link)).toHaveClass(/rf-nav__item--active/);
  });

  test('IN-028 "À propos" navigates to /about and is highlighted there', async ({ page }) => {
    await page.goto('/search');
    const link = desktopNav(page).getByRole('link', { name: 'À propos' });
    await link.click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole('heading', { level: 2, name: 'À propos' })).toBeVisible();
    await expect(item(link)).toHaveClass(/rf-nav__item--active/);
  });

  test('IN-056 Ctrl+Alt+D toggles the DNUM theme live', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByAltText('matchID Logo')).toBeVisible();
    await page.keyboard.press('Control+Alt+d');
    await expect(page.getByAltText('DNUM Logo').first()).toBeVisible();
    await expect(page.locator('a.rf-logo')).toHaveAttribute('title', 'Ministère de l\'Intérieur');
    await expect(page.locator('.rf-service__tagline')).not.toContainText('depuis 1970');
    await page.keyboard.press('Control+Alt+d');
    await expect(page.getByAltText('matchID Logo')).toBeVisible();
    await expect(page.locator('a.rf-logo')).toHaveCount(0);
  });

  test('IN-004 DNUM brand link on /search resets the search', async ({ page }) => {
    await searchReferencePerson(page);
    await page.keyboard.press('Control+Alt+d');
    await page.locator('a.rf-logo').click();
    await expect(page).toHaveURL(/\/search$/);
  });

  test('IN-032 the user dropdown opens on hover, closes on leave, toggles on click', async ({ page }) => {
    await page.goto('/about');
    await openUserMenu(page);
    await expect(userButton(page)).toHaveAttribute('aria-expanded', 'true');
    await page.mouse.move(5, 700);
    await expect(userMenu(page)).toBeHidden();
    await userButton(page).dispatchEvent('click');
    await expect(userMenu(page)).toBeVisible();
  });

  test('IN-033 "S\'identifier" opens the login modal', async ({ page }) => {
    await page.goto('/about');
    await openUserMenu(page);
    await userMenu(page).getByRole('link', { name: 'S\'identifier' }).click();
    await expect(page.getByText('Connexion').first()).toBeVisible();
    await expect(page.locator('input#email')).toBeVisible();
  });

  test('IN-035 / IN-036 / IN-037 a logged-in user gets "Corrections", "API Key" and "Appariements", not "Statistiques"', async ({ page }) => {
    await loginWithStoredToken(page, plainUser);
    await page.goto('/about');
    await openUserMenu(page);
    await expect(userMenu(page).getByRole('link', { name: 'Se déconnecter' })).toBeVisible();
    await expect(userMenu(page).getByRole('link', { name: 'Corrections' })).toHaveAttribute('href', '/edits');
    await expect(userMenu(page).getByRole('link', { name: 'Appariements' })).toHaveAttribute('href', '/jobs');
    await expect(userMenu(page).locator('a[title="Statistiques"]')).toHaveCount(0);
    await userMenu(page).getByRole('link', { name: 'API Key' }).click();
    await expect(page.getByText('Votre clé d\'API')).toBeVisible();
  });

  test('IN-038 the admin gets "Statistiques" (/stats) and the circular admin badge', async ({ page }) => {
    await stubStats(page);
    await loginWithStoredToken(page, adminUser);
    await page.goto('/about');
    await openUserMenu(page);
    const stats = userMenu(page).locator('a[title="Statistiques"]');
    await expect(stats).toBeVisible();
    await expect(userButton(page).locator('svg title')).toHaveText(adminUser);
    await stats.click();
    await expect(page).toHaveURL(/\/stats(\?.*)?$/);
    await expect(page.getByText('Statistiques de consultation')).toBeVisible();
  });
});
