// @ts-check
// Shared helpers for the search-*.spec.js suites (zone SR of the Svelte 5
// migration inventory): stubs for third parties and backend request spies.

// 1x1 transparent PNG, served instead of map tiles and Wikimedia thumbnails.
const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

/**
 * Stub the third parties used by the search pages so that the specs do not
 * depend on external services: map tiles (IGN Géoplateforme, osm), Wikimedia images
 * and the data.gouv.fr catalog of INSEE source files.
 * @param {import('@playwright/test').Page} page
 */
async function stubThirdParties(page) {
  await page.route(/data\.geopf\.fr\/wmts|tile\.osm\.org|tile\.openstreetmap\.org/, route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng }));
  await page.route(/upload\.wikimedia\.org/, route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng }));
  await page.route(/www\.data\.gouv\.fr\/api\/1\/datasets\//, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        resources: [
          { title: 'deces-2020-m01.txt', url: 'https://static.data.gouv.fr/resources/fichier-des-personnes-decedees/deces-2020-m01.txt' }
        ]
      })
    }));
}

/**
 * Record the JSON bodies of the search requests sent to the backend.
 * @param {import('@playwright/test').Page} page
 * @param {string} api backend endpoint suffix, e.g. 'search' or 'agg'
 */
function recordApiRequests(page, api = 'search') {
  /** @type {any[]} */
  const bodies = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith(`/api/v1/${api}`)) {
      try {
        bodies.push(request.postDataJSON());
      } catch (e) {
        bodies.push(request.postData());
      }
    }
  });
  return bodies;
}

/**
 * Add Wikidata links to the first person of the next search responses.
 * @param {import('@playwright/test').Page} page
 * @param {object} links
 */
async function injectWikidataLinks(page, links) {
  await page.route(/\/api\/v1\/search$/, async route => {
    const response = await route.fetch();
    const json = await response.json();
    if (json && json.response && json.response.persons && json.response.persons.length) {
      json.response.persons[0].links = links;
    }
    await route.fulfill({ response, json });
  });
}

const referenceSearch = '/search?advanced=true&fuzzy=false&ln=dupont&fn=jean&dd=2020&ddep=33';
const referenceCard = 'DUPONT Jean Pierre Eysines 1932 - Pessac 2020';

module.exports = { stubThirdParties, recordApiRequests, injectWikidataLinks, referenceSearch, referenceCard };
