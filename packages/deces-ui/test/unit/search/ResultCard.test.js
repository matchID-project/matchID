import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, createEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import md5 from 'md5';
import { jsonResponse, mockFetch, person, resetSearchStores, searchResponse } from './helpers.js';

const { default: ResultCard } = await import('../../../src/components/views/ResultCard.svelte');
const stores = await import('../../../src/components/tools/stores.js');
const { getById, searchSubmit } = await import('../../../src/components/tools/search.js');

const catalog = { resources: [{ title: 'deces-2020-m01.txt', url: '/data.gouv.fr/resources/deces-2020-m01.txt' }] };

const card = (container) => container.querySelector('.rf-card');
const column = (container) => container.firstElementChild;
const isExpanded = (container) => card(container).classList.contains('rf-card--md');
// Rows of the "Naissance"/"Décès" tables as [label, text] pairs.
const tableRows = (container, title) => {
  const th = [...container.querySelectorAll('th[scope="colgroup"]')].find(t => t.textContent === title);
  if (!th) return undefined;
  return [...th.closest('table').querySelectorAll('tbody tr')].map(tr =>
    [...tr.querySelectorAll('td')].map(td => td.textContent.replace(/\s+/g, ' ').trim()));
};

describe('ResultCard', () => {
  beforeEach(() => {
    resetSearchStores(stores);
    stores.route.set({ path: '/search' });
    stores.admin.set(false);
    stores.user.set(undefined);
    mockFetch(url => url.endsWith('/catalog') ? jsonResponse(catalog) : undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('compact card', () => {
    // BUG: the {#if !result.error} guard is there, but the reactive `conf`
    // statements (ResultCard.svelte:1074-1097) read result.name/result.birth
    // unconditionally, so mounting a card for an error result throws
    // "Cannot read properties of undefined (reading 'last')".
    it.fails('SR-087 renders nothing for an error result', () => {
      const { container } = render(ResultCard, { result: { error: true, status: 500 } });
      expect(container.innerHTML).toBe('');
    });

    it('SR-088 is half width on lg/xl when compact, full width when expanded or fullwidth', async () => {
      const { container } = render(ResultCard, { result: person(), index: 1 });
      expect(column(container).className).toContain('rf-col-lg-6 rf-col-xl-6');
      await fireEvent.click(card(container));
      expect(column(container).className).toMatch(/^rf-col-12 /);
      const other = render(ResultCard, { result: person(), index: 2, fullwidth: true });
      expect(column(other.container).className).toMatch(/^rf-col-12 /);
    });

    it('SR-089 the nomargin prop removes the paddings', () => {
      const { container } = render(ResultCard, { result: person(), index: 1 });
      expect(column(container).className).toContain('rf-padding-1N rf-padding-left-2N rf-padding-right-2N');
      const other = render(ResultCard, { result: person(), index: 1, nomargin: true });
      expect(column(other.container).className).not.toContain('rf-padding-1N');
    });

    it('SR-090 clicking the card toggles the expansion, calls onclick and blurs', async () => {
      const onclick = vi.fn();
      const { container } = render(ResultCard, { result: person(), index: 1, onclick });
      const focused = document.createElement('input');
      const blur = vi.spyOn(focused, 'blur');
      stores.activeElement.set(focused);
      await fireEvent.click(card(container));
      expect(isExpanded(container)).toBe(true);
      expect(onclick).toHaveBeenCalledTimes(1);
      expect(blur).toHaveBeenCalled();
      expect(screen.getByText('Permalien')).toBeTruthy();
      await fireEvent.click(card(container));
      expect(isExpanded(container)).toBe(false);
      expect(onclick).toHaveBeenCalledTimes(2);
    });

    it('SR-091 any keydown on the card toggles it and is prevented (Tab bubbling from the inner anchor)', async () => {
      const { container } = render(ResultCard, { result: person(), index: 1 });
      const anchor = container.querySelector('.rf-card__body > a');
      const event = createEvent.keyDown(anchor, { key: 'Tab' });
      await fireEvent(anchor, event);
      expect(event.defaultPrevented).toBe(true);
      expect(isExpanded(container)).toBe(true);
    });

    it('SR-092 the expanded card uses the md size and the left arrow', async () => {
      const { container } = render(ResultCard, { result: person(), index: 1 });
      expect(card(container).className).toContain('rf-card--sm');
      expect(card(container).classList.contains('rf-card--left-arrow')).toBe(false);
      await fireEvent.click(card(container));
      expect(card(container).className).toContain('rf-card--md');
      expect(card(container).classList.contains('rf-card--left-arrow')).toBe(true);
    });

    it('SR-093 starts expanded in card-expand mode or with forceExpand', () => {
      stores.displayMode.set('card-expand');
      const a = render(ResultCard, { result: person(), index: 1 });
      expect(isExpanded(a.container)).toBe(true);
      stores.displayMode.set('card');
      const b = render(ResultCard, { result: person(), index: 2, forceExpand: true });
      expect(isExpanded(b.container)).toBe(true);
      const c = render(ResultCard, { result: person(), index: 3 });
      expect(isExpanded(c.container)).toBe(false);
    });

    it('SR-094 changing the display mode resets the local expansion', async () => {
      const { container } = render(ResultCard, { result: person(), index: 1 });
      await fireEvent.click(card(container));
      expect(isExpanded(container)).toBe(true);
      stores.displayMode.set('table');
      await waitFor(() => expect(isExpanded(container)).toBe(false));
      stores.displayMode.set('card-expand');
      await waitFor(() => expect(isExpanded(container)).toBe(true));
    });

    it('SR-095 shows the /male.svg or /female.svg avatar with the sex as alt text', () => {
      render(ResultCard, { result: person({ sex: 'M' }), index: 1 });
      expect(screen.getByAltText('M').getAttribute('src')).toBe('/male.svg');
      render(ResultCard, { result: person({ sex: 'F' }), index: 2 });
      expect(screen.getByAltText('F').getAttribute('src')).toBe('/female.svg');
    });

    it('SR-096 the avatar background is blue with wiki links, grey otherwise', () => {
      render(ResultCard, { result: person({ sex: 'M' }), index: 1 });
      expect(screen.getByAltText('M').className).toContain('rf-background--g400');
      render(ResultCard, { result: person({ sex: 'F', links: { wikidata: 'https://www.wikidata.org/wiki/Q1' } }), index: 2 });
      expect(screen.getByAltText('F').className).toContain('rf-background--bf');
    });

    it('SR-097 shows the Wikimedia thumbnail (md5 path, 80px) once loaded and hides the avatar', async () => {
      const links = { wikidata: 'https://www.wikidata.org/wiki/Q1', wikimedia: 'http://commons.wikimedia.org/wiki/Special:FilePath/Jean%20Dupont.jpg' };
      const { container } = render(ResultCard, { result: person({ links }), index: 1 });
      const hash = md5('Jean_Dupont.jpg');
      const src = `https://upload.wikimedia.org/wikipedia/commons/thumb/${hash[0]}/${hash.substring(0, 2)}/Jean_Dupont.jpg/80px-Jean_Dupont.jpg`;
      const thumb = screen.getByAltText(src);
      expect(thumb.getAttribute('src')).toBe(src);
      expect(thumb.classList.contains('rf-hide')).toBe(true);
      expect(screen.getByAltText('M').classList.contains('rf-hide')).toBe(false);
      thumb.onload();
      await waitFor(() => expect(thumb.classList.contains('rf-hide')).toBe(false));
      expect(screen.getByAltText('M').classList.contains('rf-hide')).toBe(true);
      expect(container.querySelectorAll('img')).toHaveLength(2);
    });

    it('SR-098 the thumbnail URL falls back to the raw value when it cannot be decoded', () => {
      render(ResultCard, { result: person({ links: { wikidata: 'w', wikimedia: '%E0%A4%A' } }), index: 1 });
      expect(screen.getByAltText('%E0%A4%A').getAttribute('src')).toBe('%E0%A4%A');
    });

    it('SR-099 shows the "erreur de donnée signalée" alert overlay for a correction other than wikilink', () => {
      render(ResultCard, { result: person({ correction: { change: 'cancel' } }), index: 1 });
      expect(screen.getByTitle('erreur de donnée signalée')).toBeTruthy();
      const other = render(ResultCard, { result: person({ id: 'w', correction: { change: 'wikilink' }, links: { wikidata: 'x' } }), index: 2 });
      expect(other.container.querySelector('[title="erreur de donnée signalée"]')).toBeNull();
    });

    it('SR-100 also shows the overlay for validated modifications (alpha, not in editListMode), sized by the expansion', async () => {
      const modifications = [{ id: 'm1', auth: 1, fields: { lastName: 'Durand' }, proof: 'https://archives.example.org/acte', author: 'jo...hn@example.org', date: '2024-01-02T10:00:00Z' }];
      const { container } = render(ResultCard, { result: person({ modifications }), index: 1 });
      const overlay = () => container.querySelector('div[title="erreur de donnée signalée"]');
      expect([overlay().style.top, overlay().style.left]).toEqual(['6px', '6px']);
      await fireEvent.click(card(container));
      expect([overlay().style.top, overlay().style.left]).toEqual(['14px', '14px']);
      const list = render(ResultCard, { result: person({ id: 'x', modifications }), index: 2, editListMode: true });
      expect(list.container.querySelector('div[title="erreur de donnée signalée"]')).toBeNull();
    });

    it('SR-101 the card anchor targets #index with the aria label "étendre la carte de NOM Prénoms"', () => {
      const { container } = render(ResultCard, { result: person(), index: 7 });
      const anchor = container.querySelector('.rf-card__body > a');
      expect(anchor.getAttribute('href')).toBe('#7');
      expect(anchor.getAttribute('aria-label')).toBe('étendre la carte de DUPONT Jean Pierre');
    });

    it('SR-102 shows the name heading "NOM Prénom1 Prénom2"', () => {
      render(ResultCard, { result: person(), index: 1 });
      expect(screen.getByRole('heading', { level: 4 }).textContent.trim()).toBe('DUPONT Jean Pierre');
    });

    it('SR-103 shows the Wikidata label, truncated at 40 characters when compact', async () => {
      const label = 'Homme politique français, ancien président de la République';
      const { container } = render(ResultCard, { result: person({ links: { wikidata: 'w', label } }), index: 1 });
      expect(screen.getByText(`${label.substring(0, 40)} ...`)).toBeTruthy();
      await fireEvent.click(card(container));
      expect(screen.getByText(label)).toBeTruthy();
      render(ResultCard, { result: person({ id: 'short', links: { wikidata: 'w', label: 'Peintre' } }), index: 2 });
      expect(screen.getByText('Peintre')).toBeTruthy();
    });

    it('SR-104 adds "(source: wikidata.org)" when expanded', async () => {
      const { container } = render(ResultCard, { result: person({ links: { wikidata: 'w', label: 'Peintre' } }), index: 1 });
      expect(container.querySelector('.rf-card__desc').textContent).not.toContain('(source: wikidata.org)');
      await fireEvent.click(card(container));
      expect(container.querySelector('.rf-card__desc').textContent).toContain('(source: wikidata.org)');
    });

    it('SR-105 a compact card with a wiki label hides the cities', async () => {
      const { container } = render(ResultCard, { result: person({ links: { wikidata: 'w', label: 'Peintre' } }), index: 1 });
      const desc = () => container.querySelector('.rf-card__desc').textContent.replace(/\s+/g, ' ').trim();
      expect(desc()).toBe('Peintre - 1932 - 2020');
      await fireEvent.click(card(container));
      expect(desc()).toContain('Eysines 03/10/1932 - Pessac 16/01/2020');
    });

    it('SR-106 hides the cities on mobile', () => {
      const { container } = render(ResultCard, { result: person(), index: 1 });
      const spans = [...container.querySelectorAll('.rf-card__desc .rf-hide--mobile')].map(s => s.textContent.trim());
      expect(spans).toEqual(['Eysines', 'Pessac']);
    });

    it('SR-107 compact cards prefer the non-arrondissement city name, the table the arrondissement', async () => {
      const result = person();
      result.death = { ...result.death, location: { ...result.death.location, city: ['Paris 15e Arrondissement', 'Paris'], code: '75115', departmentCode: '75' } };
      const { container } = render(ResultCard, { result, index: 1 });
      expect(container.querySelectorAll('.rf-card__desc .rf-hide--mobile')[1].textContent.trim()).toBe('Paris');
      await fireEvent.click(card(container));
      expect(tableRows(container, 'Décès')).toContainEqual(['Commune', 'Paris 15e Arrondissement (75115)']);
    });

    it('SR-108 compact dates show the year only, expanded dates dd/mm/yyyy', async () => {
      const { container } = render(ResultCard, { result: person(), index: 1 });
      const desc = () => container.querySelector('.rf-card__desc').textContent.replace(/\s+/g, ' ').trim();
      expect(desc()).toBe('Eysines 1932 - Pessac 2020');
      await fireEvent.click(card(container));
      expect(desc()).toBe('Eysines 03/10/1932 - Pessac 16/01/2020');
    });

    it('SR-109 shows the death segment only when the record has a death', () => {
      const { container } = render(ResultCard, { result: person({ death: undefined }), index: 1 });
      expect(container.querySelector('.rf-card__desc').textContent.replace(/\s+/g, ' ').trim()).toBe('Eysines 1932');
    });

    // SR-281: the inventory describes the anchor as updating the hash; the
    // card's own click handler (on:click|preventDefault on the parent) cancels
    // the anchor navigation, so the hash is left unchanged today.
    it('SR-281 clicking the card anchor toggles the card but does not navigate to #index (default prevented)', async () => {
      const { container } = render(ResultCard, { result: person(), index: 4 });
      const anchor = container.querySelector('.rf-card__body > a');
      const clicked = await fireEvent.click(anchor);
      expect(clicked).toBe(false);
      expect(location.hash).toBe('');
      expect(isExpanded(container)).toBe(true);
    });
  });

  describe('expanded card', () => {
    const expanded = (result, props = {}) => render(ResultCard, { result, index: 1, forceExpand: true, ...props });

    it('SR-110 the details panel opens below the card on expand', async () => {
      const { container } = render(ResultCard, { result: person(), index: 1 });
      expect(container.querySelector('.rf-callout')).toBeNull();
      await fireEvent.click(card(container));
      expect(container.querySelector('.rf-callout')).not.toBeNull();
    });

    it('SR-111 a "remove" correction shows "Fiche retirée"', () => {
      expanded(person({ correction: { change: 'remove' } }));
      expect(screen.getByText('Fiche retirée')).toBeTruthy();
    });

    it("SR-112 a generic correction shows \"La fiche a fait l'objet d'un signalement pour erreur.\"", () => {
      const { container } = expanded(person({ correction: { change: 'certificateId' } }));
      expect(container.querySelector('.rf-callout > span.rf-color--rm').textContent.replace(/\s+/g, ' ').trim())
        .toBe("La fiche a fait l'objet d'un signalement pour erreur.");
    });

    it('SR-113 a "cancel" correction adds "La personne mentionnée n\'est pas décédée…"', () => {
      expanded(person({ correction: { change: 'cancel' } }));
      expect(screen.getByText(/La personne mentionnée n'est pas décédée, et a demandé le retrait de cette fiche/)).toBeTruthy();
    });

    it('SR-114 on /search the Permalien is a link to /id/<id>', async () => {
      expanded(person());
      const link = screen.getByTitle('afficher le lien permanent');
      expect(link.getAttribute('href')).toBe('/id/ba7582a6344757e6');
      expect(link.textContent.trim()).toBe('Permalien');
      // no click handler: the browser (or the router) navigates
      expect(await fireEvent.click(link)).toBe(true);
    });

    it('SR-115 elsewhere the Permalien copies the absolute URL and shows "Copié !" for 5 s', async () => {
      stores.route.set({ path: '/id' });
      const writeText = vi.fn();
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      vi.useFakeTimers();
      expanded(person());
      const link = screen.getByTitle('copier le lien permanent');
      expect(await fireEvent.click(link)).toBe(false);
      expect(writeText).toHaveBeenCalledWith(`${location.origin}/id/ba7582a6344757e6`);
      expect(link.textContent.trim()).toBe('Copié !');
      await vi.advanceTimersByTimeAsync(4900);
      expect(link.textContent.trim()).toBe('Copié !');
      await vi.advanceTimersByTimeAsync(200);
      expect(link.textContent.trim()).toBe('Permalien');
    });

    it('SR-116 the Permalien icon links to ${origin}/id/<id> with the label "copier le lien permanent"', () => {
      expanded(person());
      const icon = screen.getByLabelText('copier le lien permanent');
      expect(icon.getAttribute('href')).toBe(`${location.origin}/id/ba7582a6344757e6`);
    });

    it('SR-117 the Naissance table lists Nom, Prénom(s), Sexe, Date, Commune (code), Département, Pays (code)', () => {
      const { container } = expanded(person());
      expect(tableRows(container, 'Naissance')).toEqual([
        ['Nom', 'Dupont'],
        ['Prénom(s)', 'Jean Pierre'],
        ['Sexe', 'Masculin'],
        ['Date', '03/10/1932'],
        ['Commune', 'Eysines (33162)'],
        ['Département', '33'],
        ['Pays', 'France (FRA)']
      ]);
    });

    it('SR-118 the Décès table lists Date, Age "N ans", Commune (code), Département, Pays, Acte n°', () => {
      const { container } = expanded(person());
      expect(tableRows(container, 'Décès').slice(0, 6)).toEqual([
        ['Date', '16/01/2020'],
        ['Age', '87 ans'],
        ['Commune', 'Pessac (33318)'],
        ['Département', '33'],
        ['Pays', 'France (FRA)'],
        ['Acte n°', '69 N']
      ]);
    });

    it('SR-119 the "Source INSEE" cell links to the data.gouv file once the catalog is loaded', async () => {
      const { container } = expanded(person());
      await waitFor(() => expect(tableRows(container, 'Décès')).toContainEqual(['Source INSEE', 'fichier 2020-m01, ligne n°212']));
      const link = screen.getByTitle('source INSEE 2020-m01');
      expect(link.getAttribute('href')).toBe('/data.gouv.fr/deces-2020-m01.txt');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('SR-120 omits empty or blank fields from the tables', () => {
      const result = person();
      result.birth = { ...result.birth, location: { ...result.birth.location, departmentCode: '', country: undefined, countryCode: undefined } };
      const { container } = expanded(result);
      const labels = tableRows(container, 'Naissance').map(([label]) => label);
      expect(labels).not.toContain('Département');
      expect(labels).not.toContain('Pays');
      expect(labels).toContain('Commune');
    });

    it('SR-121 has no Décès table when the record has no death', () => {
      const { container } = expanded(person({ death: undefined }));
      expect(tableRows(container, 'Naissance')).toBeDefined();
      expect(tableRows(container, 'Décès')).toBeUndefined();
    });

    it('SR-122 shows "Voir sur wikipedia" / "Voir sur wikidata" links opening a new tab', () => {
      expanded(person({ links: { wikidata: 'https://www.wikidata.org/wiki/Q1', wikipedia: 'https://fr.wikipedia.org/wiki/X', label: 'Peintre' } }));
      const wikipedia = screen.getByText('Voir sur wikipedia').closest('a');
      expect(wikipedia.getAttribute('href')).toBe('https://fr.wikipedia.org/wiki/X');
      expect(wikipedia.getAttribute('target')).toBe('_blank');
      expect(wikipedia.getAttribute('rel')).toBe('noopener noreferrer');
      expect(screen.getByTitle('lien wikidata').getAttribute('href')).toBe('https://www.wikidata.org/wiki/Q1');
    });

    it('SR-123 two wiki links take half the width each, a single link the full width', () => {
      expanded(person({ links: { wikidata: 'a', wikipedia: 'b' } }));
      expect(screen.getByTitle('lien wikidata').parentElement.className).toContain('rf-col-md-6');
      expanded(person({ id: 'one', links: { wikidata: 'a' } }));
      const single = screen.getAllByTitle('lien wikidata').at(-1);
      expect(single.parentElement.className).toContain('rf-col-md-12');
    });

    it('SR-124 a "wikilink" correction removes the wiki links (mutating the result)', () => {
      const result = person({ correction: { change: 'wikilink' }, links: { wikidata: 'a', wikipedia: 'b' } });
      expanded(result);
      expect(screen.queryByText(/Voir sur/)).toBeNull();
      expect(result.links).toEqual([]);
    });

    it('SR-125 explains the anonymisation of recent minor deaths', () => {
      expanded(person({ anonymize: 'recentKidDeath' }));
      expect(screen.getByText(/les décès de mineurs datant de moins de 10 ans sont anonymisés par défaut/)).toBeTruthy();
    });

    it('SR-125 the search anonymises the names and birth place of a minor who died less than 10 years ago', async () => {
      const year = new Date().getFullYear();
      const kid = person({ id: 'kid', name: { first: ['Lucas', 'Paul'], last: 'Martin' } });
      kid.death = { ...kid.death, age: 9, date: `${year}0101` };
      mockFetch(url => url.endsWith('/id/kid') ? jsonResponse({ response: { persons: [structuredClone(kid)] } }) : undefined);
      const record = await getById({ id: 'kid' });
      expect(record.name).toEqual({ first: ['L****'], last: 'M****' });
      expect(record.birth.location).toEqual({ departmentCode: '33', country: 'France', countryCode: 'FRA' });
      expect(record.anonymize).toBe('recentKidDeath');
      // through the search results too
      mockFetch(url => url.endsWith('/search') ? searchResponse([structuredClone(kid)]) : undefined);
      stores.searchInput.update(v => { v.fullText.value = 'martin'; return v; });
      await searchSubmit();
      expect(get(stores.searchResults)[0].name.last).toBe('M****');
    });

    it('SR-126 alpha, non-admin: a validated modification shows "Cette fiche a fait l\'objet d\'un signalement d\'erreur."', () => {
      const modifications = [{ id: 'm1', auth: 1, fields: { lastName: 'Durand' }, proof: 'https://archives.example.org/acte', author: 'a', date: '2024-01-02T10:00:00Z' }];
      expanded(person({ modifications }));
      expect(screen.getByText("Cette fiche a fait l'objet d'un signalement d'erreur.")).toBeTruthy();
    });

    it('SR-127 alpha, non-admin: a waiting modification shows "…en cours de validation par un administrateur."', () => {
      const modifications = [{ id: 'm1', auth: 0, fields: { lastName: 'Durand' }, proof: 'p.pdf', author: 'a', date: '2024-01-02T10:00:00Z' }];
      expanded(person({ modifications }));
      expect(screen.getByText(/en cours de validation\s+par un administrateur\./)).toBeTruthy();
    });

    it('SR-128 "Preuve associée" opens the proof viewer instead of navigating', async () => {
      const modifications = [{ id: 'm1', auth: 1, fields: { lastName: 'Durand' }, proof: 'https://archives.example.org/acte', author: 'a', date: '2024-01-02T10:00:00Z' }];
      expanded(person({ modifications }));
      const link = screen.getByText('Preuve associée');
      expect(link.getAttribute('href')).toBe('https://archives.example.org/acte');
      expect(await fireEvent.click(link)).toBe(false);
      expect(get(stores.showProof)).toBe('https://archives.example.org/acte');
    });
  });
});
