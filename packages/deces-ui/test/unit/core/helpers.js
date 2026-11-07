// Shared helpers for the CO-* (core) unit tests. Not a test file.
import { get } from 'svelte/store';
import * as stores from '../../../src/components/tools/stores.js';

// Snapshots taken at import time, before any test mutates the module stores.
const initialFields = Object.fromEntries(
  Object.entries(get(stores.searchInput)).map(([key, field]) => [key, { value: field.value, fuzzy: field.fuzzy }])
);
const initialCanvas = JSON.parse(JSON.stringify(get(stores.searchCanvas)));
const initialSort = get(stores.sortInput).map(entry => ({ ...entry }));

// Put every search-related store back to its initial value. The stores are
// module singletons shared by all tests of a file.
export const resetSearchState = () => {
  stores.updateURL.set(false);
  stores.waitSearch.set(false);
  stores.searchInput.update(v => {
    Object.keys(v).forEach(key => {
      v[key].value = initialFields[key].value;
      v[key].fuzzy = initialFields[key].fuzzy;
    });
    return v;
  });
  stores.searchCanvas.set(JSON.parse(JSON.stringify(initialCanvas)));
  stores.sortInput.set(initialSort.map(entry => ({ ...entry })));
  stores.advancedSearch.set(false);
  stores.fuzzySearch.set(true);
  stores.displayMode.set('card');
  stores.current.set(1);
  stores.resultsPerPage.set(stores.resultsPerPageDefault);
  stores.searchResults.set([]);
  stores.totalResults.set(0);
  stores.totalPages.set(0);
  stores.scrollId.set(null);
  stores.wasSearched.set(false);
  stores.searchMinLength.set(1);
  stores.triggerAggregations.set(false);
  stores.cachedResponses.set({});
  stores.accessToken.set('');
  stores.activeElement.set(undefined);
};

// Set field values on the shared searchInput store ({ lastName: 'dupont' }).
export const setFields = (values) => {
  stores.searchInput.update(v => {
    Object.entries(values).forEach(([key, value]) => { v[key].value = value; });
    return v;
  });
};

export const fieldValues = () => Object.fromEntries(
  Object.entries(get(stores.searchInput)).map(([key, field]) => [key, field.value])
);

// A backend person record shaped like /search and /id responses.
export const person = (overrides = {}) => ({
  id: 'AbCdEfGhIjKl',
  score: 1,
  sex: 'M',
  name: { first: ['Jean', 'Pierre'], last: 'DUPONT' },
  birth: {
    date: '19321003',
    location: { city: 'Eysines', code: '33162', departmentCode: '33', country: 'France', countryCode: 'FRA' }
  },
  death: {
    date: '20200116',
    age: 87,
    location: { city: 'Pessac', code: '33318', departmentCode: '33', country: 'France', countryCode: 'FRA' }
  },
  ...overrides
});
