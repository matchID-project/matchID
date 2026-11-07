import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import { get } from 'svelte/store';

vi.mock('../../../src/components/tools/search.js', async (importOriginal) => ({
  ...(await importOriginal()),
  searchSubmit: vi.fn(async () => {}),
  searchURLUpdate: vi.fn(async () => {})
}));

const { ga } = await import('@beyonk/svelte-google-analytics');
const { default: SearchBox } = await import('../../../src/components/views/SearchBox.svelte');
const stores = await import('../../../src/components/tools/stores.js');

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CO-082 Google Analytics search event', () => {
  it('CO-082 SearchBox reports the search summary to ga.all.search without loading any script', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const searchEvent = vi.spyOn(ga.all, 'search');
    const { container } = render(SearchBox);
    const q = container.querySelector('#q');
    await fireEvent.input(q, { target: { value: 'dupont jean' } });
    expect(get(stores.searchInput).fullText.value).toBe('dupont jean');
    await vi.advanceTimersByTimeAsync(400);
    expect(searchEvent).toHaveBeenCalledWith('Dupont Jean');
    expect([...document.querySelectorAll('script[src]')].filter(s => /google/.test(s.src))).toEqual([]);
  });
});
