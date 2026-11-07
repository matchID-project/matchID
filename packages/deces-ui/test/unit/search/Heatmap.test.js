import { beforeEach, describe, expect, it } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { setThemeColors } from './helpers.js';

// Heatmap.svelte is used by the /stats page (hour of day x day of week).
setThemeColors();
const { default: Heatmap } = await import('../../../src/components/views/Heatmap.svelte');

const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const hours = [...Array(24).keys()].map(h => `${h}`.padStart(2, '0'));

// datasets as built by Stats.svelte: x = "<day>-<HH>h", y = value
const dataset = (id, label, value) => ({
  yAxisID: id,
  label,
  data: days.flatMap((day, i) => hours.map((hour, j) => ({ x: `${day}-${hour}h`, y: value(i, j) })))
});
const heatmapData = () => ({
  datasets: [
    // visitors: max 1000 on Sunday 23h, exactly 0.7 * max on Wednesday 22h
    dataset('visitors', 'visiteurs', (i, j) => {
      if (i === 6 && j === 23) return 1000;
      if (i === 2 && j === 22) return 700;
      return i * 24 + j;
    }),
    dataset('hits', 'requêtes', (i, j) => 10 * (i + j)),
    dataset('bytes', 'octets', (i, j) => i + j + 1)
  ]
});
const rect = (container, day, hour) => container.querySelector(`rect[id="${day}${hour}"]`);
const tooltipOf = (container, day, hour) => {
  const index = days.indexOf(day) * 24 + hours.indexOf(hour);
  return container.querySelectorAll('g.tooltip')[index];
};

describe('Heatmap', () => {
  beforeEach(() => {
    setThemeColors();
  });

  it('SR-251 renders an empty chart without data', () => {
    const { container } = render(Heatmap);
    expect(container.querySelector('svg').getAttribute('viewBox')).toBe('0 0 260 130');
    expect(container.querySelector('svg').children).toHaveLength(0);
  });

  it('SR-252 colours the day x hour grid from white to blue to red by normalised value', () => {
    const { container } = render(Heatmap, { data: heatmapData() });
    expect(container.querySelectorAll('rect.hoverable')).toHaveLength(7 * 24);
    expect(rect(container, 'Lun', '00').getAttribute('fill')).toBe('#ffffff');
    expect(rect(container, 'Dim', '23').getAttribute('fill')).toBe('#e1000f');
    // 700 / 1000 = the 0.7 threshold: pure --bf500
    expect(rect(container, 'Mer', '22').getAttribute('fill')).toBe('#000091');
    expect(rect(container, 'Lun', '10').getAttribute('fill')).not.toBe('#ffffff');
  });

  it('SR-253 labels the days and the hours (2h ... 22h)', () => {
    const { container } = render(Heatmap, { data: heatmapData() });
    const labels = [...container.querySelectorAll('svg > g > text')].map(t => t.textContent.trim());
    expect(labels).toEqual([...days, '2h', '6h', '10h', '14h', '18h', '22h']);
  });

  it('SR-254 hovering a cell shows the visitors/hits/bytes tooltip', async () => {
    const { container } = render(Heatmap, { data: heatmapData() });
    const tooltip = tooltipOf(container, 'Mar', '03');
    expect(tooltip.getAttribute('opacity')).toBe('0');
    await fireEvent.mouseEnter(rect(container, 'Mar', '03'));
    expect(tooltip.getAttribute('opacity')).toBe('0.95');
    expect([...tooltip.querySelectorAll('tspan')].map(t => t.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      'Mar 03h', 'visiteurs:27', 'requêtes:40', 'octets:5'
    ]);
    await fireEvent.mouseLeave(rect(container, 'Mar', '03'));
    expect(tooltip.getAttribute('opacity')).toBe('0');
  });

  it('SR-255 the tooltip flips to the left near the right edge and upwards near the bottom', () => {
    const { container } = render(Heatmap, { data: heatmapData() });
    const box = (day, hour) => tooltipOf(container, day, hour).querySelector('rect');
    const anchor = (day, hour) => tooltipOf(container, day, hour).querySelector('text').getAttribute('text-anchor');
    // left/top part: to the right of and below the cell
    expect(box('Lun', '00').getAttribute('x')).toBe(`${2 * 30}`);
    expect(box('Lun', '00').getAttribute('y')).toBe(`${10 + 2 * 4 + 2}`);
    expect(anchor('Lun', '00')).toBe('start');
    // right/bottom part: to the left of and above the cell
    expect(box('Sam', '20').getAttribute('x')).toBe(`${6 * 30 - 105}`);
    expect(box('Sam', '20').getAttribute('y')).toBe(`${10 + 19 * 4 + 2 - 50}`);
    expect(anchor('Sam', '20')).toBe('end');
  });
});
