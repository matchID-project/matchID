// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('simple search', () => {
  test('full-text search, result card, permalink and place details', async ({ page }) => {
    await test.step('switch from advanced to simple search', async () => {
      await page.goto('/search?advanced=true');
      await expect(page.locator('#ln')).toBeVisible();
      await page.locator('[title="Recherche simplifiée"]').click();
      await expect(page.locator('#q')).toBeVisible();
      await expect(page).not.toHaveURL(/advanced=true/);
    });

    await test.step('search while typing and sync the query in the URL', async () => {
      await page.locator('#q').fill('dupont jean');
      await expect(page).toHaveURL(/[?&]q=dupont\+jean(&|$)/);
      await expect(page.getByText('DUPONT Jean Pierre').first()).toBeVisible();
    });

    await test.step('expand the result card', async () => {
      await page.getByText('DUPONT Jean Pierre').first().click();
      await expect(page.getByText('Permalien').first()).toBeVisible();
    });

    await test.step('open the permalink', async () => {
      await page.getByText('Permalien').first().click();
      await expect(page).toHaveURL(/\/id\/[^/?#]+$/);
      await expect(page.getByText('DUPONT Jean Pierre').first()).toBeVisible();
    });

    await test.step('show birth and death places and dates', async () => {
      const lifeSpan = page.getByText('Eysines 03/10/1932 - Pessac 16/01/2020').first();
      await expect(lifeSpan).toBeVisible();
      await lifeSpan.click();
      await page.getByText('Eysines').first().click();
      await expect(page.getByText('Eysines (33162)').first()).toBeVisible();
      await page.getByText('Eysines (33162)').first().click();
    });
  });
});
