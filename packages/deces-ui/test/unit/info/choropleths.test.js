// Inventory zone IN, FranceChoropleth / WorldChoropleth maps (rows IN-155 .. IN-162).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';

// Record the rejections of async onMount callbacks: Svelte ignores the
// promise they return, so a failure there would otherwise surface as an
// unhandled rejection (and fail the whole run) instead of a test result.
const mountErrors = vi.hoisted(() => []);
vi.mock('svelte', async (importOriginal) => {
  const svelte = await importOriginal();
  return {
    ...svelte,
    onMount: (fn) => svelte.onMount(() => {
      const result = fn();
      if (result && typeof result.then === 'function') {
        result.catch(error => { mountErrors.push(error); });
        return undefined;
      }
      return result;
    })
  };
});

const { default: FranceChoropleth } = await import('../../../src/components/views/FranceChoropleth.svelte');
const { default: WorldChoropleth } = await import('../../../src/components/views/WorldChoropleth.svelte');
const { activeElement } = await import('../../../src/components/tools/stores.js');
const { resetStores } = await import('./helpers.js');
const fixture = await import('./stats-fixture.js');

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

const series = (id, label, points) => ({ yAxisID: id, label, data: points.map(([x, y]) => ({ x, y })) });

const franceData = ({ visitors = [['33', 100], ['2A', 50]], hits = [['33', 10], ['2A', 1000]] } = {}) => ({
  labels: visitors.map(p => p[0]),
  datasets: [series('visitors', 'Visiteurs', visitors), series('hits', 'Nombre de requêtes', hits)]
});

const worldData = () => ({
  labels: ['FRA', 'DEU'],
  datasets: [
    series('visitors', 'Visiteurs', [['FRA', 40], ['DEU', 7]]),
    series('hits', 'Nombre de requêtes', [['FRA', 400], ['DEU', 70]]),
    series('bytes', 'Bande passante', [['FRA', 4000], ['DEU', 700]])
  ]
});

const stubFetch = (overrides = {}) => vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
  if (url in overrides) return overrides[url]();
  if (url === '/simple-french-departments-wdom.json') return { json: async () => fixture.franceGeojson() };
  if (url === '/simple-world-map.json') return { json: async () => fixture.worldGeojson() };
  return { json: async () => ({}) };
});

const zone = (container, id) => container.querySelector(`path[id="${id}"]`);
const tooltip = (container, first) => [...container.querySelectorAll('g.tooltip')]
  .find(g => g.querySelector('tspan').textContent === first);
const opacity = (container, id) => Number(zone(container, id).getAttribute('fill-opacity'));

beforeEach(() => {
  resetStores();
  mountErrors.length = 0;
});

describe('FranceChoropleth', () => {
  it('IN-155 fetches /simple-french-departments-wdom.json on mount and draws one path per department with a geometry', async () => {
    const fetchMock = stubFetch();
    const { container } = render(FranceChoropleth, { data: franceData() });
    expect(fetchMock).toHaveBeenCalledWith('/simple-french-departments-wdom.json');
    await waitFor(() => expect(container.querySelectorAll('path.hoverable')).toHaveLength(3));
    expect(container.querySelector('svg').getAttribute('viewBox')).toBe('-30 0 205 130');
    expect(zone(container, 'XX')).toBeNull();
  });

  it('IN-156 linear fill-opacity when the 2nd max is >= max/5', async () => {
    stubFetch();
    const { container } = render(FranceChoropleth, { data: franceData() });
    await waitFor(() => expect(zone(container, '33')).not.toBeNull());
    expect(opacity(container, '33')).toBe(1);
    expect(opacity(container, '2A')).toBe(0.5);
    expect(opacity(container, '75')).toBe(0);
  });

  it('IN-156 log fill-opacity when the 2nd max is < max/5', async () => {
    stubFetch();
    const { container } = render(FranceChoropleth, { data: franceData({ visitors: [['33', 100], ['2A', 10]] }) });
    await waitFor(() => expect(zone(container, '33')).not.toBeNull());
    expect(opacity(container, '33')).toBeCloseTo(Math.log(101) / Math.log(100));
    expect(opacity(container, '2A')).toBeCloseTo(Math.log(11) / Math.log(100));
  });

  it('IN-157 hovering a department shows its tooltip: name + "<label>: <value>"', async () => {
    stubFetch();
    const { container } = render(FranceChoropleth, { data: franceData() });
    await waitFor(() => expect(zone(container, '33')).not.toBeNull());
    expect(text(tooltip(container, 'Gironde'))).toBe('Gironde Visiteurs: 100');
    expect(tooltip(container, 'Gironde').getAttribute('opacity')).toBe('0');
    await fireEvent.mouseEnter(zone(container, '33'));
    expect(tooltip(container, 'Gironde').getAttribute('opacity')).toBe('0.9');
    await fireEvent.mouseLeave(zone(container, '33'));
    expect(tooltip(container, 'Gironde').getAttribute('opacity')).toBe('0');
  });

  it('IN-158 the series selector (#view) switches the series and blurs the focused element', async () => {
    stubFetch();
    const { container } = render(FranceChoropleth, { data: franceData() });
    await waitFor(() => expect(zone(container, '33')).not.toBeNull());
    const select = container.querySelector('select#view');
    expect([...select.options].map(o => o.textContent)).toEqual(['visitors', 'hits']);
    expect(select.value).toBe('visitors');
    const focused = { blur: vi.fn() };
    activeElement.set(focused);
    await fireEvent.change(select, { target: { value: 'hits' } });
    expect(focused.blur).toHaveBeenCalledTimes(1);
    expect(get(activeElement)).toBeUndefined();
    // hits: 2A (1000) is now the darkest, 33 (10) is below max/5 -> log scale
    expect(opacity(container, '2A')).toBeCloseTo(1);
    expect(opacity(container, '33')).toBeCloseTo(Math.log(11) / Math.log(1000));
    expect(text(tooltip(container, 'Gironde'))).toBe('Gironde Nombre de requêtes: 10');
  });

  it('IN-159 a failed geojson fetch currently ends in a ReferenceError from the catch block (pinned)', async () => {
    stubFetch({ '/simple-french-departments-wdom.json': () => Promise.reject(new TypeError('offline')) });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(FranceChoropleth, { data: franceData() });
    await waitFor(() => expect(mountErrors).toHaveLength(1));
    expect(mountErrors[0]).toBeInstanceOf(ReferenceError);
    expect(mountErrors[0].message).toMatch(/response/);
    expect(log).toHaveBeenCalledWith(expect.any(TypeError));
  });

  // BUG: the catch block logs `response`, declared in the try block, so a
  // network failure throws a ReferenceError (FranceChoropleth.svelte:166-167,
  // WorldChoropleth.svelte:167-168).
  it.fails('IN-159 BUG: a failed geojson fetch is handled without error (France and World)', async () => {
    stubFetch({
      '/simple-french-departments-wdom.json': () => Promise.reject(new TypeError('offline')),
      '/simple-world-map.json': () => Promise.reject(new TypeError('offline'))
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    render(FranceChoropleth, { data: franceData() });
    render(WorldChoropleth, { data: worldData() });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(mountErrors).toEqual([]);
  });
});

describe('WorldChoropleth', () => {
  it('IN-160 fetches /simple-world-map.json on mount and draws one path per country', async () => {
    const fetchMock = stubFetch();
    const { container } = render(WorldChoropleth, { data: worldData() });
    expect(fetchMock).toHaveBeenCalledWith('/simple-world-map.json');
    await waitFor(() => expect(container.querySelectorAll('path.hoverable')).toHaveLength(3));
    expect(container.querySelector('svg').getAttribute('viewBox')).toBe('0 0 260 130');
  });

  it('IN-161 tooltip: ISO3 id + Visiteurs, shown on hover', async () => {
    stubFetch();
    const { container } = render(WorldChoropleth, { data: worldData() });
    await waitFor(() => expect(zone(container, 'FRA')).not.toBeNull());
    const fra = tooltip(container, 'FRA');
    expect([...fra.querySelectorAll('tspan')].map(t => t.textContent.split(':')[0])).toEqual(['FRA', 'Visiteurs', 'Nombre de requêtes', 'Bande passante']);
    expect(fra.querySelectorAll('tspan')[1].textContent).toBe('Visiteurs:40');
    expect(text(tooltip(container, 'BRA'))).toBe('BRA Visiteurs:0 Nombre de requêtes:0 Bande passante:0');
    await fireEvent.mouseEnter(zone(container, 'FRA'));
    expect(fra.getAttribute('opacity')).toBe('0.9');
  });

  it('IN-161 the hits/bytes tooltip lines currently show the visitors series (pinned)', async () => {
    stubFetch();
    const { container } = render(WorldChoropleth, { data: worldData() });
    await waitFor(() => expect(zone(container, 'FRA')).not.toBeNull());
    expect(text(tooltip(container, 'FRA'))).toBe('FRA Visiteurs:40 Nombre de requêtes:40 Bande passante:40');
  });

  // BUG: Svelte 3 orders the `data.datasets` reactive block before the
  // `data.labels` one in WorldChoropleth (they are written the other way in
  // FranceChoropleth), so `index = {}` wipes the series indexes and every
  // tooltip line reads the first (visitors) series. The result depends on the
  // compiler's reactive ordering, which Svelte 5 may change.
  it.fails('IN-161 BUG: the tooltip shows each series value (hits, bytes)', async () => {
    stubFetch();
    const { container } = render(WorldChoropleth, { data: worldData() });
    await waitFor(() => expect(zone(container, 'FRA')).not.toBeNull());
    expect(text(tooltip(container, 'FRA'))).toBe('FRA Visiteurs:40 Nombre de requêtes:400 Bande passante:4000');
  });

  it('IN-162 series selector at the bottom left; any view change (including the initial one) blurs the focused element', async () => {
    stubFetch();
    const focused = { blur: vi.fn() };
    activeElement.set(focused);
    const { container } = render(WorldChoropleth, { data: worldData() });
    const select = container.querySelector('select#view');
    expect([select.style.position, select.style.bottom, select.style.left]).toEqual(['absolute', '60px', '0px']);
    expect([...select.options].map(o => o.textContent)).toEqual(['visitors', 'hits', 'bytes']);
    expect(focused.blur).toHaveBeenCalledTimes(1);
    const other = { blur: vi.fn() };
    activeElement.set(other);
    await fireEvent.change(select, { target: { value: 'bytes' } });
    expect(other.blur).toHaveBeenCalledTimes(1);
    expect(get(activeElement)).toBeUndefined();
  });
});
