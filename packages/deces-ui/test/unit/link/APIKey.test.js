import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

vi.mock('idb-keyval', async () => (await import('./idb-mock.js')).idbKeyvalMock);
vi.mock('../../../src/components/tools/search.js', () => ({ URLSearchSubmit: vi.fn(), getById: vi.fn() }));

const { default: APIKey } = await import('../../../src/components/views/APIKey.svelte');
const { default: MatchIDHeader } = await import('../../../src/components/views/MatchIDHeader.svelte');
const { accessToken, accessTokenInfos, user, route } = await import('../../../src/components/tools/stores.js');
const { icons } = await import('../../../src/components/tools/icons.js');
const { resetLinkStores, stubFetch, flush, iconNames } = await import('./helpers.js');

const infos = { access_token: 'jwt-key', created_at: '1700000000', expiration_date: '1700003600', renewal_limit_date: '1700086400' };
const modal = () => document.querySelector('.modal');
const date = (s) => new Date(parseInt(s) * 1000).toLocaleString();
const iconIn = (button) => button.querySelector('.rf-fi--md');

describe('API Key modal (APIKey.svelte)', () => {
  let writeText;
  beforeEach(() => {
    resetLinkStores();
    vi.spyOn(window, 'blur').mockImplementation(() => {}); // not implemented by jsdom
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    accessToken.set('jwt-key');
    accessTokenInfos.set(infos);
    user.set('bob@example.org');
  });
  afterEach(() => vi.useRealTimers());

  it('LK-191 the "API Key" menu entry exists only when logged in and opens the modal with the token and its dates', async () => {
    stubFetch();
    route.set({ path: '/search', query: {} });
    user.set(undefined);
    const { container } = render(MatchIDHeader);
    expect(container.querySelector('#rf-admin a[title="API Key"]')).toBeNull();
    user.set('bob@example.org');
    await flush();
    await fireEvent.click(container.querySelector('#rf-admin a[title="API Key"]'));
    expect(modal().querySelector('h4').textContent).toBe('API Key');
    expect(modal().querySelector('input[readonly]').value).toBe('jwt-key');
    const text = modal().textContent.replace(/\s+/g, ' ');
    expect(text).toContain(`Date de création : ${date(infos.created_at)}`);
    expect(text).toContain(`Date d'expiration : ${date(infos.expiration_date)}`);
    expect(text).toContain(`Date limite de renouvellement : ${date(infos.renewal_limit_date)}`);
  });

  // BUG: the inline OTP login (LoginField) stores the token but not
  // accessTokenInfos, so until the next refresh/reload the API Key modal shows
  // an empty key and "Invalid Date".
  it.fails('LK-191 shows valid dates right after an inline OTP login (accessTokenInfos not set)', () => {
    accessTokenInfos.set({});
    render(APIKey, { showAPIKey: true });
    expect(modal().textContent).not.toContain('Invalid Date');
  });

  it('LK-192 "Copier clé" copies the token and shows a check icon for 2 s', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    render(APIKey, { showAPIKey: true });
    const button = screen.getByText('Copier clé').closest('button');
    expect(iconNames(button, icons)).toEqual(['ri:clipboard-line']);
    await fireEvent.click(button);
    expect(writeText).toHaveBeenCalledWith('jwt-key');
    expect(iconIn(button).classList.contains('rf-fi--valid')).toBe(true);
    expect(iconNames(button, icons)).toEqual(['ri:check-line']);
    await vi.advanceTimersByTimeAsync(1999);
    expect(iconIn(button).classList.contains('rf-fi--valid')).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(iconIn(button).classList.contains('rf-fi--valid')).toBe(false);
    expect(iconNames(button, icons)).toEqual(['ri:clipboard-line']);
  });

  it('LK-193 "Copier lien" copies /search?user=…&accessToken=…', async () => {
    render(APIKey, { showAPIKey: true });
    const button = screen.getByText('Copier lien').closest('button');
    await fireEvent.click(button);
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/search?user=bob@example.org&accessToken=jwt-key`);
    expect(iconIn(button).classList.contains('rf-fi--valid')).toBe(true);
  });

  it('LK-194 "Fermer" closes the modal', async () => {
    render(APIKey, { showAPIKey: true });
    await fireEvent.click(screen.getByText('Fermer').closest('button'));
    await waitFor(() => expect(modal()).toBeNull(), { timeout: 3000 }); // fade + slide outros
  });
});
