import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { mockFetch, person, resetSearchStores, searchResponse, setInput } from './helpers.js';

// Real search flow against a stubbed backend, so that page requests, scroll
// ids and URL updates are those of the application.
const { default: Pagination } = await import('../../../src/components/views/Pagination.svelte');
const stores = await import('../../../src/components/tools/stores.js');
const { searchSubmit } = await import('../../../src/components/tools/search.js');

let fetchMock;
const pageRequests = () => fetchMock.mock.calls
  .filter(([url]) => `${url}`.endsWith('/search'))
  .map(([, init]) => JSON.parse(init.body))
  .map(({ page, scrollId }) => ({ page, scrollId }));

const pagesShown = (container) => [...container.querySelectorAll('li.rf-pagination__item--from-md')]
  .map(li => li.textContent.trim().replace('…', '.'));

// Run a real page-1 search returning `total` results.
const searchFirstPage = async (total = 200) => {
  setInput(stores, { fullText: 'dupont' });
  await searchSubmit();
  expect(get(stores.totalPages)).toBe(Math.ceil(total / 20));
  fetchMock.mockClear();
  // forget the 59 s response cache so that every page request is visible
  stores.cachedResponses.set({});
};

const setPages = (current, totalPages) => {
  stores.wasSearched.set('Dupont');
  stores.totalPages.set(totalPages);
  stores.totalResults.set(totalPages * 20);
  stores.current.set(current);
  stores.scrollId.set({ id: 'x', context: 'c', date: Date.now() });
};

describe('Pagination', () => {
  beforeEach(() => {
    resetSearchStores(stores);
    stores.scrollId.set({ id: 'x', context: 'c', date: Date.now() });
    let n = 0;
    fetchMock = mockFetch((url, init) => {
      if (!url.endsWith('/search')) return undefined;
      const { page } = JSON.parse(init.body);
      n += 1;
      return searchResponse([person({ id: `p${page}` })], { total: 200, scrollId: `scroll-${n}` });
    });
  });

  it('SR-172 is hidden until a search has run', async () => {
    stores.totalPages.set(10);
    const { container } = render(Pagination);
    expect(container.querySelector('nav')).toBeNull();
    stores.wasSearched.set('Dupont');
    await waitFor(() => expect(container.querySelector('nav')).not.toBeNull());
  });

  it('SR-173 renders an empty nav with a single page', () => {
    setPages(1, 1);
    const { container } = render(Pagination);
    expect(container.querySelector('nav').children).toHaveLength(0);
  });

  it('SR-174 uses <nav role="navigation" aria-label="pagination">', () => {
    setPages(1, 3);
    render(Pagination);
    expect(screen.getByRole('navigation', { name: 'pagination' }).tagName).toBe('NAV');
  });

  it('SR-175 the previous arrow is disabled on page 1', () => {
    setPages(1, 3);
    const { container } = render(Pagination);
    const prev = container.querySelector('.rf-pagination__item--prev');
    expect(prev.className).toContain('rf-pagination__item--disabled');
    expect(prev.querySelector('a')).toBeNull();
  });

  it('SR-176 clicking the previous arrow fetches page - 1', async () => {
    await searchFirstPage();
    stores.current.set(3);
    const { container } = render(Pagination);
    await fireEvent.click(container.querySelector('.rf-pagination__item--prev'));
    await waitFor(() => expect(location.search).toBe('?q=dupont&current=n_2_n'));
    expect(get(stores.current)).toBe(2);
    expect(pageRequests().at(-1)).toMatchObject({ page: 2 });
  });

  it('SR-177 the next arrow is disabled on the last page', () => {
    setPages(3, 3);
    const { container } = render(Pagination);
    expect(container.querySelector('.rf-pagination__item--next').className).toContain('rf-pagination__item--disabled');
  });

  it('SR-178 clicking the next arrow fetches page + 1 with the scroll id', async () => {
    await searchFirstPage();
    const { container } = render(Pagination);
    await fireEvent.click(container.querySelector('.rf-pagination__item--next'));
    await waitFor(() => expect(get(stores.searchResults)[0].id).toBe('p2'));
    expect(get(stores.current)).toBe(2);
    expect(pageRequests()).toEqual([{ page: 2, scrollId: 'scroll-1' }]);
  });

  it('SR-179 shows every page number up to 5 pages', () => {
    setPages(2, 5);
    const { container } = render(Pagination);
    expect(pagesShown(container)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('SR-180 near the start: 1..current+1, …, last', () => {
    setPages(3, 10);
    const { container } = render(Pagination);
    expect(pagesShown(container)).toEqual(['1', '2', '3', '4', '.', '10']);
  });

  it('SR-181 in the middle: 1, …, current-1, current, current+1, …, last', () => {
    setPages(6, 10);
    const { container } = render(Pagination);
    expect(pagesShown(container)).toEqual(['1', '.', '5', '6', '7', '.', '10']);
  });

  it('SR-182 near the end: 1, …, current-1..last', () => {
    setPages(8, 10);
    const { container } = render(Pagination);
    expect(pagesShown(container)).toEqual(['1', '.', '7', '8', '9', '10']);
  });

  it('SR-183 highlights the active page', () => {
    setPages(6, 10);
    render(Pagination);
    expect(screen.getByTitle('page 6').className).toContain('rf-pagination__item--active');
    expect(screen.getByTitle('page 10').className).not.toContain('rf-pagination__item--active');
  });

  it('SR-184 page numbers are hidden on mobile (from-md), the arrows are kept', () => {
    setPages(6, 10);
    const { container } = render(Pagination);
    expect(container.querySelector('.rf-pagination__item--prev').className).not.toContain('from-md');
    expect(container.querySelector('.rf-pagination__item--next').className).not.toContain('from-md');
    expect(screen.getByTitle('page 6').className).toContain('rf-pagination__item--from-md');
  });

  it('SR-185 page links carry ?…&current=n_<p>_n and the aria label "page N"', () => {
    window.history.replaceState({}, '', '/search?q=dupont&current=n_6_n');
    setPages(6, 10);
    render(Pagination);
    const links = screen.getAllByLabelText('page 7');
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/search?q=dupont&current=n_7_n', '/search?q=dupont&current=n_7_n']);
  });

  it('SR-186 a page click blurs, re-fetches page 1 when the scroll id is stale, fetches the page and updates current=', async () => {
    await searchFirstPage();
    // the criteria changed since the scroll id was obtained
    stores.scrollId.update(v => ({ ...v, context: 'stale' }));
    const focused = document.createElement('a');
    const blur = vi.spyOn(focused, 'blur');
    stores.activeElement.set(focused);
    render(Pagination);
    const page2 = screen.getAllByTitle('page 2').find(li => li.classList.contains('rf-pagination__item--from-md'));
    await fireEvent.click(page2);
    await waitFor(() => expect(new URLSearchParams(location.search).get('current')).toBe('n_2_n'));
    expect(blur).toHaveBeenCalled();
    expect(pageRequests()).toEqual([{ page: 1 }, { page: 2, scrollId: 'scroll-2' }]);
    expect(get(stores.current)).toBe(2);
  });

  it('SR-187 a reset scroll id navigates back to page 1', async () => {
    await searchFirstPage();
    stores.current.set(4);
    render(Pagination);
    stores.scrollId.set(null);
    await waitFor(() => expect(pageRequests()).toEqual([{ page: 1 }]));
    expect(get(stores.current)).toBe(1);
  });

  it('SR-188 a click prevents the default link navigation', async () => {
    setPages(1, 3);
    render(Pagination);
    const link = screen.getAllByLabelText('page 2')[0];
    expect(await fireEvent.click(link)).toBe(false);
    expect(location.pathname).toBe('/search');
  });
});
