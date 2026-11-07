// @ts-check
const { expect } = require('@playwright/test');
const { getOtp } = require('./maildev');

const apiPath = '/deces/api/v1';

/** A unique MailDev address per test (one running job per user, fresh OTP). */
const uniqueEmail = (tag) => `link-${tag}+${Date.now()}-${Math.floor(Math.random() * 1e6)}@contretout.chacal`;

/**
 * Register `email`, read the OTP from MailDev and exchange it for a token,
 * through the API (no UI): 1 /register + 1 /auth request.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} email
 * @returns {Promise<{token: string, infos: any}>}
 */
async function loginByApi(request, email) {
  const register = await request.post(`${apiPath}/register`, { data: { user: email } });
  expect(register.ok(), `register status ${register.status()}`).toBe(true);
  const code = await getOtp(email);
  const auth = await request.post(`${apiPath}/auth`, { data: { user: email, password: code } });
  expect(auth.ok(), `auth status ${auth.status()}`).toBe(true);
  const infos = await auth.json();
  expect(infos.access_token).toBeTruthy();
  return { token: infos.access_token, infos };
}

/**
 * Store the session the way Login.svelte persists it (useLocalSync keys)
 * before any page script runs.
 * @param {import('@playwright/test').Page | import('@playwright/test').BrowserContext} target
 * @param {{token: string, email: string}} session
 */
async function seedSession(target, { token, email }) {
  await target.addInitScript(([t, u]) => {
    if (!sessionStorage.getItem('link-session-seeded')) {
      localStorage.setItem('accessToken', JSON.stringify(t));
      localStorage.setItem('user', JSON.stringify(u));
      sessionStorage.setItem('link-session-seeded', '1');
    }
  }, [token, email]);
}

/**
 * Drop a file on the /link dropzone with a real DataTransfer (LinkFile drop
 * handler), instead of the file chooser.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 * @param {string} content
 */
async function dropFile(page, name, content) {
  const dataTransfer = await page.evaluateHandle(([n, c]) => {
    const dt = new DataTransfer();
    dt.items.add(new File([c], n, { type: 'text/csv' }));
    return dt;
  }, [name, content]);
  await page.locator('div.rf-callout').first().dispatchEvent('drop', { dataTransfer });
}

/**
 * Wait for the end of the bulk job: results (step 4) or failure.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<'results' | 'empty' | 'failed'>}
 */
async function waitForJobEnd(page) {
  const outcome = await page.waitForFunction(() => {
    const text = document.body.innerText;
    if (text.includes('Le traitement a échoué')) return 'failed';
    if (text.includes('Aucune correspondance de personne décédée')) return 'empty';
    return /\d+ identités (à valider|validées) :/.test(text) ? 'results' : false;
  }, null, { timeout: 90_000, polling: 1_000 });
  return /** @type {any} */ (await outcome.jsonValue());
}

module.exports = { apiPath, uniqueEmail, loginByApi, seedSession, dropFile, waitForJobEnd };
