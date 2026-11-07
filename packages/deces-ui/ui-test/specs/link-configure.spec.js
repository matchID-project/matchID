// @ts-check
// /link configuration step without any job submission, zone LK.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const csvFile = path.join(__dirname, '..', 'fixtures', 'wikidata-deces-2020-m01.csv');
const csv = fs.readFileSync(csvFile, 'utf8');
const header = csv.split(/\r?\n/)[0];
const tileHeaders = (page) => page.locator('div[draggable="true"] th');

test.describe('bulk matching configuration (/link)', () => {
  test('LK-026 / LK-063 / LK-041 / LK-086 the options panel re-parses the file and persists the options', async ({ page }) => {
    let tiles = 0;
    await page.goto('/link');
    await test.step('LK-026 a click on the dropzone opens the file chooser', async () => {
      const chooser = page.waitForEvent('filechooser');
      await page.locator('div.rf-callout').first().click();
      await (await chooser).setFiles(csvFile);
    });
    await expect(tileHeaders(page).filter({ hasText: /^firstnameLabel$/ })).toBeVisible();
    // a column auto-mapped to the death date is not displayed (LK-044 BUG)
    tiles = await tileHeaders(page).count();
    expect(tiles).toBeGreaterThanOrEqual(header.split(',').length - 1);

    await test.step('LK-063 the Options gear toggles the csv + algorithm options', async () => {
      await page.locator('a[href="#options"]').click();
      await expect(page.getByText('Formattage du fichier')).toBeVisible();
      await expect(page.getByText('Paramètres de l\'algorithme')).toBeVisible();
      await expect(page.locator('select#sep')).toHaveValue(',');
    });

    await test.step('LK-041 changing the separator re-parses the preview', async () => {
      await page.locator('select#sep').selectOption(';');
      await expect(tileHeaders(page)).toHaveCount(1);
      await expect(tileHeaders(page).first()).toHaveText(header);
      await page.locator('select#sep').selectOption(',');
      await expect(tileHeaders(page)).toHaveCount(tiles);
    });

    await test.step('LK-086 the options are two-way bound and persisted in localStorage', async () => {
      await page.locator('select#tmpfilePersistence').selectOption('60000');
      await page.locator('#candidateNumber').fill('3');
      await expect(page.locator('label[for="candidateNumber"]')).toContainText('3');
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('linkOptions') || '{}'));
      expect(stored.csv.sep).toBe(',');
      expect(stored.csv.tmpfilePersistence).toBe('60000');
      expect(Number(stored.api.candidateNumber)).toBe(3);
      await page.locator('a[href="#options"]').click();
      await expect(page.getByText('Formattage du fichier')).toHaveCount(0);
    });
  });
});
