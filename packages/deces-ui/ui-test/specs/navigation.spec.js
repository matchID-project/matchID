// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('navigation', () => {
  test('an unknown path shows the 404 page', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await expect(page).toHaveURL('/notFound');
    await expect(page.getByText('Pas de page à l\'adresse indiquée').first()).toBeVisible();
    await expect(page).toHaveTitle(/404/);
  });

  test('the root path redirects to the search page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/search(\?.*)?$/);
    await expect(page.locator('#q')).toBeVisible();
  });
});
