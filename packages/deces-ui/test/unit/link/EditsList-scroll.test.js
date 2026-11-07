import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';

// Real svelte-scrolling here (EditsList.test.js mocks it).
vi.mock('../../../src/components/views/ResultCard.svelte', async () =>
  ({ default: (await import('./stubs/index.js')).stubComponent('ResultCard') }));

const { stubProps } = await import('./stubs/index.js');
const { default: EditsList } = await import('../../../src/components/views/EditsList.svelte');
const { accessToken, user, route } = await import('../../../src/components/tools/stores.js');
const { resetLinkStores, stubFetch } = await import('./helpers.js');

describe('/edits scroll to the expanded record', () => {
  afterEach(() => vi.useRealTimers());

  // BUG: EditsList calls `scrollTo({ref, duration})` from svelte-scrolling,
  // but that export is the `use:scrollTo` ACTION (node, options): called with
  // one argument it throws "scrollTo require a options" 400 ms after the
  // click, so the expanded record is never scrolled into view.
  it.fails('LK-199 scrolls to the expanded record 400 ms after the click without error', async () => {
    resetLinkStores();
    stubProps.length = 0;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    route.set({ path: '/edits', query: {} });
    stubFetch({ 'GET /deces/api/v1/updated': () => new Response(JSON.stringify([
      { id: 'rec-1', modifications: [{ date: '2026-01-01T10:00:00', auth: 0, author: 'bob@example.org' }] }
    ])) });
    accessToken.set('jwt-1');
    user.set('bob@example.org');
    render(EditsList);
    await waitFor(() => expect(document.body.textContent).toContain('Liste des éditions'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    stubProps.find(p => p.name === 'ResultCard').props.onclick();
    expect(() => vi.advanceTimersByTime(400)).not.toThrow();
  });
});
