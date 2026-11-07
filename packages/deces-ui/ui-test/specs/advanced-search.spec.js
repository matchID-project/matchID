// @ts-check
const { test, expect } = require('@playwright/test');

const datePlaceholder = '1970-1980 ou 1974 ou 04/02/1974';

test.describe('advanced search', () => {
  test('fields, fuzzy toggle, URL serialization and permalink', async ({ page }) => {
    await page.goto('/search?advanced=true');
    await expect(page.locator('#ln')).toBeVisible();

    await test.step('fill last name, first name, death department and date', async () => {
      await page.getByPlaceholder('Pompidou', { exact: true }).fill('dupont');
      await expect(page).toHaveURL(/[?&]ln=dupont(&|$)/);
      await page.getByPlaceholder('Georges', { exact: true }).fill('jean');
      await expect(page).toHaveURL(/[?&]fn=jean(&|$)/);
      await page.getByPlaceholder('Paris', { exact: true }).click();
      await page.getByPlaceholder('75', { exact: true }).click();
      await page.getByPlaceholder('75', { exact: true }).fill('33');
      await expect(page).toHaveURL(/[?&]ddep=33(&|$)/);
      await page.getByPlaceholder(datePlaceholder, { exact: true }).fill('2020');
      await expect(page).toHaveURL(/[?&]dd=2020(&|$)/);
    });

    await test.step('disable fuzzy search', async () => {
      await page.getByText('Recherche floue').click();
      await expect(page).toHaveURL('/search?advanced=true&fuzzy=false&ln=dupont&fn=jean&dd=2020&ddep=33');
      await expect(page.locator('strike', { hasText: 'Recherche floue' })).toBeVisible();
    });

    await test.step('show the reference person and open the permalink', async () => {
      const card = page.getByText('DUPONT Jean Pierre Eysines 1932 - Pessac 2020').first();
      await expect(card).toBeVisible();
      await card.click();
      await page.getByText('Permalien').first().click();
      await expect(page).toHaveURL(/\/id\/[^/?#]+$/);
      await expect(page.getByText('DUPONT Jean Pierre').first()).toBeVisible();
    });
  });

  test('a deep link restores the advanced form and its values', async ({ page }) => {
    await page.goto('/search?advanced=true&fuzzy=false&ln=dupont&fn=jean&dd=2020&ddep=33');
    await expect(page.getByPlaceholder('Pompidou', { exact: true })).toHaveValue('dupont');
    await expect(page.getByPlaceholder('Georges', { exact: true })).toHaveValue('jean');
    await expect(page.getByPlaceholder('75', { exact: true })).toHaveValue('33');
    await expect(page.getByPlaceholder(datePlaceholder, { exact: true })).toHaveValue('2020');
    await expect(page.getByText('DUPONT Jean Pierre Eysines 1932 - Pessac 2020').first()).toBeVisible();
  });

  // Known gap (inventory CO-021): `current=n_<N>_n` is written to the URL by
  // the pagination but URLSearchSubmit() resets the page to 1 on reload.
  // Restoring it needs a page-1 search first (scroll API); the intended
  // behaviour is not settled, so this documents the expectation only.
  test.fixme('reloading a paginated search restores the requested page', async ({ page }) => {
    await page.goto('/search?q=jean&current=n_2_n');
    await expect(page.getByLabel('page 2').first()).toBeVisible();
    await expect(page.locator('.rf-pagination__item--active')).toHaveText('2');
  });
});
