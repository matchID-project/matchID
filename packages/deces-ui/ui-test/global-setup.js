// @ts-check
const { chromium } = require('@playwright/test');

const timeoutMs = 90_000;
const retryDelayMs = 1_000;

// Wait until the local stack is usable: backend up, reference person indexed
// in Elasticsearch, and the UI rendering the advanced search form.
module.exports = async function globalSetup(config) {
  const { baseURL } = config.projects[0].use;
  const versionUrl = `${baseURL}/deces/api/v1/version`;
  const searchUrl = `${baseURL}/deces/api/v1/search?deathDate=2020&lastName=dupont&firstName=jean&deathDepartment=33&fuzzy=false`;
  const deadline = Date.now() + timeoutMs;
  let lastError = 'not started';

  while (Date.now() < deadline) {
    try {
      const versionResponse = await fetch(versionUrl);
      if (!versionResponse.ok) throw new Error(`version status ${versionResponse.status}`);
      const searchResponse = await fetch(searchUrl);
      if (!searchResponse.ok) throw new Error(`search status ${searchResponse.status}`);
      const payload = await searchResponse.json();
      if (!((payload?.response?.total || 0) > 0)) throw new Error('reference search returned no result');

      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.goto(`${baseURL}/search?advanced=true`);
        await page.waitForSelector('#ln', { timeout: 5_000 });
      } finally {
        await browser.close();
      }
      console.log('Warm-up: frontend, backend and reference data are ready');
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.log(`Warm-up pending: ${lastError}`);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  throw new Error(`Warm-up failed after ${timeoutMs / 1000} s: ${lastError}`);
};
