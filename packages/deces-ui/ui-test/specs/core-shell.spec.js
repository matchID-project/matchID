// @ts-check
const { test, expect } = require('@playwright/test');
const { apiPath, referencePerson } = require('../helpers/core-search');

const placeholderKeys = [
  'AB_THRESHOLD', 'API_EMAIL', 'API_MAX_BODY', 'ES_MAX_RESULTS', 'BACKEND_TOKEN_USER', 'BACKEND_PROXY_PATH',
  'DATAGOUV_PROXY_PATH', 'DATAGOUV_CATALOG_URL', 'DATAGOUV_RESOURCES_URL', 'MITM_URL', 'APP_FRONTEND',
  'APP_VERSION', 'THEME_DNUM'
];

test.describe('core: app shell', () => {
  test.describe('CO-057 search API errors', () => {
    const failSearch = (page, status, body) => page.route(`**${apiPath}/search`, route => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify(body)
    }));

    test('CO-057 HTTP 429 shows the rate-limit message', async ({ page }) => {
      await failSearch(page, 429, { msg: 'too many requests' });
      await page.goto('/search?q=dupont+jean');
      await expect(page.getByText('Le service étant fortement sollicité, votre requête est temporisée.')).toBeVisible();
      await expect(page.getByRole('heading', { name: /429/ })).toContainText('too many requests');
    });

    test('CO-057 HTTP 500 shows the unavailability message', async ({ page }) => {
      await failSearch(page, 500, {});
      await page.goto('/search?q=dupont+jean');
      await expect(page.getByText('Le service est indisponible. Veuillez réessayer dans quelques minutes.')).toBeVisible();
      await expect(page.getByRole('heading', { name: /500/ })).toBeVisible();
    });

    test('CO-057 HTTP 422 asks the anonymous user to register', async ({ page }) => {
      await failSearch(page, 422, { msg: 'quota' });
      await page.goto('/search?q=dupont+jean');
      await expect(page.getByText('Pour poursuivre, enregistrez-vous !')).toBeVisible();
    });
  });

  test('CO-079 the version from <BACKEND_PROXY_PATH>/version is displayed', async ({ page }) => {
    await page.route(`**${apiPath}/version`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ backend: '9.9.9', uniqRecordsCount: 1234567, updateDate: '2026-01-01' })
    }));
    await page.goto('/search');
    await expect(page.getByText('1234567 enregistrements, mise à jour le 2026-01-01')).toBeVisible();
  });

  test('CO-080 /liveConfig.json is served by nginx and fetched at startup', async ({ page, request }) => {
    const response = await request.get('/liveConfig.json');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(Object.keys(await response.json()).sort()).toEqual(['googleAdsenseId', 'googleAnalyticsId']);
    const fetched = page.waitForResponse(r => new URL(r.url()).pathname === '/liveConfig.json');
    await page.goto('/about');
    expect((await fetched).status()).toBe(200);
  });

  test('CO-081 Google Analytics / AdSense stay disabled even with ids in liveConfig', async ({ page }) => {
    const thirdParty = [];
    await page.context().route(/google|doubleclick/, route => {
      thirdParty.push(route.request().url());
      return route.abort();
    });
    await page.route('**/liveConfig.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ googleAnalyticsId: 'G-TEST', googleAdsenseId: 'ca-pub-TEST' })
    }));
    const gaLog = page.waitForEvent('console', m => m.text() === 'GA: G-TEST');
    await page.goto('/search');
    await gaLog;
    await page.locator('#q').fill('dupont jean');
    await expect(page.getByText(referencePerson).first()).toBeVisible();
    expect(thirdParty).toEqual([]);
  });

  test('CO-084 Ctrl+Alt+D toggles the DNUM theme', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('#q')).toBeVisible();
    // the logo is in both the desktop and the mobile header
    const logo = page.getByAltText('DNUM Logo');
    const initiallyDnum = await logo.count() > 0;
    const isDnum = async () => (await logo.count()) > 0;
    const switched = page.waitForEvent('console', m => /^switch theme to /.test(m.text()));
    await page.keyboard.press('Control+Alt+d');
    expect((await switched).text()).toBe(`switch theme to ${initiallyDnum ? 'public site' : 'DNUM'}`);
    await expect.poll(isDnum).toBe(!initiallyDnum);
    await page.keyboard.press('Control+Alt+d');
    await expect.poll(isDnum).toBe(initiallyDnum);
  });

  test('CO-085 Ctrl+Alt+A toggles the alpha features', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('#q')).toBeVisible();
    const toggled = () => page.waitForEvent('console', m => /^alpha features (enabled|disabled)$/.test(m.text()));
    let message = toggled();
    await page.keyboard.press('Control+Alt+a');
    const first = (await message).text();
    message = toggled();
    await page.keyboard.press('Control+Alt+a');
    const second = (await message).text();
    expect([first, second].sort()).toEqual(['alpha features disabled', 'alpha features enabled']);
  });

  test('CO-087 #infoNotWorking is removed once the app starts', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('#q')).toBeVisible();
    await expect(page.locator('#infoNotWorking')).toHaveCount(0);
  });

  test('CO-087 #infoNotWorking is shown after 5 s when the app cannot start', async ({ page }) => {
    await page.route(/\/build\/(module|nomodule)\/main\.js$/, route => route.abort());
    await page.goto('/search');
    const info = page.locator('#infoNotWorking');
    await expect(info).toBeHidden();
    await expect(info).toBeVisible({ timeout: 15_000 });
    await expect(info).toContainText('votre navigateur est incompatible');
  });

  test('CO-088 a modern browser loads the ES module build only', async ({ page }) => {
    const scripts = [];
    page.on('request', r => { if (/\/build\/.*\.js$/.test(r.url())) scripts.push(new URL(r.url()).pathname); });
    await page.goto('/search');
    await expect(page.locator('#q')).toBeVisible();
    expect(scripts).toContain('/build/module/main.js');
    expect(scripts.filter(s => s.startsWith('/build/nomodule/'))).toEqual([]);
    expect(await page.locator('script[src="/build/module/main.js"]').getAttribute('type')).toBe('module');
  });

  test('CO-094 the bundles contain no unreplaced build placeholder', async ({ request }) => {
    // the ES module entry only re-exports its code-split chunk(s)
    const entry = await (await request.get('/build/module/main.js')).text();
    const chunks = [...entry.matchAll(/from\s*"\.\/([^"]+\.js)"/g)].map(m => `/build/module/${m[1]}`);
    expect(chunks.length).toBeGreaterThan(0);
    for (const bundle of [...chunks, '/build/nomodule/main.js']) {
      const response = await request.get(bundle);
      expect(response.status(), bundle).toBe(200);
      const code = await response.text();
      const leftovers = placeholderKeys.filter(key => code.includes(`__${key}__`));
      expect(leftovers, bundle).toEqual([]);
      expect(code, bundle).toContain(apiPath);
    }
  });
});

test.describe('core: without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('CO-089 the <noscript> content is displayed', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('heading', { level: 1, name: 'Moteur de recherche des décès' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Qui sommes nous ?' })).toBeVisible();
  });
});
