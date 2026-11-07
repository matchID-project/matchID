import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';

vi.mock('idb-keyval', async () => (await import('./idb-mock.js')).idbKeyvalMock);
// The route table imports every page: keep the search engine out of it.
vi.mock('../../../src/components/tools/search.js', () => ({ URLSearchSubmit: vi.fn(), getById: vi.fn() }));

const { default: Login } = await import('../../../src/components/views/Login.svelte');
const { default: MatchIDHeader } = await import('../../../src/components/views/MatchIDHeader.svelte');
const { accessToken, accessTokenInfos, user, admin, route } = await import('../../../src/components/tools/stores.js');
const { resetLinkStores, stubFetch, jsonResponse, flush } = await import('./helpers.js');

const adminUser = 'admin@example.org'; // __BACKEND_TOKEN_USER__ in vitest.config.mjs
const email = () => document.querySelector('input#email');
const code = () => document.querySelector('input#token');
const modal = () => document.querySelector('.modal');
const text = () => document.body.textContent.replace(/\s+/g, ' ');
const tokenInfos = { access_token: 'jwt-1', created_at: '1700000000', expiration_date: '1700003600', renewal_limit_date: '1700086400' };

// Login.svelte restores the session in an async onMount: let it settle.
const renderLogin = async (props) => {
  const result = render(Login, props);
  await flush();
  return result;
};

const blurEmail = async (value) => {
  await fireEvent.focus(email());
  await fireEvent.input(email(), { target: { value } });
  await fireEvent.blur(email());
  await flush();
};

describe('Login modal (Login.svelte)', () => {
  beforeEach(() => {
    resetLinkStores();
    route.set({ path: '/search', query: {} });
  });
  afterEach(() => vi.useRealTimers());

  it('LK-162 the header "S\'identifier" entry toggles the Login modal; "Se déconnecter" when logged in', async () => {
    stubFetch();
    const { container } = render(MatchIDHeader);
    const entry = () => container.querySelector('#rf-admin a[href="/logout"]');
    expect(entry().getAttribute('title')).toBe('S\'identifier');
    expect(modal()).toBeNull();
    await fireEvent.click(entry());
    expect(modal().querySelector('h4').textContent).toBe('Connexion');
    await fireEvent.click(entry());
    await waitFor(() => expect(modal()).toBeNull());
    user.set('bob@example.org');
    await flush();
    expect(entry().textContent.trim()).toBe('Se déconnecter');
  });

  it('LK-163 email blur POSTs /register and shows the message in green when valid', async () => {
    const fetchMock = stubFetch({ 'POST /deces/api/v1/register': { valid: true, msg: 'code envoyé' } });
    await renderLogin({ showLogin: true });
    await blurEmail('bob@example.org');
    expect(fetchMock).toHaveBeenCalledWith('/deces/api/v1/register', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ user: 'bob@example.org' })
    }));
    await waitFor(() => expect(document.querySelector('p.rf-valid-text').textContent.trim()).toBe('code envoyé'));
  });

  it('LK-163 shows the register message in red when the backend rejects the address', async () => {
    stubFetch({ 'POST /deces/api/v1/register': { valid: false, msg: 'Coudn\'t send mail' } });
    await renderLogin({ showLogin: true });
    await blurEmail('bob@example.org');
    await waitFor(() => expect(document.querySelector('p.rf-error-text').textContent.trim()).toBe('Coudn\'t send mail'));
  });

  it('LK-164 an invalid email format shows "Le courriel fourni n\'est pas valide." without calling the backend', async () => {
    const fetchMock = stubFetch();
    await renderLogin({ showLogin: true });
    await blurEmail('not-an-email');
    expect(document.querySelector('p.rf-error-text').textContent.trim()).toBe('Le courriel fourni n\'est pas valide.');
    expect(fetchMock).not.toHaveBeenCalledWith('/deces/api/v1/register', expect.anything());
  });

  it('LK-165 focusing the email clears its validation message; typing clears the auth error', async () => {
    stubFetch({ 'POST /deces/api/v1/auth': () => jsonResponse({ msg: 'bad' }, 401) });
    await renderLogin({ showLogin: true });
    await blurEmail('not-an-email');
    expect(document.querySelector('p.rf-error-text')).not.toBeNull();
    await fireEvent.focus(email());
    expect(document.querySelector('p.rf-error-text')).toBeNull();
    await fireEvent.click(screen.getByText('Se connecter'));
    await waitFor(() => expect(text()).toContain('Mauvais courriel ou code d\'accès'));
    await fireEvent.input(code(), { target: { value: '1' } });
    expect(text()).not.toContain('Mauvais courriel ou code d\'accès');
  });

  it('LK-166 the code field: label "Code", 6 chars max, text input', async () => {
    await renderLogin({ showLogin: true });
    expect(document.querySelector('label[for="token"]').textContent.trim()).toBe('Code');
    expect(code().getAttribute('maxlength')).toBe('6');
    expect(code().type).toBe('text');
  });

  // BUG: the sanitizing on:input handler is declared before bind:value, so it
  // runs on the PREVIOUS value and the binding then writes the raw input:
  // letters typed in the modal "Code" field are never stripped.
  it.fails('LK-166 strips non-digits from the code field', async () => {
    await renderLogin({ showLogin: true });
    await fireEvent.input(code(), { target: { value: '12a3b4' } });
    expect(code().value).toBe('1234');
  });

  it('LK-167 admin login: the admin email gets a "Mot de passe" password field and no /register call', async () => {
    const fetchMock = stubFetch();
    await renderLogin({ showLogin: true });
    await blurEmail(adminUser);
    expect(document.querySelector('label[for="token"]').textContent.trim()).toBe('Mot de passe');
    expect(code().type).toBe('password');
    expect(fetchMock).not.toHaveBeenCalledWith('/deces/api/v1/register', expect.anything());
  });

  it('LK-168 "Se connecter" POSTs /auth and stores accessToken, accessTokenInfos and user', async () => {
    const fetchMock = stubFetch({ 'POST /deces/api/v1/auth': tokenInfos });
    await renderLogin({ showLogin: true });
    await fireEvent.input(email(), { target: { value: 'bob@example.org' } });
    await fireEvent.input(code(), { target: { value: '123456' } });
    await fireEvent.click(screen.getByText('Se connecter'));
    await waitFor(() => expect(get(accessToken)).toBe('jwt-1'));
    expect(fetchMock).toHaveBeenCalledWith('/deces/api/v1/auth', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ user: 'bob@example.org', password: '123456' })
    }));
    expect(get(accessTokenInfos)).toEqual(tokenInfos);
    expect(get(user)).toBe('bob@example.org');
  });

  it('LK-169 a wrong code (401) shows "Mauvais courriel ou code d\'accès" and clears token and user', async () => {
    stubFetch({ 'POST /deces/api/v1/auth': () => jsonResponse({ msg: 'bad' }, 401) });
    accessTokenInfos.set({ stale: true });
    await renderLogin({ showLogin: true });
    await fireEvent.input(email(), { target: { value: 'bob@example.org' } });
    await fireEvent.input(code(), { target: { value: '000000' } });
    await fireEvent.click(screen.getByText('Se connecter'));
    await waitFor(() => expect(text()).toContain('Mauvais courriel ou code d\'accès'));
    expect(email().closest('.rf-input-group').classList.contains('rf-input-group--error')).toBe(true);
    expect(get(accessToken)).toBe('');
    expect(get(user)).toBe('');
    expect(get(accessTokenInfos)).toEqual({});
  });

  it('LK-170 logged-in view "Connecté en tant que {user}"; "Se déconnecter" clears token, infos, user and form', async () => {
    stubFetch();
    await renderLogin({ showLogin: true });
    accessToken.set('jwt-1');
    accessTokenInfos.set(tokenInfos);
    user.set('bob@example.org');
    await flush();
    expect(text()).toContain('Connecté en tant que bob@example.org');
    await fireEvent.click(screen.getByText('Se déconnecter'));
    await waitFor(() => expect(email()).not.toBeNull());
    expect(get(accessToken)).toBe('');
    expect(get(accessTokenInfos)).toEqual({});
    expect(get(user)).toBe('');
    expect(email().value).toBe('');
    expect(code().value).toBe('');
  });

  it('LK-171 $admin is set only with a token and the admin user', async () => {
    stubFetch();
    render(Login);
    user.set(adminUser);
    await flush();
    expect(get(admin)).toBeFalsy();
    accessToken.set('jwt-admin');
    await flush();
    expect(get(admin)).toBe(adminUser);
    user.set('bob@example.org');
    await flush();
    expect(get(admin)).toBe(false);
  });

  it('LK-172 auto-opens the modal on auth routes (/edits) without user', async () => {
    stubFetch();
    route.set({ path: '/edits', query: {} });
    await renderLogin();
    await waitFor(() => expect(modal()).not.toBeNull());
    expect(modal().querySelector('h4').textContent).toBe('Connexion');
  });

  it('LK-172 pins that on an auth route the closed modal re-opens at once (Svelte 3 binding re-runs the auto-open statement)', async () => {
    stubFetch();
    route.set({ path: '/edits', query: {} });
    await renderLogin();
    await waitFor(() => expect(modal()).not.toBeNull());
    await fireEvent.click(modal().querySelector('div[style*="top: 26px"]'));
    await flush();
    expect(modal()).not.toBeNull();
    expect(get(route).path).toBe('/edits');
  });

  // BUG: closeLogin() (redirect to the default route) is never wired to the
  // modal, and closing it on /edits re-opens it immediately: without logging
  // in, the full-screen modal cannot be dismissed.
  it.fails('LK-172 closing the modal on an auth route leaves the page or hides the modal', async () => {
    stubFetch();
    route.set({ path: '/edits', query: {} });
    await renderLogin();
    await waitFor(() => expect(modal()).not.toBeNull());
    await fireEvent.click(modal().querySelector('div[style*="top: 26px"]'));
    await waitFor(() => expect(modal() === null || get(route).path !== '/edits').toBe(true), { timeout: 1500 });
  });

  it('LK-172 does not open the modal on public routes or when logged in', async () => {
    stubFetch();
    render(Login);
    await flush();
    expect(modal()).toBeNull();
    user.set('bob@example.org');
    route.set({ path: '/edits', query: {} });
    await flush();
    expect(modal()).toBeNull();
  });

  it('LK-173 restores token and user from localStorage at startup', async () => {
    stubFetch({ 'GET /deces/api/v1/auth': {} });
    localStorage.setItem('accessToken', JSON.stringify('jwt-saved'));
    localStorage.setItem('user', JSON.stringify('bob@example.org'));
    await renderLogin({ showLogin: true });
    await waitFor(() => expect(get(accessToken)).toBe('jwt-saved'));
    expect(get(user)).toBe('bob@example.org');
    expect(text()).toContain('Connecté en tant que bob@example.org');
  });

  it('LK-173 prefills the email with the stored user', async () => {
    stubFetch();
    localStorage.setItem('user', JSON.stringify('bob@example.org'));
    await renderLogin({ showLogin: true });
    await waitFor(() => expect(email().value).toBe('bob@example.org'));
  });

  describe('token refresh loop', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      localStorage.setItem('accessToken', JSON.stringify('jwt-0'));
      localStorage.setItem('user', JSON.stringify('bob@example.org'));
    });
    const authCalls = (fetchMock) => fetchMock.mock.calls.filter(([url]) => `${url}`.startsWith('/deces/api/v1/auth'));

    it('LK-174 refreshes at startup (GET /auth?refresh=true), checks GET /auth every 60 s, refreshes again after 1 h', async () => {
      let n = 0;
      const fetchMock = stubFetch({ 'GET /deces/api/v1/auth': () => jsonResponse({ ...tokenInfos, access_token: `jwt-${++n}` }) });
      render(Login);
      await vi.waitFor(() => expect(authCalls(fetchMock)).toHaveLength(1));
      expect(authCalls(fetchMock)[0]).toEqual(['/deces/api/v1/auth?refresh=true', { method: 'GET', headers: { Authorization: 'Bearer jwt-0' } }]);
      await vi.waitFor(() => expect(get(accessToken)).toBe('jwt-1'));
      expect(get(accessTokenInfos).access_token).toBe('jwt-1');
      await vi.advanceTimersByTimeAsync(60000);
      expect(authCalls(fetchMock)).toHaveLength(2);
      expect(authCalls(fetchMock)[1]).toEqual(['/deces/api/v1/auth', { method: 'GET', headers: { Authorization: 'Bearer jwt-1' } }]);
      expect(get(accessToken)).toBe('jwt-1'); // plain checks do not replace the token
      await vi.advanceTimersByTimeAsync(59 * 60000);
      const urls = authCalls(fetchMock).map(([url]) => url);
      expect(urls).toHaveLength(61);
      expect(urls.filter(u => u === '/deces/api/v1/auth?refresh=true')).toHaveLength(2);
      expect(urls[60]).toBe('/deces/api/v1/auth?refresh=true');
      // the 61st call (after 1 h) was a refresh: its token is stored
      expect(get(accessToken)).toBe('jwt-61');
    });

    it('LK-175 a token rejected with 422 logs the user out', async () => {
      stubFetch({ 'GET /deces/api/v1/auth': () => jsonResponse({ msg: 'invalid' }, 422) });
      render(Login);
      await vi.waitFor(() => expect(get(user)).toBe(''));
      expect(get(accessToken)).toBe('');
      expect(get(accessTokenInfos)).toEqual({});
    });

    it('LK-176 401 / 5xx / network errors are ignored and retried every 60 s: the user stays logged in', async () => {
      const responses = [
        () => jsonResponse({ msg: 'expired' }, 401),
        () => jsonResponse({ msg: 'down' }, 502),
        () => { throw new TypeError('Failed to fetch'); }
      ];
      let i = 0;
      const fetchMock = stubFetch({ 'GET /deces/api/v1/auth': () => responses[Math.min(i++, 2)]() });
      render(Login);
      await vi.waitFor(() => expect(authCalls(fetchMock)).toHaveLength(1));
      await vi.advanceTimersByTimeAsync(60000);
      await vi.advanceTimersByTimeAsync(60000);
      expect(authCalls(fetchMock)).toHaveLength(3);
      expect(get(accessToken)).toBe('jwt-0');
      expect(get(user)).toBe('bob@example.org');
      // a 401 on the refresh call is parsed as JSON without access_token: refresh is retried
      expect(authCalls(fetchMock).every(([url]) => url === '/deces/api/v1/auth?refresh=true')).toBe(true);
    });

    it('LK-177 the refresh loop only starts if a token exists at mount', async () => {
      localStorage.clear();
      const fetchMock = stubFetch({ 'GET /deces/api/v1/auth': tokenInfos });
      render(Login);
      await vi.advanceTimersByTimeAsync(0);
      accessToken.set('jwt-later');
      await vi.advanceTimersByTimeAsync(120000);
      expect(authCalls(fetchMock)).toHaveLength(0);
    });
  });

  it('LK-178 the modal close icon hides the Login modal', async () => {
    stubFetch();
    const { component } = render(Login, { showLogin: true });
    expect(modal()).not.toBeNull();
    await fireEvent.click(modal().querySelector('div[style*="top: 26px"]'));
    await waitFor(() => expect(modal()).toBeNull());
    component.$set({ showLogin: true });
    await flush();
    expect(modal()).not.toBeNull();
    await fireEvent.keyDown(modal().querySelector('div[style*="top: 26px"]'), { key: 'Escape' });
    await waitFor(() => expect(modal()).toBeNull());
  });
});
