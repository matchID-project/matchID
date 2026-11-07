import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';

// jsdom has no canvas: record charts instead of drawing them.
vi.mock('chart.js/auto', () => {
  class FakeChart {
    static defaults = { font: {} };
    static register() {}
    constructor(ctx, config) { this.config = config; }
    update() {}
    destroy() {}
  }
  return { default: FakeChart };
});
vi.mock('../../../src/components/views/GedcomTree.svelte', async () =>
  ({ default: (await import('./stubs/index.js')).stubComponent('GedcomTree') }));

const { stubProps } = await import('./stubs/index.js');
const { default: LinkCheck } = await import('../../../src/components/views/LinkCheck.svelte');
const {
  linkResults, linkCompleteResults, linkValidations, linkOptions, linkMapping, linkSourceHeader,
  linkFileName, linkCompleted, linkWaiter
} = await import('../../../src/components/tools/stores.js');
const { resetLinkStores, stubFetch, flush, captureTableHeightTimer } = await import('./helpers.js');
const { buildResults, mapping, sourceHeader, col } = await import('./fixtures.js');

const csvOptions = { sep: ';', quote: undefined, skipLines: 0, encoding: 'utf8', type: 'csv', dateFormat: 'dd/MM/yyyy' };

const setResults = ({ results, complete } = buildResults(), options = {}) => {
  linkSourceHeader.set([...sourceHeader]);
  linkMapping.set(structuredClone(mapping));
  linkFileName.set('clients.csv');
  linkOptions.update(o => ({ ...o, csv: { ...csvOptions, ...options } }));
  linkCompleteResults.set(complete);
  linkResults.set(results);
};

const text = () => document.body.textContent.replace(/\s+/g, ' ');
const tableTitles = () => [...document.querySelectorAll('p > strong')].map(s => s.textContent.trim())
  .filter(t => /identités/.test(t));

// Capture the files produced by the download buttons.
const captureDownloads = () => {
  const downloads = [];
  const blobs = [];
  URL.createObjectURL = vi.fn(blob => { blobs.push(blob); return `blob:${blobs.length}`; });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    downloads.push({ name: this.download, blob: blobs[blobs.length - 1] });
  });
  return downloads;
};

describe('LinkCheck (step 4: results, validation, downloads)', () => {
  let flushTableHeight;
  beforeEach(() => {
    resetLinkStores();
    flushTableHeight = captureTableHeightTimer();
    stubProps.length = 0;
    stubFetch({ 'POST /deces/api/v1/compare': { explain: {} } });
    HTMLCanvasElement.prototype.getContext = () => ({});
    for (const [name, color] of [['--bf500', '#000091'], ['--success', '#008941'], ['--warning', '#b34000']]) {
      document.body.style.setProperty(name, color);
    }
    window.history.replaceState({}, '', '/link');
  });
  afterEach(() => {
    flushTableHeight();
    delete URL.createObjectURL;
    delete URL.revokeObjectURL;
  });

  it('LK-114 empty result: "Aucune correspondance de personne décédée n\'a été trouvée dans votre fichier."', async () => {
    const { complete } = buildResults();
    setResults({ complete, results: { header: complete.header, rows: [] } });
    render(LinkCheck);
    await waitFor(() => expect(text()).toContain('Aucune correspondance de personne décédée n\'a été trouvée dans votre fichier.'));
    expect(screen.queryByText('Téléchargez:')).toBeNull();
  });

  it('LK-115 all validated: "Toutes les identé(s) (N) ont été validées* !" with the auto-threshold footnote', async () => {
    setResults();
    linkOptions.update(o => ({ ...o, check: { ...o.check, autoCheckThreshold: 0.3 } }));
    render(LinkCheck);
    await waitFor(() => expect(text()).toContain('Toutes les identé(s) (3) ont été validées* !'));
    expect(text()).toContain('* validation automatique pour les scores > 30');
  });

  it('LK-116 highlights the download arrows only when nothing is left to validate', async () => {
    setResults();
    const { container } = render(LinkCheck);
    await waitFor(() => expect(tableTitles()).toHaveLength(2));
    expect(container.querySelector('.rf-fi-arrow-right-line')).toBeNull();
    document.body.innerHTML = '';
    linkOptions.update(o => ({ ...o, check: { ...o.check, autoCheckThreshold: 0.3 } }));
    const second = render(LinkCheck);
    await waitFor(() => expect(second.container.querySelector('.rf-fi-arrow-right-line')).not.toBeNull());
    expect(second.container.querySelector('.rf-fi-arrow-left-line')).not.toBeNull();
  });

  it('LK-117 downloads "le fichier complet" as <base>_deces_INSEE_complete.<ext> with a spinner', async () => {
    const downloads = captureDownloads();
    setResults();
    render(LinkCheck);
    const button = await screen.findByTitle('télécharger le fichier complet');
    expect(button.textContent).toContain('le fichier complet');
    await fireEvent.click(button);
    expect(button.querySelector('.spin')).not.toBeNull();
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toBe('clients_deces_INSEE_complete.csv');
    expect(button.querySelector('.spin')).toBeNull();
    const lines = (await downloads[0].blob.text()).split('\r\n').filter(l => l);
    // header + 5 candidate rows (unmatched line included)
    expect(lines).toHaveLength(6);
    expect(lines[0].endsWith(';valid;checked')).toBe(true);
    expect(lines.some(l => l.startsWith('Durand;Paul'))).toBe(true);
  });

  it('LK-118 downloads "les décès identifiés" (scored rows only) as <base>_deces_INSEE_matched.<ext>', async () => {
    const downloads = captureDownloads();
    setResults();
    render(LinkCheck);
    await fireEvent.click(await screen.findByTitle('télécharger les décès identifiés'));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toBe('clients_deces_INSEE_matched.csv');
    const lines = (await downloads[0].blob.text()).split('\r\n').filter(l => l);
    expect(lines).toHaveLength(5);
    expect(lines.some(l => l.startsWith('Durand'))).toBe(false);
  });

  it('LK-119 Gedcom mode: "le fichier CSV" (.csv) and "le fichier Gedcom" enriched with NOTE/DEAT', async () => {
    const downloads = captureDownloads();
    const { results, complete } = buildResults();
    // Gedcom results: the first column holds the gedcom id
    for (const group of complete.rows) for (const r of group) r[0] = `@i${r[col('sourceLineNumber')]}@`;
    const gedcom = {
      head: { char: 'UTF-8' },
      '@i1@': { xxxx: 'INDI', name: 'Jean /Dupont/', birt: { date: '1 FEB 1950' } },
      '@i2@': { xxxx: 'INDI', name: 'Marie /Martin/' },
      '@i3@': { xxxx: 'INDI', name: 'Paul /Durand/' },
      '@i4@': { xxxx: 'INDI', name: 'Luc /Petit/' }
    };
    linkFileName.set('tree.ged');
    setResults({ results, complete }, { type: 'gedcom', sep: '\t', gedcom });
    linkFileName.set('tree.ged');
    render(LinkCheck);
    expect((await screen.findByTitle('télécharger le fichier CSV')).textContent).toContain('le fichier CSV');
    const gedButton = screen.getByTitle('télécharger le fichier Gedcom');
    expect(gedButton.textContent).toContain('le fichier Gedcom');
    await fireEvent.click(screen.getByTitle('télécharger le fichier CSV'));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toBe('tree_deces_INSEE_complete.csv');
    await fireEvent.click(gedButton);
    await waitFor(() => expect(downloads).toHaveLength(2));
    expect(downloads[1].name).toBe('tree_deces_INSEE_matched.ged');
    const ged = await downloads[1].blob.text();
    expect(ged).toContain('0 HEAD');
    // @i1@ is auto-validated (score 0.95): enriched with a NOTE on the match
    const indi = ged.split('\r\n0 ').find(block => block.startsWith('@I1@'));
    expect(indi).toContain('1 NOTE');
    expect(indi).toContain('2 CONT matchid: http://localhost:3000/id/id1 à 95%');
    expect(indi).toContain('2 CONT name: JEAN /DUPONT/');
    // not validated: no note
    expect(ged.split('\r\n0 ').find(block => block.startsWith('@I4@'))).not.toContain('NOTE');
  });

  // BUG: toJsonGedcom() reads `results[0].deat` / `.birt` / `.surn` on the
  // YAML lines array (not on the matched record), so DEAT/BIRT/SURN are never
  // added to an individual without them; the date fallbacks also write the
  // date into `plac` (LinkCheck.svelte:265, 270, 273).
  it.fails('LK-119 adds the matched death (DEAT) to a Gedcom individual without one', async () => {
    const downloads = captureDownloads();
    const { results, complete } = buildResults();
    for (const group of complete.rows) for (const r of group) r[0] = `@i${r[col('sourceLineNumber')]}@`;
    const gedcom = { head: {}, '@i1@': { name: 'Jean /Dupont/' }, '@i2@': {}, '@i3@': {}, '@i4@': {} };
    setResults({ results, complete }, { type: 'gedcom', sep: '\t', gedcom });
    linkFileName.set('tree.ged');
    render(LinkCheck);
    await fireEvent.click(await screen.findByTitle('télécharger le fichier Gedcom'));
    await waitFor(() => expect(downloads).toHaveLength(1));
    const indi = (await downloads[0].blob.text()).split('\r\n0 ').find(block => block.startsWith('@I1@'));
    expect(indi).toMatch(/^1 DEAT/m);
  });

  it('LK-120 CSV export: separator from options, quoting (separator / leading zero), CRLF, valid & checked columns', async () => {
    const downloads = captureDownloads();
    const built = buildResults();
    built.complete.rows[0][0][col('extra')] = 'a;b';
    built.complete.rows[2][0][col('extra')] = { nested: true }; // non-string cell
    setResults(built);
    render(LinkCheck);
    await fireEvent.click(await screen.findByTitle('télécharger le fichier complet'));
    await waitFor(() => expect(downloads).toHaveLength(1));
    const content = await downloads[0].blob.text();
    expect(content.endsWith('\r\n')).toBe(true);
    const lines = content.split('\r\n');
    const header = lines[0].split(';');
    expect(header.slice(-2)).toEqual(['valid', 'checked']);
    expect(header).toContain('sourceLineNumber');
    const dupont = lines.find(l => l.startsWith('Dupont'));
    expect(dupont).toContain('"a;b"');
    expect(dupont.endsWith(';true;auto')).toBe(true); // auto-validated 0.95
    const petit = lines.find(l => l.startsWith('Petit'));
    expect(petit).toContain(';"0123";'); // leading zero protected
    expect(petit.endsWith(';;')).toBe(true); // not validated
    expect(dupont).toContain('{"score":0.95');
    expect(lines.find(l => l.startsWith('Durand'))).toContain(';{"nested":true};');
  });

  // BUG: toCsv() pushes valid/checked onto the result rows IN PLACE, and the
  // exported values are read at fixed indexes: a second download after a
  // validation change still exports the validations of the first download.
  it.fails('LK-120 a second download exports the current validations', async () => {
    const downloads = captureDownloads();
    setResults();
    render(LinkCheck);
    await fireEvent.click(await screen.findByTitle('télécharger le fichier complet'));
    await waitFor(() => expect(downloads).toHaveLength(1));
    linkValidations.update(v => { v[2][0] = { valid: true, checked: '1 - manual' }; return v; });
    await fireEvent.click(screen.getByTitle('télécharger le fichier complet'));
    await waitFor(() => expect(downloads).toHaveLength(2));
    const petit = (await downloads[1].blob.text()).split('\r\n').find(l => l.startsWith('Petit'));
    expect(petit.endsWith(';true;true')).toBe(true);
  });

  it('LK-121 a download marks step 4 as completed', async () => {
    const downloads = captureDownloads();
    setResults();
    render(LinkCheck);
    await waitFor(() => expect(tableTitles()).toHaveLength(2));
    expect(get(linkCompleted)).toBe(false);
    await fireEvent.click(screen.getByTitle('télécharger le fichier complet'));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(get(linkCompleted)).toBe(true);
  });

  it('LK-122 auto-validates scores >= autoCheckThreshold, keeps manual checks, recomputes on threshold change', async () => {
    setResults();
    linkValidations.set([[{ checked: false }], [{ valid: false, checked: '1 - manual' }, { checked: false }], [{ checked: false }]]);
    render(LinkCheck);
    await flush();
    expect(get(linkValidations)).toEqual([
      [{ valid: true, checked: 'auto' }],
      [{ valid: false, checked: '1 - manual' }, { checked: false }],
      [{ checked: false }]
    ]);
    linkOptions.update(o => ({ ...o, check: { ...o.check, autoCheckThreshold: 0.55 } }));
    await flush();
    expect(get(linkValidations)).toEqual([
      [{ valid: true, checked: 'auto' }],
      [{ valid: false, checked: '1 - manual' }, { checked: false }],
      [{ valid: true, checked: 'auto' }]
    ]);
    linkOptions.update(o => ({ ...o, check: { ...o.check, autoCheckThreshold: 0.99 } }));
    await flush();
    expect(get(linkValidations)[0]).toEqual([{ checked: false }]);
  });

  it('LK-123 $linkCompleted is true iff some rows are checked and none is left unchecked', async () => {
    setResults();
    render(LinkCheck);
    await waitFor(() => expect(tableTitles()).toHaveLength(2));
    expect(get(linkCompleted)).toBe(false);
    linkOptions.update(o => ({ ...o, check: { ...o.check, autoCheckThreshold: 0.3 } }));
    await waitFor(() => expect(get(linkCompleted)).toBe(true));
    linkOptions.update(o => ({ ...o, check: { ...o.check, autoCheckThreshold: 0.99 } }));
    await waitFor(() => expect(get(linkCompleted)).toBe(false));
  });

  it('LK-124 opens the Options (validation parameters) and Statistiques panels', async () => {
    setResults();
    render(LinkCheck);
    await waitFor(() => expect(tableTitles()).toHaveLength(2));
    const options = document.querySelector('a[href="#options"]');
    const stats = document.querySelector('a[href="#statistiques"]');
    expect(options.getAttribute('aria-label')).toBe('Options');
    expect(stats.getAttribute('aria-label')).toBe('Statistiques');
    await fireEvent.click(options.closest('span'));
    expect(text()).toContain('Paramètres de validation');
    expect(text()).not.toContain('Formattage du fichier');
    await fireEvent.click(document.querySelector('a[href="#options"]').closest('span'));
    await fireEvent.click(document.querySelector('a[href="#statistiques"]').closest('span'));
    expect(text()).toContain('Statistiques d\'appariement');
    expect(text()).not.toContain('Paramètres de validation');
  });

  it('LK-125 renders "N identités à valider :" (score desc, master) and "N identités validées :" (score asc)', async () => {
    setResults();
    linkOptions.update(o => ({ ...o, check: { ...o.check, autoCheckThreshold: 0.65 } }));
    render(LinkCheck);
    await waitFor(() => expect(tableTitles()).toEqual(['1 identités à valider :', '2 identités validées :']));
    const scoreColumns = [...document.querySelectorAll('table[style*="border-right"]')]
      .map(t => [...t.querySelectorAll('td.hcenter[title]')].map(td => td.textContent.trim()));
    expect(scoreColumns[0]).toEqual(['60%', '50%']);
    expect(scoreColumns[1]).toEqual(['70%', '95%']);
  });

  it('LK-126 shows the Gedcom results tree view for a Gedcom input', async () => {
    const gedcom = { head: {}, '@i1@': { name: 'Jean /Dupont/' } };
    const { results, complete } = buildResults();
    for (const group of complete.rows) for (const r of group) r[0] = `@i${r[col('sourceLineNumber')]}@`;
    for (let i = 2; i <= 4; i++) gedcom[`@i${i}@`] = { name: 'X /Y/' };
    setResults({ results, complete }, { type: 'gedcom', gedcom });
    render(LinkCheck);
    await waitFor(() => expect(stubProps.map(p => p.name)).toContain('GedcomTree'));
    expect(stubProps.find(p => p.name === 'GedcomTree').props.gedcom['@i1@'].note).toBeDefined();
  });

  it('LK-127 clears the waiter once the results are present', async () => {
    linkWaiter.set('Préparation de la visualisation des résultats');
    setResults();
    render(LinkCheck);
    await flush();
    expect(get(linkWaiter)).toBe(false);
  });
});
