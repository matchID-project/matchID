import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';

// Record the charts that Chart.svelte creates instead of drawing on a canvas
// (jsdom has no 2D context).
const charts = vi.hoisted(() => []);
vi.mock('chart.js/auto', () => {
  class FakeChart {
    static defaults = { font: {} };
    static register() {}
    constructor(ctx, config) {
      this.config = config;
      charts.push(this);
    }
    update() {}
  }
  return { default: FakeChart };
});

const { default: LinkCheckStats } = await import('../../src/components/views/LinkCheckStats.svelte');
const { linkResults, linkCompleteResults, linkValidations } = await import('../../src/components/tools/stores.js');

const header = ['name', 'score'];
const candidate = (score) => [['DUPONT', score]];

describe('LinkCheckStats', () => {
  beforeEach(() => {
    charts.length = 0;
    HTMLCanvasElement.prototype.getContext = () => ({});
    for (const [name, color] of [['--bf500', '#000091'], ['--success', '#008941'], ['--warning', '#b34000']]) {
      document.body.style.setProperty(name, color);
    }
    linkResults.set({ header, rows: [candidate(0.95), candidate(0.91), candidate(0.42)] });
    linkCompleteResults.set({ header, rows: new Array(4).fill(['x']) });
    linkValidations.set([
      [{ checked: ['manual'], valid: true }],
      [{ checked: ['manual'], valid: false }],
      [{}]
    ]);
  });

  it('computes the matching, manual check and multi-match rates', () => {
    render(LinkCheckStats);
    const text = document.body.textContent;
    expect(screen.getByText('Taux d\'appariement brut')).toBeTruthy();
    expect(text).toContain('75 %'); // 3 matched rows out of 4
    expect(text).toContain('66.7 %'); // 2 of 3 rows checked manually
  });

  // Regression: the score distribution chart was imported from
  // `svelte-chartjs`, which is not a dependency: the import could not be
  // resolved (rollup kept it as an external bare specifier) and the chart
  // never rendered. It now uses the app's own chart.js wrapper. The
  // distribution also dropped the first score (reduce without initial value).
  it('draws the score distribution as a bar chart', async () => {
    const { container } = render(LinkCheckStats);
    await waitFor(() => expect(charts).toHaveLength(1));
    expect(container.querySelector('canvas')).not.toBeNull();
    const { type, data } = charts[0].config;
    expect(type).toBe('bar');
    expect(data.labels).toEqual([0.4, 0.9]);
    expect(data.datasets.map(d => d.label)).toEqual(['Total', 'Validé', 'Invalidé']);
    expect(data.datasets[0].data).toEqual([1, 2]);
  });
});
