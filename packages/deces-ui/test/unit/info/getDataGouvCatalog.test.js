// Inventory zone IN, tools/getDataGouvCatalog.js (rows IN-201 .. IN-204).
// The module keeps state (`loading`, cached store value): each test loads a
// fresh copy of it and of the stores.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

let getDataGouvCatalog;
let dataGouvCatalog;

const catalogResponse = (body, status = 200) => ({ status, json: async () => body });

const resources = () => ({
  resources: [
    { title: 'deces-2020.txt', url: '/data.gouv.fr/resources/fichier/deces-2020.txt' },
    { title: 'deces-2021-m01.txt', url: '/data.gouv.fr/resources/fichier/deces-2021-m01.txt' },
    { title: 'documentation.pdf', url: '/data.gouv.fr/resources/fichier/documentation.pdf' },
    { title: 'deces-1999.txt' },
    { url: '/data.gouv.fr/resources/fichier/orphan.txt' }
  ]
});

beforeEach(async () => {
  vi.resetModules();
  ({ default: getDataGouvCatalog } = await import('../../../src/components/tools/getDataGouvCatalog.js'));
  ({ dataGouvCatalog } = await import('../../../src/components/tools/stores.js'));
});

describe('getDataGouvCatalog', () => {
  it('IN-201 fetches the data.gouv catalog and maps year -> proxied URL, then stores it', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(catalogResponse(resources()));
    const catalog = await getDataGouvCatalog();
    expect(fetchMock).toHaveBeenCalledWith('/data.gouv.fr/catalog', { method: 'GET' });
    expect(catalog).toEqual({
      2020: '/data.gouv.fr/fichier/deces-2020.txt',
      '2021-m01': '/data.gouv.fr/fichier/deces-2021-m01.txt',
      // titles that are not "deces-*.txt" are kept as is (pinned)
      'documentation.pdf': '/data.gouv.fr/fichier/documentation.pdf'
    });
    expect(get(dataGouvCatalog)).toEqual(catalog);
  });

  it('IN-202 later calls return the stored catalog without fetching again', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(catalogResponse(resources()));
    const first = await getDataGouvCatalog();
    const second = await getDataGouvCatalog();
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('IN-202 a catalog already in the store is returned without fetching', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    dataGouvCatalog.set({ 2019: '/x' });
    expect(await getDataGouvCatalog()).toEqual({ 2019: '/x' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('IN-203 an HTTP status >= 300 returns null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(catalogResponse({}, 404));
    expect(await getDataGouvCatalog()).toBeNull();
    expect(get(dataGouvCatalog)).toBeNull();
  });

  it('IN-203 a payload without resources returns null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(catalogResponse({ title: 'no resources' }));
    expect(await getDataGouvCatalog()).toBeNull();
  });

  it('IN-204 a concurrent call while loading returns undefined', async () => {
    let resolve;
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(r => { resolve = r; }));
    const first = getDataGouvCatalog();
    expect(await getDataGouvCatalog()).toBeUndefined();
    resolve(catalogResponse(resources()));
    expect(await first).toHaveProperty('2020');
  });

  it('IN-204 after a failure, later calls return undefined forever (pinned)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(catalogResponse({}, 503))
      .mockResolvedValue(catalogResponse(resources()));
    expect(await getDataGouvCatalog()).toBeNull();
    expect(await getDataGouvCatalog()).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // BUG: `loading = false` (getDataGouvCatalog.js:43) is unreachable, so the
  // catalog is never retried after a failed call.
  it.fails('IN-204 BUG: a failed call is retried by the next call', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(catalogResponse({}, 503))
      .mockResolvedValue(catalogResponse(resources()));
    await getDataGouvCatalog();
    expect(await getDataGouvCatalog()).toHaveProperty('2020');
  });
});
