// Inventory zone IN, MatchIDHeader.svelte (rows IN-002 .. IN-057).
//
// The header contains markup that Svelte 5 refuses to compile (`<tr>/<td>`
// directly inside `<a>`, lines ~84/118/317/351, and an unbalanced `<div>` at
// ~266). The structural assertions below (roles, accessible names, hrefs,
// texts, menu ids) pin the behaviour so that the markup rewrite cannot change
// it silently. They intentionally do not assert the `<tr>/<td>` elements.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';

vi.mock('../../../src/components/tools/search.js', async (importOriginal) => ({
  ...(await importOriginal()),
  toggleAdvancedSearch: vi.fn(),
  enableDisplayMode: vi.fn()
}));
vi.mock('../../../src/components/tools/routes.js', async (importOriginal) => ({
  ...(await importOriginal()),
  goTo: vi.fn()
}));

const { default: MatchIDHeader } = await import('../../../src/components/views/MatchIDHeader.svelte');
const { goTo } = await import('../../../src/components/tools/routes.js');
const { toggleAdvancedSearch, enableDisplayMode } = await import('../../../src/components/tools/search.js');
const stores = await import('../../../src/components/tools/stores.js');
const { icons } = await import('../../../src/components/tools/icons.js');
const { resetStores, loginAs, mockFetch, ADMIN_USER } = await import('./helpers.js');
const { route, themeDnum, advancedSearch, displayMode, wasSearched, firstSearch } = stores;

const desktopNav = (container) => container.querySelector('[role="navigation"][aria-label="Menu principal"]');
const mobileNav = (container) => container.querySelector('nav[aria-label="Menu mobile"]');
const popin = (container) => container.querySelector('#header-nav-popin');
const searchItem = (container) => desktopNav(container).querySelector('li.rf-nav__item--hoverable');
const searchButton = (container) => within(desktopNav(container)).getByRole('button', { name: 'Recherche' });
const adminButton = (container) => desktopNav(container).querySelector('button[aria-controls="rf-admin"]');
const viewLinks = (scope) => [...scope.querySelectorAll('a[arial-label^="mode d\'affichage"], a[aria-label^="mode d\'affichage"]')];
// compare inline SVG icons by their path data (serialisation differs)
const iconPaths = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return [...div.querySelectorAll('path')].map(p => p.getAttribute('d'));
};
const statsEntry = (scope) => scope.querySelector('a[title="Statistiques"]');
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

const renderHeader = (path = '/search') => {
  route.set({ path, query: {} });
  return render(MatchIDHeader);
};

describe('MatchIDHeader', () => {
  beforeEach(() => {
    resetStores();
    mockFetch();
  });

  describe('brand and service title', () => {
    it('IN-002 public theme shows the matchID logo (64px) and no brand link', () => {
      const { container } = renderHeader();
      const logo = screen.getByAltText('matchID Logo');
      expect(logo.getAttribute('src')).toBe('/favicon.svg');
      expect(logo.getAttribute('width')).toBe('64px');
      expect(logo.getAttribute('height')).toBe('64px');
      expect(container.querySelector('a.rf-logo')).toBeNull();
      expect(screen.queryByAltText('DNUM Logo')).toBeNull();
    });

    it('IN-003 DNUM theme shows the "Ministère de l\'Intérieur" brand link and the round DNUM logo (80px)', () => {
      themeDnum.set(1);
      const { container } = renderHeader();
      const brand = container.querySelector('a.rf-logo');
      expect(brand).not.toBeNull();
      const title = brand.querySelector('.rf-logo__title');
      expect(title.innerHTML).toContain('Ministère<br>de l\'Intérieur');
      const logo = screen.getByAltText('DNUM Logo');
      expect(logo.getAttribute('src')).toBe('/dnum-logo-round.svg');
      expect(logo.getAttribute('width')).toBe('80px');
      expect(screen.queryByAltText('matchID Logo')).toBeNull();
    });

    it('IN-004 DNUM brand link on /search resets the search (firstSearch, wasSearched) and reloads /search', async () => {
      themeDnum.set(1);
      const { container } = renderHeader('/search');
      firstSearch.set(false);
      wasSearched.set('dupont');
      await fireEvent.click(container.querySelector('a.rf-logo'));
      expect(get(firstSearch)).toBe(true);
      expect(get(wasSearched)).toBeUndefined();
      expect(goTo).toHaveBeenCalledWith({ path: '/search', query: {} });
      expect(toggleAdvancedSearch).not.toHaveBeenCalled();
      expect(enableDisplayMode).not.toHaveBeenCalled();
    });

    it('IN-004 DNUM brand link keeps the advanced mode when resetting the search', async () => {
      themeDnum.set(1);
      advancedSearch.set(true);
      const { container } = renderHeader('/search');
      await fireEvent.click(container.querySelector('a.rf-logo'));
      expect(goTo).toHaveBeenCalledWith({ path: '/search', query: { advanced: true } });
    });

    it('IN-004 DNUM brand link from another route only navigates to /search (no reset)', async () => {
      themeDnum.set(1);
      const { container } = renderHeader('/about');
      wasSearched.set('dupont');
      await fireEvent.click(container.querySelector('a.rf-logo'));
      expect(goTo).toHaveBeenCalledWith({ path: '/search' });
      expect(get(wasSearched)).toBe('dupont');
    });

    it('IN-005 brand link href is /search, or /search?advanced=true in advanced mode', async () => {
      themeDnum.set(1);
      const { container } = renderHeader();
      expect(container.querySelector('a.rf-logo').getAttribute('href')).toBe('/search');
      advancedSearch.set(true);
      await waitFor(() => expect(container.querySelector('a.rf-logo').getAttribute('href')).toBe('/search?advanced=true'));
    });

    it('IN-006 brand link title replaces the first <br> by a space', () => {
      themeDnum.set(1);
      const { container } = renderHeader();
      expect(container.querySelector('a.rf-logo').getAttribute('title')).toBe('Ministère de l\'Intérieur');
    });

    it('IN-007 service title "Fichier des décès" with its tooltip', () => {
      const { container } = renderHeader();
      const title = container.querySelector('.rf-service__title');
      expect(text(title)).toBe('Fichier des décès');
      expect(title.getAttribute('title')).toBe('matchID - moteur de recherche des personnes décédées');
    });

    it('IN-008 tagline "Recherche libre parmi 27 millions de décès" with "libre" hidden on mobile', () => {
      const { container } = renderHeader();
      const tagline = container.querySelector('.rf-service__tagline');
      expect(text(tagline)).toMatch(/^Recherche libre parmi 27 millions de décès/);
      expect(text(tagline.querySelector('strong'))).toBe('27 millions de décès');
      const hidden = [...tagline.querySelectorAll('.rf-hide--mobile')].map(text);
      expect(hidden).toContain('libre');
    });

    it('IN-009 tagline suffix "depuis 1970" (hidden on mobile) only in the public theme', async () => {
      const { container } = renderHeader();
      const tagline = () => container.querySelector('.rf-service__tagline');
      expect([...tagline().querySelectorAll('.rf-hide--mobile')].map(text)).toEqual(['libre', 'depuis 1970']);
      themeDnum.set(1);
      await waitFor(() => expect(text(tagline())).not.toContain('depuis 1970'));
    });
  });

  describe('desktop "Recherche" dropdown', () => {
    it('IN-011 button toggles the dropdown, aria-expanded mirrors it, aria-controls="rf-recherche"', async () => {
      const { container } = renderHeader();
      const button = searchButton(container);
      const menu = container.querySelector('#rf-recherche');
      expect(button.getAttribute('aria-controls')).toBe('rf-recherche');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(menu.classList.contains('rf-menu--expanded')).toBe(false);
      await fireEvent.click(button);
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(menu.classList.contains('rf-menu--expanded')).toBe(true);
      await fireEvent.click(button);
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(menu.classList.contains('rf-menu--expanded')).toBe(false);
    });

    it('IN-010 hovering the "Recherche" item opens the dropdown, leaving closes it (unit check of the handlers)', async () => {
      const { container } = renderHeader();
      await fireEvent.mouseEnter(searchItem(container));
      expect(searchButton(container).getAttribute('aria-expanded')).toBe('true');
      await fireEvent.mouseLeave(searchItem(container));
      expect(searchButton(container).getAttribute('aria-expanded')).toBe('false');
    });

    it('IN-012 keyboard focus inside the desktop search menu opens it, focus elsewhere closes it', async () => {
      const { container } = renderHeader();
      const simple = within(container.querySelector('#rf-recherche')).getByRole('link', { name: 'recherche Simple' });
      simple.focus();
      await waitFor(() => expect(searchButton(container).getAttribute('aria-expanded')).toBe('true'));
      within(desktopNav(container)).getByText('Appariement').focus();
      await waitFor(() => expect(searchButton(container).getAttribute('aria-expanded')).toBe('false'));
    });

    it('IN-012 focus in the mobile popin collapses the shared search submenu (expandMenu.search is shared)', async () => {
      const { container } = renderHeader();
      const mobileButton = within(mobileNav(container)).getByRole('button', { name: 'Recherche' });
      await fireEvent.click(mobileButton);
      expect(mobileButton.getAttribute('aria-expanded')).toBe('true');
      within(mobileNav(container)).getByText('À propos').focus();
      await waitFor(() => expect(mobileButton.getAttribute('aria-expanded')).toBe('false'));
    });

    it('IN-013 / IN-014 search modes are two links with accessible names, icons and texts', () => {
      const { container } = renderHeader();
      const menu = container.querySelector('#rf-recherche');
      expect(text(menu.querySelector('li strong'))).toBe('Mode de recherche');
      const simple = within(menu).getByRole('link', { name: 'recherche Simple' });
      const advanced = within(menu).getByRole('link', { name: 'recherche Avancé' });
      expect(text(simple)).toBe('Simple');
      expect(text(advanced)).toBe('Avancé');
      expect(simple.querySelector('svg')).not.toBeNull();
      expect(advanced.querySelector('svg')).not.toBeNull();
      expect(simple.closest('li').classList.contains('rf-href')).toBe(true);
    });

    it('IN-013 "Simple" on /search toggles the simple mode without navigating', async () => {
      const { container } = renderHeader('/search');
      await fireEvent.click(within(container.querySelector('#rf-recherche')).getByRole('link', { name: 'recherche Simple' }));
      expect(toggleAdvancedSearch).toHaveBeenCalledWith(false);
      expect(goTo).not.toHaveBeenCalled();
    });

    it('IN-013 "Simple" from another route first navigates to /search', async () => {
      const { container } = renderHeader('/about');
      await fireEvent.click(within(container.querySelector('#rf-recherche')).getByRole('link', { name: 'recherche Simple' }));
      expect(goTo).toHaveBeenCalledWith({ path: '/search' });
      expect(toggleAdvancedSearch).toHaveBeenCalledWith(false);
      expect(goTo.mock.invocationCallOrder[0]).toBeLessThan(toggleAdvancedSearch.mock.invocationCallOrder[0]);
    });

    it('IN-014 "Avancé" toggles the advanced mode', async () => {
      const { container } = renderHeader('/search');
      await fireEvent.click(within(container.querySelector('#rf-recherche')).getByRole('link', { name: 'recherche Avancé' }));
      expect(toggleAdvancedSearch).toHaveBeenCalledWith(true);
    });

    it('IN-015 the current search mode is highlighted, only on /search', async () => {
      const { container } = renderHeader('/search');
      const items = () => [...container.querySelectorAll('#rf-recherche li')]
        .filter(li => li.querySelector('a[aria-label^="recherche"]'));
      const active = () => items().map(li => li.classList.contains('rf-menu__item--active'));
      expect(active()).toEqual([true, false]);
      advancedSearch.set(true);
      await waitFor(() => expect(active()).toEqual([false, true]));
      route.set({ path: '/about', query: {} });
      await waitFor(() => expect(active()).toEqual([false, false]));
    });

    it('IN-016 search-mode hrefs add or remove "&advanced=true" on the current URL', () => {
      window.history.replaceState({}, '', '/search?q=dupont&advanced=true');
      const { container } = renderHeader();
      const menu = container.querySelector('#rf-recherche');
      expect(within(menu).getByRole('link', { name: 'recherche Simple' }).getAttribute('href'))
        .toBe(`${location.origin}/search?q=dupont`);
      expect(within(menu).getByRole('link', { name: 'recherche Avancé' }).getAttribute('href'))
        .toBe(`${location.origin}/search?q=dupont&advanced=true`);
    });

    // BUG: on a URL without query string the "Avancé" href becomes
    // `/search&advanced=true` (no `?`), a broken link for open-in-new-tab.
    it.fails('IN-016 BUG: "Avancé" href is a valid URL when the current URL has no query string', () => {
      window.history.replaceState({}, '', '/search');
      const { container } = renderHeader();
      const href = within(container.querySelector('#rf-recherche')).getByRole('link', { name: 'recherche Avancé' }).getAttribute('href');
      expect(new URL(href).pathname).toBe('/search');
    });

    it('IN-017 "Mode d\'affichage" is greyed unless on /search after a search', async () => {
      const { container } = renderHeader('/search');
      const heading = () => [...container.querySelectorAll('#rf-recherche li')].find(li => text(li) === 'Mode d\'affichage');
      expect(heading().classList.contains('rf-inactive')).toBe(true);
      expect(viewLinks(container.querySelector('#rf-recherche')).every(a => a.closest('li').classList.contains('rf-inactive'))).toBe(true);
      wasSearched.set('dupont');
      await waitFor(() => expect(heading().classList.contains('rf-inactive')).toBe(false));
      expect(viewLinks(container.querySelector('#rf-recherche')).every(a => a.closest('li').classList.contains('rf-href'))).toBe(true);
      route.set({ path: '/about', query: {} });
      await waitFor(() => expect(heading().classList.contains('rf-inactive')).toBe(true));
    });

    it('IN-018 .. IN-022 five display modes, each calling enableDisplayMode with its mode', async () => {
      const { container } = renderHeader('/search');
      wasSearched.set('dupont');
      await waitFor(() => expect(container.querySelector('#rf-recherche li.rf-inactive')).toBeNull());
      const links = viewLinks(container.querySelector('#rf-recherche'));
      expect(links.map(text)).toEqual(['Simple', 'Complet', 'Tableur', 'Statistiques', 'Géographique']);
      expect(links.every(a => a.querySelector('svg'))).toBe(true);
      for (const link of links) {
        await fireEvent.click(link);
      }
      expect(enableDisplayMode.mock.calls.map(c => c[0])).toEqual(['card', 'card-expand', 'table', 'agg', 'geo']);
      expect(goTo).not.toHaveBeenCalled();
    });

    it('IN-023 display-mode links are inert while the section is inactive', async () => {
      const { container } = renderHeader('/search');
      for (const link of viewLinks(container.querySelector('#rf-recherche'))) {
        await fireEvent.click(link);
      }
      expect(enableDisplayMode).not.toHaveBeenCalled();
      expect(goTo).not.toHaveBeenCalled();
    });

    it('IN-024 the current display mode is highlighted from $displayMode', async () => {
      const { container } = renderHeader('/search');
      const active = () => viewLinks(container.querySelector('#rf-recherche'))
        .map(a => a.closest('li').classList.contains('rf-menu__item--active'));
      expect(active()).toEqual([true, false, false, false, false]);
      displayMode.set('table');
      await waitFor(() => expect(active()).toEqual([false, false, true, false, false]));
      displayMode.set('geo');
      await waitFor(() => expect(active()).toEqual([false, false, false, false, true]));
    });

    it('IN-025 display-mode hrefs rewrite the view= query parameter', () => {
      window.history.replaceState({}, '', '/search?q=dupont&view=geo');
      const { container } = renderHeader();
      const hrefs = viewLinks(container.querySelector('#rf-recherche')).map(a => a.getAttribute('href').replace(location.origin, ''));
      expect(hrefs).toEqual([
        '/search?q=dupont',
        '/search?view=card-expand&q=dupont',
        '/search?view=table&q=dupont',
        '/search?view=agg&q=dupont',
        '/search?view=geo&q=dupont'
      ]);
    });

    // BUG: the display-mode links use the misspelled attribute `arial-label`
    // (MatchIDHeader.svelte:111, 344), so they have no aria-label.
    it.fails('IN-026 BUG: display-mode links expose an aria-label "mode d\'affichage <mode>"', () => {
      const { container } = renderHeader();
      within(container.querySelector('#rf-recherche')).getByRole('link', { name: 'mode d\'affichage Tableur' });
    });

    it('IN-026 display-mode links currently carry the misspelled "arial-label" attribute (pinned)', () => {
      const { container } = renderHeader();
      const links = viewLinks(container.querySelector('#rf-recherche'));
      expect(links).toHaveLength(5);
      expect(links.every(a => a.hasAttribute('arial-label') && !a.hasAttribute('aria-label'))).toBe(true);
    });
  });

  describe('desktop navigation links', () => {
    it('IN-027 "Appariement" links to /link, navigates with goTo and is active on /link', async () => {
      const { container } = renderHeader('/link');
      const link = within(desktopNav(container)).getByRole('link', { name: 'Appariement' });
      expect(link.getAttribute('href')).toBe('/link');
      expect(link.closest('li').classList.contains('rf-nav__item--active')).toBe(true);
      await fireEvent.click(link);
      expect(goTo).toHaveBeenCalledWith({ path: '/link' });
    });

    it('IN-028 "À propos" links to /about, navigates with goTo and is active on /about', async () => {
      const { container } = renderHeader('/about');
      const link = within(desktopNav(container)).getByRole('link', { name: 'À propos' });
      expect(link.getAttribute('href')).toBe('/about');
      expect(link.closest('li').classList.contains('rf-nav__item--active')).toBe(true);
      expect(within(desktopNav(container)).getByRole('link', { name: 'Appariement' }).closest('li').classList.contains('rf-nav__item--active')).toBe(false);
      await fireEvent.click(link);
      expect(goTo).toHaveBeenCalledWith({ path: '/about' });
    });

    it('IN-029 active-route highlighting is suppressed while the Login modal is open', async () => {
      const { container } = renderHeader('/about');
      const about = () => within(desktopNav(container)).getByRole('link', { name: 'À propos' }).closest('li');
      expect(about().classList.contains('rf-nav__item--active')).toBe(true);
      await fireEvent.click(within(desktopNav(container)).getByRole('link', { name: 'S\'identifier' }));
      await waitFor(() => expect(about().classList.contains('rf-nav__item--active')).toBe(false));
    });

    it('IN-029 active-route highlighting is suppressed while the API Key modal is open', async () => {
      loginAs('bob@example.org');
      const { container } = renderHeader('/link');
      const link = () => within(desktopNav(container)).getByRole('link', { name: 'Appariement' }).closest('li');
      expect(link().classList.contains('rf-nav__item--active')).toBe(true);
      await fireEvent.click(within(desktopNav(container)).getByRole('link', { name: 'API Key' }));
      await waitFor(() => expect(link().classList.contains('rf-nav__item--active')).toBe(false));
    });
  });

  describe('desktop user menu', () => {
    it('IN-030 user icon: ri:user-line when anonymous, ri:user-follow-line when logged in', async () => {
      const { container } = renderHeader();
      const iconHtml = () => adminButton(container).innerHTML;
      const anonymous = iconHtml();
      loginAs('bob@example.org');
      await waitFor(() => expect(iconHtml()).not.toBe(anonymous));
      expect(iconPaths(anonymous).length).toBeGreaterThan(0);
      expect(iconPaths(anonymous)).toEqual(iconPaths(icons['ri:user-line']));
      expect(iconPaths(iconHtml())).toEqual(iconPaths(icons['ri:user-follow-line']));
    });

    it('IN-031 admin indicator: circular text with the admin user around the icon, absent for a plain user', async () => {
      loginAs('bob@example.org');
      const { container } = renderHeader();
      await waitFor(() => expect(within(adminButton(container)).queryByText('bob@example.org')).toBeNull());
      loginAs(ADMIN_USER);
      await waitFor(() => expect(adminButton(container).querySelector('svg title')).not.toBeNull());
      expect(adminButton(container).querySelector('svg title').textContent).toBe(ADMIN_USER);
      expect(adminButton(container).querySelector('textPath').textContent.trim()).toBe(ADMIN_USER);
    });

    it('IN-032 user dropdown: click toggles, hover opens/closes, aria-controls="rf-admin"', async () => {
      const { container } = renderHeader();
      const button = adminButton(container);
      const menu = container.querySelector('#rf-admin');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      await fireEvent.click(button);
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(menu.classList.contains('rf-menu--expanded')).toBe(true);
      await fireEvent.click(button);
      expect(menu.classList.contains('rf-menu--expanded')).toBe(false);
      await fireEvent.mouseEnter(button.closest('li'));
      expect(button.getAttribute('aria-expanded')).toBe('true');
      await fireEvent.mouseLeave(button.closest('li'));
      expect(button.getAttribute('aria-expanded')).toBe('false');
    });

    it('IN-033 "S\'identifier" (href /logout) opens the Login modal', async () => {
      renderHeader();
      expect(screen.queryByText('Connexion')).toBeNull();
      const login = within(screen.getByRole('navigation', { name: 'Menu principal' })).getByRole('link', { name: 'S\'identifier' });
      expect(login.getAttribute('href')).toBe('/logout');
      expect(login.getAttribute('title')).toBe('S\'identifier');
      await fireEvent.click(login);
      expect(await screen.findByText('Connexion')).toBeTruthy();
      expect(screen.getByLabelText('Courriel')).toBeTruthy();
    });

    it('IN-034 the entry reads "Se déconnecter" when logged in and still opens the Login modal', async () => {
      loginAs('bob@example.org');
      const { container } = renderHeader();
      const logout = within(desktopNav(container)).getByRole('link', { name: 'Se déconnecter' });
      expect(logout.getAttribute('title')).toBe('Se déconnecter');
      expect(within(desktopNav(container)).queryByRole('link', { name: 'S\'identifier' })).toBeNull();
      await fireEvent.click(logout);
      expect(await screen.findByText('Connexion')).toBeTruthy();
    });

    it('IN-035 / IN-036 / IN-037 "Corrections", "API Key" and "Appariements" entries only when logged in', async () => {
      const { container } = renderHeader();
      const nav = () => within(desktopNav(container));
      expect(nav().queryByRole('link', { name: 'Corrections' })).toBeNull();
      expect(nav().queryByRole('link', { name: 'API Key' })).toBeNull();
      expect(nav().queryByRole('link', { name: 'Appariements' })).toBeNull();
      loginAs('bob@example.org');
      await waitFor(() => expect(nav().queryByRole('link', { name: 'Corrections' })).not.toBeNull());
      expect(nav().getByRole('link', { name: 'Corrections' }).getAttribute('href')).toBe('/edits');
      expect(nav().getByRole('link', { name: 'API Key' }).getAttribute('href')).toBe('/api-key');
      expect(nav().getByRole('link', { name: 'Appariements' }).getAttribute('href')).toBe('/jobs');
      await fireEvent.click(nav().getByRole('link', { name: 'Corrections' }));
      expect(goTo).toHaveBeenLastCalledWith({ path: '/edits' });
      await fireEvent.click(nav().getByRole('link', { name: 'Appariements' }));
      expect(goTo).toHaveBeenLastCalledWith({ path: '/jobs' });
    });

    it('IN-036 "API Key" opens the APIKey modal', async () => {
      loginAs('bob@example.org');
      const { container } = renderHeader();
      await fireEvent.click(within(desktopNav(container)).getByRole('link', { name: 'API Key' }));
      expect(await screen.findByText('Votre clé d\'API')).toBeTruthy();
      expect(goTo).not.toHaveBeenCalled();
    });

    it('IN-038 desktop "Statistiques" (/stats) only for the admin', async () => {
      loginAs('bob@example.org');
      const { container } = renderHeader();
      await waitFor(() => expect(within(desktopNav(container)).queryByRole('link', { name: 'Corrections' })).not.toBeNull());
      expect(statsEntry(desktopNav(container))).toBeNull();
      loginAs(ADMIN_USER);
      await waitFor(() => expect(statsEntry(desktopNav(container))).not.toBeNull());
      const stats = statsEntry(desktopNav(container));
      expect(text(stats)).toBe('Statistiques');
      expect(stats.getAttribute('href')).toBe('/stats');
      await fireEvent.click(stats);
      expect(goTo).toHaveBeenLastCalledWith({ path: '/stats' });
    });

    it('IN-039 the user nav item is highlighted on /jobs and /edits, not on /stats', async () => {
      const { container } = renderHeader('/jobs');
      const item = () => adminButton(container).closest('li');
      expect(item().classList.contains('rf-nav__item--active')).toBe(true);
      route.set({ path: '/edits', query: {} });
      await waitFor(() => expect(item().classList.contains('rf-nav__item--active')).toBe(true));
      route.set({ path: '/stats', query: {} });
      await waitFor(() => expect(item().classList.contains('rf-nav__item--active')).toBe(false));
    });
  });

  describe('mobile burger and popin', () => {
    it('IN-040 burger button: title "ouvrir le menu", aria-controls="header-nav-popin", hidden on desktop', () => {
      renderHeader();
      const burger = screen.getByTitle('ouvrir le menu');
      expect(burger.tagName).toBe('BUTTON');
      expect(burger.getAttribute('aria-controls')).toBe('header-nav-popin');
      expect(burger.closest('.rf-hide--desktop')).not.toBeNull();
      // no aria-expanded on the burger today (a11y gap noted in the inventory)
      expect(burger.hasAttribute('aria-expanded')).toBe(false);
    });

    it('IN-041 burger toggles the popin expanded class', async () => {
      const { container } = renderHeader();
      expect(popin(container).classList.contains('rf-header__popin--expanded')).toBe(false);
      expect(popin(container).classList.contains('rf-hide--desktop')).toBe(true);
      await fireEvent.click(screen.getByTitle('ouvrir le menu'));
      expect(popin(container).classList.contains('rf-header__popin--expanded')).toBe(true);
      await fireEvent.click(screen.getByTitle('ouvrir le menu'));
      expect(popin(container).classList.contains('rf-header__popin--expanded')).toBe(false);
    });

    it('IN-042 popin "Fermer" button closes it', async () => {
      const { container } = renderHeader();
      await fireEvent.click(screen.getByTitle('ouvrir le menu'));
      const close = within(popin(container)).getByTitle('Fermer');
      expect(close.getAttribute('aria-controls')).toBe('header-nav-popin');
      expect(text(close)).toBe('Fermer');
      await fireEvent.click(close);
      expect(popin(container).classList.contains('rf-header__popin--expanded')).toBe(false);
    });

    it('IN-043 mobile "Recherche" submenu toggle with aria-expanded / aria-controls="rf-recherche-popin"', async () => {
      const { container } = renderHeader();
      const nav = mobileNav(container);
      const button = within(nav).getByRole('button', { name: 'Recherche' });
      const li = button.closest('li');
      expect(li.getAttribute('aria-controls')).toBe('rf-recherche-popin');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      await fireEvent.click(button);
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(li.getAttribute('aria-expanded')).toBe('true');
      expect(nav.querySelector('#rf-recherche-popin').classList.contains('rf-menu--expanded')).toBe(true);
      // the desktop and mobile submenus share the same state
      expect(searchButton(container).getAttribute('aria-expanded')).toBe('true');
    });

    it('IN-044 mobile search modes Simple / Avancé with the same names and actions as desktop', async () => {
      const { container } = renderHeader('/search');
      const menu = mobileNav(container).querySelector('#rf-recherche-popin');
      const simple = within(menu).getByRole('link', { name: 'recherche Simple' });
      const advanced = within(menu).getByRole('link', { name: 'recherche Avancé' });
      expect(text(simple)).toBe('Simple');
      expect(text(advanced)).toBe('Avancé');
      await fireEvent.click(advanced);
      await fireEvent.click(simple);
      expect(toggleAdvancedSearch.mock.calls).toEqual([[true], [false]]);
    });

    it('IN-045 mobile display modes: 5 entries, inert while inactive, active after a search', async () => {
      const { container } = renderHeader('/search');
      const menu = mobileNav(container).querySelector('#rf-recherche-popin');
      const links = viewLinks(menu);
      expect(links.map(text)).toEqual(['Simple', 'Complet', 'Tableur', 'Statistiques', 'Géographique']);
      await fireEvent.click(links[2]);
      expect(enableDisplayMode).not.toHaveBeenCalled();
      wasSearched.set('dupont');
      await waitFor(() => expect(menu.querySelector('li.rf-inactive')).toBeNull());
      await fireEvent.click(viewLinks(menu)[2]);
      expect(enableDisplayMode).toHaveBeenCalledWith('table');
    });

    it('IN-046 / IN-047 mobile "Appariement" (/link, db icon) and "À propos" (/about) links', async () => {
      const { container } = renderHeader();
      const nav = within(mobileNav(container));
      const link = nav.getByRole('link', { name: 'Appariement' });
      expect(link.getAttribute('href')).toBe('/link');
      expect(link.classList.contains('rf-fi-db-line')).toBe(true);
      const about = nav.getByRole('link', { name: 'À propos' });
      expect(about.getAttribute('href')).toBe('/about');
      await fireEvent.click(link);
      expect(goTo).toHaveBeenLastCalledWith({ path: '/link' });
      await fireEvent.click(about);
      expect(goTo).toHaveBeenLastCalledWith({ path: '/about' });
    });

    it('IN-048 mobile user submenu toggle (aria-controls="rf-admin-popin")', async () => {
      const { container } = renderHeader();
      const nav = mobileNav(container);
      const li = nav.querySelector('li[aria-controls="rf-admin-popin"]');
      const button = li.querySelector('button');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      await fireEvent.click(button);
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(li.getAttribute('aria-expanded')).toBe('true');
      expect(nav.querySelector('#rf-admin-popin').classList.contains('rf-menu--expanded')).toBe(true);
    });

    it('IN-049 mobile "S\'identifier" / "Se déconnecter" opens the Login modal', async () => {
      const { container } = renderHeader();
      await fireEvent.click(within(mobileNav(container)).getByRole('link', { name: 'S\'identifier' }));
      expect(await screen.findByText('Connexion')).toBeTruthy();
    });

    it('IN-050 mobile "Corrections" and "API Key" only when logged in', async () => {
      const { container } = renderHeader();
      const nav = () => within(mobileNav(container));
      expect(nav().queryByRole('link', { name: 'Corrections' })).toBeNull();
      expect(nav().queryByRole('link', { name: 'API Key' })).toBeNull();
      loginAs('bob@example.org');
      await waitFor(() => expect(nav().queryByRole('link', { name: 'Corrections' })).not.toBeNull());
      expect(nav().getByRole('link', { name: 'Corrections' }).getAttribute('href')).toBe('/edits');
      expect(nav().getByRole('link', { name: 'API Key' }).getAttribute('href')).toBe('/api-key');
      expect(nav().getByRole('link', { name: 'Se déconnecter' })).toBeTruthy();
    });

    // Divergence pinned as is (to decide during the migration): the mobile
    // "Appariements" entry requires $admin while the desktop one requires $user.
    it('IN-051 mobile "Appariements" (/jobs) only for the admin, desktop for any user (pinned divergence)', async () => {
      loginAs('bob@example.org');
      const { container } = renderHeader();
      await waitFor(() => expect(within(mobileNav(container)).queryByRole('link', { name: 'Corrections' })).not.toBeNull());
      expect(within(mobileNav(container)).queryByRole('link', { name: 'Appariements' })).toBeNull();
      expect(within(desktopNav(container)).queryByRole('link', { name: 'Appariements' })).not.toBeNull();
      loginAs(ADMIN_USER);
      const jobs = await within(mobileNav(container)).findByRole('link', { name: 'Appariements' });
      expect(jobs.getAttribute('href')).toBe('/jobs');
    });

    it('IN-052 mobile "Statistiques" (admin) has href /stats and navigates to /stats', async () => {
      loginAs(ADMIN_USER);
      const { container } = renderHeader();
      await waitFor(() => expect(statsEntry(mobileNav(container))).not.toBeNull());
      const stats = statsEntry(mobileNav(container));
      expect(stats.getAttribute('href')).toBe('/stats');
      await fireEvent.click(stats);
      expect(goTo).toHaveBeenLastCalledWith({ path: '/stats' });
    });
  });

  describe('navigation side effects and modals', () => {
    it('IN-053 any header navigation closes the burger and collapses both dropdowns', async () => {
      const { container } = renderHeader('/search');
      await fireEvent.click(screen.getByTitle('ouvrir le menu'));
      await fireEvent.click(searchButton(container));
      await fireEvent.click(adminButton(container));
      expect(popin(container).classList.contains('rf-header__popin--expanded')).toBe(true);
      expect(searchButton(container).getAttribute('aria-expanded')).toBe('true');
      expect(adminButton(container).getAttribute('aria-expanded')).toBe('true');
      await fireEvent.click(within(mobileNav(container)).getByRole('link', { name: 'À propos' }));
      expect(popin(container).classList.contains('rf-header__popin--expanded')).toBe(false);
      expect(searchButton(container).getAttribute('aria-expanded')).toBe('false');
      expect(adminButton(container).getAttribute('aria-expanded')).toBe('false');
    });

    it('IN-053 search-mode clicks also close the menus', async () => {
      const { container } = renderHeader('/search');
      await fireEvent.click(searchButton(container));
      await fireEvent.click(within(container.querySelector('#rf-recherche')).getByRole('link', { name: 'recherche Avancé' }));
      expect(searchButton(container).getAttribute('aria-expanded')).toBe('false');
    });

    it('IN-054 on /search a display-mode click does not re-navigate, it only switches the mode', async () => {
      const { container } = renderHeader('/search');
      wasSearched.set('dupont');
      await waitFor(() => expect(container.querySelector('#rf-recherche li.rf-inactive')).toBeNull());
      await fireEvent.click(viewLinks(container.querySelector('#rf-recherche'))[3]);
      expect(enableDisplayMode).toHaveBeenCalledWith('agg');
      expect(goTo).not.toHaveBeenCalled();
      expect(toggleAdvancedSearch).not.toHaveBeenCalled();
    });

    it('IN-055 the header mounts the Login, APIKey and ProofViewer modals (closed by default)', async () => {
      const { container } = renderHeader();
      expect(container.querySelector('.modal')).toBeNull();
      stores.showProof.set('/proof.pdf');
      const viewer = await screen.findByTitle('Visualisateur');
      expect(viewer.getAttribute('data')).toBe('/proof.pdf');
      stores.showProof.set(undefined);
    });
  });
});

describe('build-time theme', () => {
  it('IN-057 the default theme comes from the THEME_DNUM build placeholder (0 = public in tests)', async () => {
    vi.resetModules();
    const fresh = await import('../../../src/components/tools/stores.js');
    expect(get(fresh.themeDnum)).toBe(0);
    expect(get(fresh.alphaFeatures)).toBe(true);
  });
});
