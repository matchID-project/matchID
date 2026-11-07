import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { buildURLParams, searchURLUpdate, URLSearchSubmit } from '../../../src/components/tools/search.js';
import * as stores from '../../../src/components/tools/stores.js';
import { resetSearchState, setFields, fieldValues } from './helpers.js';

const submit = (query) => URLSearchSubmit(new URLSearchParams(query));

const emptyInput = () => Object.fromEntries(
  Object.entries(get(stores.searchInput)).map(([key, field]) => [key, { url: field.url, value: '' }])
);

beforeEach(resetSearchState);

describe('URL -> state (URLSearchSubmit)', () => {
  it.each(['card', 'card-expand', 'table', 'geo', 'agg'])('CO-016 view=%s restores the display mode', async (view) => {
    stores.displayMode.set('card');
    await submit(`q=dupont&view=${view}`);
    expect(get(stores.displayMode)).toBe(view);
  });

  it('CO-016 no view= falls back to card', async () => {
    stores.displayMode.set('table');
    await submit('q=dupont');
    expect(get(stores.displayMode)).toBe('card');
  });

  it('CO-017 fuzzy=false disables fuzzy search on the store and on every field', async () => {
    await submit('ln=dupont&fuzzy=false');
    expect(get(stores.fuzzySearch)).toBe(false);
    expect(Object.values(get(stores.searchInput)).every(f => f.fuzzy === false)).toBe(true);
  });

  it('CO-017 without fuzzy= the fuzzy flag is left as is (not re-enabled) and fields follow it', async () => {
    await submit('ln=dupont');
    expect(get(stores.fuzzySearch)).toBe(true);
    expect(Object.values(get(stores.searchInput)).every(f => f.fuzzy === 'auto')).toBe(true);
    stores.fuzzySearch.set(false);
    await submit('ln=dupont');
    expect(get(stores.fuzzySearch)).toBe(false);
  });

  it('CO-018 advanced=true opens the advanced form (canvas toggled)', async () => {
    await submit('advanced=true&ln=dupont');
    expect(get(stores.advancedSearch)).toBe(true);
    const canvas = get(stores.searchCanvas);
    expect([canvas.fullText.active, canvas.name.active, canvas.birth.active, canvas.death.active])
      .toEqual([false, true, true, true]);
  });

  it('CO-018 without advanced= the form mode is left unchanged', async () => {
    await submit('q=dupont');
    expect(get(stores.advancedSearch)).toBe(false);
    expect(get(stores.searchCanvas).fullText.active).toBe(true);
  });

  // BUG: URLSearchSubmit toggles every canvas section instead of setting the
  // advanced layout, so a second call with advanced=true (App.svelte re-runs
  // it whenever $accessToken changes, e.g. when Login restores the session)
  // flips the form back to the simple canvas while advancedSearch stays true.
  it.fails('CO-018 BUG: applying advanced=true twice keeps the advanced canvas', async () => {
    await submit('advanced=true&ln=dupont');
    await submit('advanced=true&ln=dupont');
    expect(get(stores.advancedSearch)).toBe(true);
    expect(get(stores.searchCanvas).name.active).toBe(true);
  });

  it.each([
    ['q', 'fullText', 'dupont jean'],
    ['ln', 'lastName', 'dupont'],
    ['fn', 'firstName', 'jean'],
    ['sex', 'sex', 'M'],
    ['bd', 'birthDate', '03/10/1932'],
    ['bc', 'birthCity', 'Eysines'],
    ['bdep', 'birthDepartment', '33'],
    ['bco', 'birthCountry', 'France'],
    ['dd', 'deathDate', '2020'],
    ['dc', 'deathCity', 'Pessac'],
    ['ddep', 'deathDepartment', '33'],
    ['dco', 'deathCountry', 'France'],
    ['dage', 'deathAge', '87']
  ])('CO-019 URL key %s restores the %s input', async (urlKey, field, value) => {
    await submit(`${urlKey}=${encodeURIComponent(value)}`);
    expect(get(stores.searchInput)[field].value).toBe(value);
    expect(get(stores.searchInput)[field].url).toBe(urlKey);
  });

  it('CO-019 every input missing from the URL is cleared', async () => {
    setFields({ lastName: 'durand', deathCity: 'Paris' });
    await submit('fn=jean');
    expect(fieldValues()).toMatchObject({ lastName: '', firstName: 'jean', deathCity: '' });
  });

  it('CO-019 the 13 search inputs and their URL keys', () => {
    expect(Object.fromEntries(Object.entries(get(stores.searchInput)).map(([k, f]) => [k, f.url]))).toEqual({
      fullText: 'q', lastName: 'ln', firstName: 'fn', sex: 'sex',
      birthDate: 'bd', birthCity: 'bc', birthDepartment: 'bdep', birthCountry: 'bco',
      deathDate: 'dd', deathAge: 'dage', deathCity: 'dc', deathDepartment: 'ddep', deathCountry: 'dco'
    });
  });

  it('CO-020 size=n_<N>_n restores the page size', async () => {
    await submit('q=dupont&size=n_100_n');
    expect(get(stores.resultsPerPage)).toBe(100);
    await submit('q=dupont');
    expect(get(stores.resultsPerPage)).toBe(100);
  });

  it('CO-021 current=n_<N>_n is parsed but the page is reset to 1', async () => {
    stores.current.set(7);
    await submit('q=dupont&current=n_3_n');
    expect(get(stores.current)).toBe(1);
    // without current= the page is not touched
    stores.current.set(7);
    await submit('q=dupont');
    expect(get(stores.current)).toBe(7);
  });

  it('CO-022 is a no-op while updateURL is true (state -> URL in progress)', async () => {
    stores.updateURL.set(true);
    await submit('ln=dupont&view=table&fuzzy=false&advanced=true');
    expect(fieldValues().lastName).toBe('');
    expect(get(stores.displayMode)).toBe('card');
    expect(get(stores.fuzzySearch)).toBe(true);
    expect(get(stores.advancedSearch)).toBe(false);
  });
});

describe('state -> URL', () => {
  it('CO-023 buildURLParams serializes advanced, fuzzy=false, non-card views, fields, size and current', () => {
    const input = emptyInput();
    input.lastName.value = 'dupont';
    input.deathAge.value = '87';
    expect(`${buildURLParams(input, true, false, 'geo', 1000, 2)}`)
      .toBe('advanced=true&fuzzy=false&view=geo&ln=dupont&dage=87&size=n_1000_n&current=n_2_n');
  });

  it.each([
    ['card', null], ['card-expand', 'card-expand'], ['table', 'table'], ['geo', 'geo'], ['agg', 'agg'], ['other', null]
  ])('CO-023 view %s is serialized as %s', (mode, expected) => {
    expect(buildURLParams(emptyInput(), false, true, mode, 20, 1).get('view')).toBe(expected);
  });

  it('CO-023 omits size when it equals the default (20) or is unset, and current on page 1', () => {
    const params = buildURLParams(emptyInput(), false, true, 'card', undefined, 0);
    expect(`${params}`).toBe('');
    expect(buildURLParams(emptyInput(), false, true, 'card', 20, 1).has('size')).toBe(false);
  });

  it('CO-024 searchURLUpdate replaces the URL from the stores, keeping the pathname', async () => {
    window.history.replaceState({}, '', '/search?stale=1#hash');
    const before = history.length;
    setFields({ fullText: 'dupont jean' });
    stores.displayMode.set('table');
    await searchURLUpdate();
    expect(location.pathname + location.search).toBe('/search?view=table&q=dupont+jean');
    expect(history.length).toBe(before);
  });

  it('CO-024 drops the "?" when there is no parameter', async () => {
    window.history.replaceState({}, '', '/search?q=old');
    await searchURLUpdate();
    expect(location.href).toBe(`${location.origin}/search`);
  });

  it('CO-024 raises updateURL while writing and lowers it afterwards', async () => {
    const states = [];
    const unsubscribe = stores.updateURL.subscribe(v => states.push(v));
    const replaceState = vi.spyOn(window.history, 'replaceState');
    await searchURLUpdate();
    unsubscribe();
    expect(states).toEqual([false, true, false]);
    expect(replaceState).toHaveBeenCalledTimes(1);
  });
});
