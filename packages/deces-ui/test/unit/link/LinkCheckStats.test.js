import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';

// jsdom has no canvas: record the charts instead of drawing them.
const charts = vi.hoisted(() => []);
vi.mock('chart.js/auto', () => {
  class FakeChart {
    static defaults = { font: {} };
    static register() {}
    constructor(ctx, config) { this.config = config; charts.push(this); }
    update() {}
    destroy() {}
  }
  return { default: FakeChart };
});

const { default: LinkCheckStats } = await import('../../../src/components/views/LinkCheckStats.svelte');
const { linkResults, linkCompleteResults, linkValidations, linkOptions } = await import('../../../src/components/tools/stores.js');
const { resetLinkStores, flush } = await import('./helpers.js');

const header = ['name', 'score'];
const group = (...scores) => scores.map(s => ['DUPONT', s]);

const tile = (label) => {
  const desc = [...document.querySelectorAll('.rf-tile__desc')].find(p => p.textContent.trim() === label);
  return desc.closest('.rf-tile').querySelector('.rf-tile__title').textContent.trim();
};

describe('LinkCheckStats', () => {
  beforeEach(() => {
    resetLinkStores();
    charts.length = 0;
    HTMLCanvasElement.prototype.getContext = () => ({});
    for (const [name, color] of [['--bf500', '#000091'], ['--success', '#008941'], ['--warning', '#b34000']]) {
      document.body.style.setProperty(name, color);
    }
    // 4 source lines, 3 matched (one with 2 candidates)
    linkCompleteResults.set({ header, rows: new Array(4).fill([['x']]) });
    linkResults.set({ header, rows: [group(0.95, 0.5), group(0.91), group(0.42)] });
    linkValidations.set([
      [{ checked: '1 - manual', valid: true }, { checked: '1 - manual', valid: true }],
      [{ checked: '2 - manual', valid: false }],
      [{ checked: 'auto', valid: true }]
    ]);
  });

  it('LK-145 shows the raw matching rate, the manual validation rate and the multiple matching rate', () => {
    render(LinkCheckStats);
    expect(document.body.textContent).toContain('Statistiques d\'appariement');
    expect(tile('Taux d\'appariement brut')).toBe('75 %');
    expect(tile('Validation manuelle')).toBe('66.7 %');
    expect(tile('Appariements multiples')).toBe('33.3 %');
  });

  it('LK-146 draws the score distribution (Total / Validé / Invalidé) as a bar chart', async () => {
    render(LinkCheckStats);
    await waitFor(() => expect(charts).toHaveLength(1));
    const { type, data } = charts[0].config;
    expect(type).toBe('bar');
    expect(data.labels).toEqual([0.4, 0.9]);
    expect(data.datasets.map(d => [d.label, d.data])).toEqual([
      ['Total', [1, 2]], ['Validé', [1]], ['Invalidé', [1]]
    ]);
  });

  it('LK-147 the threshold slider defaults to autoCheckThreshold and shows its value in %', async () => {
    linkOptions.update(o => ({ ...o, check: { ...o.check, autoCheckThreshold: 0.9 } }));
    render(LinkCheckStats);
    const slider = document.getElementById('threshold');
    expect([slider.type, slider.min, slider.max, slider.step]).toEqual(['range', '0', '1', '0.01']);
    expect(Number(slider.value)).toBe(0.9);
    const label = () => document.querySelector('label[for="threshold"]').textContent.replace(/\s+/g, ' ').trim();
    expect(label()).toBe('Seuil (pour F1-score, rappel, précision): 90%');
    await fireEvent.input(slider, { target: { value: '0.4' } });
    expect(label()).toBe('Seuil (pour F1-score, rappel, précision): 40%');
  });

  it('LK-148 recomputes Rappel / Précision / F1-score from the threshold', async () => {
    render(LinkCheckStats);
    // threshold 0.85: 2 of 3 rows above, 1 of them valid
    expect(tile('Rappel')).toBe('66.7 %');
    expect(tile('Précision')).toBe('50 %');
    expect(tile('F1-score')).toBe('57.2 %');
    await fireEvent.input(document.getElementById('threshold'), { target: { value: '0.4' } });
    await flush();
    expect(tile('Rappel')).toBe('100 %');
    expect(tile('Précision')).toBe('66.7 %');
    expect(tile('F1-score')).toBe('80 %');
  });

  it('LK-148 pins the precision / F1 display when no row reaches the threshold ("NaNG %")', async () => {
    render(LinkCheckStats);
    await fireEvent.input(document.getElementById('threshold'), { target: { value: '0.99' } });
    await flush();
    expect(tile('Rappel')).toBe('0 %');
    expect(tile('Précision')).toBe('NaNG %');
    expect(tile('F1-score')).toBe('NaNG %');
  });

  // BUG: precision is 0/0 = NaN when no row reaches the threshold, and
  // smartNumber(NaN) falls through to the "G" (billions) branch: the tiles
  // read "NaNG %".
  it.fails('LK-148 shows no NaN when no row reaches the threshold', async () => {
    render(LinkCheckStats);
    await fireEvent.input(document.getElementById('threshold'), { target: { value: '0.99' } });
    await flush();
    expect(tile('Précision')).not.toContain('NaN');
  });
});
