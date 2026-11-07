// @ts-check
// Helpers for the core-*.spec.js (CO-* inventory rows) end-to-end tests.

/** Same origin as playwright.config.js `use.baseURL`. */
const origin = `http://${process.env.TEST_HOST || 'localhost'}:${process.env.PORT || '8083'}`;

/** Backend proxy path baked into the build (BACKEND_PROXY_PATH). */
const apiPath = process.env.BACKEND_PROXY_PATH || '/deces/api/v1';

/** data.gouv proxy path baked into the build (DATAGOUV_PROXY_PATH). */
const dataGouvProxyPath = process.env.DATAGOUV_PROXY_PATH || '/deces/api/v0/getDataGouvFile';

/** Text of the reference person card in the 2020-m01 test data. */
const referencePerson = 'DUPONT Jean Pierre';

/**
 * Resolve with the JSON body of the next POST <api>/search sent by the page.
 * Call it before the action that triggers the search.
 * @param {import('@playwright/test').Page} page
 * @param {(body: any) => boolean} [predicate]
 */
async function nextSearchBody(page, predicate = () => true) {
  const request = await page.waitForRequest(r =>
    r.method() === 'POST' && new URL(r.url()).pathname === `${apiPath}/search` && predicate(r.postDataJSON()));
  return request.postDataJSON();
}

/**
 * Wait until the page is controlled by the active service worker and return
 * its script URL and scope.
 * @param {import('@playwright/test').Page} page
 */
async function waitForServiceWorker(page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return { scriptURL: registration.active && registration.active.scriptURL, scope: registration.scope };
  });
}

module.exports = { origin, apiPath, dataGouvProxyPath, referencePerson, nextSearchBody, waitForServiceWorker };
