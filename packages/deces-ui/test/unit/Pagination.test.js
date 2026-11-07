import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

vi.mock('../../src/components/tools/search.js', async (importOriginal) => ({
  ...(await importOriginal()),
  searchSubmit: vi.fn(async () => {}),
  searchURLUpdate: vi.fn(async () => {})
}));

const { default: Pagination } = await import('../../src/components/views/Pagination.svelte');
const search = await import('../../src/components/tools/search.js');
const stores = await import('../../src/components/tools/stores.js');

const setResults = ({ current = 1, totalPages = 10, scrollId = { id: 'x', context: 'stale', date: Date.now() } } = {}) => {
  stores.wasSearched.set('dupont');
  stores.totalResults.set(totalPages * 20);
  stores.totalPages.set(totalPages);
  stores.current.set(current);
  stores.scrollId.set(scrollId);
};

const pageLabels = () => screen.getAllByRole('link').map(a => a.getAttribute('aria-label'));

describe('Pagination', () => {
  beforeEach(() => {
    search.searchSubmit.mockClear();
    search.searchURLUpdate.mockClear();
  });

  it('renders nothing before a search', () => {
    stores.wasSearched.set(false);
    stores.totalPages.set(10);
    const { container } = render(Pagination);
    expect(container.querySelector('nav')).toBeNull();
  });

  it('shows first pages, an ellipsis and the last page on page 1', () => {
    setResults({ current: 1, totalPages: 10 });
    render(Pagination);
    expect(pageLabels()).toEqual(['page 1', 'page 2', 'page 10', 'page 2']);
    expect(screen.getByText('…')).toBeTruthy();
    expect(screen.getByTitle('page 1').className).toContain('rf-pagination__item--active');
  });

  it('shows a window around the current page in the middle of the results', () => {
    setResults({ current: 5, totalPages: 10 });
    render(Pagination);
    expect(pageLabels()).toEqual(['page 4', 'page 1', 'page 4', 'page 5', 'page 6', 'page 10', 'page 6']);
  });

  it('builds crawlable links carrying the page in the URL', () => {
    window.history.replaceState({}, '', '/search?q=dupont');
    setResults({ current: 1, totalPages: 3 });
    render(Pagination);
    expect(screen.getByLabelText('page 3').getAttribute('href')).toBe('/search?q=dupont&current=n_3_n');
  });

  it('fetches page 1 first when the scroll id is stale, then the requested page', async () => {
    setResults({ current: 1, totalPages: 10 });
    render(Pagination);
    await fireEvent.click(screen.getByText('2'));
    expect(search.searchSubmit.mock.calls).toEqual([[1], [2]]);
    expect(search.searchURLUpdate).toHaveBeenCalledTimes(1);
  });

  // Guards the Svelte 5 migration risk on call-expression handlers
  // (`on:click={goTo(page)}`): each click must trigger a fetch.
  it('fetches again on every click on the same page link', async () => {
    setResults({ current: 1, totalPages: 10 });
    render(Pagination);
    await fireEvent.click(screen.getByTitle('page 10'));
    await fireEvent.click(screen.getByTitle('page 10'));
    expect(search.searchSubmit.mock.calls.filter(([page]) => page === 10)).toHaveLength(2);
  });

  it('ignores the disabled previous arrow on the first page', () => {
    setResults({ current: 1, totalPages: 10 });
    const { container } = render(Pagination);
    expect(container.querySelector('.rf-pagination__item--prev.rf-pagination__item--disabled')).not.toBeNull();
  });
});
