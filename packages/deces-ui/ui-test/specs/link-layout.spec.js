// @ts-check
// /link responsive layout, zone LK (no backend call besides the page).
const fs = require('fs');
const path = require('path');
const { test, expect, devices } = require('@playwright/test');
const { dropFile } = require('../helpers/link-session');

const csv = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'wikidata-deces-2020-m01.csv'), 'utf8');
const stepCard = (page, n, title) => page.locator('div.rf-callout', { has: page.locator(`p strong:text-is("Étape ${n}. ${title}")`) });
const intro = (page) => page.getByText('L\'appariement est une fonction de rapprochement').first();

test.describe('bulk matching layout (/link)', () => {
  test.describe('mobile', () => {
    test.use({ viewport: devices['Pixel 5'].viewport, isMobile: true, hasTouch: true });

    test('LK-006 only the current step text and card are shown on mobile', async ({ page }) => {
      await page.goto('/link');
      await expect(stepCard(page, 1, 'Fichier')).toBeVisible();
      await expect(intro(page)).toBeVisible();
      await expect(stepCard(page, 2, 'Configuration')).toBeHidden();
      await expect(stepCard(page, 4, 'Validez')).toBeHidden();
      await expect(page.getByText('Ensuite, vous pouvez configurer les colonnes').first()).toBeHidden();
    });
  });

  test('LK-006 / LK-005 on desktop the step texts are hidden after step 1 and the current step is shown on the right', async ({ page }) => {
    await page.goto('/link');
    await expect(intro(page)).toBeVisible();
    await expect(stepCard(page, 2, 'Configuration')).toBeVisible();
    await dropFile(page, 'wikidata.csv', csv);
    await expect(page.getByText('Étape 2', { exact: true })).toBeVisible();
    await expect(intro(page)).toBeHidden();
    await expect(page.getByText('Ensuite, vous pouvez configurer les colonnes').last()).toBeVisible();
    for (const [n, title] of [[1, 'Fichier'], [2, 'Configuration'], [3, 'Traitement'], [4, 'Validez']]) {
      await expect(stepCard(page, n, title)).toBeVisible();
    }
  });
});
