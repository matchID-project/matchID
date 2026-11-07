// @ts-check
// Sort keys drag & drop (DraggableList via SortInput), zone LK.
const { test, expect } = require('@playwright/test');

const zone = (page, name) => page.locator('.rf-col-6.rf-padding-1N', { has: page.locator('strong', { hasText: new RegExp(`^${name}$`) }) });
const item = (scope, label) => scope.locator('div[draggable="true"]:not(.rf-hide)', { hasText: new RegExp(`^\\s*${label}\\s*$`) });

test.describe('sort keys (search results)', () => {
  test('LK-204 / LK-202 / LK-207 dragging an inactive sort key to the active zone activates it', async ({ page }) => {
    await page.goto('/search?q=dupont+jean');
    await expect(page.getByText('DUPONT Jean Pierre').first()).toBeVisible();
    await page.locator('[title="cliquez pour paramétrer le tri"]').click();
    await expect(page.getByText('clés de tri')).toBeVisible();
    const actives = zone(page, 'actives');
    const inactives = zone(page, 'inactives');
    await expect(item(actives, 'score')).toBeVisible();
    await expect(item(inactives, 'nom')).toBeVisible();
    await item(inactives, 'nom').dragTo(actives.locator('.rf-container-fuild'));
    await expect(item(actives, 'nom')).toBeVisible();
    await expect(item(inactives, 'nom')).toHaveCount(0);
    // LK-205: a click on an active key cycles its order
    const arrows = () => item(actives, 'nom').locator('.rf-fi-arrow-up-s-line, .rf-fi-arrow-down-s-line');
    await expect(arrows()).toHaveCount(1);
    const before = await arrows().getAttribute('class');
    await item(actives, 'nom').click();
    await expect.poll(() => arrows().getAttribute('class')).not.toBe(before);
  });
});
