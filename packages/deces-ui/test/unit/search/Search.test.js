import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { mockFetch, person, resetSearchStores, searchResponse, setAdvanced, setInput, setThemeColors } from './helpers.js';

vi.mock('@beyonk/svelte-google-analytics', () => ({ ga: { all: { search: vi.fn() } } }));
vi.mock('chart.js/auto', async () => (await import('./helpers.js')).fakeChartModule());

const { default: Search } = await import('../../../src/components/views/Search.svelte');
const stores = await import('../../../src/components/tools/stores.js');

const punchText = /Recherchez parmi/;
// The search box column is the parent of the <form>.
const boxColumn = (container) => container.querySelector('form').closest('.rf-grid-row > div[class*="rf-col-md-"]');

describe('Search page layout', () => {
  beforeEach(() => {
    resetSearchStores(stores);
    setThemeColors();
    mockFetch(url => url.endsWith('/search') ? searchResponse([person()], { total: 1 }) : undefined);
  });

  it('SR-001 shows the "Recherche en cours" wait overlay while a search runs', async () => {
    const { container } = render(Search);
    expect(container.querySelector('.rf-wait-container')).toBeNull();
    stores.waitSearch.set(true);
    await waitFor(() => expect(container.querySelector('.rf-wait-container').textContent).toContain('Recherche en cours'));
    stores.waitSearch.set(false);
    await waitFor(() => expect(container.querySelector('.rf-wait-container')).toBeNull());
  });

  it('SR-002 suppresses the wait overlay in geo mode (the map has its own spinner)', async () => {
    stores.displayMode.set('geo');
    const { container } = render(Search);
    stores.waitSearch.set(true);
    await Promise.resolve();
    expect(container.querySelector('.rf-wait-container')).toBeNull();
    stores.waitSearch.set(false);
  });

  it('SR-003 centres the search box (3-col spacer + 6-col box) on the landing page', () => {
    const { container } = render(Search);
    const box = boxColumn(container);
    expect(box.previousElementSibling.className).toBe('rf-col-3');
    expect(box.className).toContain('rf-col-md-6 rf-col-lg-6 rf-col-xl-6');
  });

  it('SR-004 adds the desktop top margin on the landing page in simple mode only', async () => {
    const { container } = render(Search);
    expect(boxColumn(container).className).toContain('rf-margin-top-8N--desktop');
    setAdvanced(stores);
    await waitFor(() => expect(boxColumn(container).className).not.toContain('rf-margin-top-8N--desktop'));
  });

  it('SR-005 sets firstSearch to false on the first non-empty input', async () => {
    render(Search);
    expect(get(stores.firstSearch)).toBe(true);
    setInput(stores, { fullText: 'dupont' });
    await waitFor(() => expect(get(stores.firstSearch)).toBe(false));
  });

  it('SR-006 displays the results area (header + results) once an input has a value', async () => {
    render(Search);
    expect(screen.queryByText(/Résultats/)).toBeNull();
    setInput(stores, { fullText: 'dupont' });
    stores.wasSearched.set('Dupont');
    stores.searchResults.set([person()]);
    stores.totalResults.set(1);
    await waitFor(() => expect(screen.getByText('DUPONT Jean Pierre')).toBeTruthy());
    expect(screen.getByText(/Résultats/).textContent).toMatch(/Résultats\s+1\s+à\s+1\s+parmi\s+1\s+pour:\s+Dupont/);
  });

  it('SR-007 displays the results area in agg mode even without criteria', async () => {
    stores.displayMode.set('agg');
    render(Search);
    await waitFor(() => expect(screen.getByText("Résultats sur l'ensemble des données")).toBeTruthy());
  });

  it('SR-008 shrinks the search box (md4/lg4/xl3) once results are shown', async () => {
    const { container } = render(Search);
    setInput(stores, { fullText: 'dupont' });
    await waitFor(() => expect(boxColumn(container).className).toContain('rf-col-md-4 rf-col-lg-4 rf-col-xl-3'));
    expect(container.querySelector('.rf-col-3')).toBeNull();
  });

  it('SR-009 uses a narrower search box (lg3/xl2) in table and geo modes', async () => {
    setInput(stores, { fullText: 'dupont' });
    stores.displayMode.set('table');
    const { container } = render(Search);
    expect(boxColumn(container).className).toContain('rf-col-md-4 rf-col-lg-3 rf-col-xl-2');
    const resultsColumn = boxColumn(container).nextElementSibling;
    expect(resultsColumn.className).toContain('rf-col-md-8 rf-col-lg-9 rf-col-xl-10');
  });

  it('SR-010 gives the results column the full width (xl12) in table mode only', async () => {
    setInput(stores, { fullText: 'dupont' });
    stores.displayMode.set('table');
    const { container } = render(Search);
    // Results.svelte root, rendered as soon as the criteria trigger a search
    const resultsCol = () => container.querySelector('.rf-container-fluid.rf-margin-top-1N').parentElement;
    expect(resultsCol().className).toContain('rf-col-xl-12');
    stores.displayMode.set('card');
    await waitFor(() => expect(resultsCol().className).toContain('rf-col-xl-10'));
  });

  it('SR-011 shows the punch message in the right column after the inputs are cleared', async () => {
    const { container } = render(Search);
    setInput(stores, { fullText: 'dupont' });
    await waitFor(() => expect(get(stores.firstSearch)).toBe(false));
    setInput(stores, { fullText: '' });
    await waitFor(() => expect(screen.getByText(punchText)).toBeTruthy());
    const punchColumn = screen.getByText(punchText).closest('.rf-col-xl-10');
    expect(punchColumn).not.toBeNull();
    expect(boxColumn(container).className).toContain('rf-col-md-4');
  });

  it('SR-012 shows the punch message below the box on the landing page in simple mode, not in advanced mode', async () => {
    render(Search);
    expect(screen.getByText(punchText).closest('.rf-col-12')).not.toBeNull();
    setAdvanced(stores);
    await waitFor(() => expect(screen.queryByText(punchText)).toBeNull());
  });

  it('SR-013 adds the bottom padding in simple mode only and keeps the mobile paddings', async () => {
    const { container } = render(Search);
    const classes = () => boxColumn(container).className;
    expect(classes()).toContain('rf-padding-bottom-2N');
    expect(classes()).toContain('rf-padding-left-1N--mobile rf-padding-right-1N--mobile');
    setAdvanced(stores);
    await waitFor(() => expect(classes()).not.toContain('rf-padding-bottom-2N'));
  });
});
