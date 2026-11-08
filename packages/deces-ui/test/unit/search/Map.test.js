import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import L from 'leaflet';
import { mockFetch, person, resetSearchStores } from './helpers.js';

const { default: Map } = await import('../../../src/components/views/Map.svelte');
const { default: Geo } = await import('../../../src/components/views/Geo.svelte');
const { default: TileLayer } = await import('../../../src/components/views/TileLayer.svelte');
const stores = await import('../../../src/components/tools/stores.js');
const { default: tileServers } = await import('../../../src/components/tools/tileServers.js');

const withPlaces = (id, birth, death) => {
  const p = person({ id, name: { first: ['Jean'], last: `Nom-${id}` } });
  p.birth = { ...p.birth, location: { ...p.birth.location, latitude: birth && birth[0], longitude: birth && birth[1] } };
  p.death = { ...p.death, location: { ...p.death.location, latitude: death && death[0], longitude: death && death[1] } };
  return p;
};

let maps;
let markers;
let lines;

const spyLeaflet = () => {
  maps = [];
  markers = [];
  lines = [];
  const map = L.map;
  vi.spyOn(L, 'map').mockImplementation((...args) => { const m = map(...args); maps.push(m); return m; });
  const circleMarker = L.circleMarker;
  vi.spyOn(L, 'circleMarker').mockImplementation((latlng, options) => {
    const m = circleMarker(latlng, options);
    markers.push({ latlng, options, layer: m });
    return m;
  });
  const polyline = L.polyline;
  vi.spyOn(L, 'polyline').mockImplementation((latlngs, options) => {
    const l = polyline(latlngs, options);
    lines.push({ latlngs, options, layer: l });
    return l;
  });
};

const births = () => markers.filter(m => m.options.pane === 'birth');
const deaths = () => markers.filter(m => m.options.pane === 'death');

describe('Map (geo mode)', () => {
  beforeEach(() => {
    resetSearchStores(stores);
    mockFetch();
    spyLeaflet();
  });

  it('SR-234 mounting the map sets the geo view and the page size to the max results', () => {
    render(Map);
    expect(get(stores.displayMode)).toBe('geo');
    expect(get(stores.resultsPerPage)).toBe(10000);
  });

  it('SR-235 centres the map on [47, 2.3] at zoom 6, zoom control top-right, double-click zoom off', () => {
    const { container } = render(Map);
    const [map] = maps;
    expect(L.map.mock.calls[0][1]).toMatchObject({ center: [47, 2.3], zoom: 6, zoomControl: false });
    expect(map.getCenter().lat).toBeCloseTo(47, 1);
    expect(map.getCenter().lng).toBeCloseTo(2.3, 1);
    expect(map.getZoom()).toBe(6);
    expect(map.doubleClickZoom.enabled()).toBe(false);
    expect(container.querySelector('.leaflet-top.leaflet-right .leaflet-control-zoom')).not.toBeNull();
    expect(container.querySelector('.leaflet-top.leaflet-left .leaflet-control-zoom')).toBeNull();
  });

  it('SR-236 draws blue birth markers, red death markers and birth-to-death lines', async () => {
    stores.searchResults.set([
      withPlaces('a', [44.88, -0.65], [44.8, -0.63]),
      withPlaces('b', [48.85, 2.35], undefined)
    ]);
    render(Map);
    await waitFor(() => expect(births()).toHaveLength(2));
    expect(births().map(m => m.latlng)).toEqual([[44.88, -0.65], [48.85, 2.35]]);
    expect(births()[0].options.color).toBe('var(--bf500)');
    expect(deaths().map(m => m.latlng)).toEqual([[44.8, -0.63]]);
    expect(deaths()[0].options.color).toBe('var(--rm500)');
    expect(lines.map(l => l.latlngs)).toEqual([[[44.88, -0.65], [44.8, -0.63]]]);
    expect(lines[0].options).toMatchObject({ color: '#209cee', pane: 'overlayPane' });
    expect(maps[0].hasLayer(births()[0].layer)).toBe(true);
  });

  it('SR-237 the marker size scales with the zoom and the number of results', async () => {
    stores.searchResults.set([withPlaces('a', [44.88, -0.65], [44.8, -0.63])]);
    render(Map);
    await waitFor(() => expect(births().length).toBeGreaterThan(0));
    const scaleAt = (zoom, n) => (zoom ** 1.5) * 0.05 * (2 - Math.log(Math.max(1, n)) / Math.log(10000)) ** 3;
    expect(births().at(-1).options.radius).toBeCloseTo(1.5 * scaleAt(6, 1));
    expect(deaths().at(-1).options.radius).toBeCloseTo(2 * scaleAt(6, 1));
    maps[0].setZoom(8, { animate: false });
    await waitFor(() => expect(births().at(-1).options.radius).toBeCloseTo(1.5 * scaleAt(8, 1)));
    stores.searchResults.set([...Array(100).keys()].map(i => withPlaces(`p${i}`, [45, 1], [46, 2])));
    await waitFor(() => expect(births().at(-1).options.radius).toBeCloseTo(1.5 * scaleAt(8, 100)));
  });

  it('SR-238 hovering a marker or a line previews the result card', async () => {
    stores.searchResults.set([withPlaces('a', [44.88, -0.65], [44.8, -0.63])]);
    const { container } = render(Map);
    await waitFor(() => expect(births().length).toBeGreaterThan(0));
    births().at(-1).layer.fire('mouseover');
    await waitFor(() => expect(screen.getByText('NOM-A Jean')).toBeTruthy());
    expect(container.querySelector('.result .rf-card').className).toContain('rf-card--sm');
    lines.at(-1).layer.fire('mouseover');
    deaths().at(-1).layer.fire('mouseover');
    expect(screen.getAllByText('NOM-A Jean')).toHaveLength(1);
  });

  it('SR-239 clicking a marker or a line shows the expanded card', async () => {
    stores.searchResults.set([withPlaces('a', [44.88, -0.65], [44.8, -0.63])]);
    const { container } = render(Map);
    await waitFor(() => expect(deaths().length).toBeGreaterThan(0));
    deaths().at(-1).layer.fire('click');
    await waitFor(() => expect(container.querySelector('.result .rf-card').className).toContain('rf-card--md'));
    expect(container.querySelector('.result').getAttribute('style')).toMatch(/height: 600px/);
  });

  it('SR-240 clicking the preview toggles its expansion (600 px)', async () => {
    stores.searchResults.set([withPlaces('a', [44.88, -0.65], [44.8, -0.63])]);
    const { container } = render(Map);
    await waitFor(() => expect(births().length).toBeGreaterThan(0));
    births().at(-1).layer.fire('mouseover');
    await waitFor(() => expect(container.querySelector('.result')).not.toBeNull());
    const preview = container.querySelector('.result');
    expect(preview.getAttribute('style') || '').not.toMatch(/600px/);
    await fireEvent.click(preview);
    expect(container.querySelector('.result').getAttribute('style')).toMatch(/height: 600px/);
    expect(container.querySelector('.result .rf-card').className).toContain('rf-card--md');
  });

  it('SR-241 new results clear the preview', async () => {
    stores.searchResults.set([withPlaces('a', [44.88, -0.65], [44.8, -0.63])]);
    const { container } = render(Map);
    await waitFor(() => expect(births().length).toBeGreaterThan(0));
    births().at(-1).layer.fire('mouseover');
    await waitFor(() => expect(container.querySelector('.result')).not.toBeNull());
    stores.searchResults.set([withPlaces('b', [45, 1], [46, 2])]);
    await waitFor(() => expect(container.querySelector('.result')).toBeNull());
  });

  it('SR-242 layer toggles "Naissance"/"Décès": one at least stays visible, lines only with both', async () => {
    const { container } = render(Map);
    const [map] = maps;
    const display = (pane) => map.getPane(pane).style.display;
    const toggle = (label) => fireEvent.click(screen.getByLabelText(label).parentElement);
    await toggle('Naissance');
    expect(screen.getByLabelText('Naissance').checked).toBe(false);
    expect([display('birth'), display('death'), display('overlayPane')]).toEqual(['none', 'block', 'none']);
    // hiding the last visible layer brings back the other one
    await toggle('Décès');
    expect(screen.getByLabelText('Naissance').checked).toBe(true);
    expect(screen.getByLabelText('Décès').checked).toBe(false);
    expect([display('birth'), display('death'), display('overlayPane')]).toEqual(['block', 'none', 'none']);
    await toggle('Décès');
    expect([display('birth'), display('death'), display('overlayPane')]).toEqual(['block', 'block', 'block']);
    expect(container.querySelector('label[for="Naissance"]').getAttribute('style')).toBe('color: var(--bf500);');
  });

  it('SR-243 the fullscreen toggle requests/exits fullscreen and switches its label', async () => {
    const { container } = render(Map);
    const mapDiv = container.querySelector('.map');
    mapDiv.requestFullscreen = vi.fn();
    await fireEvent.click(screen.getByText('Cliquez ici pour le plein écran'));
    expect(mapDiv.requestFullscreen).toHaveBeenCalled();
    expect(screen.getByText('Cliquez ici pour sortir du plein écran')).toBeTruthy();
    await fireEvent.click(screen.getByText('Cliquez ici pour sortir du plein écran'));
    expect(screen.getByText('Cliquez ici pour le plein écran')).toBeTruthy();
  });

  it('SR-244 shows a spinner overlay over the map while searching', async () => {
    const { container } = render(Map);
    expect(container.querySelector('.wait')).toBeNull();
    stores.waitSearch.set(true);
    await waitFor(() => expect(container.querySelector('.wait .spin')).not.toBeNull());
    stores.waitSearch.set(false);
    await waitFor(() => expect(container.querySelector('.wait')).toBeNull());
  });

  it('SR-245 a window resize invalidates the map size', async () => {
    render(Map);
    const invalidate = vi.spyOn(maps[0], 'invalidateSize');
    window.dispatchEvent(new Event('resize'));
    expect(invalidate).toHaveBeenCalled();
  });

  it('SR-246 new results redraw the layers (old ones removed)', async () => {
    stores.searchResults.set([withPlaces('a', [44.88, -0.65], [44.8, -0.63])]);
    render(Map);
    await waitFor(() => expect(births().length).toBeGreaterThan(0));
    const old = births().at(-1).layer;
    stores.searchResults.set([withPlaces('b', [45, 1], [46, 2]), withPlaces('c', [47, 1], [48, 2])]);
    await waitFor(() => expect(births().filter(m => maps[0].hasLayer(m.layer)).map(m => m.latlng)).toEqual([[45, 1], [47, 1]]));
    expect(maps[0].hasLayer(old)).toBe(false);
  });

  it('SR-247 the preview card width is full on mobile and 100% - 190px on desktop (CSS media queries)', () => {
    const { container } = render(Map);
    const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
    const mapClass = [...container.querySelector('.map').classList].find(c => c.startsWith('svelte-'));
    expect(css).toMatch(new RegExp(`max-width:\\s*768px\\)\\s*\\{\\s*\\.result\\.${mapClass}\\s*\\{\\s*width:\\s*100%`));
    expect(css).toMatch(new RegExp(`min-width:\\s*769px\\)\\s*\\{\\s*\\.result\\.${mapClass}\\s*\\{\\s*width:\\s*calc\\(100% - 190px\\)`));
  });
});

describe('TileLayer and Geo', () => {
  beforeEach(() => {
    resetSearchStores(stores);
    mockFetch();
    spyLeaflet();
  });

  it('SR-248 adds the tile layer of the configured server (attribution, maxZoom 18) to the map', () => {
    const tileLayer = vi.spyOn(L, 'tileLayer');
    render(Geo);
    const call = tileLayer.mock.calls.find(([url]) => url === tileServers['ign.plan.grey'].url);
    expect(call[1]).toEqual({ attribution: tileServers['ign.plan.grey'].attribution, maxZoom: 18, id: 'ign.plan.grey', className: 'tiles-greyscale', opacity: 0.5 });
    const layer = tileLayer.mock.results[tileLayer.mock.calls.indexOf(call)].value;
    expect(maps.at(-1).hasLayer(layer)).toBe(true);
  });

  // BUG: TileLayer registers a global L.Map.addInitHook on every mount and
  // never removes it (TileLayer.svelte:13-23): each time the geo view is
  // entered again, every new map gets one more (identical) tile layer, so
  // the tiles are requested several times.
  it.fails('SR-248 re-entering the geo view adds a single tile layer to the new map', () => {
    const first = render(Geo);
    first.unmount();
    const tileLayer = vi.spyOn(L, 'tileLayer');
    render(Geo);
    expect(tileLayer.mock.calls.filter(([url]) => url === tileServers['ign.plan.grey'].url)).toHaveLength(1);
  });

  it('SR-249 Geo uses ign.plan.grey; TileLayer defaults to osm.mapnik', () => {
    const tileLayer = vi.spyOn(L, 'tileLayer');
    render(TileLayer);
    L.map(document.createElement('div'), { center: [47, 2.3], zoom: 6 });
    expect(tileLayer.mock.calls.map(([url]) => url)).toContain(tileServers['osm.mapnik'].url);
  });

  it('SR-250 the map wrapper is centred with a flex container', () => {
    const { container } = render(Geo);
    const wrapper = container.querySelector('.map-container');
    expect(getComputedStyle(wrapper).display).toBe('flex');
    expect(getComputedStyle(wrapper).justifyContent).toBe('center');
    expect(wrapper.querySelector('.map')).not.toBeNull();
  });
});
