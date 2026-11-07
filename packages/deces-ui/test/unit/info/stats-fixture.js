// Minimal goaccess-like payloads for Stats.svelte (shape read from
// Stats.svelte and stats/src/parseLogs.pl). Every call returns fresh
// objects because Stats.svelte mutates the fetched data in place.
export const row = (data, visitors, extra = {}) => ({
  data,
  visitors: { count: visitors },
  hits: { count: visitors * 10 },
  bytes: { count: visitors * 100 },
  ...extra
});

export const catalog = () => [
  'full', 'day', 'day-detailed',
  '20230101', '20230102', '20230101-detailed',
  '202301', '202302', '202301-detailed',
  '2023S01', '2023S02', '2023S01-detailed'
];

const requests = () => ({
  data: [
    row('api: search POST', 10, { hits: { count: 1000 } }),
    row('api: search GET', 5, { hits: { count: 500 } }),
    row('api: search/csv GET', 2, { hits: { count: 4 }, bytes: { count: 400000 } }),
    row('api: id/abc POST', 1, { hits: { count: 7 } }),
    row('api: search OPTIONS', 50),
    row('page: /search (GET)', 40),
    row('page: /favicon (GET)', 3),
    row('page: /wp-admin (GET)', 30)
  ]
});

export const dataset = ({ withHeatmap = true, withCountry = true, withUrls = true } = {}) => {
  const d = {
    general: { unique_visitors: 12345, total_requests: 99999 },
    requests: requests(),
    visitors: {
      data: [
        row('20230101', 10, { duration: { mean: 0.2 } }),
        row('20230101-1300', 11),
        row('2023S01-0102', 12),
        row('2023S01-0102-1300', 13)
      ]
    },
    referring_sites: {
      data: [
        row('www.google.fr', 8),
        row('google.com/search', 4),
        row('m.facebook.com/page', 6),
        row('deces.matchid.io/search', 100),
        row('lonely.org', 1),
        row('x', 50),
        ...Array.from({ length: 20 }, (_, i) => row(`site${i}.org`, i + 2))
      ]
    },
    depcode: {
      data: [
        row('33 Gironde', 30),
        row('FR-IDF Paris', 20),
        row('2A Corse-du-Sud', 3)
      ]
    },
    browsers: {
      data: [row('Chrome', 50), row('Firefox', 20), row('Opera', 5), row('Crawlers', 2)]
    }
  };
  if (withHeatmap) {
    d.hour_of_day_of_week = { data: [row('lun-1300', 9), row('dim-0900', 4)] };
  }
  if (withCountry) {
    d.country = {
      data: [
        row('FR France', 40),
        { data: 'Europe', items: [row('DE Germany', 7)] }
      ]
    };
  }
  if (withUrls) {
    d['api: search POST'] = {
      general: { unique_visitors: 42 },
      requests: requests(),
      visitors: { data: [row('20230101', 3)] },
      referring_sites: { data: [row('www.google.fr', 8), row('qwant.com', 3)] }
    };
    d['api: id GET'] = {};
  }
  return d;
};

// Tiny geojson with one square per zone, enough for geojson2svg.
const square = (x, y) => ({
  type: 'Polygon',
  coordinates: [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]]
});

export const franceGeojson = () => ({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { code: '33', nom: 'Gironde' }, geometry: square(-50000, 6400000) },
    { type: 'Feature', properties: { code: '2A', nom: 'Corse-du-Sud' }, geometry: square(1100000, 6100000) },
    { type: 'Feature', properties: { code: '75', nom: 'Paris' }, geometry: square(650000, 6860000) },
    { type: 'Feature', properties: { code: 'XX', nom: 'Sans géométrie' }, geometry: null }
  ]
});

export const worldGeojson = () => ({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', id: 'FRA', properties: {}, geometry: square(2, 46) },
    { type: 'Feature', id: 'DEU', properties: {}, geometry: square(10, 51) },
    { type: 'Feature', id: 'BRA', properties: {}, geometry: square(-50, -10) }
  ]
});
