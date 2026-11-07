import { describe, expect, it, vi } from 'vitest';
import { render, within } from '@testing-library/svelte';
import MatchIDHeader from '../../src/components/views/MatchIDHeader.svelte';
import { accessToken, user, route } from '../../src/components/tools/stores.js';

const loginAsAdmin = () => {
  // Login.svelte (mounted by the header) derives `admin` from these stores
  // and re-reads them from localStorage on mount.
  const adminUser = 'admin@example.org'; // __BACKEND_TOKEN_USER__ in vitest.config.mjs
  localStorage.setItem('accessToken', JSON.stringify('token-admin'));
  localStorage.setItem('user', JSON.stringify(adminUser));
  accessToken.set('token-admin');
  user.set(adminUser);
  route.set({ path: '/search', query: {} });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
};

describe('MatchIDHeader', () => {
  // Regression: the mobile "Statistiques" entry pointed to /edits.
  it('links the admin "Statistiques" entry to /stats in both desktop and mobile menus', () => {
    loginAsAdmin();
    const { container } = render(MatchIDHeader);
    const mobileMenu = container.querySelector('nav[aria-label="Menu mobile"]');
    expect(mobileMenu).not.toBeNull();
    const statsLinks = [...container.querySelectorAll('a[title="Statistiques"]')];
    expect(statsLinks).toHaveLength(2);
    expect(statsLinks.map(a => a.getAttribute('href'))).toEqual(['/stats', '/stats']);
    expect(within(mobileMenu).getByTitle('Statistiques').getAttribute('href')).toBe('/stats');
  });
});
