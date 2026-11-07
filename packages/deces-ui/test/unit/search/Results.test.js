import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { jsonResponse, mockFetch, person, resetSearchStores, searchResponse, setInput, setThemeColors } from './helpers.js';

vi.mock('chart.js/auto', async () => (await import('./helpers.js')).fakeChartModule());

const { default: Results } = await import('../../../src/components/views/Results.svelte');
const stores = await import('../../../src/components/tools/stores.js');
const { searchSubmit } = await import('../../../src/components/tools/search.js');

const people = (n, offset = 0) => [...Array(n).keys()].map(i => person({
  id: `id-${i + offset}`,
  name: { first: ['Jean'], last: `Nom${i + offset}` }
}));

const showResults = (results, { total = results.length, current = 1 } = {}) => {
  setInput(stores, { fullText: 'dupont' });
  stores.searchResults.set(results);
  stores.totalResults.set(total);
  stores.totalPages.set(Math.ceil(total / 20));
  stores.current.set(current);
  stores.scrollId.set({ id: 's', context: 'c', date: Date.now() });
  stores.wasSearched.set('Dupont');
};

// Run the real search flow against a stubbed backend answering `status`.
const searchWithStatus = async (status, statusText, body = {}) => {
  mockFetch(url => url.endsWith('/search') ? jsonResponse(body, status, statusText) : undefined);
  setInput(stores, { fullText: 'dupont' });
  await searchSubmit();
};

describe('Results', () => {
  beforeEach(() => {
    resetSearchStores(stores);
    setThemeColors();
    stores.sortInput.update(v => v.map(s => ({ ...s, order: s.input === 'score' ? 'desc' : undefined })));
    stores.sortInput.update(v => [v.find(s => s.input === 'score'), ...v.filter(s => s.input !== 'score')]);
    mockFetch();
  });

  it('SR-051 renders nothing while the criteria do not trigger a search', async () => {
    stores.wasSearched.set('x');
    stores.searchResults.set([person()]);
    const { container } = render(Results);
    expect(container.innerHTML.replace(/<!---->/g, '')).toBe(''); // Svelte 5 keeps empty <!----> block anchors
    stores.searchInput.update(v => { v.birthDate.value = '19'; v.lastName.value = 'dupont'; return v; });
    await Promise.resolve();
    // an invalid mask value (incomplete date) also disables the trigger
    expect(container.innerHTML.replace(/<!---->/g, '')).toBe(''); // Svelte 5 keeps empty <!----> block anchors
  });

  it('SR-052 shows "Oups... pas de résultats pour votre recherche" and the filtered Info when nothing matches', async () => {
    showResults([]);
    render(Results);
    expect(screen.getByText('Oups... pas de résultats pour votre recherche')).toBeTruthy();
    // Info with `filter`: only the help cards flagged for the empty state
    expect(screen.getByText('Décès manquant')).toBeTruthy();
    expect(screen.getByText('Signaler un bug')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Rechercher dans les questions')).toBeNull();
  });

  it('SR-053 a 422 (anonymous quota) asks to register with an email field and its button', async () => {
    await searchWithStatus(422, 'Unprocessable Entity', { msg: 'quota' });
    render(Results);
    expect(screen.getByText('Pour poursuivre, enregistrez-vous !')).toBeTruthy();
    expect(screen.getByText(/L'usage anonyme du service est dorénavant limité/)).toBeTruthy();
    expect(screen.getByLabelText('Courriel').type).toBe('email');
    expect(screen.getByTitle('Valider le courriel')).toBeTruthy();
  });

  it('SR-054 a 429 shows the status line and the "fortement sollicité" message', async () => {
    await searchWithStatus(429, 'Too Many Requests', { msg: 'slow down' });
    const { container } = render(Results);
    expect(container.querySelector('h4.rf-color--rm').textContent.replace(/\s+/g, ' ').trim()).toBe('429 Too Many Requests slow down');
    expect(screen.getByText(/Le service étant fortement sollicité, votre requête est temporisée/)).toBeTruthy();
  });

  it('SR-055 any other error shows "Le service est indisponible" with the contact email', async () => {
    await searchWithStatus(500, 'Internal Server Error');
    const { container } = render(Results);
    expect(container.querySelector('h4.rf-color--rm').textContent.replace(/\s+/g, ' ').trim()).toBe('500 Internal Server Error');
    expect(screen.getByText(/Le service est indisponible\. .*test@example\.org/)).toBeTruthy();
  });

  it('SR-056 card modes render one ResultCard per result, numbered from the global offset', async () => {
    showResults(people(3, 20), { total: 45, current: 2 });
    const { container } = render(Results);
    const anchors = () => [...container.querySelectorAll('.rf-card__body > a')];
    expect(anchors().map(a => a.getAttribute('href'))).toEqual(['#21', '#22', '#23']);
    expect(screen.getByText('NOM20 Jean')).toBeTruthy();
    stores.displayMode.set('card-expand');
    await waitFor(() => expect(screen.getAllByText('Permalien')).toHaveLength(3));
    expect(anchors()).toHaveLength(3);
  });

  describe('table mode', () => {
    beforeEach(() => {
      showResults(people(2));
      stores.displayMode.set('table');
    });

    it('SR-057 shows the "état civil / naissance / décès" header groups', () => {
      const { container } = render(Results);
      const groups = [...container.querySelectorAll('th[scope="colgroup"]')];
      expect(groups.map(th => [th.textContent, th.getAttribute('colspan')])).toEqual([
        ['état civil', '3'], ['naissance', '5'], ['décès', '8']
      ]);
      expect(container.querySelectorAll('tr.rf-background--beige, tbody tr, table > tr').length).toBeGreaterThan(0);
    });

    it('SR-058 sets the column widths with <col> elements', () => {
      const { container } = render(Results);
      const widths = [...container.querySelectorAll('col')].map(c => c.getAttribute('style'));
      expect(widths).toHaveLength(16);
      expect(widths[0]).toBe('width: 100px;');
      expect(widths[15]).toBe('width: 70px;');
    });

    it('SR-059 clicking a sortable header cycles desc -> asc -> none and moves the key first', async () => {
      render(Results);
      const header = () => screen.getAllByRole('columnheader').find(th => th.textContent.trim() === 'nom');
      await fireEvent.click(header());
      expect(get(stores.sortInput)[0]).toMatchObject({ input: 'lastName', order: 'desc' });
      await fireEvent.click(header());
      expect(get(stores.sortInput)[0]).toMatchObject({ input: 'lastName', order: 'asc' });
      await fireEvent.click(header());
      expect(get(stores.sortInput)[0].input).toBe('lastName');
      expect(get(stores.sortInput)[0].order).toBeUndefined();
      expect(get(stores.sortInput)[1]).toMatchObject({ input: 'score', order: 'desc' });
    });

    it('SR-060 the "code INSEE" headers have no title and ignore clicks', async () => {
      render(Results);
      const codes = screen.getAllByRole('columnheader').filter(th => th.textContent.trim() === 'code INSEE');
      expect(codes).toHaveLength(2);
      const before = JSON.stringify(get(stores.sortInput));
      for (const th of codes) {
        expect(th.hasAttribute('title')).toBe(false);
        expect(th.className).not.toContain('rf-table-th--sortable');
        await fireEvent.click(th);
      }
      expect(JSON.stringify(get(stores.sortInput))).toBe(before);
    });

    it('SR-061 the header arrow icon reflects the sort order', async () => {
      render(Results);
      const header = () => screen.getAllByRole('columnheader').find(th => th.textContent.trim() === 'prénom(s)');
      expect(header().querySelector('span')).toBeNull();
      await fireEvent.click(header());
      expect(header().querySelector('span').className).toContain('rf-fi-arrow-down-s-line');
      await fireEvent.click(header());
      expect(header().querySelector('span').className).toContain('rf-fi-arrow-up-s-line');
    });

    it('SR-062 sortable headers have the "cliquez pour activer/désactiver le tri" tooltip', () => {
      render(Results);
      const sortable = screen.getAllByTitle('cliquez pour activer/désactiver le tri');
      expect(sortable).toHaveLength(14);
    });

    it('SR-063 wraps the table in a horizontal scroll container (mobile)', () => {
      const { container } = render(Results);
      expect(container.querySelector('table.rf-table').parentElement.getAttribute('style')).toMatch(/^overflow-x: auto;?$/);
    });
  });

  it('SR-064 geo mode lazily loads the Geo chunk and renders the map', async () => {
    showResults(people(2));
    stores.displayMode.set('geo');
    const { container } = render(Results);
    await waitFor(() => expect(container.querySelector('.map-container .map')).not.toBeNull());
    expect(screen.getByText('Cliquez ici pour le plein écran')).toBeTruthy();
  });

  it('SR-065 agg mode renders the Aggregations tiles', async () => {
    mockFetch(url => {
      if (url.endsWith('/agg')) return new Response('key,doc_count\nM,10\nF,12\n', { headers: { 'total-results-sex': '2' } });
      if (url.endsWith('.json')) return jsonResponse({ features: [] });
    });
    showResults(people(2));
    stores.displayMode.set('agg');
    render(Results);
    stores.triggerAggregations.set(true);
    await waitFor(() => expect(screen.getByText('Sexe')).toBeTruthy());
  });

  it('SR-066 shows the bottom pagination in card and table modes, not in geo and agg modes', async () => {
    showResults(people(20), { total: 45 });
    const { container } = render(Results);
    const nav = () => container.querySelector('nav[aria-label="pagination"]');
    expect(within(nav()).getByLabelText('page 3')).toBeTruthy();
    stores.displayMode.set('table');
    await waitFor(() => expect(nav()).not.toBeNull());
    stores.displayMode.set('agg');
    await waitFor(() => expect(nav()).toBeNull());
    stores.displayMode.set('geo');
    await waitFor(() => expect(container.querySelector('.map')).not.toBeNull());
    expect(nav()).toBeNull();
  });
});
