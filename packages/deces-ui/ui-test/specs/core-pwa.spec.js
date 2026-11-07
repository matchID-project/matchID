// @ts-check
const { test, expect } = require('@playwright/test');
const { origin, apiPath, waitForServiceWorker } = require('../helpers/core-search');

// Service workers need a secure context. The CI suite reaches nginx through
// http://<TEST_HOST>:<PORT> (not localhost), so let Chromium treat that
// origin as secure for this file.
test.use({
  serviceWorkers: 'allow',
  launchOptions: { args: [`--unsafely-treat-insecure-origin-as-secure=${origin}`] }
});

const precachedPaths = (page) => page.evaluate(async () => {
  const urls = [];
  for (const name of await caches.keys()) {
    const cache = await caches.open(name);
    (await cache.keys()).forEach(request => urls.push(new URL(request.url).pathname));
  }
  return urls;
});

// Load the app until the service worker is active and controls the page.
const controlledPage = async (page) => {
  await page.goto('/search');
  expect(await page.evaluate(() => 'serviceWorker' in navigator)).toBe(true);
  const sw = await waitForServiceWorker(page);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  return sw;
};

test.describe('core: service worker and offline mode', () => {
  test('CO-083 the service worker /sw.js is registered with the root scope', async ({ page }) => {
    const registered = page.waitForEvent('console', m => m.text() === 'Service worker has been registered.');
    await page.goto('/search');
    await registered;
    const sw = await waitForServiceWorker(page);
    expect(sw.scriptURL).toBe(`${origin}/sw.js`);
    expect(sw.scope).toBe(`${origin}/`);
  });

  test('CO-090 the app shell is precached', async ({ page }) => {
    await controlledPage(page);
    const paths = await precachedPaths(page);
    expect(paths).toEqual(expect.arrayContaining([
      '/index.html', '/build/module/main.js', '/manifest.json', '/build/module/bundle.css',
      '/css/global.css', '/favicon.svg', '/favicon.png', '/male.svg', '/female.svg'
    ]));
    // the code-split part of the ES module build
    expect(paths.some(p => /^\/build\/module\/main-[^/]+\.js$/.test(p))).toBe(true);
    // lazily loaded heavy chunks are excluded
    expect(paths.filter(p => /^\/build\/module\/(Geo|LinkCheck|Line|Bar)-/.test(p))).toEqual([]);
  });

  // BUG: the precache globs target css/dsfr.min.css and fonts/Marianne-*
  // (not in public/) instead of the css/matchid.min.css and js/matchid.min.js
  // that index.html loads, so the offline shell is unstyled.
  test.fixme('CO-090 BUG: the stylesheet and script linked by index.html are precached', async ({ page }) => {
    await controlledPage(page);
    expect(await precachedPaths(page)).toEqual(expect.arrayContaining(['/css/matchid.min.css', '/js/matchid.min.js']));
  });

  test('CO-092 offline, the app shell reloads from the service worker cache', async ({ page, context }) => {
    await controlledPage(page);
    await context.setOffline(true);
    try {
      const response = await page.reload();
      expect(response && response.fromServiceWorker()).toBe(true);
      await expect(page.locator('#q')).toBeVisible();
      await expect(page.locator('header')).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  test('CO-091 offline navigations fall back to index.html, except for the backend API', async ({ page, context }) => {
    await controlledPage(page);
    await context.setOffline(true);
    try {
      const link = await page.goto('/link');
      expect(link && link.fromServiceWorker()).toBe(true);
      await expect(page.getByText('L\'appariement est une fonction de rapprochement')).toBeVisible();
      // denylisted: not answered by the service worker (offline: network error)
      const api = await page.goto(`${apiPath}/version`).catch(() => null);
      expect(api === null || !api.fromServiceWorker()).toBe(true);
    } finally {
      await context.setOffline(false);
    }
  });

  test('CO-093 the PWA manifest is served and its icons exist', async ({ page, request }) => {
    await page.goto('/search');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('/manifest.json');
    const response = await request.get(href);
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest).toMatchObject({ short_name: 'matchID', display: 'standalone', start_url: '.', theme_color: '#000000' });
    for (const icon of manifest.icons) {
      const iconResponse = await request.get(`/${icon.src}`);
      expect(iconResponse.status(), icon.src).toBe(200);
      expect(iconResponse.headers()['content-type'], icon.src).toContain(icon.type.split('+')[0]);
    }
  });
});
