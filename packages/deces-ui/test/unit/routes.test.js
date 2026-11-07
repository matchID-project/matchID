import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

// The route table imports every page component; stub them so that this test
// only exercises the router logic.
vi.mock('../../src/components/tools/search.js', () => ({
  URLSearchSubmit: vi.fn(),
  getById: vi.fn()
}));

const { goTo, routes } = await import('../../src/components/tools/routes.js');
const { route } = await import('../../src/components/tools/stores.js');
const search = await import('../../src/components/tools/search.js');

describe('goTo', () => {
  it('navigates to a known route and rewrites the URL', () => {
    goTo({ path: '/about' });
    expect(get(route).path).toBe('/about');
    expect(location.pathname).toBe('/about');
  });

  it('keeps only the whitelisted query keys of the target route', () => {
    goTo({ path: '/search', query: { ln: 'dupont', fn: 'jean', accessToken: 'secret' } });
    expect(location.pathname + location.search).toBe('/search?ln=dupont&fn=jean');
    expect(search.URLSearchSubmit).toHaveBeenCalledTimes(1);
  });

  it('builds /id/<id> permalinks from route params', () => {
    goTo({ path: '/id', params: ['abc123'] });
    expect(location.pathname).toBe('/id/abc123');
    // Note: the route callback receives {} here, because goTo() reads
    // routes[path].params while the /id route declares `pathArgs`. No caller
    // uses goTo() for /id today (ShowId fetches the record itself).
    expect(search.getById).toHaveBeenCalledTimes(1);
  });

  // Regression: goTo({path: 'notFound'}) (missing leading slash) recursed
  // until "Maximum call stack size exceeded".
  it('redirects an unknown path to the 404 page without recursing', () => {
    expect(() => goTo({ path: '/does-not-exist' })).not.toThrow();
    expect(get(route).path).toBe('/notFound');
    expect(location.pathname).toBe('/notFound');
    expect(routes['/notFound']).toBeDefined();
  });
});
