// @ts-check
// Bulk matching (/link) failures and empty results, zone LK. Two real job
// submissions (LK-101, LK-114); the 429 "running job" answer is stubbed.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { uniqueEmail, loginByApi, seedSession, dropFile, waitForJobEnd } = require('../helpers/link-session');

const fixture = (name) => fs.readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8');
const field = (page, name) => page.locator(`input[list="LinkSampleTable"][name="${name}"]`).first();
const stepCard = (page, n, title) => page.locator('div.rf-callout', { has: page.locator(`p strong:text-is("Étape ${n}. ${title}")`) });

// Logged-in user on /link with `file` dropped and 3 fields mapped.
async function prepare(page, request, tag, file, columns) {
  const email = uniqueEmail(tag);
  const { token } = await loginByApi(request, email);
  await seedSession(page, { token, email });
  await page.goto('/link');
  await dropFile(page, file, fixture(file));
  await expect(page.getByText('Choisissez les champs à apparier:')).toBeVisible();
  await field(page, 'Nom').fill(columns.lastName);
  await field(page, 'Prénom(s)').fill(columns.firstName);
  await field(page, 'Date').fill(columns.birthDate);
  const valider = page.locator('button.rf-btn:has-text("Valider")').first();
  await expect(valider).toBeEnabled();
  return valider;
}

test.describe('bulk matching errors (/link)', () => {
  test('LK-101 / LK-099 a CSV row with extra columns fails the job with the column header mismatch message', async ({ page, request }) => {
    test.setTimeout(150_000);
    const valider = await prepare(page, request, 'ragged', 'link-ragged.csv', { lastName: 'Nom', firstName: 'Prenom', birthDate: 'Date' });
    await valider.click();
    expect(await waitForJobEnd(page)).toBe('failed');
    await expect(page.getByText('Le traitement a échoué', { exact: true })).toBeVisible();
    await expect(page.getByText('Erreur 400')).toBeVisible();
    await expect(page.getByText('le nombre de colonnes n\'est pas conforme à l\'entête CSV')).toBeVisible();
    await expect(stepCard(page, 3, 'Traitement')).toContainText('le traitement a échoué');
    await expect(stepCard(page, 3, 'Traitement')).toHaveClass(/rf-text--error/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('linkJob') || 'null'))).toBe('failed');
  });

  test('LK-114 a file without any deceased person shows the empty result message', async ({ page, request }) => {
    test.setTimeout(150_000);
    const valider = await prepare(page, request, 'nobody', 'link-nobody.csv', { lastName: 'nom', firstName: 'prenom', birthDate: 'naissance' });
    await valider.click();
    expect(await waitForJobEnd(page)).toBe('empty');
    await expect(page.getByText('Aucune correspondance de personne décédée n\'a été trouvée dans votre fichier.')).toBeVisible();
    await expect(page.getByText('Téléchargez:')).toHaveCount(0);
  });

  test('LK-102 a 429 "already running" answer links to /jobs (backend answer stubbed)', async ({ page, request }) => {
    await page.route('**/deces/api/v1/search/csv', route => (route.request().method() === 'POST'
      ? route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ msg: 'There is already 1 running or waiting jobs' }) })
      : route.continue()));
    const valider = await prepare(page, request, 'busy', 'link-nobody.csv', { lastName: 'nom', firstName: 'prenom', birthDate: 'naissance' });
    await valider.click();
    await expect(page.getByText('Erreur 429')).toBeVisible();
    await expect(page.getByText('vous avez déja un traitement en cours')).toBeVisible();
    await page.getByRole('link', { name: 'consulter les traitements' }).click();
    await expect(page).toHaveURL(/\/jobs$/);
    await expect(page.getByText('Liste des traitements')).toBeVisible();
  });
});
