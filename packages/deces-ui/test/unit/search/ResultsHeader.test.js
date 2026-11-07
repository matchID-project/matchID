import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { focusSomething, mockFetch, person, resetSearchStores, setInput } from './helpers.js';

const { default: ResultsHeader } = await import('../../../src/components/views/ResultsHeader.svelte');
const stores = await import('../../../src/components/tools/stores.js');
const { enableDisplayMode } = await import('../../../src/components/tools/search.js');

const modes = [
  ['card', 'fiche compacte'],
  ['card-expand', 'fiche complète'],
  ['table', 'tableur'],
  ['agg', 'statistiques'],
  ['geo', 'géographique']
];

const searched = ({ total = 45, current = 1, query = 'Dupont' } = {}) => {
  setInput(stores, { fullText: 'dupont' });
  stores.searchResults.set([person()]);
  stores.totalResults.set(total);
  stores.totalPages.set(Math.ceil(total / 20));
  stores.current.set(current);
  stores.scrollId.set({ id: 's', context: 'c', date: Date.now() });
  stores.wasSearched.set(query);
};

const summary = (container) => container.querySelector('tr > td:nth-child(2) span').textContent.replace(/\s+/g, ' ').trim();
const modeIcon = (label) => screen.getByLabelText(`mode d'affichage ${label}`);
const modeSpan = (label) => modeIcon(label).closest('span.rf-href');

describe('ResultsHeader', () => {
  beforeEach(() => {
    resetSearchStores(stores);
    stores.totalBuckets.set(0);
    stores.actualBuckets.set(0);
    mockFetch();
  });

  it('SR-067 is hidden without trigger, before the first search (except agg/geo) and for a single error result', async () => {
    const { container } = render(ResultsHeader);
    expect(container.innerHTML.replace(/<!---->/g, '')).toBe(''); // Svelte 5 keeps empty <!----> block anchors
    setInput(stores, { fullText: 'dupont' });
    await Promise.resolve();
    expect(container.querySelector('table')).toBeNull();
    stores.displayMode.set('geo');
    await waitFor(() => expect(container.querySelector('table')).not.toBeNull());
    stores.displayMode.set('card');
    stores.wasSearched.set('Dupont');
    stores.searchResults.set([{ error: true, status: 500 }]);
    await waitFor(() => expect(container.querySelector('table')).toBeNull());
    stores.searchResults.set([person()]);
    await waitFor(() => expect(container.querySelector('table')).not.toBeNull());
  });

  it('SR-068 shows the CSV download icon when there is more than one result, not in agg mode', async () => {
    searched({ total: 1 });
    render(ResultsHeader);
    expect(screen.queryByTitle("téléchargez l'ensemble des résultats en tableur CSV")).toBeNull();
    stores.totalResults.set(2);
    await waitFor(() => expect(screen.getByTitle("téléchargez l'ensemble des résultats en tableur CSV")).toBeTruthy());
    stores.displayMode.set('agg');
    await waitFor(() => expect(screen.queryByTitle("téléchargez l'ensemble des résultats en tableur CSV")).toBeNull());
  });

  it('SR-069 disables the download from 500 000 results', async () => {
    searched({ total: 499999 });
    render(ResultsHeader);
    expect(screen.getByTitle("téléchargez l'ensemble des résultats en tableur CSV")).toBeTruthy();
    stores.totalResults.set(500000);
    await waitFor(() => expect(screen.getByTitle('téléchargement limité à 500000 lignes')).toBeTruthy());
  });

  it('SR-070 shows the aggregation loading pie (actual/total buckets) in agg mode', async () => {
    stores.displayMode.set('agg');
    const { container } = render(ResultsHeader);
    const pie = () => container.querySelector('td:first-child svg circle[stroke-dasharray]');
    expect(pie()).toBeNull();
    stores.totalBuckets.set(10);
    stores.actualBuckets.set(5);
    await waitFor(() => expect(pie()).not.toBeNull());
    expect(pie().getAttribute('stroke-dasharray')).toBe(`${0.5 / 2 * 31.42} ${31.42 - 0.5 * 31.42}`);
    stores.actualBuckets.set(10);
    await waitFor(() => expect(pie()).toBeNull());
  });

  it('SR-071 summarises "Résultats X à Y parmi N pour: <query>"', async () => {
    searched({ total: 45, current: 3, query: 'DUPONT Jean' });
    const { container } = render(ResultsHeader);
    expect(summary(container)).toBe('Résultats 41 à 45 parmi 45 pour: DUPONT Jean');
    expect([...container.querySelectorAll('td:nth-child(2) strong')].map(s => s.textContent)).toEqual(['41', '45', '45', 'DUPONT Jean']);
  });

  it('SR-072 shows "Recherche en cours …" before the first response', () => {
    setInput(stores, { fullText: 'dupont' });
    stores.displayMode.set('geo');
    const { container } = render(ResultsHeader);
    expect(summary(container)).toBe('Recherche en cours …');
  });

  it("SR-073 agg mode without criteria shows \"Résultats sur l'ensemble des données\"", () => {
    stores.displayMode.set('agg');
    const { container } = render(ResultsHeader);
    expect(summary(container)).toBe("Résultats sur l'ensemble des données");
  });

  it('SR-074 shows the top pagination (xl only) when there is more than one page, not in geo/agg', async () => {
    searched({ total: 20 });
    const { container } = render(ResultsHeader);
    const top = () => container.querySelector('td.rf-display--xl');
    expect(top()).toBeNull();
    stores.totalPages.set(3);
    await waitFor(() => expect(within(top()).getAllByLabelText('page 2').length).toBeGreaterThan(0));
    stores.displayMode.set('agg');
    await waitFor(() => expect(top()).toBeNull());
  });

  it('SR-075 the "par page" select (20/40/60) is shown with more than one page and binds the page size', async () => {
    searched({ total: 20 });
    render(ResultsHeader);
    expect(screen.queryByLabelText('par page')).toBeNull();
    stores.totalPages.set(3);
    const select = await screen.findByLabelText('par page');
    expect([...select.options].map(o => o.value)).toEqual(['20', '40', '60']);
    expect(select.value).toBe('20');
    await fireEvent.change(select, { target: { value: '40' } });
    expect(get(stores.resultsPerPage)).toBe(40);
  });

  it('SR-076 a non-standard size from the URL is inserted in the list (lexicographic order)', async () => {
    searched();
    stores.resultsPerPage.set(100);
    render(ResultsHeader);
    expect([...screen.getByLabelText('par page').options].map(o => o.value)).toEqual(['100', '20', '40', '60']);
    expect(screen.getByLabelText('par page').value).toBe('100');
    // quirk of the default (string) sort
    stores.resultsPerPage.set(5);
    await waitFor(() => expect([...screen.getByLabelText('par page').options].map(o => o.value)).toEqual(['20', '40', '5', '60']));
  });

  it('SR-077 changing the page size blurs the active element', async () => {
    searched();
    render(ResultsHeader);
    const select = screen.getByLabelText('par page');
    const blur = vi.spyOn(select, 'blur');
    stores.activeElement.set(select);
    await fireEvent.change(select, { target: { value: '60' } });
    expect(blur).toHaveBeenCalled();
    expect(get(stores.activeElement)).toBeUndefined();
  });

  it('SR-078 summarises the sort as "tri: <keys with arrows>" or "tri: aucun"', async () => {
    searched();
    render(ResultsHeader);
    const sort = () => screen.getByTitle('cliquez pour paramétrer le tri');
    expect(sort().textContent.replace(/\s+/g, ' ').trim()).toBe('tri: score');
    expect(sort().querySelector('.rf-fi-arrow-down-s-line')).not.toBeNull();
    stores.sortInput.update(v => v.map(s => ({ ...s, order: s.input === 'lastName' ? 'asc' : (s.input === 'score' ? 'desc' : undefined) })));
    await waitFor(() => expect(sort().textContent.replace(/\s+/g, ' ').trim()).toBe('tri: score nom'));
    expect(sort().querySelector('.rf-fi-arrow-up-s-line')).not.toBeNull();
    stores.sortInput.update(v => v.map(s => ({ ...s, order: undefined })));
    await waitFor(() => expect(sort().textContent.replace(/\s+/g, ' ').trim()).toBe('tri: aucun'));
    stores.sortInput.update(v => v.map(s => ({ ...s, order: s.input === 'score' ? 'desc' : undefined })));
  });

  it('SR-079 clicking the sort summary toggles the SortInput panel', async () => {
    searched();
    render(ResultsHeader);
    expect(screen.queryByText('clés de tri')).toBeNull();
    await fireEvent.click(screen.getByTitle('cliquez pour paramétrer le tri'));
    expect(get(stores.sortInputDisplay)).toBe(true);
    expect(screen.getByText('clés de tri')).toBeTruthy();
    await fireEvent.click(screen.getByTitle('cliquez pour paramétrer le tri'));
    await waitFor(() => expect(screen.queryByText('clés de tri')).toBeNull());
  });

  it('SR-080 shows the 5 display modes (fiche compacte, fiche complète, tableur, statistiques, géographique)', () => {
    searched();
    render(ResultsHeader);
    const labels = screen.getAllByLabelText(/^mode d'affichage /).map(a => a.getAttribute('aria-label'));
    expect(labels).toEqual(modes.map(([, label]) => `mode d'affichage ${label}`));
  });

  it("SR-081 highlights the current mode, titled \"Mode d'affichage actuel:\" vs \"Basculez au mode d'affichage:\"", async () => {
    searched();
    render(ResultsHeader);
    expect(modeSpan('fiche compacte').title).toBe("Mode d'affichage actuel: fiche compacte");
    expect(modeSpan('tableur').title).toBe("Basculez au mode d'affichage: tableur");
    expect(modeIcon('fiche compacte').closest('.rf-fi--icon').className).toContain('rf-color--bf');
    expect(modeIcon('tableur').closest('.rf-fi--icon').className).toContain('rf-color--g400');
    stores.displayMode.set('table');
    await waitFor(() => expect(modeSpan('tableur').title).toBe("Mode d'affichage actuel: tableur"));
  });

  describe('SR-082 switching the display mode', () => {
    it('SR-082 writes view= in the URL and prevents the link navigation', async () => {
      searched();
      focusSomething(stores);
      render(ResultsHeader);
      const click = await fireEvent.click(modeIcon('tableur'));
      expect(click).toBe(false);
      expect(get(stores.displayMode)).toBe('table');
      await waitFor(() => expect(new URLSearchParams(location.search).get('view')).toBe('table'));
    });

    it('SR-082 leaving geo trims the results to 20 and resets the page size', async () => {
      searched();
      stores.displayMode.set('geo');
      stores.resultsPerPage.set(10000);
      stores.searchResults.set([...Array(30).keys()].map(i => person({ id: `p${i}` })));
      focusSomething(stores);
      render(ResultsHeader);
      await fireEvent.click(modeIcon('fiche compacte'));
      expect(get(stores.searchResults)).toHaveLength(20);
      expect(get(stores.resultsPerPage)).toBe(20);
      expect(get(stores.displayMode)).toBe('card');
    });

    it('SR-082 entering agg triggers the aggregations when the criteria are valid', async () => {
      searched();
      focusSomething(stores);
      render(ResultsHeader);
      await fireEvent.click(modeIcon('statistiques'));
      expect(get(stores.triggerAggregations)).toBe(true);
      expect(get(stores.displayMode)).toBe('agg');
    });

    // BUG: enableDisplayMode() calls `activeElement.blur()` without a null
    // check (search.js:77) and then stores `undefined`. When the next switch
    // happens without any focus change in between (Safari/Firefox do not focus
    // links on click), it throws a TypeError before searchURLUpdate(): the
    // mode changes but the URL keeps the previous `view=`.
    it.fails('SR-082 switching twice without any focus change still updates the URL', async () => {
      searched();
      focusSomething(stores);
      await enableDisplayMode('table');
      await enableDisplayMode('card-expand');
      expect(new URLSearchParams(location.search).get('view')).toBe('card-expand');
    });
  });

  it('SR-083 each mode icon href carries ?view=<mode> so it can be opened in a new tab', () => {
    window.history.replaceState({}, '', '/search?q=dupont&view=table');
    searched();
    render(ResultsHeader);
    expect(modeIcon('fiche compacte').getAttribute('href')).toBe(`${location.origin}/search?q=dupont`);
    expect(modeIcon('géographique').getAttribute('href')).toBe(`${location.origin}/search?view=geo&q=dupont`);
  });

  it("SR-084 each mode icon has the aria label \"mode d'affichage <label>\"", () => {
    searched();
    render(ResultsHeader);
    modes.forEach(([, label]) => expect(modeIcon(label).tagName).toBe('A'));
  });

  it('SR-085 the SortInput panel is shown when toggled, except in geo mode', async () => {
    searched();
    stores.sortInputDisplay.set(true);
    render(ResultsHeader);
    expect(screen.getByText('clés de tri')).toBeTruthy();
    stores.displayMode.set('geo');
    await waitFor(() => expect(screen.queryByText('clés de tri')).toBeNull());
  });

  it('SR-086 hides the download, per-page and sort cells on mobile', () => {
    searched();
    const { container } = render(ResultsHeader);
    const cells = [...container.querySelectorAll('tr > td')];
    expect(cells[0].className).toContain('rf-hide--mobile');
    expect(screen.getByLabelText('par page').closest('td').className).toContain('rf-hide--mobile');
    expect(screen.getByTitle('cliquez pour paramétrer le tri').closest('td').className).toContain('rf-hide--mobile');
  });
});
