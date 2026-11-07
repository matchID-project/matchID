// @ts-check
// goaccess-like payloads for the /stats e2e specs. The local CI stack has no
// `${STATS}` volume (nginx would answer the SPA index.html), so the specs
// stub /stats/*.json with these fixtures. Same shape as the unit fixture
// test/unit/info/stats-fixture.js.

const row = (data, visitors, extra = {}) => ({
  data,
  visitors: { count: visitors },
  hits: { count: visitors * 10 },
  bytes: { count: visitors * 100 },
  ...extra
});

const catalog = [
  'full', 'day', 'day-detailed',
  '20230101', '20230102', '20230101-detailed',
  '202301', '202302', '202301-detailed',
  '2023S01', '2023S02', '2023S01-detailed'
];

const dataset = () => ({
  general: { unique_visitors: 12345, total_requests: 99999 },
  requests: {
    data: [
      row('api: search POST', 10, { hits: { count: 1000 } }),
      row('api: search GET', 5, { hits: { count: 500 } }),
      row('api: search/csv GET', 2, { hits: { count: 4 }, bytes: { count: 400000 } }),
      row('api: id/abc POST', 1, { hits: { count: 7 } }),
      row('page: /favicon (GET)', 3)
    ]
  },
  visitors: {
    data: Array.from({ length: 14 }, (_, i) => row(`202301${String(i + 1).padStart(2, '0')}`, 10 + (i * 7) % 13, { duration: { mean: 0.1 + i / 100 } }))
  },
  referring_sites: {
    data: [row('www.google.fr', 8), row('m.facebook.com/page', 6), row('qwant.com', 4)]
  },
  depcode: {
    data: [row('33 Gironde', 30), row('75 Paris', 50), row('2A Corse-du-Sud', 3)]
  },
  hour_of_day_of_week: {
    data: ['lun', 'mar', 'mer'].flatMap((d, i) => [row(`${d}-0900`, 4 + i), row(`${d}-1400`, 9 - i)])
  },
  browsers: {
    data: [row('Chrome', 50), row('Firefox', 20), row('Crawlers', 2)]
  },
  country: {
    data: [row('FR France', 40), { data: 'Europe', items: [row('DE Germany', 7)] }]
  },
  'api: search POST': {
    general: { unique_visitors: 42 },
    requests: { data: [row('api: search POST', 10)] },
    visitors: { data: [row('20230101', 3)] }
  }
});

/**
 * Stub /stats/catalog.json and /stats/<source>.json.
 * @param {import('@playwright/test').Page} page
 * @param {{ status?: number }} [options]
 */
async function stubStats(page, { status = 200 } = {}) {
  const requested = [];
  await page.route('**/stats/*.json', route => {
    const source = new URL(route.request().url()).pathname.replace(/^\/stats\/(.*)\.json$/, '$1');
    requested.push(source);
    if (status !== 200) {
      return route.fulfill({ status, contentType: 'text/html', body: '<html>Too Many Requests</html>' });
    }
    return route.fulfill({ json: source === 'catalog' ? catalog : dataset() });
  });
  return requested;
}

/**
 * Make /stats/*.json answer the SPA fallback (what nginx does without the
 * stats volume).
 * @param {import('@playwright/test').Page} page
 */
async function stubStatsMissing(page) {
  await page.route('**/stats/*.json', route => route.fulfill({ contentType: 'text/html', body: '<!DOCTYPE html><html></html>' }));
}

module.exports = { catalog, dataset, stubStats, stubStatsMissing };
