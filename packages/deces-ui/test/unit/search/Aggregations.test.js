import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { mockFetch, resetSearchStores, setInput, setThemeColors } from './helpers.js';

vi.mock('chart.js/auto', async () => (await import('./helpers.js')).fakeChartModule());

const { default: Aggregations } = await import('../../../src/components/views/Aggregations.svelte');
const stores = await import('../../../src/components/tools/stores.js');
const { default: Chart } = await import('chart.js/auto');
const { smartNumber } = await import('../../../src/components/tools/stats.js');

const order = ['sex', 'birthDepartment', 'deathDate', 'deathAge', 'firstName', 'lastName'];
const csv = {
  sex: 'key,doc_count\nM,60\nF,40\n',
  birthDepartment: 'key,doc_count\n33,50\n75,30\n',
  deathDate: 'key_as_string,doc_count\n19650101,9\n20200101,5\n20200201,7\n',
  deathAge: 'key,doc_count\n87,4\n9,1\n45,2\n',
  firstName: 'key,doc_count\nJean,10\nMarie,8\n',
  lastName: 'key,doc_count\nDupont,5\n'
};
const rows = (agg) => csv[agg].trim().split('\n').length - 1;

let fetchMock;
const aggRequests = () => fetchMock.mock.calls
  .filter(([url]) => `${url}`.endsWith('/agg'))
  .map(([url, init]) => ({ url: `${url}`, method: init.method, accept: init.headers.Accept, body: JSON.parse(init.body) }));

// Backend stub: CSV per aggregation, with the `total-results-<agg>` header.
const serveAggs = (override = () => undefined) => {
  fetchMock = mockFetch(async (url, init) => {
    if (!url.endsWith('/agg')) return undefined;
    const [agg] = JSON.parse(init.body).aggs;
    const custom = await override(agg);
    if (custom) return custom;
    return new Response(csv[agg], { headers: { [`total-results-${agg}`]: `${rows(agg)}` } });
  });
};

const chartOf = (type) => Chart.instances.filter(c => c.config.type === type);
const tile = (title) => screen.getByText(title).closest('.rf-tile').parentElement;
const waitAllTiles = () => waitFor(() => expect(screen.getByText('Nom')).toBeTruthy());

describe('Aggregations', () => {
  beforeEach(() => {
    resetSearchStores(stores);
    setThemeColors();
    stores.totalBuckets.set(0);
    stores.actualBuckets.set(0);
    stores.displayMode.set('agg');
    Chart.instances.length = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
    serveAggs();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('SR-192 fetches the departments geojson on mount', async () => {
    render(Aggregations);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/simple-french-departments-wdom.json'));
  });

  it('SR-193 triggerAggregations starts a refresh and is reset to false', async () => {
    render(Aggregations);
    stores.triggerAggregations.set(true);
    await waitFor(() => expect(aggRequests().length).toBeGreaterThan(0));
    expect(get(stores.triggerAggregations)).toBe(false);
  });

  it('SR-194 sends six sequential POST /agg requests (sex, birthDepartment, deathDate, deathAge, firstName, lastName)', async () => {
    render(Aggregations);
    stores.triggerAggregations.set(true);
    await waitAllTiles();
    const requests = aggRequests();
    expect(requests.map(r => r.body.aggs)).toEqual(order.map(a => [a]));
    expect(requests.every(r => r.url === '/deces/api/v1/agg' && r.method === 'POST' && r.accept === 'text/csv')).toBe(true);
  });

  it('SR-195 skips an aggregation whose field is fixed by an exact criterion (not for date/age years or ranges)', async () => {
    stores.advancedSearch.set(true);
    setInput(stores, { lastName: 'dupont', sex: 'M', deathDate: '2020', deathAge: '80-90' });
    render(Aggregations);
    stores.triggerAggregations.set(true);
    await waitFor(() => expect(screen.getByText('Prénom')).toBeTruthy());
    expect(aggRequests().map(r => r.body.aggs[0])).toEqual(['birthDepartment', 'deathDate', 'deathAge', 'firstName']);
    expect(screen.queryByText('Nom')).toBeNull();
    expect(screen.queryByText('Sexe')).toBeNull();
    setInput(stores, { deathDate: '01/01/2020' });
    fetchMock.mockClear();
    stores.cachedResponses.set({});
    stores.triggerAggregations.set(true);
    await waitFor(() => expect(aggRequests().map(r => r.body.aggs[0])).toEqual(['birthDepartment', 'deathAge', 'firstName']));
  });

  it('SR-196 restricts the request to the valid keys and asks 15 buckets for the names', async () => {
    setInput(stores, { fullText: 'dupont' });
    render(Aggregations);
    stores.triggerAggregations.set(true);
    await waitAllTiles();
    const [sex, , , , firstName, lastName] = aggRequests().map(r => r.body);
    expect(sex).toEqual({ fuzzy: 'true', q: 'dupont', aggs: ['sex'] });
    expect(firstName).toEqual({ fuzzy: 'true', q: 'dupont', aggs: ['firstName'], aggsSize: 15 });
    expect(lastName.aggsSize).toBe(15);
  });

  it('SR-197 parses the streamed CSV and counts the buckets received', async () => {
    serveAggs(agg => {
      if (agg !== 'sex') return undefined;
      // header and rows split across chunks
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('key,doc_count\nM,60\n'));
          controller.enqueue(encoder.encode('F,40\n'));
          controller.close();
        }
      });
      return new Response(body, { headers: { 'total-results-sex': '2' } });
    });
    render(Aggregations);
    stores.triggerAggregations.set(true);
    await waitAllTiles();
    const pie = chartOf('pie')[0];
    expect(pie.data.labels).toEqual(['M', 'F']);
    expect(pie.data.datasets[0].data).toEqual([60, 40]);
    expect(get(stores.actualBuckets)).toBe(order.reduce((n, agg) => n + rows(agg), 0));
  });

  // BUG: `totalBuckets.update(v => v + response.headers ? +header : 0)`
  // (Aggregations.svelte:463) parses as `(v + response.headers) ? ... : 0`, so
  // the total is overwritten by each response instead of accumulated, while
  // actualBuckets accumulates: the progress pie of the header (SR-070) and the
  // early-exit test of the parsing loop compare inconsistent counters.
  it.fails('SR-197 accumulates the expected bucket total over the six aggregations', async () => {
    render(Aggregations);
    stores.triggerAggregations.set(true);
    await waitAllTiles();
    expect(get(stores.totalBuckets)).toBe(order.reduce((n, agg) => n + rows(agg), 0));
  });

  it('SR-198 a new trigger cancels the parsing in flight', async () => {
    let push;
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    let sexCalls = 0;
    serveAggs(async (agg) => {
      if (agg !== 'sex') return undefined;
      sexCalls += 1;
      if (sexCalls === 1) {
        const encoder = new TextEncoder();
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('key,doc_count\nM,60\n'));
            push = () => { controller.enqueue(encoder.encode('F,40\n')); controller.close(); };
          }
        });
        return new Response(body, { headers: { 'total-results-sex': '2' } });
      }
      await pending; // the second refresh waits for its sex response
      return undefined;
    });
    render(Aggregations);
    stores.triggerAggregations.set(true);
    await waitFor(() => expect(push).toBeDefined());
    stores.cachedResponses.set({});
    stores.triggerAggregations.set(true);
    await waitFor(() => expect(sexCalls).toBe(2));
    push();
    // the first parsing stops: its second chunk is dropped, no sex chart yet
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(chartOf('pie')).toHaveLength(0);
    release();
    await waitFor(() => expect(chartOf('pie')).toHaveLength(1));
    expect(chartOf('pie')[0].data.datasets[0].data).toEqual([60, 40]);
  });

  describe('tiles', () => {
    beforeEach(async () => {
      stores.totalResults.set(100);
      render(Aggregations);
      stores.triggerAggregations.set(true);
      await waitAllTiles();
    });

    it('SR-199 "Mois de décès" is a radar of the death months', () => {
      const radar = tile('Mois de décès').querySelector('.rf-tile__body svg');
      expect(radar.getAttribute('viewBox')).toBe('0 0 400 300');
      expect([...radar.querySelectorAll('text')].map(t => t.textContent.trim())).toContain('Janvier');
    });

    it('SR-200 "Département de naissance" is a France choropleth', () => {
      expect(tile('Département de naissance').querySelector('.rf-tile__body svg').getAttribute('viewBox')).toBe('-30 0 205 130');
    });

    it('SR-201 "Date de décès" is a line chart from 1970 with a month tooltip', () => {
      const line = chartOf('line').find(c => c.config.options.scales.x.id === 'axisDeathDate');
      expect(line.data.labels).toHaveLength(2);
      expect(line.data.labels.every(d => d instanceof Date && d.getFullYear() === 2020)).toBe(true);
      const title = line.config.options.tooltips.callbacks.title;
      expect(title([{ index: 0, datasetIndex: 0 }], { datasets: [{ data: [{ x: '20200301' }] }] })).toBe('mars 2020');
    });

    it('SR-202 "Âge au décès" is a line chart sorted by age with a "N ans" tooltip', () => {
      const line = chartOf('line').find(c => c.config.options.scales.x.id === 'axisDeathAge');
      expect(line.data.labels).toEqual(['9', '45', '87']);
      expect(line.data.datasets[0].data).toEqual([{ x: '9', y: 1 }, { x: '45', y: 2 }, { x: '87', y: 4 }]);
      const title = line.config.options.tooltips.callbacks.title;
      expect(title([{ index: 1, datasetIndex: 0 }], line.data)).toBe('45 ans');
    });

    it('SR-203 "Prénom" and "Nom" are bar charts of the top names', () => {
      const [firstName, lastName] = chartOf('bar');
      expect(firstName.data.labels).toEqual(['Jean', 'Marie']);
      expect(firstName.config.options.scales.x).toEqual({ id: 'axisFirstName', type: 'category' });
      expect(lastName.data.labels).toEqual(['Dupont']);
      expect(screen.getByText('Prénom')).toBeTruthy();
    });

    it('SR-204 "Sexe" is a pie chart with a percentage tooltip', () => {
      const pie = chartOf('pie')[0];
      expect(screen.getByText('Sexe')).toBeTruthy();
      expect(pie.config.options.scales).toEqual({});
      const title = pie.config.options.tooltips.callbacks.title;
      expect(title([{ index: 0, datasetIndex: 0 }], pie.data)).toBe('60%');
      expect(pie.data.datasets[0].backgroundColor).toHaveLength(2);
    });

    it('SR-206 the +/- control expands a tile to 12 columns and 500 px (hidden on mobile)', async () => {
      const t = tile('Sexe');
      const control = t.querySelector('.rf-tile__icon');
      expect(control.className).toContain('rf-hide--mobile');
      expect(t.className).toContain('rf-col-xl-6');
      expect(t.querySelector('canvas').getAttribute('style')).toBe('max-height: 250px;');
      await fireEvent.click(control);
      expect(tile('Sexe').className).toContain('rf-col-xl-12');
      expect(tile('Sexe').querySelector('canvas').getAttribute('style')).toBe('max-height: 500px;');
      await fireEvent.click(tile('Sexe').querySelector('.rf-tile__icon'));
      expect(tile('Sexe').className).toContain('rf-col-xl-6');
    });

    it('SR-209 charts have no animation, no legend, smartNumber ticks and --bf500 colours', () => {
      const { options, data } = chartOf('bar')[0].config;
      expect(options.animation).toEqual({ duration: 0 });
      expect(options.legend.display).toBe(false);
      expect(options.scales.deaths.ticks.callback).toBe(smartNumber);
      expect(options.maintainAspectRatio).toBe(false);
      expect(data.datasets[0].backgroundColor).toBe('rgba(0,0,145,0.7)');
    });
  });

  it('SR-205 hides a tile whose data is empty', async () => {
    serveAggs(agg => agg === 'firstName' ? new Response('key,doc_count\n', { headers: { 'total-results-firstName': '0' } }) : undefined);
    render(Aggregations);
    stores.triggerAggregations.set(true);
    await waitAllTiles();
    expect(screen.queryByText('Prénom')).toBeNull();
  });

  it('SR-207 a 429 shows the message with a spinner and retries after 7 s', async () => {
    let calls = 0;
    serveAggs(agg => {
      if (agg === 'sex' && ++calls === 1) return new Response('', { status: 429, statusText: 'Too Many Requests' });
      return undefined;
    });
    render(Aggregations);
    vi.useFakeTimers();
    stores.triggerAggregations.set(true);
    await vi.waitFor(() => expect(screen.getByText(/votre requête est temporisée quelques secondes/)).toBeTruthy());
    expect(screen.getByText(/429 Too Many Requests/)).toBeTruthy();
    expect(document.querySelector('.spin')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(6900);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(200);
    vi.useRealTimers();
    await waitAllTiles();
    expect(calls).toBe(2);
  });

  it('SR-208 any other error shows "Le service est indisponible" and retries after 30 s', async () => {
    let calls = 0;
    serveAggs(agg => {
      if (agg === 'sex' && ++calls === 1) return new Response('', { status: 503, statusText: 'Service Unavailable' });
      return undefined;
    });
    render(Aggregations);
    vi.useFakeTimers();
    stores.triggerAggregations.set(true);
    await vi.waitFor(() => expect(screen.getByText(/Le service est indisponible\..*test@example\.org/)).toBeTruthy());
    expect(document.querySelector('.spin')).toBeNull();
    await vi.advanceTimersByTimeAsync(29000);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1100);
    vi.useRealTimers();
    await waitAllTiles();
    expect(calls).toBe(2);
  });
});
