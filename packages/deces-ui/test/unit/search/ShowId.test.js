import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { jsonResponse, mockFetch, person, resetSearchStores } from './helpers.js';

const { default: ShowId } = await import('../../../src/components/views/ShowId.svelte');
const { default: ProofViewer } = await import('../../../src/components/views/ProofViewer.svelte');
const stores = await import('../../../src/components/tools/stores.js');

let fetchMock;
let release;

describe('ShowId (/id/<id>)', () => {
  beforeEach(() => {
    resetSearchStores(stores);
    stores.route.set({ path: '/id' });
    window.history.replaceState({}, '', '/id/ba7582a6344757e6');
    const gate = new Promise(resolve => { release = resolve; });
    fetchMock = mockFetch(async (url) => {
      if (url.endsWith('/id/ba7582a6344757e6')) {
        await gate;
        return jsonResponse({ response: { persons: [person()] } });
      }
      if (url.endsWith('/id/unknown')) return jsonResponse({ response: { persons: [] } });
      return undefined;
    });
  });

  it('SR-210 shows the wait overlay while the record loads', async () => {
    const { container } = render(ShowId);
    expect(container.querySelector('.rf-wait-container').textContent).toContain('Recherche en cours');
    release();
    await waitFor(() => expect(container.querySelector('.rf-wait-container')).toBeNull());
  });

  it('SR-211 forces the card-expand mode and resets the search flags on mount', async () => {
    stores.wasSearched.set('previous search');
    render(ShowId);
    expect(get(stores.displayMode)).toBe('card-expand');
    expect(get(stores.waitSearch)).toBe(true);
    expect(get(stores.wasSearched)).toBe(false);
    release();
    await waitFor(() => expect(get(stores.waitSearch)).toBe(false));
  });

  it('SR-212 fetches GET /id/<id> from the path', async () => {
    render(ShowId);
    release();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/deces/api/v1/id/ba7582a6344757e6', { method: 'GET' }));
  });

  it('SR-213 shows the record as an expanded card', async () => {
    const { container } = render(ShowId);
    release();
    await waitFor(() => expect(screen.getByText('DUPONT Jean Pierre')).toBeTruthy());
    expect(container.querySelector('.rf-card').className).toContain('rf-card--md');
    expect(screen.getByText('Permalien')).toBeTruthy();
    expect(container.querySelector('.rf-card__body > a').getAttribute('href')).toBe('#1');
  });

  it('SR-214 an unknown id shows "Oups... pas de résultats pour cet identifiant" and the help', async () => {
    window.history.replaceState({}, '', '/id/unknown');
    render(ShowId);
    expect(await screen.findByText('Oups... pas de résultats pour cet identifiant')).toBeTruthy();
    expect(screen.getByText('Décès manquant')).toBeTruthy();
  });

  it('SR-215 sets wasSearched to a text summary of the record, or "not found"', async () => {
    render(ShowId);
    release();
    await waitFor(() => expect(get(stores.wasSearched)).toBeTruthy());
    expect(get(stores.wasSearched).replace(/\s+/g, ' ')).toBe('DUPONT Jean Pierre 87 ans, Eysines 03/10/1932 - Pessac 16/01/2020');
  });

  it('SR-215 "not found" for an unknown id', async () => {
    window.history.replaceState({}, '', '/id/unknown');
    render(ShowId);
    await waitFor(() => expect(get(stores.wasSearched)).toBe('not found'));
  });

  it('SR-216 shows the punch message under the card', async () => {
    render(ShowId);
    release();
    await screen.findByText('DUPONT Jean Pierre');
    const punch = screen.getByText(/Recherchez parmi/);
    expect(punch.closest('.rf-col-12')).not.toBeNull();
  });
});

describe('ProofViewer', () => {
  beforeEach(() => {
    stores.showProof.set(undefined);
  });

  it('SR-217 the proof modal is shown only when showProof is set', async () => {
    const { container } = render(ProofViewer);
    expect(container.querySelector('.modal')).toBeNull();
    stores.showProof.set('/deces/api/v1/updates/proof/x-m1');
    await waitFor(() => expect(container.querySelector('.modal')).not.toBeNull());
  });

  it('SR-218 renders the PDF in an <object type="application/pdf"> titled "Visualisateur"', () => {
    stores.showProof.set('/deces/api/v1/updates/proof/x-m1');
    render(ProofViewer);
    const viewer = screen.getByTitle('Visualisateur');
    expect(viewer.tagName).toBe('OBJECT');
    expect(viewer.getAttribute('type')).toBe('application/pdf');
    expect(viewer.getAttribute('data')).toBe('/deces/api/v1/updates/proof/x-m1');
    expect(viewer.getAttribute('aria-label')).toBe('Visualisateur');
  });

  it('SR-219 the close icon clears showProof', async () => {
    stores.showProof.set('/proof.pdf');
    const { container } = render(ProofViewer);
    container.querySelector('.rf-fi-close-circle-line').parentElement.click();
    expect(get(stores.showProof)).toBe('');
    await waitFor(() => expect(container.querySelector('.modal')).toBeNull());
  });
});
