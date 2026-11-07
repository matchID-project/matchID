// @ts-check
// Inventory zone IN: /about and /notFound pages (Default.svelte + Info.svelte)
// and the filtered FAQ shown on empty search / unknown id pages.
const { test, expect } = require('@playwright/test');
const { stubStats } = require('../helpers/info-stats');
const { stubVersion, versionPayload } = require('../helpers/info-common');

// page.route() does not see requests answered by a service worker: keep the
// app service worker (public/sw.js) out of the way of the stubs.
test.use({ serviceWorkers: 'block' });

const card = (page, id) => page.locator(`[id="${id}"] .rf-card`);
const callout = (page, id) => page.locator(`[id="${id}"] .rf-callout`);
const cards = (page) => page.locator('.rf-card .rf-text--lg');

test.describe('about / FAQ', () => {
  test.beforeEach(async ({ page }) => {
    await stubVersion(page);
  });

  test('IN-058 /about shows the "À propos" title, the document title and the full FAQ', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { level: 2, name: 'À propos' })).toBeVisible();
    await expect(page).toHaveTitle('matchID - À propos');
    await expect(page.getByPlaceholder('Rechercher dans les questions')).toBeVisible();
    await expect(cards(page)).toHaveCount(15);
  });

  test('IN-059 / IN-060 an unknown path is replaced by /notFound with the 404 title and the full FAQ', async ({ page }) => {
    await page.goto('/une-page-inconnue');
    await expect(page).toHaveURL(/\/notFound$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Pas de page à l\'adresse indiquée' })).toBeVisible();
    await expect(page).toHaveTitle('matchID - 404 - Pas de page à l\'adresse indiquée');
    await expect(cards(page)).toHaveCount(15);
  });

  test('IN-065 the 15 sections are listed in a fixed order', async ({ page }) => {
    await page.goto('/about');
    await expect(cards(page)).toHaveText([
      'À qui s\'adresse le service ?',
      'Qui sommes nous ?',
      'Merci pour votre soutien !',
      'D\'où proviennent les données ?',
      'Quelles sont les garanties sur les données ?',
      'Données personnelles',
      'Comment sont indexées les données ?',
      'Décès manquant',
      'Données erronnées',
      'Signaler un bug',
      'Suggérer des améliorations du service',
      'Développeurs, utilisez l\'API',
      'Algorithme de rapprochement d\'identités',
      'Code open source',
      'Statistiques de consultation'
    ]);
  });

  test('IN-064 / IN-069 the FAQ search filters the sections', async ({ page }) => {
    await page.goto('/about');
    await page.getByPlaceholder('Rechercher dans les questions').fill('swagger');
    await expect(cards(page)).toHaveText(['Développeurs, utilisez l\'API']);
    await page.getByPlaceholder('Rechercher dans les questions').fill('');
    await expect(cards(page)).toHaveCount(15);
  });

  test('IN-067 a search without result shows the filtered FAQ (3 sections)', async ({ page }) => {
    await page.goto('/search?advanced=true&fuzzy=false&ln=zzyzxqwvk&fn=qqqwwwzzz');
    await expect(page.getByText('Oups... pas de résultats pour votre recherche')).toBeVisible();
    await expect(cards(page)).toHaveText(['Merci pour votre soutien !', 'Décès manquant', 'Signaler un bug']);
    await expect(page.getByPlaceholder('Rechercher dans les questions')).toHaveCount(0);
  });

  // Real behaviour on the CI stack (deces-2020-m01, CI run 42390422527): the
  // API answers 400 (HTML body) for an unknown id, runRequest turns it into a
  // fake {error: true} person, ShowId takes it as a result, then ResultCard
  // and toString() throw "Cannot read properties of undefined (reading
  // 'last')": $wasSearched is never set and the page stays on
  // "Recherche en cours" (ShowId.svelte:41-52, runRequest.js:30-50). The "Oups" branch itself is
  // covered by the unit test test/unit/info/ShowId.test.js.
  test('IN-068 an unknown id currently stays on "Recherche en cours" (pinned BUG)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const idResponse = page.waitForResponse(r => /\/deces\/api\/v1\/id\/this-id-does-not-exist$/.test(r.url()));
    await page.goto('/id/this-id-does-not-exist');
    expect((await idResponse).status()).toBeGreaterThanOrEqual(400);
    await expect(page.getByText('Recherche en cours')).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(page.getByText('Recherche en cours')).toBeVisible();
    await expect(page.getByText('Oups... pas de résultats pour cet identifiant')).toHaveCount(0);
    expect(errors.some(message => /reading 'last'/.test(message))).toBe(true);
  });

  // BUG: see above; expected behaviour once ShowId handles the error person.
  test.fixme('IN-068 BUG: an unknown id shows the "Oups" message and the filtered FAQ', async ({ page }) => {
    await page.goto('/id/this-id-does-not-exist');
    await expect(page.getByText('Oups... pas de résultats pour cet identifiant')).toBeVisible();
    await expect(cards(page)).toHaveText(['Merci pour votre soutien !', 'Décès manquant', 'Signaler un bug']);
  });

  test('IN-072 / IN-073 / IN-074 / IN-075 / IN-076 opening and closing a section', async ({ page }) => {
    await page.goto('/about');
    await card(page, 'qui-sommes-nous').click();
    await expect(callout(page, 'qui-sommes-nous')).toBeVisible();
    await expect(callout(page, 'qui-sommes-nous')).toContainText('Le projet matchID a été initié');
    await expect(page).toHaveURL(/\/about#qui-sommes-nous$/);
    await expect(card(page, 'qui-sommes-nous')).toHaveClass(/rf-card--left-arrow/);

    await card(page, 'code-open-source').click();
    await expect(callout(page, 'code-open-source')).toBeVisible();
    await expect(callout(page, 'qui-sommes-nous')).toHaveCount(0);
    await expect(page).toHaveURL(/\/about#code-open-source$/);

    await card(page, 'code-open-source').click();
    await expect(callout(page, 'code-open-source')).toHaveCount(0);
    await expect(page).toHaveURL(/\/about$/);
  });

  test('IN-077 a deep link /about#donnees-personnelles opens that section', async ({ page }) => {
    await page.goto('/about#donnees-personnelles');
    await expect(callout(page, 'donnees-personnelles')).toBeVisible();
    await expect(callout(page, 'donnees-personnelles')).toContainText('article 85 loi CNIL');
    await expect(page.locator('.rf-callout')).toHaveCount(1);
  });

  test('IN-085 / IN-094 the data and bug sections show the /version figures', async ({ page }) => {
    await page.goto('/about#d-ou-proviennent-les-donnees');
    await expect(callout(page, 'd-ou-proviennent-les-donnees'))
      .toContainText(`le fichier comporte ${versionPayload.uniqRecordsCount} décès et 44 doublons (stricts)`);
    await expect(callout(page, 'd-ou-proviennent-les-donnees')).toContainText(`jusqu'au ${versionPayload.lastRecordDate}`);
    await card(page, 'signaler-un-bug').click();
    await expect(callout(page, 'signaler-un-bug')).toContainText(`-api/${versionPayload.backend}`);
  });

  test('IN-096 the API section embeds the matchid.io API documentation iframe', async ({ page }) => {
    await page.goto('/about#developpeurs-utilisez-l-api');
    const iframe = callout(page, 'developpeurs-utilisez-l-api').locator('iframe');
    await expect(iframe).toHaveAttribute('src', 'https://matchid.io/link-api');
    await expect(iframe).toHaveAttribute('title', 'documentation de l\'api');
  });

  test('IN-097 the algorithm section embeds AlgoDetails, which calls the compare API', async ({ page }) => {
    const compare = page.waitForRequest(request => request.url().endsWith('/deces/api/v1/compare') && request.method() === 'POST');
    await page.goto('/about#algorithme-de-rapprochement-d-identites');
    await expect(callout(page, 'algorithme-de-rapprochement-d-identites').getByRole('heading', { level: 3 }))
      .toHaveText('Appariement sur deces.matchid.io, explications');
    expect((await compare).postDataJSON().params.explain).toBe(true);
  });

  test('IN-099 the stats section embeds Stats; the source is appended to the hash', async ({ page }) => {
    await stubStats(page);
    await page.goto('/about#statistiques-de-consultation');
    await expect(callout(page, 'statistiques-de-consultation').getByText('Statistiques de consultation')).toBeVisible();
    await expect(page).toHaveURL(/\/about#statistiques-de-consultation\?source=day&scope=today$/);
  });

  // BUG: any key on a focused card (Tab included) toggles the section and is
  // prevented (Info.svelte:26): keyboard users are trapped on the first card.
  test.fixme('IN-079 BUG: Tab moves the focus from one card icon to the next without toggling', async ({ page }) => {
    await page.goto('/about');
    await page.locator('[id="a-qui-s-adresse-le-service"] a.rf-fi__link').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('[id="qui-sommes-nous"] a.rf-fi__link')).toBeFocused();
    await expect(page.locator('.rf-callout')).toHaveCount(0);
  });

  // BUG (Firefox only): the delayed smooth scroll calls the svelte-scrolling
  // action as a function and throws "scrollTo require a options"
  // (Info.svelte:500-504). The CI project is Chromium only.
  test('IN-078 BUG: opening a section in Firefox scrolls to it without a page error', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Firefox-only code path; the CI project runs Chromium');
    test.fail(true, 'BUG: svelte-scrolling scrollTo misuse throws in the timeout');
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/about');
    await card(page, 'code-open-source').click();
    await page.waitForTimeout(600);
    expect(errors).toEqual([]);
  });
});
