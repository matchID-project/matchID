// @ts-check
const { test, expect } = require('@playwright/test');
const { stubThirdParties, recordApiRequests, referenceSearch, referenceCard } = require('../helpers/search-stubs');

// page.route() does not see requests handled by the service worker: block it
// so that the third-party stubs always apply.
test.use({ serviceWorkers: 'block' });

const datePlaceholder = '1970-1980 ou 1974 ou 04/02/1974';

test.describe('search form (SR)', () => {
  test.beforeEach(async ({ page }) => {
    await stubThirdParties(page);
  });

  // Implicit submission (Enter) only exists in simple mode: the advanced form
  // has several text fields and no submit button outside the agg view.
  test('SR-014 Enter submits the search without reloading the page', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('#q')).toBeVisible();
    await page.evaluate(() => { window['sr014'] = 'same document'; });
    const searches = recordApiRequests(page);
    await page.locator('#q').fill('dupont');
    await page.locator('#q').press('Enter');
    await expect.poll(() => searches.some(body => body.q === 'dupont')).toBe(true);
    await expect(page.getByText(/^Résultats/).first()).toBeVisible();
    expect(await page.evaluate(() => window['sr014'])).toBe('same document');
    await expect(page).toHaveURL(/\/search\?q=dupont$/);
  });

  test('SR-016 the eraser clears every field', async ({ page }) => {
    await page.goto(referenceSearch);
    await expect(page.getByPlaceholder('Pompidou', { exact: true })).toHaveValue('dupont');
    await page.locator('[title="Réinitialiser"]').click();
    for (const id of ['ln', 'fn', 'dd', 'ddep']) {
      await expect(page.locator(`#${id}`)).toHaveValue('');
    }
    await expect(page.locator('[title="Réinitialiser"]')).toHaveCount(0);
  });

  test('SR-020 the toggle moves the full text to last/first name and syncs the URL', async ({ page }) => {
    await page.goto('/search?q=dupont+jean');
    await expect(page.locator('#q')).toHaveValue('dupont jean');
    await page.locator('[title="Recherche avancée"]').click();
    await expect(page.locator('#ln')).toHaveValue('dupont');
    await expect(page.locator('#fn')).toHaveValue('jean');
    await expect(page).toHaveURL(/\/search\?advanced=true&ln=dupont&fn=jean$/);
    await page.locator('[title="Recherche simplifiée"]').click();
    await expect(page.locator('#q')).toHaveValue('dupont jean');
    await expect(page).toHaveURL(/\/search\?q=dupont\+jean$/);
  });

  test('SR-030 SR-032 a datalist department and a year are valid and trigger the search', async ({ page }) => {
    await page.goto('/search?advanced=true');
    const searches = recordApiRequests(page);
    await page.getByPlaceholder('75', { exact: true }).fill('33');
    await expect(page.getByPlaceholder('75', { exact: true })).not.toHaveClass(/rf-input--error/);
    await expect.poll(() => searches.some(body => body.deathDepartment === '33')).toBe(true);
    await page.getByPlaceholder(datePlaceholder, { exact: true }).fill('2020');
    await expect(page.getByPlaceholder(datePlaceholder, { exact: true })).not.toHaveClass(/rf-input--error/);
    await expect.poll(() => searches.some(body => body.deathDate === '2020' && body.deathDepartment === '33')).toBe(true);
    await expect(page).toHaveURL(/[?&]dd=2020(&|$)/);
  });

  test('SR-031 the date mask rejects letters while typing', async ({ page }) => {
    await page.goto('/search?advanced=true');
    const date = page.getByPlaceholder(datePlaceholder, { exact: true });
    await date.pressSequentially('19a');
    await expect(date).toHaveValue('19');
  });

  test('SR-033 typing sends a single debounced search for the final value', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('#q')).toBeVisible();
    const searches = recordApiRequests(page);
    await page.locator('#q').pressSequentially('dupont', { delay: 30 });
    await expect(page).toHaveURL(/[?&]q=dupont(&|$)/);
    await expect(page.getByText(/^Résultats/).first()).toBeVisible();
    await expect.poll(() => searches.filter(body => body.q === 'dupont').length).toBe(1);
    expect(searches.filter(body => body.q && body.q !== 'dupont')).toEqual([]);
  });

  test('SR-039 SR-042 the URL carries every criterion and the fuzzy flag', async ({ page }) => {
    await page.goto('/search?advanced=true');
    await page.getByPlaceholder('Pompidou', { exact: true }).fill('dupont');
    await page.getByPlaceholder('Georges', { exact: true }).fill('jean');
    await page.getByPlaceholder('F/M', { exact: true }).fill('M');
    await page.getByPlaceholder('75', { exact: true }).fill('33');
    await expect(page).toHaveURL(/\/search\?advanced=true&ln=dupont&fn=jean&sex=M&ddep=33$/);
    const searches = recordApiRequests(page);
    await page.getByText('Recherche floue').click();
    await expect(page).toHaveURL(/\/search\?advanced=true&fuzzy=false&ln=dupont&fn=jean&sex=M&ddep=33$/);
    await expect.poll(() => searches.some(body => body.fuzzy === 'false')).toBe(true);
    await expect(page.locator('strike', { hasText: 'Recherche floue' })).toBeVisible();
  });

  test('SR-280 a deep link restores the fields, the fuzzy flag and the view', async ({ page }) => {
    await page.goto('/search?advanced=true&fuzzy=false&view=table&ln=dupont&dd=2020');
    await expect(page.locator('#ln')).toHaveValue('dupont');
    await expect(page.locator('#dd')).toHaveValue('2020');
    await expect(page.locator('strike', { hasText: 'Recherche floue' })).toBeVisible();
    await expect(page.locator('th[scope="colgroup"]', { hasText: 'état civil' })).toBeVisible();
  });

  test('SR-282 Control+Shift++ in the date field does not alter its value (no app shortcut)', async ({ page }) => {
    await page.goto(referenceSearch);
    const date = page.getByPlaceholder(datePlaceholder, { exact: true });
    await expect(date).toHaveValue('2020');
    await date.press('Control+Shift++');
    await expect(date).toHaveValue('2020');
    await expect(page.getByText(referenceCard).first()).toBeVisible();
  });
});
