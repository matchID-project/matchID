import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';

const scroll = vi.hoisted(() => ({ scrollTo: vi.fn() }));
vi.mock('svelte-scrolling', () => scroll);
// ResultCard belongs to the search zone: replace it with a placeholder that
// records its props (the toggle callback in particular).
vi.mock('../../../src/components/views/ResultCard.svelte', async () =>
  ({ default: (await import('./stubs/index.js')).stubComponent('ResultCard') }));

const { stubProps } = await import('./stubs/index.js');
const { default: EditsList } = await import('../../../src/components/views/EditsList.svelte');
const { accessToken, user, admin, route } = await import('../../../src/components/tools/stores.js');
const { icons } = await import('../../../src/components/tools/icons.js');
const { resetLinkStores, stubFetch, flush, iconNames } = await import('./helpers.js');

const edit = (id, mods) => ({ id, name: { last: id }, modifications: mods });
const mod = (date, auth, author = 'bob@example.org') => ({ date, auth, author });
const edits = () => [
  edit('rec-old', [mod('2026-01-01T10:00:00', 1)]),
  edit('rec-new', [mod('2026-01-01T09:00:00', 1), mod('2026-03-02T10:00:00', 0, 'alice@example.org')]),
  edit('rec-mid', [mod('2026-02-01T10:00:00', -1), mod('2026-02-03T10:00:00', -2)])
];

const tile = (label) => [...document.querySelectorAll('.rf-tile__desc')].find(p => p.textContent.trim() === label)
  .closest('.rf-tile').querySelector('.rf-tile__title').textContent.trim();
const bodyRows = () => [...document.querySelectorAll('tbody > tr')];
const cardProps = (id) => stubProps.filter(p => p.name === 'ResultCard' && p.props.index === id).pop().props;

describe('/edits (EditsList.svelte)', () => {
  let fetchMock;
  beforeEach(() => {
    resetLinkStores();
    stubProps.length = 0;
    scroll.scrollTo.mockClear();
    route.set({ path: '/edits', query: {} });
    window.history.replaceState({}, '', '/edits');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    fetchMock = stubFetch({ 'GET /deces/api/v1/updated': () => new Response(JSON.stringify(edits())) });
  });
  afterEach(() => vi.useRealTimers());

  const renderLogged = async ({ asAdmin = false } = {}) => {
    accessToken.set('jwt-1');
    user.set(asAdmin ? 'admin@example.org' : 'bob@example.org');
    admin.set(asAdmin ? 'admin@example.org' : false);
    const result = render(EditsList);
    await waitFor(() => expect(document.body.textContent).toContain('Liste des éditions'));
    return result;
  };

  it('LK-195 renders only when logged in, then GETs /updated with the bearer token', async () => {
    const { container } = render(EditsList);
    await flush();
    expect(container.textContent.trim()).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
    accessToken.set('jwt-1');
    user.set('bob@example.org');
    await waitFor(() => expect(container.textContent).toContain('Liste des éditions'));
    expect(fetchMock).toHaveBeenCalledWith('/deces/api/v1/updated', { headers: { Authorization: 'Bearer jwt-1' } });
  });

  it('LK-195 fetches again when the user changes', async () => {
    await renderLogged();
    user.set('carol@example.org');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('LK-196 tiles: Contributions, Contributions en attente, Contributions validées ("usagers" for admin)', async () => {
    await renderLogged();
    expect(tile('Contributions')).toBe('3');
    expect(tile('Contributions en attente')).toBe('1');
    expect(tile('Contributions validées')).toBe('2');
    document.body.innerHTML = '';
    await renderLogged({ asAdmin: true });
    expect(tile('Contributions usagers')).toBe('3');
  });

  it('LK-197 sorts by last modification date (newest first); author and edit count columns for admin only', async () => {
    await renderLogged();
    expect(bodyRows().map(tr => tr.querySelectorAll('td')[1].textContent.trim())).toEqual(['2026-03-02', '2026-02-03', '2026-01-01']);
    expect([...document.querySelectorAll('thead th')].map(th => th.textContent)).toEqual(['statut', 'date', 'enregistrement']);
    document.body.innerHTML = '';
    await renderLogged({ asAdmin: true });
    expect([...document.querySelectorAll('thead th')].map(th => th.textContent)).toEqual(['statut', 'date', 'auteur', 'éditions', 'enregistrement']);
    const first = [...bodyRows()[0].querySelectorAll('td')].map(td => td.textContent.trim());
    expect(first.slice(1, 4)).toEqual(['2026-03-02', 'alice@example.org', '2']);
  });

  it('LK-198 shows one status icon per modification state (0 waiting, >0 validated, -1 to review, -2 rejected)', async () => {
    await renderLogged();
    const status = (i) => iconNames(bodyRows()[i].querySelector('td'), icons);
    expect(status(0)).toEqual(['ri:time-line', 'ri:check-line']); // rec-new: auth 0 and 1
    expect(status(1)).toEqual(['ri:refresh-line', 'ri:close-line']); // rec-mid: auth -1 and -2
    expect(status(2)).toEqual(['ri:check-line']); // rec-old: auth 1
  });

  it('LK-199 clicking a record expands it (hash, scroll after 400 ms); clicking again collapses and removes the hash', async () => {
    await renderLogged();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    cardProps('rec-mid').onclick();
    await vi.advanceTimersByTimeAsync(0);
    expect(location.hash).toBe('#rec-mid');
    expect(get(route).hash).toBe('#rec-mid');
    const expanded = bodyRows()[1];
    expect(expanded.querySelectorAll('td')).toHaveLength(1);
    expect(expanded.querySelector('td').getAttribute('colspan')).toBe('3');
    expect(scroll.scrollTo).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(scroll.scrollTo).toHaveBeenCalledWith({ ref: '#rec-mid', duration: 400 });
    cardProps('rec-mid').onclick();
    await vi.advanceTimersByTimeAsync(0);
    expect(location.hash).toBe('');
    expect(get(route).hash).toBeUndefined();
    expect(bodyRows()[1].querySelector('td:last-child').getAttribute('colspan')).toBe('1');
  });

  it('LK-199 the expanded record spans 5 columns for admin', async () => {
    await renderLogged({ asAdmin: true });
    cardProps('rec-old').onclick();
    await flush();
    expect(bodyRows()[2].querySelector('td').getAttribute('colspan')).toBe('5');
  });

  it('LK-200 a deep link /edits#<id> expands that record on load', async () => {
    route.set({ path: '/edits', query: {}, hash: '#rec-old' });
    await renderLogged();
    await flush();
    expect(bodyRows()[2].querySelectorAll('td')).toHaveLength(1);
    expect(location.hash).toBe('#rec-old');
  });

  it('LK-201 shows "Aucune donnée" when there is no edit', async () => {
    fetchMock.mockImplementation(async () => new Response('[]'));
    accessToken.set('jwt-1');
    user.set('bob@example.org');
    render(EditsList);
    await waitFor(() => expect(document.body.textContent).toContain('Aucune donnée'));
    expect(document.querySelector('table')).toBeNull();
  });
});
