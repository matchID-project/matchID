import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get, writable } from 'svelte/store';

// jsdom has no IndexedDB: replace idb-keyval with an in-memory map.
const idb = new Map();
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key) => idb.get(key)),
  set: vi.fn(async (key, value) => { idb.set(key, value); }),
  del: vi.fn(async (key) => { idb.delete(key); }),
  clear: vi.fn(async () => { idb.clear(); })
}));

const idbKeyval = await import('idb-keyval');
const { useLocalSync, clearAll } = await import('../../../src/components/tools/useLocalStorage.js');

beforeEach(() => {
  idb.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useLocalSync restore', () => {
  it('CO-075 restores the store from IndexedDB first', async () => {
    idb.set('linkJob', JSON.stringify({ id: 'from-idb' }));
    localStorage.setItem('linkJob', JSON.stringify({ id: 'from-localStorage' }));
    const store = writable(null);
    await useLocalSync(store, 'linkJob');
    expect(get(store)).toEqual({ id: 'from-idb' });
  });

  it('CO-075 falls back to localStorage when IndexedDB has nothing', async () => {
    localStorage.setItem('accessToken', JSON.stringify('jwt-123'));
    const store = writable('');
    await useLocalSync(store, 'accessToken');
    expect(get(store)).toBe('jwt-123');
  });

  it('CO-075 falls back to localStorage when IndexedDB throws', async () => {
    idbKeyval.get.mockRejectedValueOnce(new Error('no IndexedDB'));
    localStorage.setItem('user', JSON.stringify('jean@example.org'));
    const store = writable(undefined);
    await useLocalSync(store, 'user');
    expect(get(store)).toBe('jean@example.org');
  });

  it('CO-075 tolerates invalid JSON and keeps the initial value', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    localStorage.setItem('linkOptions', '{not json');
    const store = writable({ csv: undefined });
    await useLocalSync(store, 'linkOptions');
    expect(get(store)).toEqual({ csv: undefined });
  });

  it('CO-075 keeps the initial value when nothing is stored', async () => {
    const store = writable(42);
    await useLocalSync(store, 'nothing');
    expect(get(store)).toBe(42);
  });
});

describe('useLocalSync persist', () => {
  it('CO-076 persists values below 1 MB to localStorage', async () => {
    const store = writable(null);
    await useLocalSync(store, 'linkMapping');
    store.set({ nom: 'lastName' });
    expect(localStorage.getItem('linkMapping')).toBe('{"nom":"lastName"}');
    expect(idbKeyval.set).not.toHaveBeenCalled();
  });

  it('CO-076 persists values of 1 MB or more to IndexedDB, deferred by 100 ms', async () => {
    vi.useFakeTimers();
    const store = writable(null);
    await useLocalSync(store, 'linkResults');
    const big = ['x'.repeat(1_000_000)];
    store.set(big);
    expect(localStorage.getItem('linkResults')).toBeNull();
    expect(idbKeyval.set).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(idbKeyval.set).toHaveBeenCalledWith('linkResults', JSON.stringify(big));
  });

  it('CO-077 removes the key from both storages on null or undefined', async () => {
    idb.set('accessToken', '"old"');
    localStorage.setItem('accessToken', '"old"');
    const store = writable('');
    await useLocalSync(store, 'accessToken');
    store.set(null);
    await vi.waitFor(() => expect(idbKeyval.del).toHaveBeenCalledWith('accessToken'));
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(idb.has('accessToken')).toBe(false);
    store.set('again');
    store.set(undefined);
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('CO-077 an empty string is persisted, not removed', async () => {
    const store = writable(null);
    await useLocalSync(store, 'accessToken');
    store.set('');
    expect(localStorage.getItem('accessToken')).toBe('""');
  });
});

describe('clearAll', () => {
  it('CO-078 clears IndexedDB only (localStorage is kept)', async () => {
    idb.set('linkResults', '[]');
    localStorage.setItem('linkJob', '{}');
    await clearAll();
    expect(idbKeyval.clear).toHaveBeenCalledTimes(1);
    expect(idb.size).toBe(0);
    expect(localStorage.getItem('linkJob')).toBe('{}');
  });
});
