import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import sum from 'hash-sum';

vi.mock('../../../src/components/tools/runRequest.js', () => ({
  runSearchRequest: vi.fn(),
  runIdRequest: vi.fn()
}));

const { runSearchRequest, runIdRequest } = await import('../../../src/components/tools/runRequest.js');
const search = await import('../../../src/components/tools/search.js');
const stores = await import('../../../src/components/tools/stores.js');
const { resetSearchState, setFields, fieldValues, person } = await import('./helpers.js');

const respond = (response) => runSearchRequest.mockResolvedValue({ response });

beforeEach(() => {
  resetSearchState();
  runSearchRequest.mockReset();
  runIdRequest.mockReset();
  respond({ total: 1, size: 20, persons: [person()] });
});

describe('searchSubmit', () => {
  it('CO-035 does nothing when the form cannot trigger a search', async () => {
    await search.searchSubmit();
    setFields({ lastName: 'dupont', deathDate: '195' });
    await search.searchSubmit();
    expect(runSearchRequest).not.toHaveBeenCalled();
  });

  it('CO-035 does nothing while a search is already running', async () => {
    setFields({ lastName: 'dupont' });
    stores.waitSearch.set(true);
    await search.searchSubmit();
    expect(runSearchRequest).not.toHaveBeenCalled();
  });

  it('CO-036 toggles waitSearch around the request', async () => {
    const states = [];
    const unsubscribe = stores.waitSearch.subscribe(v => states.push(v));
    let duringRequest;
    runSearchRequest.mockImplementation(async () => {
      duringRequest = get(stores.waitSearch);
      return { response: { total: 0, size: 20, persons: [] } };
    });
    setFields({ lastName: 'dupont' });
    await search.searchSubmit();
    unsubscribe();
    expect(duringRequest).toBe(true);
    expect(states).toEqual([false, true, false]);
  });

  it('CO-037 stores results, totals, scroll id (with its context hash) and the search summary', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(123456);
    respond({ total: 45, size: 20, scrollId: 'scroll-xyz', persons: [person(), person({ id: 'other-person' })] });
    setFields({ lastName: 'dupont', firstName: 'jean' });
    await search.searchSubmit();
    expect(get(stores.searchResults).map(p => p.id)).toEqual(['AbCdEfGhIjKl', 'other-person']);
    expect(get(stores.totalResults)).toBe(45);
    expect(get(stores.totalPages)).toBe(3);
    expect(get(stores.scrollId)).toEqual({
      id: 'scroll-xyz',
      date: 123456,
      context: sum(JSON.stringify(get(stores.searchInput)) + JSON.stringify(get(stores.sortInput)))
    });
    expect(get(stores.wasSearched)).toBe('DUPONT Jean');
    expect(runSearchRequest.mock.calls[0][0]).toMatchObject({ lastName: 'dupont', firstName: 'jean', page: 1 });
  });

  it('CO-037 keeps the previous scroll id when the response has none', async () => {
    stores.scrollId.set({ id: 'previous', context: 'c', date: 1 });
    setFields({ lastName: 'dupont' });
    await search.searchSubmit();
    expect(get(stores.scrollId).id).toBe('previous');
  });

  it('CO-037 searchSubmit(n) requests page n, otherwise page 1', async () => {
    setFields({ lastName: 'dupont' });
    stores.current.set(5);
    await search.searchSubmit();
    expect(get(stores.current)).toBe(1);
    await search.searchSubmit(3);
    expect(get(stores.current)).toBe(3);
    expect(runSearchRequest.mock.calls.map(([body]) => body.page)).toEqual([1, 3]);
  });

  it.each([
    [undefined, 10, 0],
    [0, 10, 0],
    [20, 0, 1],
    [20, 40, 2],
    [20, 41, 3]
  ])('CO-038 totalPages with size=%s and total=%s is %s', async (size, total, expected) => {
    respond({ total, size, persons: [] });
    setFields({ lastName: 'dupont' });
    await search.searchSubmit();
    expect(get(stores.totalPages)).toBe(expected);
  });
});

describe('getById', () => {
  it('CO-047 returns the corrected person of /id/<id>', async () => {
    runIdRequest.mockResolvedValue({ response: { persons: [person()] } });
    const found = await search.getById({ id: 'AbCdEfGhIjKl' });
    expect(runIdRequest).toHaveBeenCalledWith('AbCdEfGhIjKl');
    expect(found).toMatchObject({ id: 'AbCdEfGhIjKl', name: { last: 'DUPONT' } });
  });

  it('CO-047 returns a falsy value when the backend has no person', async () => {
    runIdRequest.mockResolvedValue({ response: { persons: [] } });
    expect(await search.getById({ id: 'missing' })).toBeUndefined();
    runIdRequest.mockResolvedValue(undefined);
    expect(await search.getById({ id: 'missing' })).toBeFalsy();
  });
});

describe('toggleAdvancedSearch', () => {
  it('CO-042 simple -> advanced splits the full text into last and first name and clears other fields', async () => {
    setFields({ fullText: 'dupont jean', deathDate: '2020' });
    await search.toggleAdvancedSearch(true);
    expect(get(stores.advancedSearch)).toBe(true);
    const canvas = get(stores.searchCanvas);
    expect([canvas.fullText.active, canvas.name.active, canvas.birth.active, canvas.death.active])
      .toEqual([false, true, true, true]);
    expect(fieldValues()).toMatchObject({ fullText: '', lastName: 'dupont', firstName: 'jean', deathDate: '' });
    expect(runSearchRequest).toHaveBeenCalledTimes(1);
    expect(runSearchRequest.mock.calls[0][0]).toMatchObject({ lastName: 'dupont', firstName: 'jean' });
    expect(location.search).toBe('?advanced=true&ln=dupont&fn=jean');
  });

  it('CO-042 keeps only the first two words (third word dropped) and an empty first name for one word', async () => {
    setFields({ fullText: 'dupont jean pierre' });
    await search.toggleAdvancedSearch(true);
    expect(fieldValues()).toMatchObject({ lastName: 'dupont', firstName: 'jean' });
    resetSearchState();
    setFields({ fullText: 'dupont' });
    await search.toggleAdvancedSearch(true);
    expect(fieldValues()).toMatchObject({ lastName: 'dupont', firstName: '' });
  });

  it('CO-042 advanced -> simple joins last and first name into the full text', async () => {
    await search.toggleAdvancedSearch(true);
    setFields({ lastName: 'dupont', firstName: 'jean', birthCity: 'eysines' });
    await search.toggleAdvancedSearch(false);
    expect(get(stores.advancedSearch)).toBe(false);
    expect(get(stores.searchCanvas).fullText.active).toBe(true);
    expect(fieldValues()).toMatchObject({ fullText: 'dupont jean', lastName: '', firstName: '', birthCity: '' });
    expect(location.search).toBe('?q=dupont+jean');
  });

  it('CO-042 is a no-op when the requested mode is already active', async () => {
    setFields({ fullText: 'dupont jean' });
    await search.toggleAdvancedSearch(false);
    expect(fieldValues().fullText).toBe('dupont jean');
    expect(runSearchRequest).not.toHaveBeenCalled();
  });
});

describe('toggleFuzzySearch', () => {
  it('CO-043 flips the fuzzy flag on every field, resubmits and updates the URL', async () => {
    setFields({ lastName: 'dupont' });
    await search.toggleFuzzySearch();
    expect(get(stores.fuzzySearch)).toBe(false);
    expect(Object.values(get(stores.searchInput)).every(f => f.fuzzy === false)).toBe(true);
    await vi.waitFor(() => expect(runSearchRequest).toHaveBeenCalledTimes(1));
    expect(runSearchRequest.mock.calls[0][0].fuzzy).toBe('false');
    expect(location.search).toBe('?fuzzy=false&ln=dupont');
  });

  it('CO-043 back to fuzzy sets "auto" on every field (including the exact-only ones) and drops fuzzy=false', async () => {
    await search.toggleFuzzySearch();
    await search.toggleFuzzySearch();
    expect(get(stores.fuzzySearch)).toBe(true);
    expect(Object.values(get(stores.searchInput)).every(f => f.fuzzy === 'auto')).toBe(true);
    expect(location.search).toBe('');
  });
});

describe('enableDisplayMode', () => {
  const focused = () => {
    const blur = vi.fn();
    stores.activeElement.set({ blur });
    return blur;
  };

  it('CO-044 leaving geo truncates the results to 20 and resets the page size', async () => {
    focused();
    stores.displayMode.set('geo');
    stores.resultsPerPage.set(1000);
    stores.searchResults.set(Array.from({ length: 50 }, (_, i) => ({ id: i })));
    await search.enableDisplayMode('table');
    expect(get(stores.searchResults).map(r => r.id)).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(get(stores.resultsPerPage)).toBe(20);
    expect(get(stores.displayMode)).toBe('table');
  });

  it('CO-045 entering agg requests aggregations only when the form is searchable', async () => {
    focused();
    await search.enableDisplayMode('agg');
    expect(get(stores.triggerAggregations)).toBe(false);
    stores.displayMode.set('card');
    setFields({ lastName: 'dupont' });
    focused();
    await search.enableDisplayMode('agg');
    expect(get(stores.triggerAggregations)).toBe(true);
    expect(get(stores.displayMode)).toBe('agg');
  });

  it('CO-046 blurs the focused element, clears activeElement and writes view= in the URL', async () => {
    const blur = focused();
    setFields({ lastName: 'dupont' });
    await search.enableDisplayMode('table');
    expect(blur).toHaveBeenCalledTimes(1);
    expect(get(stores.activeElement)).toBeUndefined();
    expect(location.search).toBe('?view=table&ln=dupont');
  });

  // BUG: enableDisplayMode calls `v.blur()` without checking that an element
  // is focused. activeElement is undefined after goTo() and in browsers that
  // do not focus buttons on click (Safari), so switching view throws.
  it.fails('CO-046 BUG: does not throw when no element is focused', async () => {
    stores.activeElement.set(undefined);
    await expect(search.enableDisplayMode('table')).resolves.toBeUndefined();
  });
});
