// @ts-check
const path = require('path');
const { test, expect } = require('@playwright/test');
const { getOtp } = require('../helpers/maildev');

const csvFile = path.join(__dirname, '..', 'fixtures', 'wikidata-deces-2020-m01.csv');

test.describe('bulk matching (/link)', () => {
  test('upload a CSV, log in by email OTP, run the job and show matches', async ({ page }) => {
    const email = `bob.morane+${Date.now()}@contretout.chacal`;

    await test.step('upload the CSV through the drop zone', async () => {
      await page.goto('/link');
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.locator('div.rf-callout').first().click();
      await (await fileChooserPromise).setFiles(csvFile);
      await expect(page.locator('label:has-text("Prénom(s)")').first()).toBeVisible();
    });

    await test.step('map the first name column', async () => {
      const firstName = page.locator('input[name="Prénom(s)"]').first();
      await firstName.fill('firstnameLabel');
      await expect(firstName).toHaveValue('firstnameLabel');
    });

    await test.step('register by email and log in with the OTP from MailDev', async () => {
      await page.locator('input[type="email"]#email').fill(email);
      await page.locator('button[type="submit"]').first().click();
      const code = await getOtp(email);
      const otp = page.locator('input[type="text"]#emailOTP');
      await expect(otp).toBeVisible();
      await otp.fill(code);
      await page.locator('button[type="submit"]').first().click();
    });

    await test.step('start the job and wait for matched rows', async () => {
      await page.locator('button.rf-btn:has-text("Valider")').first().click();
      const outcome = await page.waitForFunction(() => {
        const text = document.body.innerText;
        if (text.includes('Le traitement a échoué')) return 'failed';
        return text.includes('Costes') ? 'matched' : false;
      }, null, { timeout: 60_000, polling: 1_000 });
      expect(await outcome.jsonValue()).toBe('matched');
      await expect(page.getByText('Costes').first()).toBeVisible();
    });
  });
});
