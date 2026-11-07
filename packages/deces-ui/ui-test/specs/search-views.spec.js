// @ts-check
const { test, expect } = require('@playwright/test');
const { stubThirdParties, recordApiRequests } = require('../helpers/search-stubs');

// page.route() does not see requests handled by the service worker: block it
// so that the third-party stubs always apply.
test.use({ serviceWorkers: 'block' });

// Deaths of DUPONT in January 2020: a handful of records with geo points.
const geoSearch = '/search?advanced=true&ln=dupont&dd=2020&view=geo';
const aggSearch = '/search?advanced=true&ln=dupont&dd=2020&view=agg';

test.describe('geo and statistics views (SR)', () => {
  test.beforeEach(async ({ page }) => {
    await stubThirdParties(page);
  });

  test.describe('geo view', () => {
    test('SR-064 SR-234 SR-235 SR-248 the map loads with its tile layer and requests up to the max page size', async ({ page }) => {
      const searches = recordApiRequests(page);
      const tile = page.waitForRequest(/basemaps\.cartocdn\.com\/light_all\//);
      await page.goto(geoSearch);
      await expect(page.locator('.map-container .leaflet-container')).toBeVisible();
      await tile;
      await expect(page.locator('.leaflet-top.leaflet-right .leaflet-control-zoom')).toBeVisible();
      await expect(page.locator('.leaflet-control-attribution')).toContainText('ESRI');
      await expect.poll(() => searches.some(body => body.size > 20)).toBe(true);
    });

    test('SR-236 SR-246 draws the birth and death markers of the results', async ({ page }) => {
      await page.goto(geoSearch);
      await expect(page.locator('.leaflet-birth-pane path.leaflet-interactive').first()).toBeAttached();
      await expect(page.locator('.leaflet-death-pane path.leaflet-interactive').first()).toBeAttached();
      const before = await page.locator('.leaflet-birth-pane path.leaflet-interactive').count();
      const searches = recordApiRequests(page);
      await page.getByPlaceholder('Georges', { exact: true }).fill('jean');
      await expect.poll(() => searches.some(body => body.firstName === 'jean')).toBe(true);
      await expect.poll(() => page.locator('.leaflet-birth-pane path.leaflet-interactive').count()).toBeLessThanOrEqual(before);
      await expect(page.locator('.leaflet-birth-pane path.leaflet-interactive').first()).toBeAttached();
    });

    test('SR-237 the marker size grows with the zoom', async ({ page }) => {
      await page.goto(geoSearch);
      const marker = page.locator('.leaflet-birth-pane path.leaflet-interactive').first();
      await expect(marker).toBeAttached();
      const before = Number(await marker.getAttribute('stroke-width'));
      await page.locator('.leaflet-control-zoom-in').click();
      await expect.poll(async () => Number(await page.locator('.leaflet-birth-pane path.leaflet-interactive').first().getAttribute('stroke-width'))).toBeGreaterThan(before);
    });

    test('SR-238 SR-239 SR-240 hovering a marker previews the card, a click expands it', async ({ page }) => {
      await page.goto(geoSearch);
      const marker = page.locator('.leaflet-death-pane path.leaflet-interactive').first();
      await expect(marker).toBeAttached();
      await marker.dispatchEvent('mouseover');
      const preview = page.locator('.map .result');
      await expect(preview.locator('.rf-card')).toBeVisible();
      await marker.dispatchEvent('click');
      await expect(preview).toHaveAttribute('style', /height: 600px/);
      await expect(preview.locator('.rf-card.rf-card--md')).toBeVisible();
    });

    test('SR-242 the layer toggles keep at least one layer visible', async ({ page }) => {
      await page.goto(geoSearch);
      // panes are empty-sized containers: check their display style
      const pane = (name) => page.locator(`.leaflet-${name}-pane`).first();
      await expect(pane('birth')).toHaveCSS('display', 'block');
      await page.locator('label[for="Naissance"]').click();
      await expect(page.locator('#Naissance')).not.toBeChecked();
      await expect(pane('birth')).toHaveCSS('display', 'none');
      await expect(pane('overlay')).toHaveCSS('display', 'none');
      await expect(pane('death')).toHaveCSS('display', 'block');
      await page.locator('label[for="Décès"]').click();
      await expect(page.locator('#Naissance')).toBeChecked();
      await expect(page.locator('#Décès')).not.toBeChecked();
      await expect(pane('death')).toHaveCSS('display', 'none');
      await expect(pane('birth')).toHaveCSS('display', 'block');
    });

    test('SR-243 SR-245 SR-250 the fullscreen toggle and resize keep the map usable', async ({ page }) => {
      await page.goto(geoSearch);
      const toggle = page.getByText('Cliquez ici pour le plein écran');
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(page.getByText('Cliquez ici pour sortir du plein écran')).toBeVisible();
      await page.getByText('Cliquez ici pour sortir du plein écran').click();
      await expect(page.getByText('Cliquez ici pour le plein écran')).toBeVisible();
      await page.setViewportSize({ width: 900, height: 700 });
      await expect(page.locator('.map-container')).toHaveCSS('display', 'flex');
      const box = await page.locator('.leaflet-container').boundingBox();
      expect(box && box.width).toBeLessThanOrEqual(900);
    });

    test('SR-247 the preview card is full width on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto(geoSearch);
      const marker = page.locator('.leaflet-death-pane path.leaflet-interactive').first();
      await expect(marker).toBeAttached();
      await marker.dispatchEvent('mouseover');
      const preview = page.locator('.map .result');
      await expect(preview).toBeVisible();
      const [previewBox, mapBox] = await Promise.all([preview.boundingBox(), page.locator('.map').boundingBox()]);
      expect(previewBox && mapBox && Math.round(previewBox.width)).toBe(mapBox && Math.round(mapBox.width));
    });
  });

  test.describe('statistics view', () => {
    test('SR-065 SR-194 SR-199..SR-204 sends the six aggregations and shows their tiles', async ({ page }) => {
      const aggs = recordApiRequests(page, 'agg');
      await page.goto(aggSearch);
      for (const title of ['Sexe', 'Département de naissance', 'Date de décès', 'Âge au décès', 'Prénom', 'Mois de décès']) {
        await expect(page.locator('h4.rf-tile__title', { hasText: new RegExp(`^\\s*${title}\\s*$`) })).toBeVisible();
      }
      // the last name is fixed by the criteria: no "Nom" aggregation
      await expect(page.locator('h4.rf-tile__title', { hasText: /^\s*Nom\s*$/ })).toHaveCount(0);
      // a refresh may be triggered more than once on load: compare the distinct, ordered aggregations
      await expect.poll(() => [...new Set(aggs.map(body => body.aggs[0]))]).toEqual(['sex', 'birthDepartment', 'deathDate', 'deathAge', 'firstName']);
      expect(aggs.every(body => body.lastName === 'dupont' && body.deathDate === '2020' && body.page === undefined)).toBe(true);
      await expect(page.locator('.rf-tile canvas').first()).toBeVisible();
      await expect(page.getByText("Résultats sur l'ensemble des données")).toHaveCount(0);
    });

    test('SR-206 a tile expands to the full width', async ({ page }) => {
      await page.goto(aggSearch);
      // On load the aggregations may be refreshed more than once (each refresh
      // empties then refills the tiles): wait for the last tile and the end of
      // the requests before measuring, and re-measure on re-render.
      await expect(page.locator('h4.rf-tile__title', { hasText: /^\s*Prénom\s*$/ })).toBeVisible();
      await page.waitForLoadState('networkidle');
      const tile = page.locator('.rf-tile', { has: page.locator('h4', { hasText: /^\s*Sexe\s*$/ }) });
      const width = async () => { const box = await tile.boundingBox(); return box ? box.width : 0; };
      await expect.poll(width).toBeGreaterThan(0);
      const before = await width();
      await tile.locator('.rf-tile__icon').click();
      await expect.poll(width).toBeGreaterThan(before * 1.5);
      await expect(tile.locator('canvas')).toHaveAttribute('style', /max-height: 500px/);
    });
  });
});
