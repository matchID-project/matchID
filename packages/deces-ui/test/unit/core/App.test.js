import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/svelte';
import { person } from './helpers.js';

// jsdom has no IndexedDB (used by useLocalSync): keep it in memory.
vi.mock('idb-keyval', () => {
  const db = new Map();
  return {
    get: async (key) => db.get(key),
    set: async (key, value) => { db.set(key, value); },
    del: async (key) => { db.delete(key); },
    clear: async () => { db.clear(); }
  };
});

const versionPayload = { backend: '9.9.9', data: '20260101' };
const emptySearch = { response: { total: 0, size: 20, persons: [] } };

// Mirror the parts of public/index.html that App.svelte relies on.
const setupDocument = () => {
  document.head.innerHTML = `
    <meta name="description" content="initial description">
    <link rel="canonical" href="https://deces.matchid.io">`;
  document.title = 'initial';
  const info = document.createElement('div');
  info.id = 'infoNotWorking';
  info.textContent = 'navigateur incompatible';
  document.body.appendChild(info);
};

const reply = (payload) => (payload instanceof Error ? Promise.reject(payload) : new Response(JSON.stringify(payload)));

const backend = ({ liveConfig = { googleAnalyticsId: '', googleAdsenseId: '' }, version = versionPayload } = {}) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = `${url}`;
    if (u === '/deces/api/v1/version') return reply(version);
    if (u === '/liveConfig.json') return reply(liveConfig);
    if (u === '/deces/api/v1/search') return reply(emptySearch);
    if (u.startsWith('/deces/api/v1/id/')) return reply({ response: { persons: [person()] } });
    return new Response('{}');
  });

let fetchMock;

// App.svelte, the router and the stores are module singletons whose initial
// state comes from `location`: load fresh instances for each start URL.
const boot = async (url, options) => {
  window.history.replaceState({}, '', url);
  setupDocument();
  fetchMock = backend(options);
  vi.resetModules();
  const stores = await import('../../../src/components/tools/stores.js');
  const router = await import('../../../src/components/tools/routes.js');
  const { default: App } = await import('../../../src/App.svelte');
  const result = render(App);
  return { ...result, stores, router };
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  // pages lazy-load chunks (Info, Geo...): let them settle before teardown
  await vi.dynamicImportSettled();
  cleanup();
  document.getElementById('infoNotWorking')?.remove();
});

const canonical = () => document.querySelector("link[rel='canonical']").getAttribute('href');
const description = () => document.querySelector('meta[name="description"]').getAttribute('content');
const h2 = () => screen.getByRole('heading', { level: 2 }).textContent.trim();

describe('CO-015 route rendering', () => {
  it('CO-015 renders the component of the current route and switches on navigation', async () => {
    const { container, router } = await boot('/about');
    await waitFor(() => expect(h2()).toBe('À propos'));
    expect(container.querySelector('main #q')).toBeNull();
    router.goTo({ path: '/search' });
    await waitFor(() => expect(container.querySelector('main #q')).not.toBeNull());
  });

  it('CO-015 an unknown path renders the 404 page', async () => {
    await boot('/does-not-exist');
    await waitFor(() => expect(h2()).toBe('Pas de page à l\'adresse indiquée'));
    expect(location.pathname).toBe('/notFound');
  });
});

describe('CO-011 / CO-012 / CO-013 document title, description and canonical link', () => {
  it.each([
    ['/about', 'À propos'],
    ['/link', 'Appariement'],
    ['/explain', 'Explication de l\'algorithme'],
    ['/search', 'Moteur de recherche des personnes décédées'],
    ['/nope', '404 - Pas de page à l\'adresse indiquée']
  ])('CO-011 %s has the title "matchID - %s"', async (path, title) => {
    const { router } = await boot(path);
    expect(document.title).toBe(`matchID - ${title}`);
    // CO-012 the description follows the route
    expect(description()).toBe(router.routes[location.pathname].desc);
  });

  it('CO-011 /search with results: "matchID - recherche <summary>"', async () => {
    const { stores } = await boot('/search');
    stores.wasSearched.set('DUPONT Jean');
    await waitFor(() => expect(document.title).toBe('matchID - recherche DUPONT Jean'));
  });

  it('CO-011 /id with a record: "matchID - <summary>"', async () => {
    const { stores } = await boot('/id/AbCdEfGhIjKl');
    await waitFor(() => expect(get(stores.wasSearched)).toMatch(/DUPONT/));
    // document.title collapses the whitespace of the multi-line summary
    expect(document.title).toBe(`matchID - ${get(stores.wasSearched).replace(/\s+/g, ' ').trim()}`);
    expect(document.title.startsWith('matchID - recherche')).toBe(false);
  });

  it('CO-012 with results the description is "résultats de la recherche pour <summary>"', async () => {
    const { stores } = await boot('/search');
    stores.wasSearched.set('DUPONT Jean');
    await waitFor(() => expect(description()).toBe('résultats de la recherche pour DUPONT Jean'));
  });

  it('CO-013 canonical link: stripped of query and hash without results, full URL with results', async () => {
    const { stores } = await boot('/search?q=dupont+jean#top');
    expect(canonical()).toBe(`${location.origin}/search`);
    expect(document.querySelectorAll("link[rel='canonical']")).toHaveLength(1);
    stores.wasSearched.set('Dupont Jean');
    await waitFor(() => expect(canonical()).toBe(location.href));
    expect(canonical()).toContain('q=dupont');
  });

  it('CO-013 creates the canonical link when index.html has none', async () => {
    window.history.replaceState({}, '', '/about');
    document.head.innerHTML = '<meta name="description" content="x">';
    await boot('/about');
    expect(canonical()).toBe(`${location.origin}/about`);
  });
});

describe('CO-014 token in the URL', () => {
  it('CO-014 /search?accessToken=..&user=.. stores token and user in localStorage when not logged in', async () => {
    const { stores } = await boot('/search?accessToken=jwt-from-url&user=jean%40example.org');
    expect(JSON.parse(localStorage.getItem('accessToken'))).toBe('jwt-from-url');
    expect(JSON.parse(localStorage.getItem('user'))).toBe('jean@example.org');
    // Login.svelte then restores the session from localStorage
    await waitFor(() => expect(get(stores.accessToken)).toBe('jwt-from-url'));
  });

  it('CO-014 needs both accessToken and user', async () => {
    await boot('/search?accessToken=jwt-from-url');
    expect(JSON.parse(localStorage.getItem('accessToken') || 'null')).not.toBe('jwt-from-url');
  });

  it('CO-014 is ignored outside /search', async () => {
    await boot('/about?accessToken=jwt-from-url&user=jean%40example.org');
    expect(JSON.parse(localStorage.getItem('accessToken') || 'null')).not.toBe('jwt-from-url');
    expect(localStorage.getItem('user')).toBeNull();
  });
});

describe('CO-079 / CO-080 startup requests', () => {
  it('CO-079 fills version.api and version.data from <BACKEND_PROXY_PATH>/version', async () => {
    const { stores } = await boot('/about');
    await waitFor(() => expect(get(stores.version).api).toBe('9.9.9'));
    expect(get(stores.version)).toEqual({ ui: 'deces-ui version test', api: '9.9.9', data: versionPayload });
    expect(fetchMock).toHaveBeenCalledWith('/deces/api/v1/version');
  });

  it('CO-079 a version failure is silent', async () => {
    const { stores } = await boot('/about', { version: new Error('offline') });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/liveConfig.json'));
    expect(get(stores.version)).toEqual({ ui: 'deces-ui version test' });
  });

  it('CO-080 fills liveConfig from /liveConfig.json', async () => {
    const { stores } = await boot('/about', { liveConfig: { googleAnalyticsId: 'G-1', googleAdsenseId: 'ca-2' } });
    await waitFor(() => expect(get(stores.liveConfig)).toEqual({ googleAnalyticsId: 'G-1', googleAdsenseId: 'ca-2' }));
  });

  it('CO-080 a liveConfig failure is logged and leaves liveConfig empty', async () => {
    const error = new Error('no liveConfig');
    const { stores } = await boot('/about', { liveConfig: error });
    await waitFor(() => expect(console.log).toHaveBeenCalledWith(error));
    expect(get(stores.liveConfig)).toBeNull();
  });
});

describe('CO-081 Google Analytics / AdSense', () => {
  it('CO-081 stay disabled even when liveConfig provides ids', async () => {
    const { stores } = await boot('/search', { liveConfig: { googleAnalyticsId: 'G-TEST', googleAdsenseId: 'ca-pub-TEST' } });
    await waitFor(() => expect(get(stores.liveConfig)).not.toBeNull());
    const thirdParty = [...document.querySelectorAll('script[src]')]
      .map(s => s.src)
      .filter(src => /googletagmanager|googlesyndication|google-analytics/.test(src));
    expect(thirdParty).toEqual([]);
    expect(fetchMock.mock.calls.map(([u]) => `${u}`).filter(u => /google/.test(u))).toEqual([]);
    // only the id is logged
    expect(console.log).toHaveBeenCalledWith('GA: G-TEST');
  });
});

describe('CO-084 / CO-085 / CO-086 keyboard shortcuts and shake', () => {
  it('CO-084 Ctrl+Alt+D toggles the DNUM theme', async () => {
    const { stores } = await boot('/about');
    expect(get(stores.themeDnum)).toBe(0);
    await fireEvent.keyDown(window, { key: 'd', ctrlKey: true, altKey: true });
    expect(get(stores.themeDnum)).toBe(1);
    await fireEvent.keyDown(window, { key: 'd', ctrlKey: true, altKey: true });
    expect(get(stores.themeDnum)).toBe(0);
    await fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
    await fireEvent.keyDown(window, { key: 'd', altKey: true });
    expect(get(stores.themeDnum)).toBe(0);
  });

  it('CO-085 Ctrl+Alt+A toggles the alpha features', async () => {
    const { stores } = await boot('/about');
    expect(get(stores.alphaFeatures)).toBe(true);
    await fireEvent.keyDown(window, { key: 'a', ctrlKey: true, altKey: true });
    expect(get(stores.alphaFeatures)).toBe(false);
    await fireEvent.keyDown(window, { key: 'a', ctrlKey: true, altKey: true });
    expect(get(stores.alphaFeatures)).toBe(true);
    await fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    expect(get(stores.alphaFeatures)).toBe(true);
  });

  it('CO-086 a device "shake" event toggles the alpha features', async () => {
    const { stores } = await boot('/about');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/liveConfig.json'));
    // the shake listener is added at the end of onMount, after both fetches
    await waitFor(() => {
      window.dispatchEvent(new Event('shake'));
      expect(get(stores.alphaFeatures)).toBe(false);
    });
    window.dispatchEvent(new Event('shake'));
    expect(get(stores.alphaFeatures)).toBe(true);
  });
});

describe('CO-087 startup fallback message', () => {
  it('CO-087 the app removes #infoNotWorking when it starts', async () => {
    expect(document.getElementById('infoNotWorking')).toBeNull();
    await boot('/search');
    expect(document.getElementById('infoNotWorking')).toBeNull();
  });
});

describe('CO-018 deep link advanced=true in the app', () => {
  it('CO-018 an anonymous user deep-linking advanced=true gets the advanced form', async () => {
    const { container, stores } = await boot('/search?advanced=true&ln=dupont');
    await waitFor(() => expect(container.querySelector('#ln')).not.toBeNull());
    expect(get(stores.advancedSearch)).toBe(true);
    expect(container.querySelector('#ln').value).toBe('dupont');
  });

  // BUG: App.svelte re-runs URLSearchSubmit(location.search) whenever
  // $accessToken changes; Login.svelte restores the token on mount, so for a
  // logged-in user URLSearchSubmit toggles the canvas a second time and the
  // simple form is displayed although advancedSearch is true.
  it.fails('CO-018 BUG: a logged-in user deep-linking advanced=true keeps the advanced form', async () => {
    localStorage.setItem('accessToken', JSON.stringify('jwt'));
    localStorage.setItem('user', JSON.stringify('jean@example.org'));
    const { stores } = await boot('/search?advanced=true&ln=dupont');
    await waitFor(() => expect(get(stores.accessToken)).toBe('jwt'));
    expect(get(stores.advancedSearch)).toBe(true);
    expect(get(stores.searchCanvas).name.active).toBe(true);
  });
});
