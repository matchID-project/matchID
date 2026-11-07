import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
// synchronises requestAnimationFrame timestamps (transitions)
import './helpers.js';

// GEDCOM views of the /link flow (LinkConfigure, LinkCheck).
const { default: GedcomPersonCard } = await import('../../../src/components/views/GedcomPersonCard.svelte');
const { default: GedcomTree } = await import('../../../src/components/views/GedcomTree.svelte');

const record = (overrides = {}) => ({
  name: 'Mr Jean /Dupont/',
  sex: 'M',
  birt: { date: '3 OCT 1932', plac: 'Eysines, France' },
  deat: { date: '16 JAN 2020', plac: 'Pessac, France', age: 87 },
  ...overrides
});
const card = (container) => container.querySelector('.rf-card');
const isExpanded = (container) => card(container).classList.contains('rf-card--md');
const rows = (container, column) => {
  const title = [...container.querySelectorAll('strong')].find(s => s.textContent === column);
  return [...title.closest('div').querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim()));
};

describe('GedcomPersonCard', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/link');
  });

  it('SR-256 splits a GEDCOM name "Given /Surname/" and strips the titles', () => {
    const r = record();
    render(GedcomPersonCard, { record: r, id: '@I1@' });
    expect(r.surn).toBe('Dupont');
    expect(r.givn.trim()).toBe('Jean');
    expect(screen.getByRole('heading', { level: 4 }).textContent.replace(/\s+/g, ' ').trim()).toBe('Dupont Jean');
    const structured = record({ name: { givn: 'Marie', surn: 'Martin' } });
    render(GedcomPersonCard, { record: structured, id: '@I2@' });
    expect([structured.surn, structured.givn]).toEqual(['Martin', 'Marie']);
  });

  it('SR-257 parses the city and the country of a "city, country" place', () => {
    const r = record();
    render(GedcomPersonCard, { record: r, id: '@I1@' });
    expect([r.birt.city, r.birt.ctry]).toEqual(['Eysines', 'France']);
    expect([r.deat.city, r.deat.ctry]).toEqual(['Pessac', 'France']);
  });

  // BUG: with a "city, department, country" place the regexes of
  // GedcomPersonCard.svelte:166-175 are greedy: city = "Bordeaux, 33" and the
  // department regex leaves the country in place: depc = "33 France".
  it.fails('SR-257 parses the city, the department and the country of a "city, dept, country" place', () => {
    const r = record({ birt: { date: '1932', plac: 'Bordeaux, 33, France' } });
    render(GedcomPersonCard, { record: r, id: '@I1@' });
    expect([r.birt.city, r.birt.depc, r.birt.ctry]).toEqual(['Bordeaux', '33', 'France']);
  });

  it('SR-258 compact: name and dates; expanded: also the cities', async () => {
    const { container } = render(GedcomPersonCard, { record: record(), id: '@I1@' });
    const desc = () => container.querySelector('.rf-card__desc').textContent.replace(/\s+/g, ' ').trim();
    expect(desc()).toBe('3 OCT 1932 - 16 JAN 2020');
    await fireEvent.click(card(container));
    expect(desc()).toBe('Eysines 3 OCT 1932 - Pessac 16 JAN 2020');
  });

  it('SR-259 clicking the card toggles it and sets location.hash to its id', async () => {
    const { container } = render(GedcomPersonCard, { record: record(), id: 'I1' });
    await fireEvent.click(card(container));
    expect(isExpanded(container)).toBe(true);
    expect(location.hash).toBe('#I1');
    await fireEvent.click(card(container));
    expect(isExpanded(container)).toBe(false);
  });

  it('SR-260 a hashchange to its own id expands the card, another id collapses it', async () => {
    const a = render(GedcomPersonCard, { record: record(), id: 'I1' });
    const b = render(GedcomPersonCard, { record: record({ name: 'Marie /Martin/' }), id: 'I2' });
    window.location.hash = 'I2';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await waitFor(() => expect(isExpanded(b.container)).toBe(true));
    expect(isExpanded(a.container)).toBe(false);
    window.location.hash = 'I1';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await waitFor(() => expect(isExpanded(a.container)).toBe(true));
    expect(isExpanded(b.container)).toBe(false);
  });

  it('SR-261 shows the M/F avatar with the focus / active / inactive styles', () => {
    const inactive = render(GedcomPersonCard, { record: record({ sex: 'F' }), id: 'a' });
    expect(inactive.container.querySelector('img').getAttribute('src')).toBe('/female.svg');
    expect(inactive.container.querySelector('img').className).toContain('rf-background--g400');
    expect(card(inactive.container).className).toContain('rf-inactive');
    const active = render(GedcomPersonCard, { record: record(), id: 'b', active: true });
    expect(active.container.querySelector('img').getAttribute('src')).toBe('/male.svg');
    expect(active.container.querySelector('img').className).toContain('rf-callout--scheme-soft-blue-soft');
    expect(card(active.container).className).not.toContain('rf-inactive');
    const focus = render(GedcomPersonCard, { record: record(), id: 'c', focus: true });
    expect(focus.container.querySelector('img').className).toContain('rf-background--bf');
  });

  it('SR-262 a matchID note borders the avatar and links "identification à <score>" to /id/<id>', async () => {
    const r = record({ note: { cont: ['matchid https://deces.matchid.io/id/abc123 à 0.95'] } });
    const { container } = render(GedcomPersonCard, { record: r, id: 'I1' });
    expect(container.querySelector('img').classList.contains('match')).toBe(true);
    await fireEvent.click(card(container));
    const link = screen.getByText('identification à 0.95');
    expect(link.getAttribute('href')).toBe('/id/abc123');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('SR-263 shows the Naissance and Décès tables (masculin/féminin, age "N ans")', async () => {
    const { container } = render(GedcomPersonCard, { record: record(), id: 'I1' });
    await fireEvent.click(card(container));
    // current behaviour: without a department part, depc keeps the whole place (see the SR-257 BUG)
    expect(rows(container, 'Naissance')).toEqual([
      ['Nom', 'Dupont'], ['Prénom(s)', 'Jean'], ['Sexe', 'masculin'], ['Date', '3 OCT 1932'],
      ['Commune', 'Eysines'], ['Département', 'Eysines, France'], ['Pays', 'France']
    ]);
    expect(rows(container, 'Décès')).toEqual([
      ['Date', '16 JAN 2020'], ['Age', '87 ans'], ['Commune', 'Pessac'], ['Département/Région', 'Pessac, France'], ['Pays', 'France']
    ]);
    const f = render(GedcomPersonCard, { record: record({ sex: 'F', deat: undefined }), id: 'I2' });
    await fireEvent.click(card(f.container));
    expect(rows(f.container, 'Naissance')).toContainEqual(['Sexe', 'féminin']);
    expect([...f.container.querySelectorAll('strong')].map(s => s.textContent)).not.toContain('Décès');
  });

  it('SR-264 links the parents, spouse(s) and children to their #id', async () => {
    const r = record({
      pare: [{ id: '@I8@', surn: 'Dupont', givn: 'Paul' }],
      cons: [{ id: '@I2@', surn: 'Martin', givn: 'Marie' }],
      chil: [{ id: '@I3@', surn: 'Dupont', givn: 'Luc' }]
    });
    const { container } = render(GedcomPersonCard, { record: r, id: 'I1' });
    await fireEvent.click(card(container));
    expect(screen.getByTitle('Dupont Paul').getAttribute('href')).toBe('#@I8@');
    expect(screen.getByTitle('Martin Marie').getAttribute('href')).toBe('#@I2@');
    expect(screen.getByTitle('Dupont Luc').getAttribute('href')).toBe('#@I3@');
    expect(screen.getByText('Parents')).toBeTruthy();
    expect(screen.getByText('Conjoint')).toBeTruthy();
    expect(screen.getByText('Enfants')).toBeTruthy();
  });

  // BUG: `record.cons.lengh > 1` (typo, GedcomPersonCard.svelte:100): the
  // plural "Conjoints" is never displayed.
  it.fails('SR-264 labels several spouses "Conjoints"', async () => {
    const r = record({ cons: [{ id: '@I2@', surn: 'Martin', givn: 'Marie' }, { id: '@I4@', surn: 'Durand', givn: 'Anne' }] });
    const { container } = render(GedcomPersonCard, { record: r, id: 'I1' });
    await fireEvent.click(card(container));
    expect(screen.getByText('Conjoints')).toBeTruthy();
  });

  it('SR-265 renders the notes with clickable http links', async () => {
    const r = record({ note: { xxxx: 'Ancien combattant', cont: ['voir http://archives.example.org/acte'] } });
    const { container } = render(GedcomPersonCard, { record: r, id: 'I1' });
    await fireEvent.click(card(container));
    const link = container.querySelector('a[href="http://archives.example.org/acte"]');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getByText(/Ancien combattant/)).toBeTruthy();
  });

  // BUG: only `http:` URLs are linkified (GedcomPersonCard.svelte:194); an
  // https link in a note stays plain text.
  it.fails('SR-265 also links https URLs in the notes', async () => {
    const r = record({ note: { cont: ['voir https://archives.example.org/acte'] } });
    const { container } = render(GedcomPersonCard, { record: r, id: 'I1' });
    await fireEvent.click(card(container));
    expect(container.querySelector('a[href="https://archives.example.org/acte"]')).not.toBeNull();
  });

  it('SR-266 calls the mouseenter / mouseleave callback props', async () => {
    const mouseenter = vi.fn();
    const mouseleave = vi.fn();
    const { container } = render(GedcomPersonCard, { record: record(), id: 'I1', mouseenter, mouseleave });
    await fireEvent.mouseEnter(container.firstElementChild);
    expect(mouseenter).toHaveBeenCalledTimes(1);
    await fireEvent.mouseLeave(container.firstElementChild);
    expect(mouseleave).toHaveBeenCalledTimes(1);
  });
});

describe('GedcomTree', () => {
  // Two parents (family @F1@) and two children.
  const gedcom = () => ({
    '@I1@': { name: 'Jean /Dupont/', sex: 'M', birt: { date: '1900' }, fams: '@F1@' },
    '@I2@': { name: 'Marie /Martin/', sex: 'F', birt: { date: '1902' }, fams: '@F1@' },
    '@I3@': { name: 'Luc /Dupont/', sex: 'M', birt: { date: '1930' }, famc: '@F1@' },
    '@I4@': { name: 'Anne /Dupont/', sex: 'F', birt: { date: '1932' }, famc: '@F1@' },
    '@F1@': { husb: '@I1@', wife: '@I2@', chil: ['@I3@', '@I4@'] }
  });
  const generations = (container) => [...container.querySelectorAll('.rf-grid-row.rf-margin-bottom-2N')]
    .map(row => [...row.querySelectorAll('h4')].map(h => h.textContent.replace(/\s+/g, ' ').trim()));
  const personCard = (id) => document.getElementById(id);

  afterEach(() => {
    vi.useRealTimers();
  });

  it('SR-267 renders the tree once the relations are computed', () => {
    render(GedcomTree, { gedcom: gedcom() });
    expect(screen.getByText(/Visualisation des individus de l'arbre généalogique/)).toBeTruthy();
  });

  it('SR-268 derives the parents, children and spouses from the families', () => {
    const g = gedcom();
    render(GedcomTree, { gedcom: g });
    expect(g['@I3@'].pare).toEqual([{ id: '@I1@', surn: 'Dupont', givn: 'Jean ' }, { id: '@I2@', surn: 'Martin', givn: 'Marie ' }]);
    expect(g['@I1@'].chil.map(c => c.id)).toEqual(['@I3@', '@I4@']);
    expect(g['@I1@'].cons).toEqual([{ id: '@I2@', surn: 'Martin', givn: 'Marie ' }]);
    expect(g['@I2@'].cons.map(c => c.id)).toEqual(['@I1@']);
  });

  it('SR-269 shows one row per generation rank', () => {
    const { container } = render(GedcomTree, { gedcom: gedcom() });
    expect(generations(container)).toEqual([['Dupont Jean', 'Martin Marie'], ['Dupont Luc', 'Dupont Anne']]);
  });

  it('SR-270 hovering a person focuses it, highlights its family and dims the others', async () => {
    render(GedcomTree, { gedcom: gedcom() });
    await fireEvent.mouseEnter(personCard('@I1@'));
    const avatar = (id) => personCard(id).querySelector('img').className;
    const inactive = (id) => personCard(id).querySelector('.rf-card').classList.contains('rf-inactive');
    expect(avatar('@I1@')).toContain('rf-background--bf');
    expect(avatar('@I2@')).toContain('rf-callout--scheme-soft-blue-soft');
    expect(avatar('@I3@')).toContain('rf-callout--scheme-soft-blue-soft');
    expect([inactive('@I1@'), inactive('@I2@'), inactive('@I3@')]).toEqual([false, false, false]);
    expect(document.getElementById('@F1@').classList.contains('rf-hide')).toBe(false);
  });

  it('SR-271 leaving the tree resets the highlight', async () => {
    const { container } = render(GedcomTree, { gedcom: gedcom() });
    await fireEvent.mouseEnter(personCard('@I3@'));
    await fireEvent.mouseLeave(container.querySelector('.rf-container-fluid'));
    expect(personCard('@I3@').querySelector('img').className).toContain('rf-callout--scheme-soft-blue-soft');
    expect(personCard('@I1@').querySelector('img').className).not.toContain('rf-background--bf');
    expect(document.getElementById('@F1@').classList.contains('rf-hide')).toBe(true);
  });

  it('SR-272 positions and rotates the spouse connector line between the two spouses', async () => {
    vi.useFakeTimers();
    render(GedcomTree, { gedcom: gedcom() });
    const place = (id, top, left) => {
      const el = personCard(id);
      Object.defineProperties(el, {
        offsetTop: { value: top, configurable: true },
        offsetLeft: { value: left, configurable: true },
        offsetHeight: { value: 40, configurable: true },
        offsetWidth: { value: 100, configurable: true }
      });
    };
    place('@I2@', 0, 0); // wife: line origin
    place('@I1@', 0, 300); // husband, same row
    await fireEvent.mouseEnter(personCard('@I1@'));
    await vi.advanceTimersByTimeAsync(500);
    const line = document.getElementById('@F1@');
    expect(line.style.height).toBe('300px');
    expect(line.style.left).toBe('200px');
    expect(line.style.top).toBe('-130px');
    expect(line.classList.contains('rf-hide')).toBe(false);
  });

  it('SR-273 a click recomputes the lines', async () => {
    vi.useFakeTimers();
    const { container } = render(GedcomTree, { gedcom: gedcom() });
    await vi.advanceTimersByTimeAsync(500);
    const line = document.getElementById('@F1@');
    Object.defineProperty(personCard('@I1@'), 'offsetLeft', { value: 400, configurable: true });
    Object.defineProperty(personCard('@I1@'), 'offsetWidth', { value: 0, configurable: true });
    await fireEvent.click(container.querySelector('.rf-container-fluid'));
    await vi.advanceTimersByTimeAsync(500);
    expect(line.style.height).toBe('400px');
  });
});
