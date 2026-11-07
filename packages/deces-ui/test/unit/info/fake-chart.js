// Stand-in for `chart.js/auto` (jsdom has no 2D canvas context). Use with
//   vi.mock('chart.js/auto', () => import('./fake-chart.js'));
// and inspect `charts` to see what Chart.svelte asked chart.js to draw.
export const charts = [];
export const registered = [];

export default class FakeChart {
  static defaults = { font: {} };

  static register(...items) {
    registered.push(...items);
  }

  constructor(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.data = config.data;
    this.updates = 0;
    this.destroyed = false;
    charts.push(this);
  }

  update() {
    this.updates += 1;
  }

  destroy() {
    this.destroyed = true;
  }
}

export const resetCharts = () => {
  charts.length = 0;
  registered.length = 0;
  FakeChart.defaults = { font: {} };
};
