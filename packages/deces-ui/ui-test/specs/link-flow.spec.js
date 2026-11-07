// @ts-check
// Bulk matching (/link) end to end, zone LK of the Svelte 5 migration
// inventory. ONE job submission for the whole file (nginx allows 4 bulk
// submissions per minute for the suite).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { getOtp } = require('../helpers/maildev');
const { uniqueEmail, seedSession, dropFile, waitForJobEnd } = require('../helpers/link-session');

const csvFile = path.join(__dirname, '..', 'fixtures', 'wikidata-deces-2020-m01.csv');
const csv = fs.readFileSync(csvFile, 'utf8');
const csvLines = csv.split(/\r?\n/).filter(l => l).length;

const field = (page, name) => page.locator(`input[list="LinkSampleTable"][name="${name}"]`).first();
const fieldGroup = (page, name) => page.locator('.rf-input-group', { has: field(page, name) });
const columnTile = (page, col) => page.locator('div[draggable="true"]', { has: page.locator('th', { hasText: new RegExp(`^${col}$`) }) });
const stepCard = (page, n) => page.locator('div.rf-callout', { has: page.locator(`p strong:text-is("Étape ${n}. ${['Fichier', 'Configuration', 'Traitement', 'Validez'][n - 1]}")`) });
const tableRoot = (page, title) => page.locator(`p:has(strong:text-matches("identités ${title} :"))`).locator('xpath=..');
const count = async (page, title) => {
  const strong = page.locator(`p strong:text-matches("identités ${title} :")`);
  if (!(await strong.count())) return 0;
  return Number((await strong.first().innerText()).match(/^(\d+)/)?.[1]);
};

test.describe('bulk matching flow (/link)', () => {
  test('LK-001..LK-208 file, mapping, OTP login, job, validation, downloads, /jobs and reset', async ({ page, browser }) => {
    test.setTimeout(240_000);
    const email = uniqueEmail('flow');

    await test.step('LK-001 the page shows "Appariement" and the 4 steps', async () => {
      await page.goto('/link');
      await expect(page.locator('strong', { hasText: /^\s*Appariement\s*$/ })).toBeVisible();
      for (const n of [1, 2, 3, 4]) await expect(stepCard(page, n)).toHaveCount(1);
      await expect(stepCard(page, 1)).toContainText('Glissez un fichier au format CSV ou Gedcom ici');
    });

    await test.step('LK-028 / LK-010 dropping the CSV moves to step 2 and labels step 1 with the file name and size', async () => {
      await dropFile(page, 'wikidata.csv', csv);
      await expect(page.getByText('Étape 2', { exact: true })).toBeVisible();
      await expect(stepCard(page, 1)).toContainText('wikidata.csv');
      await expect(stepCard(page, 1)).toContainText(/\d+(\.\d)?Mo/);
    });

    await test.step('LK-023 / LK-051 step 2 shows the configuration form and the sample columns', async () => {
      await expect(page.getByText('Choisissez les champs à apparier:')).toBeVisible();
      await expect(columnTile(page, 'firstnameLabel')).toBeVisible();
      await expect(page.locator('input[list="LinkSampleTable"]')).toHaveCount(15);
    });

    await test.step('LK-070 a click on a field clears its association', async () => {
      await field(page, 'Prénom(s)').fill('personLabel');
      await expect(field(page, 'Prénom(s)')).toHaveValue('personLabel');
      await fieldGroup(page, 'Prénom(s)').click();
      await expect(field(page, 'Prénom(s)')).toHaveValue('');
    });

    await test.step('LK-046 / LK-068 dragging a column tile onto a field maps it', async () => {
      await columnTile(page, 'firstnameLabel').dragTo(fieldGroup(page, 'Prénom(s)'));
      await expect(field(page, 'Prénom(s)')).toHaveValue('firstnameLabel');
    });

    await test.step('LK-067 typing a column name maps it', async () => {
      await field(page, 'Nom').fill('lastnameLabel');
      await expect(field(page, 'Nom')).toHaveValue('lastnameLabel');
      await expect(fieldGroup(page, 'Nom')).toHaveClass(/rf-input-group--valid/);
    });

    await test.step('LK-057 not logged in: RGPD message and the inline email login', async () => {
      await expect(page.getByText('Pour des raisons de traçabilité et conformité RGPD')).toBeVisible();
      await expect(page.locator('button.rf-btn:has-text("Valider")')).toHaveCount(0);
    });

    let code = '';
    await test.step('LK-180 / LK-184 submitting the email registers it and shows the OTP stage', async () => {
      const register = page.waitForResponse(r => r.url().endsWith('/register') && r.request().method() === 'POST');
      await page.locator('input[type="email"]#email').fill(email);
      await page.locator('button[title="Valider le courriel"]').click();
      expect((await register).ok()).toBe(true);
      await expect(page.locator('input#emailOTP')).toBeVisible();
      await expect(page.getByText('Code de validation')).toBeVisible();
      code = await getOtp(email);
    });

    await test.step('LK-188 a wrong OTP shows "Le code d\'accès n\'est pas valide"', async () => {
      const wrong = code === '000000' ? '111111' : '000000';
      const auth = page.waitForResponse(r => r.url().endsWith('/auth') && r.request().method() === 'POST');
      await page.locator('input#emailOTP').fill(wrong);
      await page.locator('button[title="Valider pour s\'identifier"]').click();
      expect((await auth).status()).toBe(401);
      await expect(page.getByText('Le code d\'accès n\'est pas valide')).toBeVisible();
    });

    await test.step('LK-186 the mailed OTP logs the user in', async () => {
      await page.locator('input#emailOTP').fill(code);
      await page.locator('button[title="Valider pour s\'identifier"]').click();
      await expect(page.getByText('Vous êtes identifié(e), vous pouvez poursuivre l\'appariement')).toBeVisible();
    });

    await test.step('LK-061 / LK-087 Valider uploads the file with the mapping (multipart, bearer)', async () => {
      const upload = page.waitForRequest(r => r.url().endsWith('/search/csv') && r.method() === 'POST');
      await page.locator('button.rf-btn:has-text("Valider")').first().click();
      const request = await upload;
      expect(request.headers().authorization).toMatch(/^Bearer \S+/);
      // Chromium does not expose multipart bodies holding a file: the mapping
      // sent is checked on the server side through /jobs (LK-152) instead.
      expect(request.headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/);
      await expect(page.getByText('Étape 3', { exact: true })).toBeVisible();
    });

    await test.step('LK-019 reloading while processing restores the session (not back to step 1)', async () => {
      await page.waitForFunction(() => !!localStorage.getItem('linkJob'));
      await page.reload();
      await expect(stepCard(page, 1)).toContainText('wikidata.csv');
      await expect(page.getByText('Glissez un fichier au format CSV')).toHaveCount(0);
    });

    await test.step('LK-015 / LK-208 the job ends on step 4 with the matched rows', async () => {
      expect(await waitForJobEnd(page)).toBe('results');
      await expect(page.getByText('Étape 4', { exact: true })).toBeVisible();
      await expect(page.getByText('Costes').first()).toBeVisible();
      await expect(stepCard(page, 3)).toContainText(/\d+\/\d+ identifications potentielles/);
    });

    await test.step('LK-124 the Statistiques panel opens', async () => {
      await page.locator('a[href="#statistiques"]').click();
      await expect(page.getByText('Statistiques d\'appariement')).toBeVisible();
      await expect(page.getByText('Taux d\'appariement brut')).toBeVisible();
      await page.locator('a[href="#statistiques"]').click();
      await expect(page.getByText('Statistiques d\'appariement')).toHaveCount(0);
    });

    await test.step('LK-125 with a 100 % auto-validation threshold every identity is "à valider"', async () => {
      await page.locator('a[href="#options"]').click();
      await expect(page.getByText('Paramètres de validation')).toBeVisible();
      await page.locator('#autoCheckThreshold').fill('1');
      await expect(page.locator('p strong:text-matches("identités à valider :")')).toBeVisible();
      await expect(page.locator('p strong:text-matches("identités validées :")')).toHaveCount(0);
      await page.locator('a[href="#options"]').click();
    });

    await test.step('LK-134 clicking a row of the master table selects it', async () => {
      // the current selection may be a group beyond the 5 displayed ones
      const first = await tableRoot(page, 'à valider').locator('table[style*="border-right"] tr:has(td.hcenter)').first().elementHandle();
      expect(first).not.toBeNull();
      await (await first.$('td.hcenter'))?.click();
      await expect.poll(() => first.evaluate(tr => tr.classList.contains('rf-inactive'))).toBe(false);
    });

    await test.step('LK-136 / LK-140 validating the selected group moves it to "validées"', async () => {
      const before = await count(page, 'à valider');
      expect(before).toBeGreaterThan(1);
      const scoreTable = tableRoot(page, 'à valider').locator('table[style*="border-right"]');
      // the master table auto-selects its first group: all its candidates are highlighted
      const selected = scoreTable.locator('tr:has(td.hcenter):not(.rf-inactive)');
      await expect(selected.first()).toBeVisible();
      const candidates = await selected.count();
      expect(candidates).toBeGreaterThan(0);
      for (let i = 0; i < candidates; i++) {
        await selected.locator('span.rf-fi-checkbox-line:not(.rf-color--bf)').first().click();
      }
      await expect(page.locator('p strong:text-matches("identités validées :")')).toBeVisible();
      expect(await count(page, 'à valider')).toBeLessThan(before);
      await expect(tableRoot(page, 'validées').locator('span.rf-fi-checkbox-line.rf-color--bf').first()).toBeVisible();
    });

    await test.step('LK-137 invalidating the selected row marks it invalid (red)', async () => {
      const selected = tableRoot(page, 'à valider').locator('table[style*="border-right"] tr:has(td.hcenter):not(.rf-inactive)').first();
      await selected.locator('span.rf-fi-close-circle-line').click();
      await expect(page.locator('span.rf-fi-close-circle-line.rf-color--rm').first()).toBeVisible();
    });

    await test.step('LK-144 validations survive a reload', async () => {
      const toCheck = await count(page, 'à valider');
      const checked = await count(page, 'validées');
      await page.reload();
      expect(await waitForJobEnd(page)).toBe('results');
      await expect.poll(() => count(page, 'validées')).toBe(checked);
      expect(await count(page, 'à valider')).toBe(toCheck);
    });

    let completeLines = 0;
    await test.step('LK-117 downloads the complete file <base>_deces_INSEE_complete.csv', async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTitle('télécharger le fichier complet').click()
      ]);
      expect(download.suggestedFilename()).toBe('wikidata_deces_INSEE_complete.csv');
      const lines = fs.readFileSync(await download.path(), 'utf8').split('\r\n').filter(l => l);
      expect(lines[0]).toMatch(/,valid,checked$/);
      expect(lines.length).toBeGreaterThanOrEqual(csvLines);
      completeLines = lines.length;
    });

    await test.step('LK-118 downloads the matched rows <base>_deces_INSEE_matched.csv', async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTitle('télécharger les décès identifiés').click()
      ]);
      expect(download.suggestedFilename()).toBe('wikidata_deces_INSEE_matched.csv');
      const content = fs.readFileSync(await download.path(), 'utf8');
      expect(content).toContain('Costes');
      const lines = content.split('\r\n').filter(l => l);
      expect(lines[0]).toMatch(/,valid,checked$/);
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.length).toBeLessThan(completeLines);
    });

    const key = await page.evaluate(() => JSON.parse(localStorage.getItem('linkJob') || 'null'));
    const token = await page.evaluate(() => JSON.parse(localStorage.getItem('accessToken') || 'null'));

    await test.step('LK-152 / LK-155 /jobs lists the job with a link to /link?job=<key>', async () => {
      await page.goto('/jobs');
      await expect(page.getByText('Liste des traitements')).toBeVisible();
      const link = page.locator(`a[href="/link?job=${key}"]`);
      await expect(link).toBeVisible();
      const row = page.locator('tbody tr', { has: link });
      await expect(row).toContainText('succès');
      // lastName, birthDate (+ firstName, not counted: validColumns) were sent
      await expect(row.locator('td').nth(6)).toHaveText(/^[1-9]\d*$/);
    });

    await test.step('LK-020 / LK-098 the /link?job= deep link restores the job from the server in a fresh browser', async () => {
      const context = await browser.newContext();
      try {
        await seedSession(context, { token, email });
        const fresh = await context.newPage();
        await fresh.goto(`/link?job=${key}`);
        expect(await waitForJobEnd(fresh)).toBe('results');
        await expect(fresh.getByText('Costes').first()).toBeVisible();
        expect(await fresh.evaluate(() => JSON.parse(localStorage.getItem('linkFileName') || 'null'))).toMatch(/\.csv$/);
      } finally {
        await context.close();
      }
    });

    await test.step('LK-017 the trash icon resets everything back to step 1', async () => {
      await page.goto('/link');
      expect(await waitForJobEnd(page)).toBe('results');
      await page.locator('a[href="#reset"]').click();
      await expect(page.getByText('Glissez un fichier au format CSV ou Gedcom ici')).toBeVisible();
      await expect.poll(() => page.evaluate(() => localStorage.getItem('linkJob'))).toBeNull();
      await expect(page).not.toHaveURL(/job=/);
    });
  });
});
