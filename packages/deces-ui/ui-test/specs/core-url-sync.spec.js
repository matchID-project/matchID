// @ts-check
const { test, expect } = require('@playwright/test');
const { nextSearchBody, referencePerson } = require('../helpers/core-search');

const currentView = (label) => `[title="Mode d'affichage actuel: ${label}"]`;

test.describe('core: URL <-> search state', () => {
  test('CO-016 view= restores the display mode', async ({ page }) => {
    await page.goto('/search?q=dupont+jean&view=table');
    await expect(page.locator(currentView('tableur'))).toBeVisible();
    await expect(page.locator('table.rf-table td', { hasText: 'Eysines' }).first()).toBeVisible();
    await page.goto('/search?q=dupont+jean&view=card-expand');
    await expect(page.locator(currentView('fiche complète'))).toBeVisible();
    await page.goto('/search?q=dupont+jean');
    await expect(page.locator(currentView('fiche compacte'))).toBeVisible();
  });

  test('CO-017 fuzzy=false disables fuzzy search on reload', async ({ page }) => {
    const body = nextSearchBody(page);
    await page.goto('/search?q=dupont+jean&fuzzy=false');
    expect((await body).fuzzy).toBe('false');
    // the fuzzy switch is only displayed by the advanced form
    const advancedBody = nextSearchBody(page);
    await page.goto('/search?advanced=true&fuzzy=false&ln=dupont&fn=jean');
    expect((await advancedBody).fuzzy).toBe('false');
    await expect(page.locator('strike', { hasText: 'Recherche floue' })).toBeVisible();
  });

  test('CO-018 advanced=true opens the advanced form', async ({ page }) => {
    await page.goto('/search?advanced=true');
    await expect(page.locator('#ln')).toBeVisible();
    await expect(page.locator('#q')).toHaveCount(0);
    await expect(page.locator('[title="Recherche simplifiée"]')).toBeVisible();
  });

  test('CO-019 a ?q= deep link restores the full-text search', async ({ page }) => {
    const body = nextSearchBody(page);
    await page.goto('/search?q=dupont+jean');
    expect(await body).toMatchObject({ q: 'dupont jean', page: 1 });
    await expect(page.locator('#q')).toHaveValue('dupont jean');
    await expect(page.getByText(referencePerson).first()).toBeVisible();
  });

  test('CO-019 an advanced deep link restores birth and death fields', async ({ page }) => {
    const body = nextSearchBody(page);
    await page.goto('/search?advanced=true&ln=dupont&fn=jean&bd=1932&bc=Eysines&dd=2020&ddep=33');
    expect(await body).toMatchObject({
      lastName: 'dupont', firstName: 'jean', birthDate: '1932', birthCity: 'Eysines', deathDate: '2020', deathDepartment: '33'
    });
    await expect(page.locator('#ln')).toHaveValue('dupont');
    await expect(page.locator('#fn')).toHaveValue('jean');
    await expect(page.locator('#bd')).toHaveValue('1932');
    await expect(page.locator('#bc')).toHaveValue('Eysines');
    await expect(page.locator('#dd')).toHaveValue('2020');
    await expect(page.locator('#ddep')).toHaveValue('33');
    await expect(page.getByText(referencePerson).first()).toBeVisible();
  });

  test('CO-020 size=n_<N>_n restores the page size', async ({ page }) => {
    const body = nextSearchBody(page);
    await page.goto('/search?q=jean&size=n_40_n');
    expect((await body).size).toBe(40);
  });

  test('CO-042 toggling simple <-> advanced moves the names between fields and the URL', async ({ page }) => {
    await page.goto('/search?q=dupont+jean');
    await expect(page.locator('#q')).toHaveValue('dupont jean');
    await page.locator('[title="Recherche avancée"]').click();
    await expect(page.locator('#ln')).toHaveValue('dupont');
    await expect(page.locator('#fn')).toHaveValue('jean');
    await expect(page).toHaveURL(/\/search\?advanced=true&ln=dupont&fn=jean$/);
    await page.locator('[title="Recherche simplifiée"]').click();
    await expect(page.locator('#q')).toHaveValue('dupont jean');
    await expect(page).toHaveURL(/\/search\?q=dupont\+jean$/);
  });

  test('CO-043 toggling fuzzy search resubmits and updates the URL', async ({ page }) => {
    await page.goto('/search?advanced=true&ln=dupont&fn=jean');
    await expect(page.getByText(referencePerson).first()).toBeVisible();
    const exact = nextSearchBody(page, b => b.fuzzy === 'false');
    await page.getByText('Recherche floue').click();
    expect(await exact).toMatchObject({ lastName: 'dupont', firstName: 'jean' });
    await expect(page).toHaveURL(/\/search\?advanced=true&fuzzy=false&ln=dupont&fn=jean$/);
    await page.getByText('Recherche floue').click();
    await expect(page).toHaveURL(/\/search\?advanced=true&ln=dupont&fn=jean$/);
    await expect(page.locator('strike', { hasText: 'Recherche floue' })).toHaveCount(0);
  });
});
