// @ts-check
const { test, expect } = require('@playwright/test');
const { apiPath, dataGouvProxyPath } = require('../helpers/core-search');

// nginx keys the per-user rate-limit zones on X-Forwarded-For
// (API_USER_SCOPE=http_x_forwarded_for): bursts below use a dedicated
// documentation address (TEST-NET-3) so other specs keep their quota.
const burst = async (request, path, count, address) => {
  const responses = await Promise.all(Array.from({ length: count }, () =>
    request.get(path, { headers: { 'X-Forwarded-For': address } })));
  return responses.map(r => r.status());
};

test.describe('core: nginx', () => {
  test('CO-095 deep links serve the SPA (index.html) and render the page', async ({ page, request }) => {
    for (const path of ['/id/AbCdEfGhIjKl', '/link', '/about', '/search', '/stats', '/explain', '/jobs']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()['content-type'], path).toContain('text/html');
      expect(await response.text(), path).toContain('/build/module/main.js');
    }
    await page.goto('/about');
    await expect(page.getByRole('heading', { level: 2, name: 'À propos' })).toBeVisible();
    await page.goto('/link');
    await expect(page.getByText('L\'appariement est une fonction de rapprochement')).toBeVisible();
    await page.goto('/id/AbCdEfGhIjKl');
    await expect(page).toHaveURL(/\/id\/AbCdEfGhIjKl$/);
    await expect(page.locator('header')).toBeVisible();
  });

  test('CO-096 limit_req answers 429 beyond the per-user burst (misc and search zones)', async ({ request }) => {
    // api_misc: API_MISC_LIMIT_RATE=2r/s, burst 7 nodelay
    const misc = await burst(request, `${apiPath}/version`, 20, '203.0.113.96');
    expect(misc).toContain(200);
    expect(misc).toContain(429);
    // search: CI runs with API_SEARCH_LIMIT_RATE=10r/s, burst 30 nodelay
    const search = await burst(request, `${apiPath}/search?q=dupont&size=1`, 60, '203.0.113.97');
    expect(search).toContain(429);
    // requests from other clients are not throttled by these bursts
    await expect.poll(async () => (await request.get(`${apiPath}/version`)).status()).toBe(200);
  });

  test('CO-097 unknown backend paths get 400, non-GET data.gouv proxy requests get 405', async ({ request }) => {
    expect((await request.get(`${apiPath}/no-such-endpoint`)).status()).toBe(400);
    expect((await request.post(`${apiPath}/no-such-endpoint`)).status()).toBe(400);
    expect((await request.post(`${dataGouvProxyPath}/deces-2020-m01.txt`)).status()).toBe(405);
    expect((await request.delete(`${dataGouvProxyPath}/deces-2020-m01.txt`)).status()).toBe(405);
  });
});
