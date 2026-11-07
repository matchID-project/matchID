// Shared fixtures for the zone SR unit tests (search, results, card, map,
// aggregations, download, Gedcom). Not a test file: vitest only collects
// `*.test.js`.
import { vi } from 'vitest';
import { get } from 'svelte/store';

// A person as returned by the backend (see deces-backend/src/models/result.ts).
export const person = (overrides = {}) => {
  const base = {
    score: 10.5,
    source: '2020-m01',
    sourceLine: 212,
    id: 'ba7582a6344757e6',
    name: { first: ['Jean', 'Pierre'], last: 'Dupont' },
    sex: 'M',
    birth: {
      date: '19321003',
      location: {
        city: 'Eysines',
        code: '33162',
        departmentCode: '33',
        country: 'France',
        countryCode: 'FRA',
        latitude: 44.88,
        longitude: -0.65
      }
    },
    death: {
      date: '20200116',
      certificateId: '69 N',
      age: 87,
      location: {
        city: 'Pessac',
        code: '33318',
        departmentCode: '33',
        country: 'France',
        countryCode: 'FRA',
        latitude: 44.8,
        longitude: -0.63
      }
    }
  };
  return { ...base, ...overrides };
};

export const jsonResponse = (body, status = 200, statusText = 'OK') =>
  new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' }
  });

export const searchResponse = (persons, { total = persons.length, size = 20, scrollId = 'scroll-1' } = {}) =>
  jsonResponse({ response: { total, size, page: 1, scrollId, persons } });

// Route every fetch() to a handler `(url, init) => Response | undefined`;
// unknown URLs get an empty JSON (an empty geojson for the static .json files
// fetched by the aggregations and the choropleth).
export const mockFetch = (handler = () => undefined) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const response = await handler(`${url}`, init);
    if (response) return response;
    return `${url}`.endsWith('.json') ? jsonResponse({ type: 'FeatureCollection', features: [] }) : jsonResponse({});
  });

// Reset the search state shared through the svelte stores.
// The first call snapshots the pristine per-field fuzzy flags of the module
// instance (each test file gets its own module graph).
const pristineFuzzy = new WeakMap();
export const resetSearchStores = (stores) => {
  if (!pristineFuzzy.has(stores.searchInput)) {
    pristineFuzzy.set(stores.searchInput, Object.fromEntries(
      Object.entries(get(stores.searchInput)).map(([k, v]) => [k, v.fuzzy])
    ));
  }
  const fuzzy = pristineFuzzy.get(stores.searchInput);
  stores.searchInput.update(v => {
    Object.keys(v).forEach(k => { v[k].value = ''; v[k].fuzzy = fuzzy[k]; });
    return v;
  });
  setAdvanced(stores, false);
  stores.cachedResponses.set({});
  stores.searchResults.set([]);
  stores.totalResults.set(0);
  stores.totalPages.set(0);
  stores.current.set(1);
  stores.wasSearched.set(false);
  stores.waitSearch.set(false);
  stores.displayMode.set('card');
  stores.resultsPerPage.set(20);
  stores.firstSearch.set(true);
  stores.triggerAggregations.set(false);
  stores.sortInputDisplay.set(false);
  stores.showProof.set(undefined);
  stores.fuzzySearch.set(true);
};

export const setInput = (stores, values) => {
  stores.searchInput.update(v => {
    Object.entries(values).forEach(([k, value]) => { v[k].value = value; });
    return v;
  });
};

export const inputValues = (stores) =>
  Object.fromEntries(Object.entries(get(stores.searchInput)).map(([k, v]) => [k, v.value]));

// Switch the shared canvas to advanced mode (what the URL `advanced=true` does).
export const setAdvanced = (stores, advanced = true) => {
  if (get(stores.advancedSearch) === advanced) return;
  stores.advancedSearch.set(advanced);
  stores.searchCanvas.update(v => {
    Object.keys(v).forEach(k => { v[k].active = !v[k].active; });
    return v;
  });
};

// Some handlers call `activeElement.blur()` without a null check: give them
// a focusable element, as a real click on a link would.
export const focusSomething = (stores) => {
  stores.activeElement.set(document.body);
};

// A Response whose body streams the given CSV chunks (aggregations).
export const csvStreamResponse = (chunks, headers = {}) => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      chunks.forEach(c => controller.enqueue(encoder.encode(c)));
      controller.close();
    }
  });
  return new Response(body, { status: 200, headers });
};

// Serialized markup of an iconify icon, as the DOM renders it ({@html}).
export const iconMarkup = (icons, name) => {
  const div = document.createElement('div');
  div.innerHTML = icons[name];
  return div.innerHTML;
};

// DSFR colour tokens read through getComputedStyle by the charts/heatmap.
export const setThemeColors = () => {
  document.body.style.setProperty('--bf500', '#000091');
  document.body.style.setProperty('--rm500', '#e1000f');
};

// Minimal chart.js stand-in: jsdom has no canvas. Use with
// vi.mock('chart.js/auto', () => fakeChartModule()) (inside the factory, after
// `await import('./helpers.js')`).
export const fakeChartModule = () => {
  class FakeChart {
    constructor(ctx, config) {
      this.config = config;
      this.data = config.data;
      FakeChart.instances.push(this);
    }
    update() { this.updated = (this.updated || 0) + 1; }
    destroy() {}
  }
  FakeChart.instances = [];
  FakeChart.register = () => {};
  FakeChart.defaults = { font: {} };
  return { default: FakeChart };
};
