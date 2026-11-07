// Inventory zone IN, chart building blocks (rows IN-139 .. IN-154):
// StatsTile + smartNumber, Chart/Bar/Line/Pie (chart.js wrapper), PieChart,
// Radar + tools/radar.js.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

vi.mock('chart.js/auto', () => import('./fake-chart.js'));

const { default: StatsTile } = await import('../../../src/components/views/StatsTile.svelte');
const { default: Chart } = await import('../../../src/components/views/Chart.svelte');
const { default: Bar } = await import('../../../src/components/views/Bar.svelte');
const { default: Line } = await import('../../../src/components/views/Line.svelte');
const { default: Pie } = await import('../../../src/components/views/Pie.svelte');
const { default: PieChart } = await import('../../../src/components/views/PieChart.svelte');
const { default: Radar } = await import('../../../src/components/views/Radar.svelte');
const { default: renderRadar } = await import('../../../src/components/tools/radar.js');
const { smartNumber } = await import('../../../src/components/tools/stats.js');
const Adapter = await import('chartjs-adapter-date-fns');
const { charts, registered, resetCharts, default: FakeChart } = await import('./fake-chart.js');
const { setDsfrColors } = await import('./helpers.js');

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const chartData = (values) => ({ labels: values.map((_, i) => `l${i}`), datasets: [{ label: 's', data: values }] });

beforeEach(() => {
  resetCharts();
  setDsfrColors();
  HTMLCanvasElement.prototype.getContext = () => ({ kind: '2d' });
});

describe('smartNumber and StatsTile', () => {
  it('IN-141 smartNumber: plain below 1000, then k / M / G, trailing ".0" stripped', () => {
    expect(smartNumber(0)).toBe('0');
    expect(smartNumber(42)).toBe('42');
    expect(smartNumber(12.34, 1)).toBe('12.3');
    expect(smartNumber(10, 1)).toBe('10');
    expect(smartNumber(1000)).toBe('1k');
    expect(smartNumber(12345, 1)).toBe('12.3k');
    expect(smartNumber(1500000, 1)).toBe('1.5M');
    expect(smartNumber(2000000000)).toBe('2G');
  });

  it('IN-141 smartNumber edge cases (pinned): rounding up at boundaries, "1.50" not stripped', () => {
    expect(smartNumber(999.9)).toBe('1000');
    expect(smartNumber(999999)).toBe('1000k');
    expect(smartNumber(1.5, 2)).toBe('1.50');
    expect(smartNumber(2, 2)).toBe('2');
  });

  it('IN-139 StatsTile renders smartNumber(number, precision) and its label', () => {
    const { container } = render(StatsTile, { number: 12345, precision: 1, label: 'Visiteurs' });
    expect(text(container.querySelector('h4'))).toBe('12.3k');
    expect(text(container.querySelector('p'))).toBe('Visiteurs');
  });

  it('IN-139 StatsTile defaults: 0 and an empty label', () => {
    const { container } = render(StatsTile);
    expect(text(container.querySelector('h4'))).toBe('0');
    expect(text(container.querySelector('p'))).toBe('');
  });

  it('IN-140 StatsTile passes non-number values through (e.g. "12 %")', () => {
    const { container } = render(StatsTile, { number: '12 %', label: 'Taux' });
    expect(text(container.querySelector('h4'))).toBe('12 %');
  });
});

describe('Chart (chart.js wrapper)', () => {
  it('IN-142 creates one chart.js instance once data and canvas exist', () => {
    const data = chartData([1, 2]);
    const options = { animation: { duration: 0 } };
    const { container } = render(Chart, { type: 'bar', data, options });
    expect(charts).toHaveLength(1);
    expect(charts[0].ctx).toEqual({ kind: '2d' });
    expect(charts[0].config).toEqual({ type: 'bar', data, options });
    expect(container.querySelector('canvas').getAttribute('style')).toBe('max-height: 250px');
  });

  it('IN-142 no chart is created without data', () => {
    render(Chart, { type: 'line' });
    expect(charts).toHaveLength(0);
  });

  it('IN-143 a data update reuses the instance (chart.data + update); type/options changes are ignored', async () => {
    const { rerender } = render(Chart, { type: 'line', data: chartData([1]), options: { a: 1 } });
    const next = chartData([3, 4]);
    await rerender({ data: next });
    expect(charts).toHaveLength(1);
    expect(charts[0].data).toBe(next);
    expect(charts[0].updates).toBe(1);
    await rerender({ type: 'bar', options: { b: 2 } });
    expect(charts).toHaveLength(1);
    expect(charts[0].config.type).toBe('line');
    expect(charts[0].config.options).toEqual({ a: 1 });
  });

  it('IN-144 registers the date-fns adapter and sets the global font family', () => {
    render(Chart, { data: chartData([1]) });
    expect(registered).toContain(Adapter);
    expect(FakeChart.defaults.font.family).toMatch(/^-apple-system,BlinkMacSystemFont,"Segoe UI"/);
  });

  it('IN-145 the chart.js instance is not destroyed on unmount (pinned leak)', () => {
    const { unmount } = render(Chart, { data: chartData([1]) });
    unmount();
    expect(charts[0].destroyed).toBe(false);
  });

  // BUG: Chart.svelte has no onDestroy, chart.js instances leak on
  // unmount/remount (add chart.destroy() during the migration).
  it.fails('IN-145 BUG: the chart.js instance is destroyed on unmount', () => {
    const { unmount } = render(Chart, { data: chartData([1]) });
    unmount();
    expect(charts[0].destroyed).toBe(true);
  });

  it('IN-146 Bar / Line / Pie wrappers set the chart type', () => {
    render(Bar, { data: chartData([1]) });
    render(Line, { data: chartData([1]) });
    render(Pie, { data: chartData([1]) });
    expect(charts.map(c => c.config.type)).toEqual(['bar', 'line', 'pie']);
  });

  it('IN-146 wrappers forward data, options and style', () => {
    const data = chartData([1]);
    const { container } = render(Bar, { data, options: { x: 1 }, style: 'max-height: 500px;' });
    expect(charts[0].config.data).toBe(data);
    expect(charts[0].config.options).toEqual({ x: 1 });
    expect(container.querySelector('canvas').getAttribute('style')).toBe('max-height: 500px;');
  });

  // The inventory expected the wrapper default (undefined) to override the
  // Chart default; in Svelte 3 an undefined prop takes the fallback value, so
  // the canvas keeps "max-height: 250px" (same fallback rule in Svelte 5).
  it('IN-147 a wrapper without style falls back to the Chart default max-height', () => {
    const { container } = render(Line, { data: chartData([1]) });
    expect(container.querySelector('canvas').getAttribute('style')).toBe('max-height: 250px');
  });
});

describe('PieChart (donut progress)', () => {
  it('IN-148 draws the progress with stroke-dasharray from percent', () => {
    const { container } = render(PieChart, { percent: 0.5 });
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(2);
    expect(circles[1].getAttribute('stroke-dasharray')).toBe(`${0.5 / 2 * 31.42} ${31.42 - 0.5 * 31.42}`);
    expect(circles[1].getAttribute('stroke-dasharray')).toBe('7.855 15.71');
  });

  it('IN-148 0 % and 100 %', () => {
    const { container: empty } = render(PieChart, { percent: 0 });
    expect(empty.querySelectorAll('circle')[1].getAttribute('stroke-dasharray')).toBe('0 31.42');
    const { container: full } = render(PieChart, { percent: 1 });
    expect(full.querySelectorAll('circle')[1].getAttribute('stroke-dasharray')).toBe('15.71 0');
  });

  it('IN-149 spin (inner div), center (outer div) and extra classes on both', () => {
    const { container } = render(PieChart, { percent: 0.2, spin: true, center: true, class: 'extra' });
    const outer = container.firstElementChild;
    const inner = outer.firstElementChild;
    expect(outer.classList.contains('center')).toBe(true);
    expect(outer.classList.contains('spin')).toBe(false);
    expect(inner.classList.contains('spin')).toBe(true);
    expect(outer.classList.contains('extra')).toBe(true);
    expect(inner.classList.contains('extra')).toBe(true);
    expect(outer.classList.contains('rf-fi--icon')).toBe(true);
  });
});

describe('tools/radar.js render()', () => {
  const columns = { a: 'A', b: 'B', c: 'C', d: 'D' };

  it('IN-154 rejects non-object columns and data', () => {
    expect(() => renderRadar([], {})).toThrow('columns must be an object');
    expect(() => renderRadar('x', {})).toThrow('columns must be an object');
    expect(() => renderRadar(columns, [])).toThrow('data must be an object');
    expect(() => renderRadar(columns, 3)).toThrow('data must be an object');
  });

  it('IN-154 geometry: transform, scale circles, axes, captions and one closed path per year', () => {
    const result = renderRadar(columns, { 2022: { a: 1, b: 0.5 } }, { maxVal: 1, size: 120, width: 200, height: 100 });
    expect(result.transform).toBe('translate(100.0000,50.0000)');
    // chartSize = size / captionsPosition (1.2) = 100
    expect(result.groups.scale.map(c => [c.cx, c.cy])).toEqual([[0, 0], [0, 0], [0, 0]]);
    expect(result.groups.scale[0].r).toBeCloseTo(50);
    expect(result.groups.scale[1].r).toBeCloseTo(100 / 3);
    expect(result.groups.scale[2].r).toBeCloseTo(50 / 3);
    expect(result.groups.axis.map(a => a.points)).toEqual([
      '0.0000,0.0000 0.0000,-50.0000',
      '0.0000,0.0000 50.0000,0.0000',
      '0.0000,0.0000 0.0000,50.0000',
      '0.0000,0.0000 -50.0000,0.0000'
    ]);
    expect(result.groups.caption.map(c => [c.col, c.text, c.x, c.y, c.dy])).toEqual([
      ['a', 'A', '0.0000', '-57.0000', 1.5],
      ['b', 'B', '57.0000', '0.0000', 1.5],
      ['c', 'C', '0.0000', '57.0000', 1.5],
      ['d', 'D', '-57.0000', '0.0000', 1.5]
    ]);
    expect(result.groups.shapes).toEqual([
      { year: '2022', d: 'M 0.0000,-50.0000 25.0000,0.0000 0.0000,0.0000 0.0000,0.0000 z' }
    ]);
  });

  it('IN-154 options: no scale circles when scales = 0, no captions/axes when disabled', () => {
    const result = renderRadar(columns, {}, { scales: 0, captions: false, axes: false });
    expect(result.groups).toEqual({ shapes: [] });
  });
});

describe('Radar.svelte', () => {
  const day = (x, y) => ({ x, y });
  const radarData = () => ({
    datasets: [{ data: [day('20220115', 3), day('20220120', 2), day('20220701', 5), day('20230201', 4), day('bad', 9)] }]
  });

  it('IN-150 folds daily data into one polygon per year with month axes and captions', () => {
    const { container } = render(Radar, { data: radarData() });
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 400 300');
    expect(svg.getAttribute('width')).toBe('100%');
    expect(container.querySelectorAll('path')).toHaveLength(2);
    expect(container.querySelectorAll('polyline')).toHaveLength(12);
    expect(container.querySelectorAll('circle')).toHaveLength(10);
    const captions = [...container.querySelectorAll('text[dx="-12"]')].map(text);
    // Pinned quirk: the month keys "10", "11", "12" are integer-like and come
    // first in Object.keys(), so the radar starts at October.
    expect(captions).toEqual(['Oct', 'Nov', 'Déc', 'Janvier', 'Fév', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Sept']);
    const years = [...container.querySelectorAll('text.small')].map(text);
    expect(years).toEqual(['2022', '2023']);
  });

  it('IN-151 hovering a year shape thickens it, shows the year and the monthly values', async () => {
    const { container } = render(Radar, { data: radarData() });
    const path2022 = container.querySelectorAll('path')[0];
    const year2022 = container.querySelectorAll('text.small')[0];
    expect(path2022.style.strokeWidth).toBe('1px');
    expect(year2022.style.opacity).toBe('0');
    const before = container.querySelectorAll('text').length;
    await fireEvent.mouseEnter(path2022);
    expect(path2022.style.strokeWidth).toBe('3px');
    expect(year2022.style.opacity).toBe('0.9');
    expect(container.querySelectorAll('text').length).toBe(before + 2); // January (3 + 2) and July (5)
    const valueTexts = [...container.querySelectorAll('text:not([dx]):not(.small)')].map(text);
    expect(valueTexts).toEqual(['5', '5']);
    await fireEvent.mouseLeave(path2022);
    expect(path2022.style.strokeWidth).toBe('1px');
    expect(container.querySelectorAll('text').length).toBe(before);
  });

  it('IN-152 season colours: summer red, winter blue, others grey', () => {
    const { container } = render(Radar, { data: radarData() });
    const fill = Object.fromEntries([...container.querySelectorAll('text[dx="-12"]')].map(t => [text(t), t.getAttribute('fill')]));
    expect(fill).toEqual({
      Janvier: '#457b9d', 'Fév': '#457b9d', 'Déc': '#457b9d',
      Juin: '#e63946', Juillet: '#e63946', 'Août': '#e63946',
      Mars: '#666666', Avril: '#666666', Mai: '#666666',
      Sept: '#666666', Oct: '#666666', Nov: '#666666'
    });
  });

  it('IN-153 only the last dataset is drawn (pinned)', () => {
    const data = { datasets: [{ data: [day('20200101', 1)] }, { data: [day('20210101', 1)] }] };
    const { container } = render(Radar, { data });
    expect([...container.querySelectorAll('text.small')].map(text)).toEqual(['2021']);
  });

  // BUG: each dataset overwrites renderData (Radar.svelte:95-97), so all
  // datasets but the last are dropped.
  it.fails('IN-153 BUG: every dataset contributes to the radar', () => {
    const data = { datasets: [{ data: [day('20200101', 1)] }, { data: [day('20210101', 1)] }] };
    const { container } = render(Radar, { data });
    expect([...container.querySelectorAll('text.small')].map(text)).toEqual(['2020', '2021']);
  });

  // BUG: maxVal accumulates across data updates and is never reset, so a
  // smaller new dataset is drawn shrunk against the previous maximum.
  it.fails('IN-153 BUG: the radar scale is recomputed when the data changes', async () => {
    const { container, rerender } = render(Radar, { data: { datasets: [{ data: [day('20200101', 100)] }] } });
    const first = container.querySelector('path').getAttribute('d');
    await rerender({ data: { datasets: [{ data: [day('20200101', 1)] }] } });
    expect(container.querySelector('path').getAttribute('d')).toBe(first);
  });
});
