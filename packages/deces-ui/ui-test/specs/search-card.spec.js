// @ts-check
const { test, expect } = require('@playwright/test');
const { stubThirdParties, injectWikidataLinks, referenceSearch, referenceCard } = require('../helpers/search-stubs');

// page.route() does not see requests handled by the service worker: block it
// so that the third-party stubs always apply.
test.use({ serviceWorkers: 'block' });

test.describe('result card, /id page and download (SR)', () => {
  test.beforeEach(async ({ page }) => {
    await stubThirdParties(page);
  });

  test('SR-090 SR-110 SR-117 SR-118 a click expands the card with its birth and death tables', async ({ page }) => {
    await page.goto(referenceSearch);
    const card = page.getByText(referenceCard).first();
    await card.click();
    const panel = page.locator('.rf-callout').first();
    await expect(panel).toBeVisible();
    await expect(page.getByText('Permalien').first()).toBeVisible();
    await expect(panel.locator('th[scope="colgroup"]', { hasText: 'Naissance' })).toBeVisible();
    await expect(panel.locator('tr', { hasText: 'Commune' }).first()).toContainText('Eysines (33162)');
    await expect(panel.locator('th[scope="colgroup"]', { hasText: 'Décès' })).toBeVisible();
    await expect(panel.locator('tr', { hasText: 'Age' })).toContainText(/\d+ ans/);
    await page.getByText('DUPONT Jean Pierre').first().click();
    await expect(page.locator('.rf-callout')).toHaveCount(0);
  });

  test('SR-119 the "Source INSEE" cell links to the data.gouv file', async ({ page }) => {
    await page.goto(`${referenceSearch}&view=card-expand`);
    const source = page.locator('a[title^="source INSEE"]').first();
    await expect(source).toBeVisible();
    await expect(source).toHaveText(/^fichier \d{4}-m\d{2}$/);
    await expect(source).toHaveAttribute('target', '_blank');
    await expect(page.locator('tr', { hasText: 'Source INSEE' }).first()).toContainText(/ligne n°\d+/);
  });

  test('SR-097 SR-122 a record with Wikidata links shows the thumbnail and the wiki links', async ({ page }) => {
    await injectWikidataLinks(page, {
      wikidata: 'https://www.wikidata.org/wiki/Q42',
      wikipedia: 'https://fr.wikipedia.org/wiki/Jean_Dupont',
      wikimedia: 'http://commons.wikimedia.org/wiki/Special:FilePath/Jean%20Dupont.jpg',
      label: 'Personnalité de test'
    });
    await page.goto(`${referenceSearch}&view=card-expand`);
    const thumbnail = page.locator('.rf-card__img img[alt^="https://upload.wikimedia.org/wikipedia/commons/thumb/"]').first();
    await expect(thumbnail).toBeVisible();
    await expect(thumbnail).toHaveAttribute('src', /\/80px-Jean_Dupont\.jpg$/);
    await expect(page.getByText('Personnalité de test').first()).toBeVisible();
    const wikipedia = page.getByTitle('lien wikipedia').first();
    await expect(wikipedia).toHaveAttribute('href', 'https://fr.wikipedia.org/wiki/Jean_Dupont');
    await expect(wikipedia).toHaveAttribute('target', '_blank');
    await expect(page.getByTitle('lien wikidata').first()).toHaveAttribute('href', 'https://www.wikidata.org/wiki/Q42');
  });

  test('SR-114 SR-212 SR-213 the permalink opens /id/<id> with the expanded card', async ({ page }) => {
    await page.goto(referenceSearch);
    await page.getByText(referenceCard).first().click();
    const permalink = page.getByTitle('afficher le lien permanent').first();
    const href = await permalink.getAttribute('href');
    expect(href).toMatch(/^\/id\/[^/?#]+$/);
    const idRequest = page.waitForRequest(request => new URL(request.url()).pathname.endsWith(`/api/v1${href}`) && request.method() === 'GET');
    await permalink.click();
    await idRequest;
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator('.rf-card.rf-card--md').first()).toBeVisible();
    await expect(page.getByText('Eysines 03/10/1932 - Pessac 16/01/2020').first()).toBeVisible();
    // on /id the permalink copies the link instead of navigating
    await expect(page.getByTitle('copier le lien permanent').first()).toBeVisible();
  });

  test('SR-214 an unknown id shows "Oups... pas de résultats pour cet identifiant"', async ({ page }) => {
    await page.goto('/id/thisIdDoesNotExist0000');
    await expect(page.getByText('Oups... pas de résultats pour cet identifiant')).toBeVisible();
  });

  test('SR-222 SR-226 the CSV download posts the criteria and saves deces-<VALUES>.csv', async ({ page }) => {
    await page.goto('/search?advanced=true&ln=dupont&dd=2020');
    const icon = page.getByTitle("téléchargez l'ensemble des résultats en tableur CSV");
    await expect(icon).toBeVisible();
    const csvRequest = page.waitForRequest(request =>
      request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/api/v1/search') &&
      (request.headers()['accept'] || '').includes('text/csv'));
    const download = page.waitForEvent('download');
    await icon.click();
    const request = await csvRequest;
    expect(request.postDataJSON()).toMatchObject({ headerLang: 'french', lastName: 'DUPONT', deathDate: '2020' });
    expect((await download).suggestedFilename()).toBe('deces-DUPONT-2020.csv');
    await expect(page.getByTitle('téléchargement terminé')).toBeVisible();
  });

  test('SR-279 the login modal fades in with the favicon and closes', async ({ page }) => {
    await page.goto('/search');
    // the menu opens on hover (a click would toggle it back closed)
    await page.locator('button[aria-controls="rf-admin"]').first().hover();
    await page.locator('#rf-admin a[title="S\'identifier"]').first().click();
    const modal = page.locator('.modal').filter({ has: page.getByRole('heading', { name: 'Connexion' }) });
    await expect(modal).toBeVisible();
    await expect(modal.getByAltText('login')).toHaveAttribute('src', '/favicon.svg');
    await modal.locator('.rf-card div[style*="right:26px"], .rf-card div[style*="right: 26px"]').first().click();
    await expect(modal).toHaveCount(0);
  });

  test('SR-147 (unit only) correction submission is covered by unit tests', async () => {
    test.skip(true, 'Writes to the shared backend and needs an OTP login: covered by test/unit/search/ResultCard.edit.test.js');
  });
});
