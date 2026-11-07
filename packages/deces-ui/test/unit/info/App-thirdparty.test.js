// Inventory zone IN, App.svelte third-party integrations and theme toggle
// (rows IN-056, IN-058, IN-185 .. IN-188) and GoogleAdsense.svelte.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';

vi.mock('register-service-worker', () => ({ register: vi.fn() }));
vi.mock('shake.js', () => ({ default: class { start() {} } }));
// Would be instantiated if App rendered <GoogleAnalytics>.
vi.mock('@beyonk/svelte-google-analytics', () => ({ GoogleAnalytics: vi.fn() }));
vi.mock('../../../src/components/tools/search.js', async (importOriginal) => ({
  ...(await importOriginal()),
  URLSearchSubmit: vi.fn()
}));

const { default: App } = await import('../../../src/App.svelte');
const { default: GoogleAdsense } = await import('../../../src/components/views/GoogleAdsense.svelte');
const { GoogleAnalytics } = await import('@beyonk/svelte-google-analytics');
const { route, themeDnum, liveConfig, version } = await import('../../../src/components/tools/stores.js');
const { resetStores, mockFetch } = await import('./helpers.js');

const liveConfigBody = { googleAnalyticsId: 'G-TEST', googleAdsenseId: 'ca-pub-TEST' };
const injectedScripts = () => [...document.querySelectorAll('script')].map(s => s.getAttribute('src') || '');

// App.svelte expects the elements of public/index.html.
const setUpShell = () => {
  document.head.innerHTML = '<meta name="description" content=""><script src="/build/main.js"></script>';
  const info = document.createElement('div');
  info.id = 'infoNotWorking';
  document.body.appendChild(info);
};

describe('App third-party integrations and theme', () => {
  beforeEach(() => {
    resetStores();
    setUpShell();
    window.history.replaceState({}, '', '/about');
    route.set({ path: '/about', query: {}, hash: '' });
  });

  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('IN-188 /liveConfig.json is fetched once on mount (after /version) and stored', async () => {
    const fetchMock = mockFetch({ '/liveConfig.json': liveConfigBody, '/version': { backend: '1.2.3' } });
    render(App);
    await waitFor(() => expect(get(liveConfig)).toEqual(liveConfigBody));
    const urls = fetchMock.mock.calls.map(c => c[0]);
    expect(urls.filter(u => u === '/liveConfig.json')).toHaveLength(1);
    expect(urls.indexOf('/deces/api/v1/version')).toBeLessThan(urls.indexOf('/liveConfig.json'));
    expect(get(version).api).toBe('1.2.3');
  });

  it('IN-188 /liveConfig.json is not fetched again when already loaded', async () => {
    liveConfig.set({ googleAnalyticsId: 'G-1' });
    const fetchMock = mockFetch({ '/version': { backend: '1.2.3' } });
    render(App);
    await waitFor(() => expect(get(version).api).toBe('1.2.3'));
    expect(fetchMock.mock.calls.map(c => c[0])).not.toContain('/liveConfig.json');
  });

  it('IN-185 / IN-186 Google Analytics and Adsense stay disabled (`&& false`) even with ids in the public theme', async () => {
    mockFetch({ '/liveConfig.json': liveConfigBody, '/version': { backend: '1.2.3' } });
    render(App);
    await waitFor(() => expect(get(liveConfig)).toEqual(liveConfigBody));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(get(themeDnum)).toBe(0);
    expect(GoogleAnalytics).not.toHaveBeenCalled();
    expect(injectedScripts().filter(src => /googlesyndication|googletagmanager|google-analytics/.test(src))).toEqual([]);
  });

  it('IN-058 /about sets the document title "matchID - À propos" and renders the page title', async () => {
    mockFetch();
    render(App);
    await waitFor(() => expect(document.title).toBe('matchID - À propos'));
    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent.trim())).toContain('À propos');
    expect(document.querySelector('meta[name="description"]').getAttribute('content')).toMatch(/^À propos de matchID/);
    expect(document.getElementById('infoNotWorking')).toBeNull();
  });

  it('IN-056 Ctrl+Alt+D toggles the theme live (header logo switches)', async () => {
    mockFetch();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(App);
    expect(screen.getByAltText('matchID Logo')).toBeTruthy();
    await fireEvent.keyDown(window, { key: 'd', ctrlKey: true, altKey: true });
    await waitFor(() => expect(screen.getAllByAltText('DNUM Logo').length).toBeGreaterThan(0));
    expect(get(themeDnum)).toBe(1);
    expect(log).toHaveBeenCalledWith('switch theme to DNUM');
    await fireEvent.keyDown(window, { key: 'd', ctrlKey: true, altKey: true });
    await waitFor(() => expect(screen.getByAltText('matchID Logo')).toBeTruthy());
    expect(get(themeDnum)).toBe(0);
  });

  it('IN-056 "d" without Ctrl+Alt does not toggle the theme', async () => {
    mockFetch();
    render(App);
    await fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
    await fireEvent.keyDown(window, { key: 'd' });
    expect(get(themeDnum)).toBe(0);
  });
});

describe('GoogleAdsense', () => {
  beforeEach(() => {
    document.head.innerHTML = '<script src="/build/main.js"></script>';
  });

  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('IN-187 inserts the async adsbygoogle.js script with the client id before the first script, and logs on load', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(GoogleAdsense, { id: 'ca-pub-123' });
    await waitFor(() => expect(document.querySelectorAll('script')).toHaveLength(2));
    const [ads, main] = document.querySelectorAll('script');
    expect(ads.getAttribute('src')).toBe('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-123');
    expect(ads.async).toBeTruthy();
    expect(main.getAttribute('src')).toBe('/build/main.js');
    ads.onload({}, false);
    expect(log).toHaveBeenCalledWith('Google Adsense script loaded and registered with ID ca-pub-123');
    expect(ads.onload).toBeNull();
  });
});
