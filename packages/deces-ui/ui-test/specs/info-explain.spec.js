// @ts-check
// Inventory zone IN: /explain page (AlgoDetails.svelte).
const { test, expect } = require('@playwright/test');
const { stubVersion } = require('../helpers/info-common');

// page.route() does not see requests answered by a service worker: keep the
// app service worker (public/sw.js) out of the way of the stubs.
test.use({ serviceWorkers: 'block' });

const explainResult = {
  score: 0.856,
  name: { score: 0.9, first: 1, last: 0.9 },
  sex: 1,
  birthDate: 1,
  birthLocation: { score: 1, city: 1 }
};

const isCompare = (request) => request.url().endsWith('/deces/api/v1/compare') && request.method() === 'POST';
const diagram = (page) => page.locator('svg[viewBox^="0 0 137.94624"]');

test.describe('explain page', () => {
  test.beforeEach(async ({ page }) => {
    await stubVersion(page);
  });

  test('IN-164 /explain renders AlgoDetails standalone', async ({ page }) => {
    await page.goto('/explain');
    await expect(page).toHaveTitle('matchID - Explication de l\'algorithme');
    await expect(page.getByRole('heading', { level: 3, name: 'Appariement sur deces.matchid.io, explications' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 4 })).toHaveText([
      'Recherche des identités', 'Scoring', 'Mise au point et évaluation', 'Interface de validation intelligente'
    ]);
    await expect(page.locator('input#ln')).toHaveCount(2);
    await expect(page.locator('input#ln').nth(0)).toHaveValue('pompidous');
    await expect(page.locator('input#ln').nth(1)).toHaveValue('Pompidou');
  });

  test('IN-170 / IN-172 the compare request (explain) is sent after mount and the backend score is drawn', async ({ page }) => {
    const request = page.waitForRequest(isCompare);
    const response = page.waitForResponse(r => isCompare(r.request()));
    await page.goto('/explain');
    const body = (await request).postDataJSON();
    expect(body).toEqual({
      personA: { lastName: 'pompidous', firstName: 'georges', birthDate: '01/11/1969' },
      personB: { lastName: 'Pompidou', firstName: 'Georges', sex: 'M', birthDate: '01/11/1969' },
      params: { dateFormatA: 'dd/MM/yyyy', dateFormatB: 'dd/MM/yyyy', explain: true }
    });
    expect((await response).ok()).toBe(true);
    await expect(diagram(page).getByText('score', { exact: true })).toBeVisible();
    await expect(diagram(page).getByText(/^\d+%$/).first()).toBeVisible();
  });

  test('IN-171 / IN-173 typing in identity B re-runs the compare and redraws the diagram', async ({ page }) => {
    let calls = 0;
    await page.route('**/deces/api/v1/compare', route => {
      calls += 1;
      const result = calls === 1 ? explainResult : { ...explainResult, score: 0.42, name: { score: 0.5, first: 1, last: 0.5 } };
      return route.fulfill({ json: result });
    });
    await page.goto('/explain');
    await expect(diagram(page).getByText('85%', { exact: true })).toBeVisible();
    await page.locator('input#ln').nth(1).fill('Pompidoux');
    await expect(diagram(page).getByText('42%', { exact: true })).toBeVisible();
    await expect(diagram(page).getByText('Nom: 50%')).toBeVisible();
    expect(calls).toBe(2);
  });

  test('IN-167 the validation UI screenshot points to matchid.io', async ({ page }) => {
    await page.route('**/deces/api/v1/compare', route => route.fulfill({ json: explainResult }));
    await page.goto('/explain');
    await expect(page.getByAltText('valider l\'appariement'))
      .toHaveAttribute('src', 'https://matchid.io/assets/images/deces-ui-link-validate.png');
  });
});
