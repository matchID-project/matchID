// Shared helpers for the "info" zone unit tests (header, about/FAQ, stats,
// charts, explain page, icons). Not a test file: it is not matched by the
// `test/unit/**/*.test.js` include pattern.
import { vi } from 'vitest';
import {
  accessToken, user, admin, route, themeDnum, advancedSearch, displayMode,
  wasSearched, firstSearch, version, activeElement, liveConfig, searchTyping,
  dataGouvCatalog
} from '../../../src/components/tools/stores.js';

// __BACKEND_TOKEN_USER__ in vitest.config.mjs
export const ADMIN_USER = 'admin@example.org';

// Put the stores this zone reads back to their initial values. Stores are
// module singletons shared by all the tests of a file.
export const resetStores = () => {
  accessToken.set('');
  user.set(undefined);
  admin.set(false);
  route.set({ path: '/search', query: {} });
  themeDnum.set(0);
  advancedSearch.set(false);
  displayMode.set('card');
  wasSearched.set(false);
  firstSearch.set(true);
  version.set({ ui: 'deces-ui version test' });
  activeElement.set(undefined);
  liveConfig.set(null);
  searchTyping.set(0);
  dataGouvCatalog.set(null);
};

// Log a user in the way Login.svelte (mounted by the header) expects it:
// stores + localStorage, which Login re-reads on mount. Login then derives
// `admin` from `user === __BACKEND_TOKEN_USER__`.
export const loginAs = (name) => {
  localStorage.setItem('accessToken', JSON.stringify(`token-${name}`));
  localStorage.setItem('user', JSON.stringify(name));
  accessToken.set(`token-${name}`);
  user.set(name);
};

// Answer fetch() calls from a table of URL substrings to JSON bodies (or
// Response factories). Unknown URLs get an empty JSON object.
export const mockFetch = (table = {}) => vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
  const key = Object.keys(table).find(k => `${url}`.includes(k));
  if (key === undefined) return new Response('{}');
  const value = table[key];
  if (typeof value === 'function') return value(url);
  return new Response(typeof value === 'string' ? value : JSON.stringify(value));
});

// The charts and maps read the DSFR colour from a CSS custom property at
// init; jsdom has no stylesheet, so set it inline.
export const setDsfrColors = () => {
  for (const [name, color] of [['--bf500', '#000091'], ['--success', '#008941'], ['--warning', '#b34000'], ['--rm500', '#e1000f']]) {
    document.body.style.setProperty(name, color);
  }
};

export const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));
