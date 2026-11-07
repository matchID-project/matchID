import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

// The route callbacks call into search.js: replace them with spies so that
// these tests only exercise the router.
vi.mock('../../../src/components/tools/search.js', () => ({
  URLSearchSubmit: vi.fn(),
  getById: vi.fn()
}));

const tools = '../../../src/components/tools';

// The `route` store is parsed from `location` once, when routes.js is first
// imported: load fresh module instances for a given start URL.
const boot = async (url) => {
  window.history.replaceState({}, '', url);
  vi.resetModules();
  const stores = await import(`${tools}/stores.js`);
  const router = await import(`${tools}/routes.js`);
  const search = await import(`${tools}/search.js`);
  return { stores, router, search, route: () => get(stores.route) };
};

let app;

beforeEach(async () => {
  app = await boot('/search');
  app.search.URLSearchSubmit.mockClear();
  app.search.getById.mockClear();
});

describe('initial URL parsing', () => {
  it('CO-001 "/" is rewritten to "/search" without a reload', async () => {
    const before = history.length;
    const { route } = await boot('/');
    expect(location.pathname + location.search).toBe('/search');
    expect(route()).toMatchObject({ path: '/search', params: false, hash: '' });
    expect(history.length).toBe(before);
  });

  it('CO-001 "/?query" keeps the query string', async () => {
    const { route } = await boot('/?q=dupont+jean&view=table');
    expect(location.pathname + location.search).toBe('/search?q=dupont+jean&view=table');
    expect(route().query).toEqual({ q: 'dupont jean', view: 'table' });
  });

  it('CO-002 parses path, params, query and hash into the route store', async () => {
    let r = (await boot('/id/AbCdEfGhIjKl')).route();
    expect(r).toMatchObject({ path: '/id', params: ['AbCdEfGhIjKl'], hash: '' });
    r = (await boot('/search?ln=dupont&fn=jean#results')).route();
    expect(r).toEqual({ path: '/search', params: false, query: { ln: 'dupont', fn: 'jean' }, hash: '#results' });
    r = (await boot('/about')).route();
    expect(r).toMatchObject({ path: '/about', params: false, hash: '' });
    r = (await boot('/id/a/b')).route();
    expect(r.params).toEqual(['a', 'b']);
  });

  it('CO-002 without a query string, the whole href ends up as a query key (current behaviour)', async () => {
    const r = (await boot('/id/AbCdEfGhIjKl')).route();
    expect(r.query).toEqual({ [location.href]: '' });
  });

  // BUG: routes.js:56 falls back to `location.href.replace(/.*\?/, '')` when
  // there is no search string; without a '?' the replace is a no-op and the
  // full URL is parsed as a query key. route.query should be {}.
  it.fails('CO-002 BUG: a URL without query string gives an empty route query', async () => {
    expect((await boot('/about')).route().query).toEqual({});
  });

  it('CO-003 an unknown path is replaced by /notFound', async () => {
    const { route, router } = await boot('/this-page-does-not-exist?x=1');
    expect(location.pathname).toBe('/notFound');
    expect(route().path).toBe('/notFound');
    expect(router.routes['/notFound'].title).toBe('404 - Pas de page à l\'adresse indiquée');
  });

  it('CO-003 the 404 route renders the Default page with its title', async () => {
    const { router } = await boot('/nope');
    const notFound = router.routes['/notFound'];
    render(notFound.component, { props: notFound.props });
    expect(screen.getByRole('heading', { level: 2 }).textContent.trim()).toBe('Pas de page à l\'adresse indiquée');
  });

  it('CO-003 every declared route has a component, a title and a description', () => {
    const { routes } = app.router;
    expect(Object.keys(routes).sort()).toEqual(
      ['/', '/about', '/edits', '/explain', '/id', '/jobs', '/link', '/notFound', '/search', '/stats']
    );
    Object.values(routes).forEach(r => {
      expect(typeof r.component).toBe('function');
      expect(r.title).toBeTruthy();
      expect(r.desc).toBeTruthy();
    });
  });
});

describe('goTo', () => {
  it('CO-004 blurs the focused element and resets wasSearched', () => {
    const blur = vi.fn();
    app.stores.activeElement.set({ blur });
    app.stores.wasSearched.set('DUPONT');
    app.router.goTo({ path: '/about' });
    expect(blur).toHaveBeenCalledTimes(1);
    expect(get(app.stores.activeElement)).toBeUndefined();
    expect(get(app.stores.wasSearched)).toBe(false);
  });

  it('CO-004 works when nothing is focused', () => {
    app.stores.activeElement.set(undefined);
    expect(() => app.router.goTo({ path: '/about' })).not.toThrow();
  });

  it('CO-005 keeps only the whitelisted query keys of the target route', () => {
    app.router.goTo({
      path: '/search',
      query: { advanced: true, ln: 'dupont', q: 'dupont', size: 'n_50_n', current: 'n_2_n', accessToken: 'secret' }
    });
    // `q`, `size` and `current` are not in the /search whitelist (routes.js:37-39)
    expect(location.pathname + location.search).toBe('/search?advanced=true&ln=dupont');
  });

  it('CO-005 drops the whole query on routes without a whitelist', () => {
    app.router.goTo({ path: '/link', query: { ln: 'dupont' } });
    expect(location.pathname + location.search).toBe('/link');
  });

  it('CO-006 params build /path/a/b and the callback receives an empty query', () => {
    app.router.goTo({ path: '/id', params: ['AbCdEfGhIjKl'] });
    expect(location.pathname).toBe('/id/AbCdEfGhIjKl');
    expect(get(app.stores.route)).toEqual({ path: '/id', params: ['AbCdEfGhIjKl'] });
    // routes.js reads routes[path].params, but /id declares `pathArgs`
    expect(app.search.getById).toHaveBeenCalledWith({});
  });

  it('CO-007 /search calls URLSearchSubmit with the filtered query', () => {
    app.router.goTo({ path: '/search', query: { ln: 'dupont', fn: 'jean' } });
    expect(app.search.URLSearchSubmit).toHaveBeenCalledTimes(1);
    expect(`${app.search.URLSearchSubmit.mock.calls[0][0]}`).toBe('ln=dupont&fn=jean');
    app.router.goTo({ path: '/search' });
    expect(`${app.search.URLSearchSubmit.mock.calls[1][0]}`).toBe('');
  });

  it('CO-007 routes without a callback do not search', () => {
    app.router.goTo({ path: '/about' });
    app.router.goTo({ path: '/stats' });
    expect(app.search.URLSearchSubmit).not.toHaveBeenCalled();
    expect(app.search.getById).not.toHaveBeenCalled();
  });

  it('CO-008 an unknown path goes to /notFound without recursing or calling a callback', () => {
    expect(() => app.router.goTo({ path: 'search' })).not.toThrow();
    expect(get(app.stores.route).path).toBe('/notFound');
    expect(location.pathname).toBe('/notFound');
    expect(app.search.URLSearchSubmit).not.toHaveBeenCalled();
  });

  it('CO-009 navigation replaces the history entry (no pushState)', () => {
    const before = history.length;
    const pushState = vi.spyOn(window.history, 'pushState');
    app.router.goTo({ path: '/about' });
    app.router.goTo({ path: '/link' });
    app.router.goTo({ path: '/search', query: { ln: 'dupont' } });
    expect(history.length).toBe(before);
    expect(pushState).not.toHaveBeenCalled();
  });
});

describe('CO-010 authenticated routes', () => {
  const renderLogin = async (path) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const { default: Login } = await import('../../../src/components/views/Login.svelte');
    app.stores.route.set({ path });
    return render(Login);
  };

  it('CO-010 only /edits is flagged auth:true', () => {
    const authRoutes = Object.entries(app.router.routes).filter(([, r]) => r.auth).map(([p]) => p);
    expect(authRoutes).toEqual(['/edits']);
  });

  it('CO-010 an anonymous user on /edits gets the login modal', async () => {
    await renderLogin('/edits');
    expect(await screen.findByText('Connexion')).toBeTruthy();
    expect(screen.getByLabelText('Courriel')).toBeTruthy();
  });

  it('CO-010 no login modal on a public route', async () => {
    await renderLogin('/search');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.queryByText('Connexion')).toBeNull();
  });

  it('CO-010 a logged-in user on /edits gets no modal', async () => {
    localStorage.setItem('accessToken', JSON.stringify('jwt'));
    localStorage.setItem('user', JSON.stringify('someone@example.org'));
    await renderLogin('/edits');
    await waitFor(() => expect(get(app.stores.user)).toBe('someone@example.org'));
    expect(screen.queryByText('Connexion')).toBeNull();
  });

  // BUG: Login.svelte defines closeLogin() (redirect to the default route when
  // the login modal is closed on an auth route) but never passes it to
  // <Modal callback=...>, so closing the modal leaves the anonymous user on
  // /edits instead of redirecting to /search.
  it.fails('CO-010 BUG: closing the login modal on /edits redirects to /search', async () => {
    const { container } = await renderLogin('/edits');
    await screen.findByText('Connexion');
    await fireEvent.click(container.querySelector('.modal [style*="right: 26px"], .modal [style*="right:26px"]'));
    expect(get(app.stores.route).path).toBe('/search');
  });
});
