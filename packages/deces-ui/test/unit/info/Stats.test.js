// Inventory zone IN, Stats.svelte consultation dashboard (rows IN-103 .. IN-138).
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/svelte';

vi.mock('chart.js/auto', () => import('./fake-chart.js'));

const { default: Stats } = await import('../../../src/components/views/Stats.svelte');
const { route } = await import('../../../src/components/tools/stores.js');
const { charts, resetCharts } = await import('./fake-chart.js');
const { resetStores, setDsfrColors } = await import('./helpers.js');
const fixture = await import('./stats-fixture.js');

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

// fetch() stub keeping a reference to the objects handed to the component
// (Stats.svelte mutates them in place).
let served;
const stubFetch = ({ catalog = fixture.catalog(), data = {}, fallback = () => fixture.dataset() } = {}) => {
  served = {};
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (url === '/stats/catalog.json') {
      if (catalog instanceof Error) throw catalog;
      return { status: 200, json: async () => catalog };
    }
    const match = `${url}`.match(/^\/stats\/(.*)\.json$/);
    if (match) {
      const source = match[1];
      const value = source in data ? data[source] : fallback(source);
      if (value instanceof Error) return { status: 404, json: async () => { throw value; } };
      served[source] = value;
      return { status: 200, json: async () => value };
    }
    if (url === '/simple-french-departments-wdom.json') return { json: async () => fixture.franceGeojson() };
    if (url === '/simple-world-map.json') return { json: async () => fixture.worldGeojson() };
    return { json: async () => ({}) };
  });
};

const selects = (container) => [...container.querySelectorAll('select.rf-select[name="select"]')];
const tile = (container, title) => [...container.querySelectorAll('.rf-tile')]
  .find(t => t.querySelector('.rf-tile__title') && text(t.querySelector('.rf-tile__title')) === title);
// chart tiles are the ones with an expand toggle (KPI tiles have none)
const chartTitles = (container) => [...container.querySelectorAll('.rf-tile')]
  .filter(t => t.querySelector('.rf-tile__icon'))
  .map(t => text(t.querySelector('h4.rf-tile__title')));
const kpis = (container) => [...container.querySelectorAll('.rf-tile .rf-tile__body.rf-text--center')]
  .map(t => [text(t.querySelector('h4')), text(t.querySelector('p'))]);
const lastChart = (predicate) => [...charts].reverse().find(predicate);
const chartByLabelCount = (type) => lastChart(c => c.config.type === type);
const labelsOf = (chart) => chart.data.labels;

const renderStats = async (query = {}) => {
  route.set({ path: '/stats', query });
  const result = render(Stats);
  await waitFor(() => expect(result.container.querySelector('h4')).not.toBeNull());
  return result;
};

const changeSelect = async (select, value) => {
  await fireEvent.change(select, { target: { value } });
};

describe('Stats', () => {
  beforeEach(() => {
    resetStores();
    resetCharts();
    setDsfrColors();
    HTMLCanvasElement.prototype.getContext = () => ({});
    window.history.replaceState({}, '', '/stats');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('loading and availability', () => {
    it('IN-103 fetches /stats/catalog.json on mount', async () => {
      const fetchMock = stubFetch();
      render(Stats);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/stats/catalog.json'));
    });

    it('IN-104 unavailable state (alarm icon + message) when the catalog fetch fails', async () => {
      stubFetch({ catalog: new TypeError('offline') });
      const { container } = render(Stats);
      expect(await screen.findByText('Les statistiques seront bientôt disponibles ...')).toBeTruthy();
      expect(container.querySelector('svg')).not.toBeNull();
      expect(container.querySelector('select')).toBeNull();
    });

    it('IN-104 unavailable state when the data JSON cannot be parsed (e.g. SPA fallback HTML)', async () => {
      stubFetch({ data: { day: new SyntaxError('Unexpected token <') } });
      render(Stats);
      expect(await screen.findByText('Les statistiques seront bientôt disponibles ...')).toBeTruthy();
    });

    it('IN-105 nothing is rendered while the catalog is loading (no spinner)', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
      const { container } = render(Stats);
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(container.querySelector('.rf-grid-row').children).toHaveLength(0);
    });

    it('IN-135 series colours are derived from the CSS variable --bf500', async () => {
      stubFetch();
      await renderStats();
      const visitors = await waitFor(() => {
        const c = chartByLabelCount('line');
        expect(c).toBeDefined();
        return c;
      });
      expect(visitors.data.datasets.map(d => d.backgroundColor)).toEqual([
        'rgba(0,0,145,0.7)', 'rgba(0,0,145,0.55)', 'rgba(0,0,145,0.4)', 'rgba(0,0,145,0.25)'
      ]);
    });

    it('IN-135 without the --bf500 CSS variable the component fails at init (jsdom pitfall, pinned)', () => {
      document.body.style.removeProperty('--bf500');
      stubFetch();
      expect(() => render(Stats)).toThrow(TypeError);
    });
  });

  describe('scope, period and URL selectors', () => {
    it('IN-106 default scope "Aujourd\'hui" loads /stats/day.json', async () => {
      const fetchMock = stubFetch();
      const { container } = await renderStats();
      expect(fetchMock).toHaveBeenCalledWith('/stats/day.json');
      expect(selects(container)[0].value).toBe('today');
    });

    it('IN-107 deep link ?scope=month&source=202301 restores the selectors and loads that period', async () => {
      const fetchMock = stubFetch();
      const { container } = await renderStats({ scope: 'month', source: '202301' });
      expect(fetchMock).toHaveBeenCalledWith('/stats/202301.json');
      expect(fetchMock).not.toHaveBeenCalledWith('/stats/202302.json');
      await waitFor(() => expect(selects(container)[1].value).toBe('202301'));
      expect(selects(container)[0].value).toBe('month');
    });

    it('IN-108 a source change rewrites the URL with ?source=…&scope=… (replaceState)', async () => {
      stubFetch();
      const replaceState = vi.spyOn(window.history, 'replaceState');
      const { container } = await renderStats();
      expect(location.pathname + location.search).toBe('/stats?source=day&scope=today');
      await changeSelect(selects(container)[0], 'week');
      await waitFor(() => expect(location.search).toBe('?source=2023S02&scope=week'));
      expect(replaceState).toHaveBeenCalled();
    });

    it('IN-115 "Cycle" select lists the 9 scopes', async () => {
      stubFetch();
      const { container } = await renderStats();
      const options = [...selects(container)[0].querySelectorAll('option')];
      expect(options.map(o => [o.value, text(o)])).toEqual([
        ['', '- Choisir -'],
        ['full', 'Complet'],
        ['today', 'Aujourd\'hui'],
        ['day', 'Jour'],
        ['month', 'Mois'],
        ['week', 'Semaine'],
        ['today-detailed', 'Aujourd\'hui (détail)'],
        ['day-detailed', 'Jour (détail)'],
        ['month-detailed', 'Mois (détail)'],
        ['week-detailed', 'Semaine (détail)']
      ]);
      expect(within(container).getByText('Cycle').tagName).toBe('LABEL');
    });

    it('IN-116 "Période" select is disabled for "today" and "full"', async () => {
      stubFetch();
      const { container } = await renderStats();
      expect(selects(container)[1].disabled).toBe(true);
      await changeSelect(selects(container)[0], 'day');
      await waitFor(() => expect(selects(container)[1].disabled).toBe(false));
      await changeSelect(selects(container)[0], 'full');
      await waitFor(() => expect(selects(container)[1].disabled).toBe(true));
    });

    it('IN-117 "Période" options: catalog entries of the scope, newest first, formatted', async () => {
      stubFetch();
      const { container } = await renderStats();
      const periods = () => [...selects(container)[1].querySelectorAll('option')].filter(o => o.value).map(o => [o.value, text(o)]);
      await changeSelect(selects(container)[0], 'day');
      await waitFor(() => expect(periods()).toEqual([['20230102', '02/01/2023'], ['20230101', '01/01/2023']]));
      await changeSelect(selects(container)[0], 'week');
      await waitFor(() => expect(periods()).toEqual([['2023S02', 'Semaine S02 2023'], ['2023S01', 'Semaine S01 2023']]));
      await changeSelect(selects(container)[0], 'month-detailed');
      await waitFor(() => expect(periods()).toEqual([['202301-detailed', 'Janvier 2023']]));
      await changeSelect(selects(container)[0], 'week-detailed');
      await waitFor(() => expect(periods()).toEqual([['2023S01-detailed', 'semaine S01 2023']]));
    });

    it('IN-118 changing the scope auto-selects the latest period and loads it', async () => {
      const fetchMock = stubFetch();
      const { container } = await renderStats();
      await changeSelect(selects(container)[0], 'month');
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/stats/202302.json'));
      expect(selects(container)[1].value).toBe('202302');
    });

    it('IN-119 month labels are French month names (pinned with the current "Févier" typo)', async () => {
      stubFetch();
      const { container } = await renderStats();
      await changeSelect(selects(container)[0], 'month');
      await waitFor(() => expect(text(selects(container)[1])).toContain('Févier 2023'));
      expect(text(selects(container)[1])).toContain('Janvier 2023');
    });

    // BUG: February is spelled "Févier" (Stats.svelte:443).
    it.fails('IN-119 BUG: February is labelled "Février"', async () => {
      stubFetch();
      const { container } = await renderStats();
      await changeSelect(selects(container)[0], 'month');
      await waitFor(() => expect(text(selects(container)[1])).toContain('Février 2023'), { timeout: 300 });
    });

    it('IN-120 "Filtre URL" select: "Aucun" + API endpoints that have data', async () => {
      stubFetch();
      const { container } = await renderStats();
      const options = [...selects(container)[2].querySelectorAll('option')].map(o => [o.value, text(o)]);
      expect(options).toEqual([['', 'Aucun'], ['', 'Aucun'], ['api: search POST', 'api: search POST']]);
    });

    it('IN-121 selecting a URL filter switches to that dataset and hides "Sites sources"', async () => {
      stubFetch();
      const { container } = await renderStats();
      expect(chartTitles(container)).toContain('Sites sources');
      await changeSelect(selects(container)[2], 'api: search POST');
      await waitFor(() => expect(chartTitles(container)).not.toContain('Sites sources'));
      expect(chartTitles(container)).toEqual(['Visiteurs', 'Requêtes']);
      expect(kpis(container)[0]).toEqual(['42', 'Visiteurs']);
    });

    // BUG: the three selects share id="select" and all labels point to it.
    it.fails('IN-138 BUG: each stats select has a unique id referenced by its label', async () => {
      stubFetch();
      const { container } = await renderStats();
      const ids = selects(container).map(s => s.id);
      expect(new Set(ids).size).toBe(3);
    });

    it('IN-138 the three selects currently share id="select" (pinned)', async () => {
      stubFetch();
      const { container } = await renderStats();
      expect(selects(container).map(s => s.id)).toEqual(['select', 'select', 'select']);
      expect([...container.querySelectorAll('label.rf-label')].map(l => l.getAttribute('for'))).toEqual(['select', 'select', 'select']);
    });
  });

  describe('polling', () => {
    it('IN-109 day scopes re-fetch the data every 150 s while selected', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      const fetchMock = stubFetch();
      route.set({ path: '/stats', query: {} });
      render(Stats);
      const dayCalls = () => fetchMock.mock.calls.filter(c => c[0] === '/stats/day.json').length;
      await vi.waitFor(() => expect(dayCalls()).toBe(1));
      await vi.advanceTimersByTimeAsync(149000);
      expect(dayCalls()).toBe(1);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.waitFor(() => expect(dayCalls()).toBe(2));
    });

    it('IN-109 non-day scopes are fetched once', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      const fetchMock = stubFetch();
      route.set({ path: '/stats', query: { scope: 'month', source: '202301' } });
      render(Stats);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/stats/202301.json'));
      await vi.advanceTimersByTimeAsync(300000);
      expect(fetchMock.mock.calls.filter(c => c[0] === '/stats/202301.json')).toHaveLength(1);
    });

    // BUG: the polling loop is never stopped (no onDestroy): it keeps fetching
    // after the component is destroyed (Stats.svelte:231-236).
    it.fails('IN-109 BUG: polling stops when the component is destroyed', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      const fetchMock = stubFetch();
      route.set({ path: '/stats', query: {} });
      const { unmount } = render(Stats);
      const dayCalls = () => fetchMock.mock.calls.filter(c => c[0] === '/stats/day.json').length;
      await vi.waitFor(() => expect(dayCalls()).toBe(1));
      unmount();
      await vi.advanceTimersByTimeAsync(150000);
      expect(dayCalls()).toBe(1);
    });
  });

  describe('KPI tiles', () => {
    it('IN-110 heading "Statistiques de consultation" above the KPI tiles', async () => {
      stubFetch();
      const { container } = await renderStats();
      expect(text(container.querySelector('h4'))).toBe('Statistiques de consultation');
    });

    it('IN-111 .. IN-114 Visiteurs, Appels API décès, Appariements, Corrections usager', async () => {
      stubFetch();
      const { container } = await renderStats();
      expect(kpis(container)).toEqual([
        ['12.3k', 'Visiteurs'], // general.unique_visitors = 12345
        // hits of every "api: search …" row, OPTIONS included (1000 + 500 + 500)
        ['2k', 'Appels API décès'],
        ['1k', 'Appariements'], // bytes of "api: search/csv GET" / 400
        ['7', 'Corrections usager'] // hits of "api: id… POST"
      ]);
    });
  });

  describe('charts', () => {
    it('IN-122 / IN-123 chart tiles: views without data are hidden; heatmap hidden for day scopes', async () => {
      stubFetch({ fallback: () => fixture.dataset({ withCountry: false }) });
      const { container } = await renderStats();
      expect(chartTitles(container)).toEqual(['Visiteurs', 'Sites sources', 'Par département', 'Requêtes', 'Navigateur']);
      await changeSelect(selects(container)[0], 'month');
      await waitFor(() => expect(chartTitles(container)).toContain('Heure de visite'));
      expect(chartTitles(container)).toEqual(['Visiteurs', 'Sites sources', 'Par département', 'Heure de visite', 'Requêtes', 'Navigateur']);
    });

    it('IN-124 expand toggle (desktop only): 6 -> 12 columns, max-height 250 -> 500 px', async () => {
      stubFetch();
      const { container } = await renderStats();
      const visitors = () => tile(container, 'Visiteurs');
      const column = () => visitors().parentElement;
      expect(column().className).toContain('rf-col-xl-6');
      expect(visitors().querySelector('canvas').getAttribute('style')).toBe('max-height: 250px;');
      const toggle = visitors().querySelector('.rf-tile__icon');
      expect(toggle.classList.contains('rf-hide--mobile')).toBe(true);
      await fireEvent.click(toggle);
      expect(column().className).toContain('rf-col-xl-12');
      expect(column().className).toContain('rf-col-lg-12');
      expect(visitors().querySelector('canvas').getAttribute('style')).toBe('max-height: 500px;');
      await fireEvent.click(toggle);
      expect(column().className).toContain('rf-col-xl-6');
    });

    it('IN-125 "Visiteurs": line chart, time x-axis, 4 series', async () => {
      stubFetch();
      await renderStats();
      const chart = await waitFor(() => {
        const c = chartByLabelCount('line');
        expect(c).toBeDefined();
        return c;
      });
      expect(chart.config.options.scales.x).toEqual({ type: 'time' });
      expect(chart.data.datasets.map(d => d.label)).toEqual(['Visiteurs', 'Nombre de requêtes', 'Bande passante', 'Temps de réponse']);
      expect(chart.data.datasets.map(d => d.yAxisID)).toEqual(['visitors', 'hits', 'bytes', 'duration']);
      expect(chart.data.datasets[0].data.map(p => p.y)).toEqual([10, 11, 12, 13]);
      expect(chart.data.datasets[3].data.map(p => p.y)).toEqual([0.2]);
      expect(chart.config.options.scales.visitors.type).toBe('linear');
    });

    it('IN-133 dateParse: yyyymmdd, yyyymmdd-hhmm, yyyySww-mmdd, yyyySww-mmdd-hhmm (+1 h)', async () => {
      stubFetch();
      await renderStats();
      const chart = await waitFor(() => {
        const c = chartByLabelCount('line');
        expect(c).toBeDefined();
        return c;
      });
      expect(chart.data.labels.map(d => d.getTime())).toEqual([
        new Date(2023, 0, 1, 1, 0).getTime(),
        new Date(2023, 0, 1, 14, 0).getTime(),
        new Date(2023, 0, 2, 1, 0).getTime(),
        new Date(2023, 0, 2, 14, 0).getTime()
      ]);
    });

    it('IN-126 "Sites sources": log bar chart, referrers aggregated, matchid.io excluded, top 15 by visitors', async () => {
      stubFetch();
      await renderStats();
      const chart = await waitFor(() => {
        const c = charts.find(ch => ch.data.labels.includes('google.com'));
        expect(c).toBeDefined();
        return c;
      });
      expect(chart.config.type).toBe('bar');
      expect(chart.config.options.scales.visitors.type).toBe('logarithmic');
      expect(chart.data.labels).toHaveLength(15);
      expect(chart.data.labels.slice(0, 3)).toEqual(['site19.org', 'site18.org', 'site17.org']);
      expect(chart.data.labels).toContain('google.com');
      expect(chart.data.labels).not.toContain('matchid.io');
      expect(chart.data.labels).not.toContain('lonely.org');
      expect(chart.data.labels).not.toContain('x');
      const google = chart.data.labels.indexOf('google.com');
      expect(chart.data.datasets[0].data[google].y).toBe(12); // www.google.fr (8) + google.com/search (4)
    });

    it('IN-129 "Requêtes": log bar chart, OPTIONS/HEAD removed, only api/static entries kept, sorted by visitors', async () => {
      stubFetch();
      await renderStats();
      const chart = await waitFor(() => {
        const c = charts.find(ch => ch.data.labels.includes('api: search POST'));
        expect(c).toBeDefined();
        return c;
      });
      expect(chart.config.type).toBe('bar');
      expect(chart.config.options.scales.hits.type).toBe('logarithmic');
      // "page: /x (GET)" rows are renamed "page: x" and then dropped by the
      // `^page: \/…` filter (pinned quirk); "page: WRONG" is dropped too.
      expect(chart.data.labels).toEqual(['api: search POST', 'api: search GET', 'static: images', 'api: search/csv GET', 'api: id/abc POST']);
    });

    it('IN-130 "Navigateur": bar chart limited to Chrome/Safari/Edge/Firefox/MSIE/Others/Crawlers', async () => {
      stubFetch();
      await renderStats();
      const chart = await waitFor(() => {
        const c = charts.find(ch => ch.data.labels.includes('Chrome'));
        expect(c).toBeDefined();
        return c;
      });
      expect(chart.config.type).toBe('bar');
      expect(chart.data.labels).toEqual(['Chrome', 'Firefox', 'Crawlers']);
    });

    it('IN-132 bar border width is 2 for day scopes, 1 for full and detailed scopes', async () => {
      stubFetch();
      const { container } = await renderStats();
      const browsers = () => [...charts].reverse().find(ch => ch.data.labels.includes('Chrome'));
      await waitFor(() => expect(browsers()).toBeDefined());
      expect(browsers().data.datasets[0].borderWidth).toBe(2);
      await changeSelect(selects(container)[0], 'full');
      await waitFor(() => expect(browsers().data.datasets[0].borderWidth).toBe(1));
      await changeSelect(selects(container)[0], 'month-detailed');
      await waitFor(() => expect(browsers().data.datasets[0].borderWidth).toBe(1));
      await changeSelect(selects(container)[0], 'month');
      await waitFor(() => expect(browsers().data.datasets[0].borderWidth).toBe(2));
    });

    it('IN-127 "Par département": France map, department codes filtered on [0-9][0-9ab]', async () => {
      stubFetch();
      const { container } = await renderStats();
      const map = tile(container, 'Par département');
      await waitFor(() => expect(map.querySelectorAll('path.hoverable')).toHaveLength(3));
      const tooltip = (id) => [...map.querySelectorAll('g.tooltip')]
        .find(g => g.querySelector('tspan').textContent === id);
      expect(text(tooltip('Gironde'))).toBe('Gironde Visiteurs: 30');
      expect(text(tooltip('Corse-du-Sud'))).toBe('Corse-du-Sud Visiteurs: 3');
      expect(text(tooltip('Paris'))).toBe('Paris Visiteurs: 0');
    });

    it('IN-128 "Heure de visite": heatmap of day-of-week x hour (month scope)', async () => {
      stubFetch();
      const { container } = await renderStats({ scope: 'month', source: '202301' });
      const heatmap = await waitFor(() => {
        const t = tile(container, 'Heure de visite');
        expect(t).toBeDefined();
        return t;
      });
      await waitFor(() => expect(heatmap.querySelector('rect[id="lun13"]')).not.toBeNull());
      expect(heatmap.querySelector('rect[id="dim09"]')).not.toBeNull();
      expect([...heatmap.querySelectorAll('text[id="lun"], text[id="dim"]')].map(text)).toEqual(['lun', 'dim']);
    });

    it('IN-131 "Par pays": world map, ISO2 -> ISO3, nested items flattened', async () => {
      stubFetch();
      const { container } = await renderStats();
      const map = tile(container, 'Par pays');
      await waitFor(() => expect(map.querySelectorAll('path.hoverable')).toHaveLength(3));
      const tooltip = (id) => [...map.querySelectorAll('g.tooltip')]
        .find(g => g.querySelector('tspan').textContent === id);
      expect(text(tooltip('FRA'))).toMatch(/^FRA Visiteurs:40 /);
      expect(text(tooltip('DEU'))).toMatch(/^DEU Visiteurs:7 /);
      expect(text(tooltip('BRA'))).toBe('BRA Visiteurs:0 Nombre de requêtes:0 Bande passante:0');
    });

    it('IN-134 chart dataCB callbacks mutate the fetched data in place, once per template evaluation (pinned)', async () => {
      stubFetch();
      const { container } = await renderStats({ scope: 'month', source: '202301' });
      await waitFor(() => expect(tile(container, 'Heure de visite')).toBeDefined());
      const raw = served['202301'];
      const suffixes = () => raw.hour_of_day_of_week.data.map(d => d.data.replace(/^.*-\d\d/, ''));
      // already evaluated twice by the initial render (Svelte 3)
      expect(suffixes()).toEqual(['hh', 'hh']);
      await changeSelect(selects(container)[2], 'api: search POST');
      await changeSelect(selects(container)[2], '');
      await waitFor(() => expect(tile(container, 'Heure de visite')).toBeDefined());
      expect(suffixes()[0].length).toBeGreaterThan(2);
    });

    // BUG: the "h" suffix is appended again each time the template
    // re-evaluates data(view) on the same raw data (Stats.svelte:482-483).
    // Svelte 5 may re-run it more often.
    it.fails('IN-134 BUG: re-rendering does not re-apply dataCB on already transformed data', async () => {
      stubFetch();
      const { container } = await renderStats({ scope: 'month', source: '202301' });
      await waitFor(() => expect(tile(container, 'Heure de visite')).toBeDefined());
      expect(served['202301'].hour_of_day_of_week.data.map(d => d.data)).toEqual(['lun-13h', 'dim-09h']);
    });
  });
});
