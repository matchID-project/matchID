import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { buildURLParams, URLSearchSubmit } from '../../src/components/tools/search.js';
import { searchInput, current, resultsPerPage, fuzzySearch, displayMode } from '../../src/components/tools/stores.js';

const emptyInput = () => {
  const input = structuredClone(Object.fromEntries(
    Object.entries(get(searchInput)).map(([key, value]) => [key, { url: value.url, value: '' }])
  ));
  return input;
};

describe('buildURLParams', () => {
  it('serializes an advanced, exact search in the order the e2e permalink expects', () => {
    const input = emptyInput();
    input.lastName.value = 'dupont';
    input.firstName.value = 'jean';
    input.deathDate.value = '2020';
    input.deathDepartment.value = '33';
    const params = buildURLParams(input, true, false, 'card', 20, 1);
    expect(`${params}`).toBe('advanced=true&fuzzy=false&ln=dupont&fn=jean&dd=2020&ddep=33');
  });

  it('omits defaults: simple search, fuzzy, card view, default page size, first page', () => {
    const input = emptyInput();
    input.fullText.value = 'dupont jean';
    const params = buildURLParams(input, false, true, 'card', 20, 1);
    expect(`${params}`).toBe('q=dupont+jean');
  });

  it('keeps non-default view, page size and page', () => {
    const input = emptyInput();
    input.fullText.value = 'dupont';
    const params = buildURLParams(input, false, true, 'table', 100, 3);
    expect(params.get('view')).toBe('table');
    expect(params.get('size')).toBe('n_100_n');
    expect(params.get('current')).toBe('n_3_n');
  });

  it('does not serialize the default card view', () => {
    const params = buildURLParams(emptyInput(), false, true, 'card', 20, 1);
    expect(params.has('view')).toBe(false);
  });
});

describe('URLSearchSubmit', () => {
  it('restores fields, fuzzy flag, view and page size from the URL', async () => {
    await URLSearchSubmit(new URLSearchParams('q=dupont+jean&fuzzy=false&view=table&size=n_50_n'));
    expect(get(searchInput).fullText.value).toBe('dupont jean');
    expect(get(fuzzySearch)).toBe(false);
    expect(get(displayMode)).toBe('table');
    expect(get(resultsPerPage)).toBe(50);
  });

  // Documents current behaviour (inventory CO-021): the requested page is
  // parsed from `current=n_<N>_n` but the page store is reset to 1, and the
  // following search (SearchBox -> searchSubmit()) also starts from page 1.
  // Restoring the page needs a page-1 search to obtain a scroll id first, so
  // the intended behaviour is not unambiguous from the code; see the matching
  // `test.fixme` in ui-test/specs/search.spec.js.
  it('resets the page to 1 even when the URL requests another page (current behaviour)', async () => {
    current.set(4);
    await URLSearchSubmit(new URLSearchParams('q=dupont&current=n_3_n'));
    expect(get(current)).toBe(1);
  });
});
