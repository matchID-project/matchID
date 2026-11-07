// @ts-check
// Login modal (header), API key and /edits, zone LK. No bulk submission.
const { test, expect } = require('@playwright/test');
const { getOtp } = require('../helpers/maildev');
const { apiPath, uniqueEmail, loginByApi, seedSession } = require('../helpers/link-session');

const modal = (page) => page.locator('.modal');
const modalTitle = (page) => modal(page).locator('h4');
// the close icon (style="position:absolute;top:26px;right:26px"): Svelte 3 serialised
// the style attribute with spaces, Svelte 5 keeps it as written
const closeModal = (page) => modal(page).locator('div[style*="right: 26px"], div[style*="right:26px"]').first().click();
const adminEntry = async (page, title) => {
  await page.locator('button[aria-controls="rf-admin"]').hover();
  return page.locator(`#rf-admin a[title="${title}"]`);
};

test.describe('login, API key and edits', () => {
  test('LK-162..LK-195 header login modal with an emailed code, session restore, API key, /edits and logout', async ({ page }) => {
    test.setTimeout(120_000);
    const email = uniqueEmail('auth');

    await test.step('LK-162 "S\'identifier" opens the Connexion modal', async () => {
      await page.goto('/search');
      await (await adminEntry(page, 'S\'identifier')).click();
      await expect(modalTitle(page)).toHaveText('Connexion');
    });

    await test.step('LK-163 leaving the email field registers it and shows the backend message in green', async () => {
      const register = page.waitForResponse(r => r.url().endsWith('/register') && r.request().method() === 'POST');
      await modal(page).locator('input#email').fill(email);
      await modal(page).locator('input#email').blur();
      expect((await register).ok()).toBe(true);
      await expect(modal(page).locator('p.rf-valid-text')).toBeVisible();
    });

    const code = await getOtp(email);

    await test.step('LK-169 a wrong code shows "Mauvais courriel ou code d\'accès"', async () => {
      await modal(page).locator('input#token').fill(code === '000000' ? '111111' : '000000');
      await modal(page).getByText('Se connecter').click();
      await expect(modal(page).getByText('Mauvais courriel ou code d\'accès')).toBeVisible();
    });

    await test.step('LK-168 / LK-170 the mailed code logs in: "Connecté en tant que <email>"', async () => {
      await modal(page).locator('input#token').fill(code);
      await modal(page).getByText('Se connecter').click();
      await expect(modal(page).getByText(`Connecté en tant que ${email}`)).toBeVisible();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('user') || 'null'))).toBe(email);
      await closeModal(page);
      await expect(modal(page)).toHaveCount(0);
    });

    await test.step('LK-191 the "API Key" entry shows the token and its dates', async () => {
      await (await adminEntry(page, 'API Key')).click();
      await expect(modalTitle(page)).toHaveText('API Key');
      await expect(modal(page).locator('input[readonly]')).toHaveValue(/^[\w-]+\.[\w-]+\.[\w-]+$/);
      await expect(modal(page)).toContainText('Date de création');
      await expect(modal(page)).not.toContainText('Invalid Date');
      await modal(page).getByText('Fermer').click();
      await expect(modal(page)).toHaveCount(0);
    });

    await test.step('LK-173 the session survives a reload', async () => {
      const refresh = page.waitForRequest(r => r.url().includes('/auth?refresh=true'));
      await page.reload();
      expect((await refresh).headers().authorization).toMatch(/^Bearer /);
      const entry = await adminEntry(page, 'Se déconnecter');
      await expect(entry).toHaveCount(1);
    });

    await test.step('LK-195 /edits lists the edits of the logged-in user (GET /updated)', async () => {
      const updated = page.waitForResponse(r => r.url().endsWith(`${apiPath}/updated`));
      await page.goto('/edits');
      expect((await updated).ok()).toBe(true);
      await expect(page.getByText('Liste des éditions')).toBeVisible();
      await expect(page.getByText('Aucune donnée')).toBeVisible();
      await expect(modal(page)).toHaveCount(0);
    });

    await test.step('LK-170 "Se déconnecter" logs out', async () => {
      await (await adminEntry(page, 'Se déconnecter')).click();
      await expect(modal(page).getByText(`Connecté en tant que ${email}`)).toBeVisible();
      await modal(page).getByRole('button', { name: /Se déconnecter/ }).click();
      await expect(modal(page).locator('input#email')).toBeVisible();
      await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken'))).toBe('""');
    });

    await test.step('LK-172 /edits without user opens the login modal automatically', async () => {
      await page.goto('/edits');
      await expect(modalTitle(page)).toHaveText('Connexion');
      await expect(page.getByText('Liste des éditions')).toHaveCount(0);
    });
  });

  test('LK-199 / LK-200 an edit expands on click (URL hash) and from a /edits#<id> deep link (edit list stubbed)', async ({ page, request }) => {
    const email = uniqueEmail('edits');
    const { token } = await loginByApi(request, email);
    // a real person from the reference data, with one pending modification
    const search = await request.get(`${apiPath}/search?deathDate=2020&lastName=dupont&firstName=jean&deathDepartment=33&fuzzy=false`);
    const person = (await search.json()).response.persons[0];
    expect(person && person.id).toBeTruthy();
    const edit = {
      ...person,
      modifications: [{ date: '2026-01-02T10:00:00', auth: 0, author: email, fields: { firstName: 'Jean' }, proof: '', message: 'test' }]
    };
    await page.route(`**${apiPath}/updated`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([edit]) }));
    await seedSession(page, { token, email });

    await test.step('LK-199 a click toggles the expansion and the URL hash', async () => {
      await page.goto('/edits');
      await expect(page.getByText('Liste des éditions')).toBeVisible();
      const row = page.locator('tbody > tr').first();
      await expect(row.locator(':scope > td')).toHaveCount(3);
      await row.locator('.rf-card').first().click({ position: { x: 10, y: 10 } });
      await expect(page).toHaveURL(new RegExp(`#${person.id}$`));
      await expect(row.locator(':scope > td')).toHaveCount(1);
      await expect(row.locator(':scope > td').first()).toHaveAttribute('colspan', '3');
      await row.locator('.rf-card').first().click({ position: { x: 10, y: 10 } });
      await expect(page).not.toHaveURL(/#/);
      await expect(row.locator(':scope > td')).toHaveCount(3);
    });

    await test.step('LK-200 /edits#<id> opens with the record expanded', async () => {
      // a full page load (a hash-only goto would be a same-document navigation)
      await page.goto('/about');
      await page.goto(`/edits#${person.id}`);
      await expect(page.locator('tbody > tr').first().locator(':scope > td')).toHaveCount(1);
    });
  });
});
