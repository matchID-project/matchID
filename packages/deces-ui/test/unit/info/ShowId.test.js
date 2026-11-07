// Inventory zone IN, row IN-068: the filtered FAQ shown by ShowId.svelte for
// an identifier without result.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';

// Record the rejections of async onMount callbacks (see choropleths.test.js).
const mountErrors = vi.hoisted(() => []);
vi.mock('svelte', async (importOriginal) => {
  const svelte = await importOriginal();
  return {
    ...svelte,
    onMount: (fn) => svelte.onMount(() => {
      const result = fn();
      if (result && typeof result.then === 'function') {
        result.catch(error => { mountErrors.push(error); });
        return undefined;
      }
      return result;
    })
  };
});
vi.mock('../../../src/components/tools/search.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getById: vi.fn()
}));
vi.mock('../../../src/components/tools/routes.js', () => ({ goTo: vi.fn() }));
// ResultCard is out of this zone; a plain component stands in for it.
vi.mock('../../../src/components/views/ResultCard.svelte', () => import('../../../src/components/views/StatsTile.svelte'));

const { default: ShowId } = await import('../../../src/components/views/ShowId.svelte');
const { getById } = await import('../../../src/components/tools/search.js');
const { resetStores } = await import('./helpers.js');

const oups = 'Oups... pas de résultats pour cet identifiant';
const cardTitles = (container) => [...container.querySelectorAll('.rf-card .rf-text--lg')].map(e => e.textContent.trim());

describe('ShowId without result', () => {
  beforeEach(() => {
    resetStores();
    mountErrors.length = 0;
    window.history.replaceState({}, '', '/id/unknown-id');
  });

  it('IN-068 an id without result shows "Oups" and the filtered FAQ (3 sections)', async () => {
    getById.mockResolvedValue(undefined);
    const { container } = render(ShowId);
    expect(await screen.findByText(oups)).toBeTruthy();
    expect(getById).toHaveBeenCalledWith({ id: 'unknown-id' });
    expect(cardTitles(container)).toEqual(['Merci pour votre soutien !', 'Décès manquant', 'Signaler un bug']);
    // the spinner leaves with a fade outro
    await waitFor(() => expect(screen.queryByText('Recherche en cours')).toBeNull(), { timeout: 3000 });
    expect(mountErrors).toEqual([]);
  });

  it('IN-068 the API error person (HTTP >= 400 turned into {error: true} by runRequest) makes onMount throw (pinned)', async () => {
    getById.mockResolvedValue({ error: true, status: 400, statusText: 'Bad Request' });
    render(ShowId);
    await waitFor(() => expect(mountErrors).toHaveLength(1));
    expect(mountErrors[0]).toBeInstanceOf(TypeError);
    expect(screen.queryByText(oups)).toBeNull();
    expect(screen.getByText('Recherche en cours')).toBeTruthy();
  });

  // BUG: on the CI stack an unknown id gets a 400 from the API; ShowId takes
  // the error person as a result and toString() throws on its missing name,
  // so the page stays on "Recherche en cours" (ShowId.svelte:41-52).
  it.fails('IN-068 BUG: an API error for the id shows "Oups" and the filtered FAQ', async () => {
    getById.mockResolvedValue({ error: true, status: 400, statusText: 'Bad Request' });
    render(ShowId);
    await waitFor(() => expect(screen.getByText(oups)).toBeTruthy(), { timeout: 500 });
  });
});
