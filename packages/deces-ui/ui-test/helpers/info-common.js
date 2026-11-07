// @ts-check
// Shared helpers for the "info" zone e2e specs (header, about/FAQ, stats,
// explain page). Everything that the local CI stack cannot provide
// deterministically (stats JSON, /version payload, auth refresh) is stubbed
// with page.route().
const { expect } = require('@playwright/test');

// Admin login of the backend (__BACKEND_TOKEN_USER__ baked in the UI build):
// default of packages/deces-backend, overridable like the stack itself.
const adminUser = process.env.BACKEND_TOKEN_USER || 'matchid.project@gmail.com';
const plainUser = 'bob.morane@contretout.chacal';

const versionPayload = {
  backend: '9.9.9-e2e',
  uniqRecordsCount: 27123456,
  rawRecordsCount: 27123500,
  lastRecordDate: '31/01/2020',
  updateDate: '15/02/2020',
  lastDataset: 'deces-2020-m01'
};

/**
 * Serve a fixed /version payload so that version-dependent texts are stable.
 * @param {import('@playwright/test').Page} page
 */
async function stubVersion(page, payload = versionPayload) {
  await page.route('**/deces/api/v1/version', route => route.fulfill({ json: payload }));
}

/**
 * Start the app as an already logged-in user: Login.svelte re-reads the
 * token and user from localStorage on mount, then polls /auth; the /auth
 * stub keeps the fake token valid.
 * @param {import('@playwright/test').Page} page
 * @param {string} user
 */
async function loginWithStoredToken(page, user) {
  await page.route('**/deces/api/v1/auth**', route => route.fulfill({ json: {} }));
  await page.addInitScript(([name]) => {
    window.localStorage.setItem('accessToken', JSON.stringify(`e2e-token-${name}`));
    window.localStorage.setItem('user', JSON.stringify(name));
  }, [user]);
}

/**
 * Run a reference search that returns results, so that the display modes
 * of the header menu become active.
 * @param {import('@playwright/test').Page} page
 */
async function searchReferencePerson(page) {
  await page.goto('/search?q=dupont+jean');
  await expect(page.getByText('DUPONT Jean Pierre').first()).toBeVisible();
}

const desktopNav = (page) => page.getByRole('navigation', { name: 'Menu principal' });
const mobileNav = (page) => page.getByRole('navigation', { name: 'Menu mobile' });

module.exports = {
  adminUser,
  plainUser,
  versionPayload,
  stubVersion,
  loginWithStoredToken,
  searchReferencePerson,
  desktopNav,
  mobileNav
};
