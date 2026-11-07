import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import sum from 'hash-sum';
import fs from 'node:fs';
import path from 'node:path';
import buildRequest, { validScrollId } from '../../../src/components/tools/buildRequest.js';
import buildRequestFilter from '../../../src/components/tools/buildRequestFilter.js';
import {
  searchInput, sortInput, current, resultsPerPage, scrollId, fuzzySearch, scrollIdTimeout
} from '../../../src/components/tools/stores.js';

const defaultSort = structuredClone(get(sortInput).map(({ label, input, field, order }) => ({ label, input, field, order })));

const input = (values = {}) => {
  const v = structuredClone(Object.fromEntries(
    Object.entries(get(searchInput)).map(([key, field]) => [key, { url: field.url, backendQuery: field.backendQuery, value: '' }])
  ));
  Object.entries(values).forEach(([key, value]) => { v[key].value = value; });
  return v;
};

const contextOf = (searchInputValue, sortInputValue) =>
  sum(JSON.stringify(searchInputValue) + JSON.stringify(sortInputValue));

beforeEach(() => {
  current.set(1);
  resultsPerPage.set(20);
  scrollId.set(null);
  fuzzySearch.set(true);
  sortInput.set(structuredClone(defaultSort));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CO-048 buildRequest body', () => {
  it('CO-048 page 1: fuzzy as a string, page, size, scroll=1m and no scrollId', () => {
    const body = buildRequest(input({ lastName: 'dupont' }));
    expect(body).toMatchObject({ fuzzy: 'true', page: 1, size: 20, scroll: '1m', scrollId: undefined });
    fuzzySearch.set(false);
    expect(buildRequest(input({ lastName: 'dupont' })).fuzzy).toBe('false');
  });

  it('CO-048 page > 1 with a valid scrollId: sends the scrollId and scroll=1m', () => {
    const search = input({ lastName: 'dupont' });
    current.set(2);
    scrollId.set({ id: 'scroll-1', context: contextOf(search, get(sortInput)), date: Date.now() });
    const body = buildRequest(search);
    expect(body).toMatchObject({ page: 2, scrollId: 'scroll-1', scroll: '1m' });
  });

  it('CO-048 page > 1 without a valid scrollId: no scroll and no scrollId', () => {
    current.set(3);
    scrollId.set({ id: 'scroll-1', context: 'other-search', date: Date.now() });
    const body = buildRequest(input({ lastName: 'dupont' }));
    expect(body).toMatchObject({ page: 3, scroll: undefined, scrollId: undefined });
  });

  it('CO-048 explicit options override page, size and scrollId', () => {
    const body = buildRequest(input({ lastName: 'dupont' }), { page: 4, size: 100, scrollId: 'given' });
    expect(body).toMatchObject({ page: 4, size: 100, scrollId: 'given', scroll: '1m' });
  });

  it('CO-048 the body carries no Elasticsearch query or filter (the backend builds them)', () => {
    const body = buildRequest(input({ lastName: 'dupont' }));
    expect(Object.keys(body).sort()).toEqual(['fuzzy', 'lastName', 'page', 'scroll', 'scrollId', 'size', 'sort']);
  });
});

describe('CO-049 buildRequest field mapping', () => {
  it('CO-049 maps fullText to the backend key q and other fields by store key, skipping empty ones', () => {
    const body = buildRequest(input({ fullText: 'dupont jean' }));
    expect(body.q).toBe('dupont jean');
    expect(body.fullText).toBeUndefined();
    const advanced = buildRequest(input({ lastName: 'dupont', firstName: 'jean', deathDepartment: '33', birthDate: '1932' }));
    expect(advanced).toMatchObject({ lastName: 'dupont', firstName: 'jean', deathDepartment: '33', birthDate: '1932' });
    expect('deathCity' in advanced).toBe(false);
  });
});

describe('CO-050 validScrollId', () => {
  it('CO-050 returns undefined without a scroll id', () => {
    expect(validScrollId(null, input(), defaultSort)).toBeUndefined();
  });

  it('CO-050 returns the id for the same search and sort within 59 s', () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const search = input({ lastName: 'dupont' });
    const scroll = { id: 'abc', context: contextOf(search, defaultSort), date: Date.now() };
    vi.setSystemTime(1_000_000 + scrollIdTimeout - 1);
    expect(validScrollId(scroll, search, defaultSort)).toBe('abc');
    expect(scrollIdTimeout).toBe(59000);
  });

  it('CO-050 expires after 59 s', () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const search = input({ lastName: 'dupont' });
    const scroll = { id: 'abc', context: contextOf(search, defaultSort), date: Date.now() };
    vi.setSystemTime(1_000_000 + scrollIdTimeout + 1);
    expect(validScrollId(scroll, search, defaultSort)).toBeUndefined();
  });

  it('CO-050 is invalidated by a change of search or sort', () => {
    const search = input({ lastName: 'dupont' });
    const scroll = { id: 'abc', context: contextOf(search, defaultSort), date: Date.now() };
    expect(validScrollId(scroll, input({ lastName: 'durand' }), defaultSort)).toBeUndefined();
    const sorted = structuredClone(defaultSort);
    sorted[1].order = 'asc';
    expect(validScrollId(scroll, search, sorted)).toBeUndefined();
  });
});

describe('CO-051 buildSort', () => {
  it('CO-051 keeps only the sort entries that have an order', () => {
    expect(buildRequest(input({ lastName: 'dupont' })).sort).toEqual([{ score: 'desc' }]);
    const sorted = structuredClone(defaultSort);
    sorted[1].order = 'asc';
    sorted[8].order = 'desc';
    sortInput.set(sorted);
    expect(buildRequest(input({ lastName: 'dupont' })).sort).toEqual([
      { score: 'desc' }, { lastName: 'asc' }, { deathDate: 'desc' }
    ]);
  });
});

describe('CO-052 buildRequestFilter (dead code)', () => {
  // buildRequestFilter.js is a copy of the Elastic search-ui sample (fields
  // `states`, `acres`...). It is imported by buildRequest.js but never called:
  // pin that status so that a migration does not wire it in by accident.
  it('CO-052 is never called by the application code', () => {
    const toolsDir = path.resolve(__dirname, '../../../src/components/tools');
    const viewsDir = path.resolve(__dirname, '../../../src/components/views');
    const files = [
      ...fs.readdirSync(toolsDir).map(f => path.join(toolsDir, f)),
      ...fs.readdirSync(viewsDir).map(f => path.join(viewsDir, f))
    ].filter(f => /\.(js|svelte)$/.test(f) && !f.endsWith('buildRequestFilter.js'));
    const calls = files.filter(f => /buildRequestFilter\s*\(/.test(fs.readFileSync(f, 'utf8')));
    expect(calls).toEqual([]);
  });

  it('CO-052 returns nothing for no filter or unknown fields', () => {
    expect(buildRequestFilter(undefined)).toBeUndefined();
    expect(buildRequestFilter([{ field: 'lastName', type: 'any', values: ['x'] }])).toBeUndefined();
  });
});
