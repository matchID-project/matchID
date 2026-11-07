import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import LinkSampleTableHost from './stubs/LinkSampleTableHost.svelte';
import { linkFile, linkOptions, linkSourceHeader, linkSourceHeaderTypes } from '../../../src/components/tools/stores.js';
import { resetLinkStores, makeDataTransfer, flush } from './helpers.js';

const latin1Bytes = (text) => Uint8Array.from([...text].map(c => c.charCodeAt(0)));

// Render the sample table for `content` and wait for the file to be parsed.
// (through a host passing only `fields`, so that rerender({ fields }) updates
// it like LinkConfigure does, see stubs/LinkSampleTableHost.svelte)
const parse = async (content, { name = 'people.csv', fields = [] } = {}) => {
  linkFile.set(new File([content], name));
  const result = render(LinkSampleTableHost, { fields });
  await waitFor(() => expect(get(linkSourceHeader)).toBeTruthy());
  await flush();
  return result;
};

const csvOptions = () => get(linkOptions).csv;
const types = () => get(linkSourceHeaderTypes);
const tiles = (container) => [...container.querySelectorAll('div[draggable="true"]')];
const tileHeaders = (container) => tiles(container).map(t => t.querySelector('th').textContent);
const tileCells = (container, i) => [...tiles(container)[i].querySelectorAll('td')].map(td => td.textContent);

const gedcom = [
  '0 HEAD', '1 CHAR UTF-8',
  '0 @I1@ INDI', '1 NAME Jean /Dupont/', '2 GIVN Jean', '2 SURN Dupont', '1 SEX M',
  '1 BIRT', '2 DATE 12 MAR 1950', '2 PLAC Paris, 75, France',
  '1 DEAT', '2 DATE 11 JAN 2020', '2 PLAC Lyon, 69, France',
  '0 @I2@ INDI', '1 NAME Mr Pierre /Martin/', '1 BIRT', '2 DATE 13 FEB 1940',
  '0 TRLR', ''
].join('\n');

// Every FileReader started by the component: a test must not end while one is
// pending, or its onload would write the shared stores during the next test.
const readers = [];
const readAsText = FileReader.prototype.readAsText;

describe('LinkSampleTable: file sniffing and preview', () => {
  beforeEach(() => {
    resetLinkStores();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (...args) {
      readers.push(this);
      return readAsText.apply(this, args);
    });
  });
  afterEach(async () => {
    await waitFor(() => expect(readers.every(r => r.readyState === FileReader.DONE)).toBe(true));
    await flush();
    readers.length = 0;
  });

  it('LK-032 reads only the first 100 000 bytes of the file', async () => {
    const slice = vi.spyOn(Blob.prototype, 'slice');
    await parse('nom;prenom;ville\nDupont;Jean;Paris\n');
    expect(slice).toHaveBeenCalledWith(0, 100000);
  });

  it('LK-033 detects a UTF-8 file', async () => {
    const { container } = await parse('nom;prénom;ville\nDupont;Hélène;Évry\n');
    expect(csvOptions().encoding).toBe('utf8');
    expect(container.textContent).toContain('Hélène');
  });

  it('LK-033 detects a Latin-1 file (fewest non-ASCII residuals) and decodes accents', async () => {
    const { container } = await parse(latin1Bytes('nom;prenom;ville\nDupont;Hélène;Évry\n'));
    expect(['latin1', 'windows-1252', 'mac']).toContain(csvOptions().encoding);
    expect(csvOptions().encoding).not.toBe('utf8');
    expect(container.textContent).toContain('Hélène');
  });

  it('LK-034 detects a Gedcom file from its "0 HEAD" first line', async () => {
    await parse(gedcom, { name: 'tree.ged' });
    expect(csvOptions().type).toBe('gedcom');
  });

  for (const [label, sep] of [['semicolon', ';'], ['comma', ','], ['pipe', '|'], ['tab', '\t']]) {
    it(`LK-035 detects the ${label} separator`, async () => {
      await parse(['nom', 'prenom', 'ville'].join(sep) + '\n' + ['Dupont', 'Jean', 'Paris'].join(sep) + '\n'
        + ['Martin', 'Marie', 'Lyon'].join(sep) + '\n');
      expect(csvOptions().sep).toBe(sep);
      expect(get(linkSourceHeader)).toEqual(['nom', 'prenom', 'ville']);
    });
  }

  it('LK-036 detects one leading line with a different column count (skipLines)', async () => {
    await parse('Export du fichier clients\nnom;prenom;ville\nDupont;Jean;Paris\nMartin;Marie;Lyon\n');
    expect(csvOptions().skipLines).toBe(1);
    expect(get(linkSourceHeader)).toEqual(['nom', 'prenom', 'ville']);
  });

  // BUG: guessQuote() slices `csv.split(/(\r\n|\n\r|\n|\r)/)`, whose capturing
  // group keeps the line breaks as array items: skipping N lines only drops
  // about N/2 real lines, so with 2 preamble lines the header is wrong.
  it.fails('LK-036 skips two leading lines before the header', async () => {
    await parse('Export du fichier\nclients 2020\nnom;prenom;ville\nDupont;Jean;Paris\nMartin;Marie;Lyon\n');
    expect(csvOptions().skipLines).toBe(2);
    expect(get(linkSourceHeader)).toEqual(['nom', 'prenom', 'ville']);
  });

  it('LK-037 detects double quotes and parses quoted fields (doubled-quote escape)', async () => {
    const { container } = await parse('"nom";"prenom";"note"\n"Dupont";"Jean";"dit ""Jeannot"""\n"Martin";"Marie";"x"\n');
    expect(csvOptions().quote).toBe('"');
    expect(get(linkSourceHeader)).toEqual(['nom', 'prenom', 'note']);
    expect(tileCells(container, 0)).toContain('Dupont');
    expect(tileCells(container, 2)).toContain('dit "Jeannot"');
  });

  it('LK-037 keeps a separator inside a quoted field (after the first 10 lines)', async () => {
    const lines = ['"nom";"prenom"'];
    for (let i = 0; i < 10; i++) lines.push(`"N${i}";"P${i}"`);
    lines.push('"Dupont; Jr";"Jean"');
    const { unmount } = await parse(lines.join('\n') + '\n');
    expect(csvOptions().skipLines).toBe(0);
    expect(get(linkSourceHeader)).toEqual(['nom', 'prenom']);
    unmount();
  });

  // BUG: skipLines counts every line of the first 10 whose raw column count
  // differs, quotes ignored: a quoted separator in a data row makes the
  // header line be skipped.
  it.fails('LK-037 does not skip the header when a quoted field of the first lines contains the separator', async () => {
    await parse('"nom";"prenom";"note"\n"Dupont; Jr";"Jean";"x"\n"Martin";"Marie";"y"\n');
    expect(get(linkSourceHeader)).toEqual(['nom', 'prenom', 'note']);
  });

  // BUG: guessQuote() returns the rows parsed with the LAST candidate quote
  // ("), not with the detected one: single-quoted values keep their quotes in
  // the first preview.
  it.fails('LK-037 detects single quotes and unquotes the values', async () => {
    const { container } = await parse("'nom','prenom'\n'O''Neil','Jean'\n'Martin','Marie'\n");
    expect(csvOptions().quote).toBe("'");
    expect(tileCells(container, 0)).toContain("O'Neil");
  });

  it('LK-037 detects single quotes (quote option)', async () => {
    await parse("'nom','prenom'\n'Dupont','Jean'\n'Martin','Marie'\n");
    expect(csvOptions().quote).toBe("'");
  });

  it('LK-038 trims cells and shows empty cells as <vide>', async () => {
    const { container } = await parse('nom;prenom;ville\n  Dupont  ;;Paris\nMartin;Marie;Lyon\n');
    expect(tileCells(container, 0)[0]).toBe('Dupont');
    expect(tileCells(container, 1)[0]).toBe('<vide>');
  });

  it('LK-039 uses the first row after the skipped lines as $linkSourceHeader', async () => {
    await parse('nom,date naissance,commune\nDupont,01/02/1950,Paris\n');
    expect(get(linkSourceHeader)).toEqual(['nom', 'date naissance', 'commune']);
  });

  it('LK-040 persists the detected options once into $linkOptions.csv {sep, quote, skipLines, encoding, type}', async () => {
    await parse('nom;prenom\nDupont;Jean\n');
    expect(csvOptions()).toEqual({ sep: ';', quote: undefined, skipLines: 0, encoding: 'utf8', type: 'csv' });
  });

  it('LK-040 does not overwrite csv options that are already set (they are used to read the file)', async () => {
    const preset = { sep: ',', quote: undefined, skipLines: 0, encoding: 'utf8', type: 'csv', dateFormat: 'dd/MM/yyyy' };
    linkOptions.update(o => ({ ...o, csv: preset }));
    await parse('nom;prenom,ville\nDupont;Jean,Paris\n');
    expect(csvOptions()).toBe(preset);
    expect(get(linkSourceHeader)).toEqual(['nom;prenom', 'ville']);
  });

  it('LK-041 re-parses the file and refreshes the preview when the separator / skipLines change', async () => {
    const { container } = await parse('titre\nnom;prenom,ville\nDupont;Jean,Paris\nMartin;Marie,Lyon\n');
    expect(get(linkSourceHeader)).toEqual(['nom', 'prenom,ville']);
    linkOptions.update(o => ({ ...o, csv: { ...o.csv, sep: ',' } }));
    await waitFor(() => expect(get(linkSourceHeader)).toEqual(['nom;prenom', 'ville']));
    await waitFor(() => expect(tileHeaders(container)).toEqual(['nom;prenom', 'ville']));
    linkOptions.update(o => ({ ...o, csv: { ...o.csv, skipLines: 0 } }));
    await waitFor(() => expect(get(linkSourceHeader)).toEqual(['titre']));
  });

  it('LK-042 guesses date formats (6 formats)', async () => {
    await parse([
      'a;b;c;d;e;f',
      '1950/02/01;1950-02-01;19500201;01-02-1950;01/02/1950;01021950',
      '1960/12/31;1960-12-31;19601231;31-12-1960;31/12/1960;31121960'
    ].join('\n') + '\n');
    expect(Object.values(types()).map(t => `${t.type}=${t.format}`)).toEqual([
      'date=yyyy/MM/dd', 'date=yyyy-MM-dd', 'date=yyyyMMdd', 'date=dd-MM-yyyy', 'date=dd/MM/yyyy', 'date=ddMMyyyy'
    ]);
  });

  it('LK-042 guesses INSEE codes (incl. 2A/2B), postal codes, sex encodings and departments', async () => {
    await parse([
      'insee;corse;cp;s12;sfm;sfh;dep',
      '33001;2A004;33090;1;f;h;33',
      '33063;2B033;33100;2;m;f;2A',
      '33002;2A004;33130;1;f;h;971'
    ].join('\n') + '\n');
    const t = types();
    expect(t.insee.type).toBe('locationCode');
    expect(t.corse.type).toBe('locationCode');
    expect(t.cp.type).toBe('postalCode');
    expect([t.s12.type, t.s12.format]).toEqual(['sex', '12']);
    expect([t.sfm.type, t.sfm.format]).toEqual(['sex', 'fm']);
    expect([t.sfh.type, t.sfh.format]).toEqual(['sex', 'fh']);
    expect(t.dep.type).toBe('depCode');
  });

  it('LK-042 guesses last names, first names, cities and countries; ignores columns under the 5 % threshold', async () => {
    const rows = ['nom;prenom;ville;pays;libre'];
    rows.push('Martin;Nathalie;Paris;France;x1', 'Dubois;Isabelle;Lyon;Algérie;x2', 'Petit;Sylvie;Marseille;Maroc;x3');
    for (let i = 0; i < 40; i++) rows.push(`Zzz${i};Qqq${i};Www${i};Vvv${i};y${i}`);
    await parse(rows.join('\n') + '\n');
    const t = types();
    expect(t.nom.type).toBe('lastName');
    expect(t.prenom.type).toBe('firstName');
    expect(t.ville.type).toBe('city');
    expect(t.pays.type).toBe('country');
    expect(t.libre).toBeUndefined();
  });

  it('LK-042 pins that guessBoost is never applied (freq is never above 1)', async () => {
    await parse('ville;nom\nParis;Martin\nLyon;Bernard\n');
    expect(types().ville).toEqual({ type: 'city', format: false, freq: 1 });
    expect(types().nom).toEqual({ type: 'lastName', format: false, freq: 1 });
  });

  it('LK-043 stores the guessed types in $linkSourceHeaderTypes as {type, format, freq}', async () => {
    await parse('naissance;sexe\n01/02/1950;m\n03/04/1960;f\n');
    expect(types()).toEqual({
      naissance: { type: 'date', format: 'dd/MM/yyyy', freq: 1 },
      sexe: { type: 'sex', format: 'fm', freq: 1 }
    });
  });

  const fields = (mapTo = {}) => [
    { label: 'Nom', field: 'lastName', mapTo: mapTo.lastName },
    { label: 'Prénom', field: 'firstName', mapTo: mapTo.firstName },
    { label: 'Décès', field: { query: 'deathDate', result: 'deathDate' }, mapTo: mapTo.deathDate }
  ];
  const sevenRows = 'a;b;c;d\n' + [1, 2, 3, 4, 5, 6, 7].map(i => `a${i};b${i};c${i};d${i}`).join('\n') + '\n';

  it('LK-044 shows the header and 5 sample rows per column tile', async () => {
    const { container } = await parse(sevenRows, { fields: fields() });
    expect(tileHeaders(container)).toEqual(['a', 'b', 'c', 'd']);
    expect(tileCells(container, 0)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
  });

  it('LK-044 lists mapped columns first (in field order) and greys unmapped ones', async () => {
    const { container, rerender } = await parse(sevenRows, { fields: fields() });
    await rerender({ fields: fields({ lastName: 'c', firstName: 'b' }) });
    await flush();
    expect(tileHeaders(container)).toEqual(['c', 'b', 'a', 'd']);
    const inactive = tiles(container).map(t => t.querySelector('table').classList.contains('rf-inactive'));
    expect(inactive).toEqual([false, false, true, true]);
    expect(tileCells(container, 0)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
  });

  // BUG: mapped columns are listed through `mapping.reverse[f.field]`; for the
  // death date fields `f.field` is an object ({query, result}) so the lookup
  // fails, and the column is also excluded from the unmapped list: a column
  // mapped to a death date disappears from the preview.
  it.fails('LK-044 keeps a column mapped to the death date in the preview', async () => {
    const { container, rerender } = await parse(sevenRows, { fields: fields() });
    await rerender({ fields: fields({ lastName: 'a', deathDate: 'd' }) });
    await flush();
    expect(tileHeaders(container)).toContain('d');
  });

  it('LK-045 fills <datalist id="LinkSampleTable"> with the column names', async () => {
    const { container } = await parse('nom;prenom\nDupont;Jean\n');
    const options = [...container.querySelectorAll('datalist#LinkSampleTable option')].map(o => o.textContent);
    expect(options).toEqual(['nom', 'prenom']);
  });

  it('LK-046 column tiles are draggable; dragstart sends {col, type, format, freq} as JSON', async () => {
    const { container } = await parse('naissance;nom\n01/02/1950;Martin\n03/04/1960;Bernard\n');
    const dataTransfer = makeDataTransfer();
    await fireEvent.dragStart(tiles(container)[0], { dataTransfer });
    expect(dataTransfer.effectAllowed).toBe('move');
    expect(JSON.parse(dataTransfer.store['text/plain'])).toEqual({
      col: 'naissance', type: 'date', format: 'dd/MM/yyyy', freq: 1
    });
  });

  it('LK-047 sets the full cell value as title (cells are ellipsized by CSS)', async () => {
    const long = 'x'.repeat(200);
    const { container } = await parse(`nom;note\nDupont;${long}\n`);
    const td = tiles(container)[1].querySelector('td');
    expect(td.getAttribute('title')).toBe(long);
  });

  it('LK-048 parses a Gedcom file into 15 fixed columns and a generated TSV', async () => {
    await parse(gedcom, { name: 'tree.ged' });
    expect(get(linkSourceHeader)).toEqual([
      'gedcom_id', 'nom', 'prénom(s)', 'nom_prénom(s)', 'sexe',
      'date de naissance', 'ville de naissance', 'pays de naissance', 'département de naissance', 'lieu de naissance',
      'date de décès', 'ville de décès', 'pays de décès', 'département de décès', 'lieu de décès'
    ]);
    const options = csvOptions();
    expect(options).toMatchObject({ sep: '\t', skipLines: 0, dateFormat: 'yyyyMMdd', encoding: 'utf-8', type: 'gedcom' });
    expect(options.gedcom['@i1@'].birt.plac).toBe('Paris, 75, France');
    const tsv = options.csv.split('\n');
    expect(tsv).toHaveLength(3);
    expect(tsv[0].split('\t')).toHaveLength(15);
    const first = tsv[1].split('\t');
    expect(first[0]).toBe('@i1@');
    expect(first[4]).toBe('M');
    expect(first[9]).toBe('Paris, 75, France');
    expect(first[14]).toBe('Lyon, 69, France');
  });

  // BUG: the city/department/country split of a Gedcom place uses greedy
  // regexes: "Paris, 75, France" gives city "Paris, 75" and department
  // "75 France".
  it.fails('LK-048 splits a Gedcom place "city, department, country"', async () => {
    await parse(gedcom, { name: 'tree.ged' });
    const first = csvOptions().csv.split('\n')[1].split('\t');
    expect(first.slice(6, 9)).toEqual(['Paris', 'France', '75']);
  });

  it('LK-049 converts Gedcom day-month-year dates to yyyyMMdd', async () => {
    await parse(gedcom, { name: 'tree.ged' });
    const rows = csvOptions().csv.split('\n').map(r => r.split('\t'));
    expect(rows[1][5]).toBe('19500312');
    expect(rows[1][10]).toBe('20200111');
    expect(rows[2][5]).toBe('19400213');
  });

  // BUG: single-digit days are not zero-padded: "1 JAN 2020" -> "2020011".
  it.fails('LK-049 zero-pads single-digit Gedcom days', async () => {
    await parse(gedcom.replace('2 DATE 11 JAN 2020', '2 DATE 1 JAN 2020'), { name: 'tree.ged' });
    const rows = csvOptions().csv.split('\n').map(r => r.split('\t'));
    expect(rows[1][10]).toBe('20200101');
  });

  // BUG: dates without a day ("MAR 2020") or a month ("1950") produce the
  // literal string "undefined" ("202003undefined", "195000undefined").
  it.fails('LK-049 converts partial Gedcom dates without an "undefined" suffix', async () => {
    await parse(gedcom.replace('2 DATE 11 JAN 2020', '2 DATE MAR 2020'), { name: 'tree.ged' });
    const rows = csvOptions().csv.split('\n').map(r => r.split('\t'));
    expect(rows[1][10]).not.toContain('undefined');
  });

  it('LK-050 parses a "First /Last/" Gedcom name and strips the civility', async () => {
    await parse(gedcom, { name: 'tree.ged' });
    const second = csvOptions().csv.split('\n')[2].split('\t');
    expect(second[1]).toBe('Martin'); // nom
    expect(second[2]).toBe('Pierre'); // prénom(s)
  });

  // BUG: with GIVN/SURN sub-records, first and last names are swapped
  // (`firstName = name.surn`, `lastName = name.givn`).
  it.fails('LK-050 maps GIVN to the first name and SURN to the last name', async () => {
    await parse(gedcom, { name: 'tree.ged' });
    const first = csvOptions().csv.split('\n')[1].split('\t');
    expect(first[1]).toBe('Dupont');
    expect(first[2]).toBe('Jean');
  });
});
