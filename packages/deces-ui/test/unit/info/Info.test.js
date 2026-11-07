// Inventory zone IN, Default.svelte + Info.svelte (rows IN-061 .. IN-102).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { flush } from 'svelte/internal';

// AlgoDetails (embedded in a FAQ section) calls the backend compare API.
vi.mock('../../../src/components/tools/runRequest.js', async (importOriginal) => ({
  ...(await importOriginal()),
  runCompareRequest: vi.fn().mockResolvedValue(undefined)
}));

const { default: Info } = await import('../../../src/components/views/Info.svelte');
const { default: Default } = await import('../../../src/components/views/Default.svelte');
const { route, themeDnum, version } = await import('../../../src/components/tools/stores.js');
const { runCompareRequest } = await import('../../../src/components/tools/runRequest.js');
const { resetStores, mockFetch, setDsfrColors } = await import('./helpers.js');

const SECTION_IDS = [
  'a-qui-s-adresse-le-service',
  'qui-sommes-nous',
  'merci-pour-votre-soutien',
  'd-ou-proviennent-les-donnees',
  'quelles-sont-les-garanties-sur-les-donnees',
  'donnees-personnelles',
  'comment-sont-indexees-les-donnees',
  'deces-manquant',
  'donnees-erronnees',
  'signaler-un-bug',
  'suggerer-des-ameliorations-du-service',
  'developpeurs-utilisez-l-api',
  'algorithme-de-rapprochement-d-identites',
  'code-open-source',
  'statistiques-de-consultation'
];

const SECTION_TITLES = [
  'À qui s\'adresse le service ?',
  'Qui sommes nous ?',
  'Merci pour votre soutien !',
  'D\'où proviennent les données ?',
  'Quelles sont les garanties sur les données ?',
  'Données personnelles',
  'Comment sont indexées les données ?',
  'Décès manquant',
  'Données erronnées',
  'Signaler un bug',
  'Suggérer des améliorations du service',
  'Développeurs, utilisez l\'API',
  'Algorithme de rapprochement d\'identités',
  'Code open source',
  'Statistiques de consultation'
];

// closing a section waits for its slide outro (requestAnimationFrame based,
// slower when the whole suite runs in parallel)
const OUTRO = { timeout: 5000 };

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const sectionIds = (container) => [...container.querySelectorAll('.rf-card')].map(card => card.closest('[id]').id);
const card = (container, id) => container.querySelector(`[id="${id}"] .rf-card`);
const callout = (container, id) => container.querySelector(`[id="${id}"] .rf-callout`);
const searchBox = () => screen.getByPlaceholderText('Rechercher dans les questions');
const hrefs = (el) => [...el.querySelectorAll('a')].map(a => a.getAttribute('href'));

const open = async (container, id) => {
  await fireEvent.click(card(container, id));
  await waitFor(() => expect(callout(container, id)).not.toBeNull());
  return callout(container, id);
};

const typeSearch = async (value) => {
  await fireEvent.input(searchBox(), { target: { value } });
};

describe('Default page', () => {
  beforeEach(() => {
    resetStores();
    mockFetch();
  });

  it('IN-061 title falls back to "Non trouvé" without a title prop', () => {
    render(Default);
    expect(screen.getByRole('heading', { level: 2 }).textContent.trim()).toBe('Non trouvé');
  });

  it('IN-058 / IN-059 renders the route title ("À propos", 404 title) as the h2', () => {
    render(Default, { title: 'À propos' });
    expect(screen.getByRole('heading', { level: 2 }).textContent.trim()).toBe('À propos');
  });

  it('IN-062 optional subtitle paragraph, absent by default', () => {
    const { container, unmount } = render(Default, { title: 'T' });
    expect(container.querySelector('p.rf-text--lg')).toBeNull();
    unmount();
    render(Default, { title: 'T', subtitle: 'Sous-titre' });
    expect(screen.getByText('Sous-titre').tagName).toBe('P');
  });

  it('IN-063 Info is lazily loaded below the title (nothing until the dynamic import resolves)', async () => {
    const { container } = render(Default, { title: 'À propos' });
    expect(container.querySelector('.rf-card')).toBeNull();
    expect(await screen.findByPlaceholderText('Rechercher dans les questions')).toBeTruthy();
    expect(container.querySelectorAll('.rf-card')).toHaveLength(15);
  });
});

describe('Info (FAQ / about)', () => {
  beforeEach(() => {
    resetStores();
    route.set({ path: '/about', query: {}, hash: '' });
    window.history.replaceState({}, '', '/about');
    mockFetch();
  });

  describe('list and filter', () => {
    it('IN-064 the FAQ search input is shown in full mode only', () => {
      const { unmount } = render(Info);
      expect(searchBox().getAttribute('type')).toBe('search');
      unmount();
      render(Info, { filter: true });
      expect(screen.queryByPlaceholderText('Rechercher dans les questions')).toBeNull();
    });

    it('IN-065 full mode lists the 15 sections in a fixed order, each with an icon and a title', () => {
      const { container } = render(Info);
      const cards = [...container.querySelectorAll('.rf-card')];
      expect(cards.map(c => text(c.querySelector('.rf-text--lg')))).toEqual(SECTION_TITLES);
      expect(cards.every(c => c.querySelector('svg'))).toBe(true);
    });

    it('IN-080 section anchor ids are the slugified titles (15 stable ids)', () => {
      const { container } = render(Info);
      expect(sectionIds(container)).toEqual(SECTION_IDS);
    });

    it('IN-066 filter mode lists only "Merci pour votre soutien !", "Décès manquant", "Signaler un bug"', () => {
      const { container } = render(Info, { filter: true });
      expect(sectionIds(container)).toEqual(['merci-pour-votre-soutien', 'deces-manquant', 'signaler-un-bug']);
    });

    it('IN-069 search: "swagger" (tags) finds the API section', async () => {
      const { container } = render(Info);
      await typeSearch('swagger');
      expect(sectionIds(container)).toEqual(['developpeurs-utilisez-l-api']);
    });

    it('IN-069 search is case-insensitive and matches tags, content or title ("bénévole", "BUG", "cagnotte")', async () => {
      const { container } = render(Info);
      await typeSearch('bénévole');
      expect(sectionIds(container)).toEqual(['qui-sommes-nous']);
      await typeSearch('BUG');
      expect(sectionIds(container)).toContain('signaler-un-bug');
      await typeSearch('cagnotte');
      expect(sectionIds(container)).toEqual(['merci-pour-votre-soutien']);
    });

    it('IN-069 whitespace-separated terms must all match (AND) within one field (tags, content or title)', async () => {
      const { container } = render(Info);
      await typeSearch('api');
      expect(sectionIds(container).length).toBeGreaterThan(1);
      await typeSearch('rapprochement identités');
      expect(sectionIds(container)).toEqual(['algorithme-de-rapprochement-d-identites']);
      // "api" only matches the title and "swagger" only the tags: no section
      await typeSearch('api swagger');
      expect(sectionIds(container)).toEqual([]);
      await typeSearch('');
      expect(sectionIds(container)).toEqual(SECTION_IDS);
    });

    it('IN-070 a search without match shows an empty grid and no empty-state message', async () => {
      const { container } = render(Info);
      await typeSearch('zzzzqqqq');
      expect(container.querySelectorAll('.rf-card')).toHaveLength(0);
      expect(searchBox()).toBeTruthy();
    });

    // BUG: the search terms are used as raw RegExp sources (Info.svelte:469),
    // so "(" throws "SyntaxError: Invalid regular expression" inside the
    // reactive statement and the component stops updating.
    it.fails('IN-071 BUG: a search term with regex metacharacters ("(") does not throw', () => {
      render(Info);
      searchBox().value = '(';
      searchBox().dispatchEvent(new Event('input'));
      expect(() => flush()).not.toThrow();
    });

    it('IN-071 a search term with regex metacharacters currently throws a SyntaxError (pinned)', () => {
      render(Info);
      searchBox().value = '(';
      searchBox().dispatchEvent(new Event('input'));
      expect(() => flush()).toThrow(SyntaxError);
    });
  });

  describe('open / close sections', () => {
    it('IN-072 clicking a card opens its section, clicking again closes it, one open at a time', async () => {
      const { container } = render(Info);
      await open(container, 'qui-sommes-nous');
      expect(callout(container, 'qui-sommes-nous').textContent).toContain('Le projet matchID a été initié');
      await open(container, 'code-open-source');
      await waitFor(() => expect(callout(container, 'qui-sommes-nous')).toBeNull(), OUTRO);
      expect(container.querySelectorAll('.rf-callout')).toHaveLength(1);
      await fireEvent.click(card(container, 'code-open-source'));
      await waitFor(() => expect(container.querySelectorAll('.rf-callout')).toHaveLength(0), OUTRO);
    });

    it('IN-073 the open card spans the full width and shows the left-arrow style', async () => {
      const { container } = render(Info);
      const wrapper = () => container.querySelector('[id="qui-sommes-nous"]').parentElement;
      expect(wrapper().className).toContain('rf-col-xl-6');
      expect(card(container, 'qui-sommes-nous').classList.contains('rf-card--left-arrow')).toBe(false);
      await open(container, 'qui-sommes-nous');
      expect(wrapper().className).toMatch(/^rf-col-12 /);
      expect(card(container, 'qui-sommes-nous').classList.contains('rf-card--left-arrow')).toBe(true);
    });

    it('IN-075 opening sets location.hash and $route.hash to the section id', async () => {
      const { container } = render(Info);
      await open(container, 'donnees-personnelles');
      expect(location.hash).toBe('#donnees-personnelles');
      expect(get(route).hash).toBe('#donnees-personnelles');
    });

    it('IN-076 closing removes the hash with history.pushState and clears $route.hash', async () => {
      const { container } = render(Info);
      await open(container, 'donnees-personnelles');
      const pushState = vi.spyOn(window.history, 'pushState');
      await fireEvent.click(card(container, 'donnees-personnelles'));
      expect(pushState).toHaveBeenCalledWith(null, null, `${location.origin}/about`);
      expect(location.hash).toBe('');
      expect(get(route).hash).toBeUndefined();
    });

    it('IN-077 a deep link /about#<section-id> opens that section on mount', async () => {
      route.set({ path: '/about', query: {}, hash: '#donnees-personnelles' });
      const { container } = render(Info);
      await waitFor(() => expect(callout(container, 'donnees-personnelles')).not.toBeNull());
      expect(container.querySelectorAll('.rf-callout')).toHaveLength(1);
    });

    it('IN-079 Enter on a focused card toggles its section', async () => {
      const { container } = render(Info);
      await fireEvent.keyDown(card(container, 'signaler-un-bug'), { key: 'Enter' });
      await waitFor(() => expect(callout(container, 'signaler-un-bug')).not.toBeNull());
    });

    // BUG: the card keydown handler toggles on ANY key and calls
    // preventDefault (Info.svelte:26), so Tab cannot leave a focused card
    // icon (keyboard trap) and toggles the section instead.
    it.fails('IN-079 BUG: Tab on a focused card does not toggle the section nor get prevented', async () => {
      const { container } = render(Info);
      const notPrevented = await fireEvent.keyDown(card(container, 'signaler-un-bug'), { key: 'Tab' });
      expect(notPrevented).toBe(true);
      expect(callout(container, 'signaler-un-bug')).toBeNull();
    });

    // BUG: in Firefox, the delayed smooth scroll calls the svelte-scrolling
    // `scrollTo` action as a plain function with one argument, which throws
    // "scrollTo require a options" inside the timeout (Info.svelte:500-504).
    it.fails('IN-078 BUG: Firefox delayed scroll after opening a section does not throw', async () => {
      const ua = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0');
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      try {
        const { container } = render(Info);
        await fireEvent.click(card(container, 'code-open-source'));
        expect(() => vi.advanceTimersByTime(400)).not.toThrow();
      } finally {
        vi.useRealTimers();
        ua.mockRestore();
      }
    });

    it('IN-102 each card has an icon link to its id labelled with its title', () => {
      const { container } = render(Info);
      const links = [...container.querySelectorAll('.rf-card a.rf-fi__link')];
      expect(links.map(a => a.getAttribute('href'))).toEqual(SECTION_IDS);
      expect(links.map(a => a.getAttribute('aria-label'))).toEqual(SECTION_TITLES);
    });

    it('IN-100 full-width-on-mobile sections (API, algorithm, stats) get rf-callout--no-mobile', async () => {
      const { container } = render(Info);
      const content = await open(container, 'developpeurs-utilisez-l-api');
      expect(content.classList.contains('rf-callout--no-mobile')).toBe(true);
      const other = await open(container, 'code-open-source');
      expect(other.classList.contains('rf-callout--no-mobile')).toBe(false);
    });
  });

  describe('section contents', () => {
    it('IN-081 "À qui s\'adresse le service ?" text depends on the theme', async () => {
      const { container } = render(Info);
      const content = await open(container, 'a-qui-s-adresse-le-service');
      expect(text(content)).toBe('Généalogistes, professionnels ou particuliers, services publics hospitaliers, ou de lutte contre la fraude.');
      themeDnum.set(1);
      await waitFor(() => expect(text(callout(container, 'a-qui-s-adresse-le-service'))).toBe('Professionnels du service public.'));
    });

    it('IN-082 "Qui sommes nous ?": EIG and matchid.io links; maintainers paragraph (public) vs "administrateur ministériel des données" (DNUM)', async () => {
      const { container } = render(Info);
      const content = await open(container, 'qui-sommes-nous');
      expect(hrefs(content)).toEqual([
        'https://entrepreneur-interet-general.etalab.gouv.fr/defis/2017/mi-matchid.html',
        'https://www.matchid.io'
      ]);
      expect(text(content)).toContain('assurée par Fabien ANTOINE');
      expect(text(content)).not.toContain('administrateur ministériel des données');
      themeDnum.set(1);
      await waitFor(() => expect(text(callout(container, 'qui-sommes-nous'))).toContain('(administrateur ministériel des données)'));
      expect(text(callout(container, 'qui-sommes-nous'))).not.toContain('Fabien ANTOINE');
    });

    it('IN-083 "Merci pour votre soutien !": cagnotte link in the public theme, empty body in DNUM', async () => {
      const { container } = render(Info);
      const content = await open(container, 'merci-pour-votre-soutien');
      expect(hrefs(content)).toEqual(['https://matchid.io/cagnotte']);
      expect(text(content)).toContain('une cagnotte a été créée');
      themeDnum.set(1);
      await waitFor(() => expect(text(callout(container, 'merci-pour-votre-soutien'))).toBe(''));
    });

    it('IN-084 "D\'où proviennent les données ?": data.gouv and INSEE links', async () => {
      const { container } = render(Info);
      const content = await open(container, 'd-ou-proviennent-les-donnees');
      expect(hrefs(content).slice(0, 2)).toEqual([
        'https://www.data.gouv.fr/fr/datasets/fichier-des-personnes-decedees/',
        'https://www.insee.fr/fr/information/4190491'
      ]);
    });

    it('IN-085 the data section shows live counts from $version.data (records, duplicates, dates)', async () => {
      version.set({
        ui: 'deces-ui version test',
        api: '1.2.3',
        data: { uniqRecordsCount: 27000000, rawRecordsCount: 27000150, lastRecordDate: '31/12/2022', updateDate: '05/01/2023' }
      });
      const { container } = render(Info);
      const content = text(await open(container, 'd-ou-proviennent-les-donnees'));
      expect(content).toContain('le fichier comporte 27000000 décès et 150 doublons (stricts)');
      expect(content).toContain('(jusqu\'au 31/12/2022)');
      expect(content).toContain('il a été mis à jour le 05/01/2023');
    });

    it('IN-086 without /version data the counts read "undefined" (pinned)', async () => {
      const { container } = render(Info);
      const content = text(await open(container, 'd-ou-proviennent-les-donnees'));
      expect(content).toContain('le fichier comporte undefined décès et undefined doublons');
    });

    // BUG: when /version failed or is not loaded yet, the section renders the
    // literal "undefined" instead of hiding the figures (Info.svelte:170-176).
    it.fails('IN-086 BUG: without /version data the section does not render "undefined"', async () => {
      const { container } = render(Info);
      const content = text(await open(container, 'd-ou-proviennent-les-donnees'));
      expect(content).not.toContain('undefined');
    });

    it('IN-087 useful links: CNIL RNIPP, INSEE déclaration de décès, service-public F16507, Wikipedia RNIPP', async () => {
      const { container } = render(Info);
      const content = await open(container, 'd-ou-proviennent-les-donnees');
      expect(hrefs(content).slice(2)).toEqual([
        'https://www.cnil.fr/fr/rnipp-repertoire-national-didentification-des-personnes-physiques-0',
        'https://www.insee.fr/fr/information/1303477',
        'https://www.service-public.fr/particuliers/vosdroits/F16507',
        'https://fr.wikipedia.org/wiki/R%C3%A9pertoire_national_d%27identification_des_personnes_physiques'
      ]);
    });

    it('IN-088 "Quelles sont les garanties sur les données ?": CRPA articles, Licence Ouverte, no vital status certification', async () => {
      const { container } = render(Info);
      const content = await open(container, 'quelles-sont-les-garanties-sur-les-donnees');
      expect(text(content)).toContain('articles L311-9 et L312-1-1 du code des relations entre le public et l’administration');
      expect(hrefs(content)).toEqual(['https://www.etalab.gouv.fr/licence-ouverte-open-licence']);
      expect(text(content.querySelector('strong'))).toContain('ne peuvent en aucun cas être utilisées dans un but de certification du statut vital des personnes');
    });

    it('IN-089 "Données personnelles": RGPD art. 85, opposition file, contact, bulk matching, user data, GA/Ads statement', async () => {
      const { container } = render(Info);
      const content = await open(container, 'donnees-personnelles');
      const body = text(content);
      expect(body).toContain('hors du champ d\'application du RGPD - article 85 loi CNIL');
      expect(hrefs(content)).toContain('https://www.data.gouv.fr/fr/datasets/r/7bcdfa57-dc50-43a8-beb6-6c76537e7057');
      expect(hrefs(content)).toContain('mailto:test@example.org');
      expect(hrefs(content)).toContain('https://www.cnil.fr/fr/rgpd-de-quoi-parle-t-on');
      expect([...content.querySelectorAll('strong')].map(text)).toEqual([
        'Le fichiers des décès est hors du champ d\'application du RGPD - article 85 loi CNIL',
        'Traitement d\'appariement en masse',
        'Données personnelles des utilisateurs de matchID',
        'Google Analytics & Google Ads'
      ]);
      expect(body).toContain('effacées automatiquement un heure après');
      // Content vs behaviour mismatch (see IN-185/IN-186): GA and Ads are
      // hard-disabled in App.svelte but the legal text still states they are used.
      expect(body).toContain('fait l\'usage de cookies Google Analytics et Google Ads');
    });

    it('IN-090 contact mail link: build-time __API_EMAIL__ in the public theme, datalab@interieur.gouv.fr in DNUM', async () => {
      const { container } = render(Info);
      for (const id of ['donnees-personnelles', 'donnees-erronnees', 'signaler-un-bug', 'suggerer-des-ameliorations-du-service']) {
        const content = await open(container, id);
        const mail = [...content.querySelectorAll('a[href^="mailto:"]')];
        expect(mail.map(a => [a.getAttribute('href'), text(a)])).toEqual([['mailto:test@example.org', 'test@example.org']]);
      }
      themeDnum.set(1);
      await waitFor(() => expect(callout(container, 'suggerer-des-ameliorations-du-service').querySelector('a[href="mailto:datalab@interieur.gouv.fr"]')).not.toBeNull());
      expect(text(callout(container, 'suggerer-des-ameliorations-du-service').querySelector('a[href^="mailto:"]'))).toBe('datalab@interieur.gouv.fr');
    });

    it('IN-091 "Comment sont indexées les données ?": matchid.io, deces-dataprep, data.gouv, elastic.co, Wikipedia, GitHub deces-ui', async () => {
      const { container } = render(Info);
      const content = await open(container, 'comment-sont-indexees-les-donnees');
      expect(hrefs(content)).toEqual([
        'https://www.matchid.io',
        'https://github.com/matchid-project/deces-dataprep',
        'https://www.data.gouv.fr/fr/datasets/fichier-des-personnes-decedees/',
        'https://elastic.co',
        'https://wikipedia.org/wiki/Recherche_approximative',
        'https://github.com/matchid-project/deces-ui'
      ]);
    });

    it('IN-092 "Décès manquant" guidance: no longer handled + 4 identified cases', async () => {
      const { container } = render(Info);
      const content = await open(container, 'deces-manquant');
      expect(text(content.querySelector('strong'))).toContain('Nous ne traitons pas aujourd\'hui plus le cas des décès manquant');
      expect(content.querySelectorAll('li')).toHaveLength(4);
      expect(hrefs(content)).toEqual([]);
    });

    it('IN-093 "Données erronnées": contact mail; the data.gouv URL is plain text, not a link', async () => {
      const { container } = render(Info);
      const content = await open(container, 'donnees-erronnees');
      expect(hrefs(content)).toEqual(['mailto:test@example.org']);
      expect(text(content)).toContain('sur le site du fournisseur de données: https://www.data.gouv.fr/fr/datasets/fichier-des-personnes-decedees/');
    });

    it('IN-094 "Signaler un bug": version string "<ui>-api/<api>" and contact mail', async () => {
      version.set({ ui: 'deces-ui version test', api: '1.2.3' });
      const { container } = render(Info);
      const content = await open(container, 'signaler-un-bug');
      expect(text(content.querySelector('p:last-child strong'))).toBe('deces-ui version test-api/1.2.3');
      expect(hrefs(content)).toEqual(['mailto:test@example.org']);
    });

    it('IN-095 "Suggérer des améliorations du service": Gedcom item only in the public theme', async () => {
      const { container } = render(Info);
      const content = await open(container, 'suggerer-des-ameliorations-du-service');
      expect([...content.querySelectorAll('li')].map(text)[0]).toBe('le support des fichiers Gedcom');
      expect(content.querySelectorAll('li')).toHaveLength(3);
      themeDnum.set(1);
      await waitFor(() => expect(callout(container, 'suggerer-des-ameliorations-du-service').querySelectorAll('li')).toHaveLength(2));
      expect(text(callout(container, 'suggerer-des-ameliorations-du-service'))).not.toContain('Gedcom');
    });

    it('IN-096 "Développeurs, utilisez l\'API" embeds the API doc iframe (matchid.io/link-api, cropped)', async () => {
      const { container } = render(Info);
      const content = await open(container, 'developpeurs-utilisez-l-api');
      const iframe = content.querySelector('iframe');
      expect(iframe.getAttribute('src')).toBe('https://matchid.io/link-api');
      expect(iframe.getAttribute('title')).toBe('documentation de l\'api');
      expect(iframe.getAttribute('style')).toContain('margin-top:-450px');
      expect(iframe.getAttribute('style')).toContain('margin-bottom:-1000px');
    });

    it('IN-097 "Algorithme de rapprochement d\'identités" embeds AlgoDetails, which fires a compare request', async () => {
      const { container } = render(Info);
      const content = await open(container, 'algorithme-de-rapprochement-d-identites');
      expect(within(content).getByRole('heading', { level: 3 }).textContent).toContain('Appariement sur deces.matchid.io, explications');
      await waitFor(() => expect(runCompareRequest).toHaveBeenCalledTimes(1), { timeout: 2000 });
    });

    it('IN-098 "Code open source": GitHub deces-ui, deces-backend and LGPL-3.0 links', async () => {
      const { container } = render(Info);
      const content = await open(container, 'code-open-source');
      expect(hrefs(content)).toEqual([
        'https://github.com/matchid-project/deces-ui',
        'https://github.com/matchid-project/deces-backend',
        'https://spdx.org/licenses/LGPL-3.0.html#licenseText'
      ]);
    });

    it('IN-099 "Statistiques de consultation" embeds Stats, which fetches /stats/catalog.json', async () => {
      setDsfrColors();
      const fetchMock = mockFetch({ '/stats/catalog.json': () => Promise.reject(new TypeError('offline')) });
      const { container } = render(Info);
      const content = await open(container, 'statistiques-de-consultation');
      expect(await within(content).findByText('Les statistiques seront bientôt disponibles ...')).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledWith('/stats/catalog.json');
    });

    it('IN-101 external links open in a new tab with rel="noopener noreferrer" (2 known exceptions)', async () => {
      const { container } = render(Info);
      const links = [];
      for (const id of SECTION_IDS.filter(i => !['developpeurs-utilisez-l-api', 'algorithme-de-rapprochement-d-identites', 'statistiques-de-consultation'].includes(i))) {
        const content = await open(container, id);
        links.push(...content.querySelectorAll('a[href^="http"]'));
      }
      const exceptions = links.filter(a => a.getAttribute('target') !== '_blank' || a.getAttribute('rel') !== 'noopener noreferrer')
        .map(a => a.getAttribute('href'));
      expect(links.length).toBeGreaterThan(15);
      expect(exceptions).toEqual([
        'https://www.data.gouv.fr/fr/datasets/r/7bcdfa57-dc50-43a8-beb6-6c76537e7057',
        'https://www.cnil.fr/fr/rgpd-de-quoi-parle-t-on'
      ]);
    });
  });
});
