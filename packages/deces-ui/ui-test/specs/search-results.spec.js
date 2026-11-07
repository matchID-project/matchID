// @ts-check
const { test, expect } = require('@playwright/test');
const { stubThirdParties, recordApiRequests, referenceSearch, referenceCard } = require('../helpers/search-stubs');

// page.route() does not see requests handled by the service worker: block it
// so that the third-party stubs always apply.
test.use({ serviceWorkers: 'block' });

// `jean` (simple search) returns several pages of deaths of January 2020.
const manyResults = '/search?q=jean';
const summary = (page) => page.locator('td.rf-td--vcenter span').filter({ hasText: /^\s*Résultats/ }).first();

test.describe('search results (SR)', () => {
  test.beforeEach(async ({ page }) => {
    await stubThirdParties(page);
  });

  test('SR-006 SR-056 SR-071 the results area shows the summary and one card per result', async ({ page }) => {
    await page.goto(referenceSearch);
    await expect(summary(page)).toHaveText(/Résultats\s+1\s+à\s+\d+\s+parmi\s+\d+\s+pour:\s+DUPONT Jean/);
    await expect(page.getByText(referenceCard).first()).toBeVisible();
    await expect(page.locator('.rf-card__body > a[href="#1"]')).toHaveCount(1);
  });

  test('SR-052 a search without match shows "Oups... pas de résultats pour votre recherche"', async ({ page }) => {
    await page.goto('/search?advanced=true&fuzzy=false&ln=zzqxwvkj&dd=2020');
    await expect(page.getByText('Oups... pas de résultats pour votre recherche')).toBeVisible();
    await expect(page.getByText('Décès manquant').first()).toBeVisible();
  });

  test.describe('pagination', () => {
    test('SR-176 SR-178 SR-186 next, page number and previous fetch the pages and update current=', async ({ page }) => {
      await page.goto(manyResults);
      await expect(summary(page)).toHaveText(/Résultats\s+1\s+à\s+20\s+parmi/);
      const searches = recordApiRequests(page);
      const bottom = page.locator('.rf-margin-bottom-2N nav[aria-label="pagination"]');
      await bottom.locator('.rf-pagination__item--next').click();
      await expect(page).toHaveURL(/[?&]current=n_2_n/);
      await expect(summary(page)).toHaveText(/Résultats\s+21\s+à\s+40\s+parmi/);
      await expect.poll(() => searches.some(body => body.page === 2 && body.scrollId)).toBe(true);
      await bottom.locator('li[title="page 3"].rf-pagination__item--from-md').click();
      await expect(page).toHaveURL(/[?&]current=n_3_n/);
      await expect(summary(page)).toHaveText(/Résultats\s+41\s+à\s+60\s+parmi/);
      await expect(bottom.locator('.rf-pagination__item--active')).toHaveText('3');
      await bottom.locator('.rf-pagination__item--prev').click();
      await expect(page).toHaveURL(/[?&]current=n_2_n/);
      await expect(summary(page)).toHaveText(/Résultats\s+21\s+à\s+40\s+parmi/);
    });

    test('SR-048 SR-075 the "par page" select re-runs the search with the new size', async ({ page }) => {
      await page.goto(manyResults);
      await expect(summary(page)).toHaveText(/Résultats\s+1\s+à\s+20\s+parmi/);
      const searches = recordApiRequests(page);
      await page.locator('#per-page').selectOption('40');
      await expect(summary(page)).toHaveText(/Résultats\s+1\s+à\s+40\s+parmi/);
      await expect(page).toHaveURL(/[?&]size=n_40_n/);
      await expect.poll(() => searches.some(body => body.size === 40)).toBe(true);
    });

    test('SR-074 the top pagination is shown on xl screens', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(manyResults);
      await expect(page.locator('td.rf-display--xl nav[aria-label="pagination"]')).toBeVisible();
    });
  });

  test.describe('table mode', () => {
    test('SR-057 SR-059 sorting a column from its header re-runs the search', async ({ page }) => {
      await page.goto('/search?advanced=true&ln=dupont&dd=2020&view=table');
      await expect(page.locator('th[scope="colgroup"]', { hasText: 'naissance' })).toBeVisible();
      const searches = recordApiRequests(page);
      const header = page.locator('th.rf-table-th--sortable', { hasText: /^\s*prénom\(s\)\s*$/ });
      await header.click();
      await expect(header.locator('.rf-fi-arrow-down-s-line')).toBeVisible();
      await expect.poll(() => searches.some(body => JSON.stringify(body.sort) === JSON.stringify([{ firstName: 'desc' }, { score: 'desc' }]))).toBe(true);
      await header.click();
      await expect(header.locator('.rf-fi-arrow-up-s-line')).toBeVisible();
    });

    test('SR-171 a truncated cell expands on hover', async ({ page }) => {
      await page.goto('/search?advanced=true&ln=dupont&dd=2020&view=table');
      const cell = page.locator('table.rf-table tr .expand-on-hover').first();
      await expect(cell).toBeVisible();
      await expect(cell).toHaveCSS('z-index', 'auto');
      await cell.hover();
      await expect(cell).toHaveCSS('z-index', '1');
    });
  });

  test.describe('display modes', () => {
    test('SR-080 SR-082 switching the display mode updates view= and the results', async ({ page }) => {
      await page.goto(referenceSearch);
      await expect(page.getByText(referenceCard).first()).toBeVisible();
      await page.getByLabel("mode d'affichage tableur").click();
      await expect(page).toHaveURL(/[?&]view=table(&|$)/);
      await expect(page.locator('th[scope="colgroup"]', { hasText: 'état civil' })).toBeVisible();
      await page.getByLabel("mode d'affichage fiche complète").click();
      await expect(page).toHaveURL(/[?&]view=card-expand(&|$)/);
      await expect(page.getByText('Permalien').first()).toBeVisible();
      await page.getByLabel("mode d'affichage fiche compacte").click();
      await expect(page).not.toHaveURL(/view=/);
    });
  });

  test('SR-191 dragging a sort key into the active keys re-runs the search with that sort', async ({ page }) => {
    await page.goto('/search?advanced=true&ln=dupont&dd=2020');
    await page.getByTitle('cliquez pour paramétrer le tri').click();
    await expect(page.getByText('clés de tri')).toBeVisible();
    const searches = recordApiRequests(page);
    const visibleKey = (label) => page.locator('[draggable="true"]:not(.rf-hide)', { has: page.locator('.no-pointer-events', { hasText: new RegExp(`^\\s*${label}\\s*$`) }) });
    await visibleKey('nom').dragTo(visibleKey('score'));
    await expect.poll(() => searches.some(body => JSON.stringify(body.sort) === JSON.stringify([{ lastName: 'asc' }, { score: 'desc' }]))).toBe(true);
  });

  test.describe('mobile', () => {
    test.use({ viewport: { width: 375, height: 800 } });

    test('SR-013 SR-063 SR-086 SR-106 SR-184 mobile layout: paddings, scrollable table, hidden tools, cities and page numbers', async ({ page }) => {
      await page.goto(manyResults);
      const box = page.locator('div.rf-padding-left-1N--mobile', { has: page.locator('form') });
      await expect(box).toHaveCSS('padding-left', '8px');
      await expect(box).toHaveCSS('padding-right', '8px');
      await expect(summary(page)).toBeVisible();
      await expect(page.locator('#per-page')).toBeHidden();
      await expect(page.getByTitle('cliquez pour paramétrer le tri')).toBeHidden();
      await expect(page.getByTitle("téléchargez l'ensemble des résultats en tableur CSV")).toBeHidden();
      const bottom = page.locator('.rf-margin-bottom-2N nav[aria-label="pagination"]');
      await expect(bottom.locator('.rf-pagination__item--next')).toBeVisible();
      await expect(bottom.locator('li.rf-pagination__item--from-md').first()).toBeHidden();
      await expect(page.locator('.rf-card__desc .rf-hide--mobile').first()).toBeHidden();
      await page.goto(`${manyResults}&view=table`);
      const wrapper = page.locator('div[style*="overflow-x"]', { has: page.locator('table.rf-table') });
      await expect(wrapper).toBeVisible();
      expect(await wrapper.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    });
  });
});
