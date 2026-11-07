// @ts-check
const { test, expect } = require('@playwright/test');
const { apiPath, referencePerson } = require('../helpers/core-search');

test.describe('core: routing, history and document metadata', () => {
  test('CO-001 "/" is rewritten to "/search" and keeps the query string', async ({ page }) => {
    await page.goto('/?q=dupont+jean');
    await expect(page).toHaveURL(/\/search\?q=dupont\+jean$/);
    await expect(page.locator('#q')).toHaveValue('dupont jean');
    await expect(page.getByText(referencePerson).first()).toBeVisible();
  });

  test('CO-003 an unknown path shows the 404 page at /notFound', async ({ page }) => {
    await page.goto('/no/such/page');
    await expect(page).toHaveURL(/\/notFound$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Pas de page à l\'adresse indiquée' })).toBeVisible();
    await expect(page).toHaveTitle('matchID - 404 - Pas de page à l\'adresse indiquée');
  });

  test('CO-009 in-app navigation replaces history entries: Back leaves the app state', async ({ page }) => {
    await page.goto('/about');
    await page.goto('/search');
    const historyLength = await page.evaluate(() => history.length);
    await page.locator('#q').fill('dupont jean');
    await expect(page).toHaveURL(/[?&]q=dupont\+jean(&|$)/);
    await page.locator('header a[href="/link"]').first().click();
    await expect(page).toHaveURL(/\/link$/);
    expect(await page.evaluate(() => history.length)).toBe(historyLength);
    await page.goBack();
    // the previous document, not the previous search
    await expect(page).toHaveURL(/\/about$/);
  });

  test('CO-010 an anonymous visitor of /edits gets the login modal', async ({ page }) => {
    await page.goto('/edits');
    await expect(page.locator('.modal').getByText('Connexion')).toBeVisible();
    await expect(page.locator('.modal input#email')).toBeVisible();
  });

  test('CO-011 document title per route and for a search with results', async ({ page }) => {
    await page.goto('/about');
    await expect(page).toHaveTitle('matchID - À propos');
    await page.goto('/link');
    await expect(page).toHaveTitle('matchID - Appariement');
    await page.goto('/search');
    await expect(page).toHaveTitle('matchID - Moteur de recherche des personnes décédées');
    await page.locator('#q').fill('dupont jean');
    await expect(page.getByText(referencePerson).first()).toBeVisible();
    await expect(page).toHaveTitle('matchID - recherche Dupont Jean');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'résultats de la recherche pour Dupont Jean');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/search\?q=dupont\+jean$/);
  });

  test('CO-014 /search?accessToken=..&user=.. stores the session and uses the token', async ({ page }) => {
    // keep the fake token: answer the session refresh instead of the backend
    await page.route(`**${apiPath}/auth*`, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    const authRequest = page.waitForRequest(r => new URL(r.url()).pathname === `${apiPath}/auth`);
    await page.goto('/search?accessToken=fake-jwt-from-url&user=jean%40example.org');
    expect((await authRequest).headers().authorization).toBe('Bearer fake-jwt-from-url');
    const stored = await page.evaluate(() => [localStorage.getItem('accessToken'), localStorage.getItem('user')]);
    expect(stored).toEqual(['"fake-jwt-from-url"', '"jean@example.org"']);
  });
});
