import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';

vi.mock('idb-keyval', async () => (await import('./idb-mock.js')).idbKeyvalMock);

const { default: LinkConfigureOptions } = await import('../../../src/components/views/LinkConfigureOptions.svelte');
const { linkOptions } = await import('../../../src/components/tools/stores.js');
const { useLocalSync } = await import('../../../src/components/tools/useLocalStorage.js');
const { resetLinkStores, flush } = await import('./helpers.js');

const csv = { sep: ';', quote: undefined, skipLines: 0, encoding: 'utf8', type: 'csv', dateFormat: 'dd/MM/yyyy', tmpfilePersistence: '3600000' };

const renderOptions = (props) => {
  linkOptions.update(o => ({ ...o, csv: { ...csv } }));
  return render(LinkConfigureOptions, props).container;
};
const control = (id) => document.getElementById(id);
const optionsOf = (id) => [...control(id).querySelectorAll('option')].map(o => [o.textContent, o.__value]);
const labelOf = (id) => document.querySelector(`label[for="${id}"]`).textContent.replace(/\s+/g, ' ').trim();
const sectionTitles = () => [...document.querySelectorAll('.rf-padding-top-3N strong')].map(s => s.textContent);

describe('LinkConfigureOptions', () => {
  beforeEach(() => resetLinkStores());

  it('LK-072 shows the "Formattage du fichier" section only when csv is requested', () => {
    renderOptions({ csv: true });
    expect(sectionTitles()).toEqual(['Formattage du fichier']);
    document.body.innerHTML = '';
    renderOptions({ api: true, check: true });
    expect(sectionTitles()).toEqual(['Paramètres de l\'algorithme', 'Paramètres de validation']);
  });

  it('LK-073 encoding select: Unicode / Latin / Mac / Windows 1252', () => {
    renderOptions({ csv: true });
    expect(labelOf('encoding')).toBe('Codage');
    expect(optionsOf('encoding')).toEqual([
      ['Unicode', 'utf8'], ['Latin', 'latin1'], ['Mac', 'mac'], ['Windows 1252', 'win1252']
    ]);
    expect(control('encoding').value).toBe('utf8');
  });

  // BUG: "win1252" is not a WHATWG encoding label (FileReader falls back to
  // UTF-8), and the detected value "windows-1252" has no option to display.
  it.fails('LK-073 the Windows 1252 option uses the "windows-1252" label produced by the detection', () => {
    renderOptions({ csv: true });
    expect(optionsOf('encoding').map(o => o[1])).toContain('windows-1252');
  });

  it('LK-074 separator select: ; , Tabulation, Espace', () => {
    renderOptions({ csv: true });
    expect(labelOf('sep')).toBe('Séparateur');
    expect(optionsOf('sep')).toEqual([
      ['Point-virgule (;)', ';'], ['Virgule (,)', ','], ['Tabulation', '\t'], ['Espace', ' ']
    ]);
  });

  // BUG: the pipe entry is merged into the Tabulation tuple
  // (["Tabulation","\t","Barre verticale (|)",'|']) and is never rendered,
  // although "|" is one of the auto-detected separators.
  it.fails('LK-074 offers the pipe separator "Barre verticale (|)"', () => {
    renderOptions({ csv: true });
    expect(optionsOf('sep')).toContainEqual(['Barre verticale (|)', '|']);
  });

  it('LK-075 quote ("Délimiteur") select: aucun, ", \'', () => {
    renderOptions({ csv: true });
    expect(labelOf('quote')).toBe('Délimiteur');
    expect(optionsOf('quote')).toEqual([
      ['aucun', undefined], ['guillemets doubles (")', '"'], ['guillemets simples (\')', '\'']
    ]);
  });

  it('LK-076 skip lines select 0..5', () => {
    renderOptions({ csv: true });
    expect(labelOf('skipLines')).toBe('Lignes sautées:');
    expect(optionsOf('skipLines')).toEqual([['aucune', 0], ['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5]]);
  });

  it('LK-077 date format select: 5 valid formats, "yyyy/MM/dd" without value', () => {
    renderOptions({ csv: true });
    expect(labelOf('dateFormat')).toBe('Format des dates');
    expect(optionsOf('dateFormat')).toEqual([
      ['dd/MM/yyyy', 'dd/MM/yyyy'], ['yyyy-MM-dd', 'yyyy-MM-dd'], ['yyyyMMdd', 'yyyyMMdd'],
      ['ddMMyyyy', 'ddMMyyyy'], ['dd-MM-yyyy', 'dd-MM-yyyy'], ['yyyy/MM/dd', undefined]
    ]);
  });

  // BUG: the "yyyy/MM/dd" option has no value: choosing it sets dateFormat to
  // undefined, and a guessed "yyyy/MM/dd" format cannot be displayed.
  it.fails('LK-077 selecting "yyyy/MM/dd" stores that date format', async () => {
    renderOptions({ csv: true });
    const select = control('dateFormat');
    select.options[5].selected = true;
    await fireEvent.change(select);
    expect(get(linkOptions).csv.dateFormat).toBe('yyyy/MM/dd');
  });

  it('LK-078 file persistence select: 1 min, 1 h, 4 h, 8 h', () => {
    renderOptions({ csv: true });
    expect(labelOf('tmpfilePersistence')).toBe('Temps de persistence du fichier');
    expect(optionsOf('tmpfilePersistence')).toEqual([
      ['1 minute', '60000'], ['1 heure', '3600000'], ['4 heures', '14400000'], ['8 heures', '28800000']
    ]);
  });

  it('LK-079 range "Maximum de correspondances" 1..10 with its value label', async () => {
    renderOptions({ api: true });
    const range = control('candidateNumber');
    expect([range.type, range.min, range.max, range.step]).toEqual(['range', '1', '10', '1']);
    expect(labelOf('candidateNumber')).toBe('Maximum de correspondances : 10');
    await fireEvent.input(range, { target: { value: '4' } });
    expect(get(linkOptions).api.candidateNumber).toBe(4);
    expect(labelOf('candidateNumber')).toBe('Maximum de correspondances : 4');
  });

  it('LK-080 range "Seuil minimal de correspondance" 0..1 shown as %', async () => {
    renderOptions({ api: true });
    const range = control('pruneScore');
    expect([range.min, range.max, range.step]).toEqual(['0', '1', '0.01']);
    expect(labelOf('pruneScore')).toBe('Seuil minimal de correspondance : 30%');
    await fireEvent.input(range, { target: { value: '0.55' } });
    expect(get(linkOptions).api.pruneScore).toBe(0.55);
    expect(labelOf('pruneScore')).toBe('Seuil minimal de correspondance : 55%');
  });

  it('LK-081 checkbox "Valider automatiquement les paires similaires"', async () => {
    renderOptions({ check: true });
    const box = control('autoCheckSimilar');
    expect(labelOf('autoCheckSimilar')).toBe('Valider automatiquement les paires similaires');
    expect(box.checked).toBe(true);
    await fireEvent.click(box);
    expect(get(linkOptions).check.autoCheckSimilar).toBe(false);
  });

  it('LK-082 checkbox "Afficher toutes les colonnes"', async () => {
    renderOptions({ check: true });
    const box = control('displayUnmappedColumns');
    expect(labelOf('displayUnmappedColumns')).toBe('Afficher toutes les colonnes');
    expect(box.checked).toBe(false);
    await fireEvent.click(box);
    expect(get(linkOptions).check.displayUnmappedColumns).toBe(true);
  });

  it('LK-083 range "Regrouper les pairs similaires à plus de" 0..1 step .005 in %', async () => {
    renderOptions({ check: true });
    const range = control('similarThreshold');
    expect([range.min, range.max, range.step]).toEqual(['0', '1', '0.005']);
    expect(labelOf('similarThreshold')).toBe('Regrouper les pairs similaires à plus de : 97%');
    await fireEvent.input(range, { target: { value: '0.9' } });
    expect(get(linkOptions).check.similarThreshold).toBe(0.9);
  });

  it('LK-084 range "Valider les scores au dessus de" has min = pruneScore', async () => {
    renderOptions({ check: true });
    const range = control('autoCheckThreshold');
    expect([range.min, range.max]).toEqual(['0.3', '1']);
    expect(labelOf('autoCheckThreshold')).toBe('Valider les scores au dessus de : 85%');
    linkOptions.update(o => ({ ...o, api: { ...o.api, pruneScore: 0.5 } }));
    await flush();
    expect(range.min).toBe('0.5');
  });

  it('LK-085 text input "Rechercher dans les résultats (filtre)"', async () => {
    renderOptions({ check: true });
    expect(labelOf('filter')).toBe('Rechercher dans les résultats (filtre)');
    await fireEvent.input(control('filter'), { target: { value: 'dupont' } });
    expect(get(linkOptions).check.filter).toBe('dupont');
  });

  it('LK-086 every option is two-way bound to $linkOptions and persisted under the "linkOptions" key', async () => {
    await useLocalSync(linkOptions, 'linkOptions');
    renderOptions({ csv: true, api: true, check: true });
    await fireEvent.change(control('sep'), { target: { value: ',' } });
    await fireEvent.change(control('encoding'), { target: { value: 'latin1' } });
    await fireEvent.change(control('skipLines'), { target: { value: '2' } });
    await fireEvent.change(control('tmpfilePersistence'), { target: { value: '60000' } });
    await fireEvent.input(control('candidateNumber'), { target: { value: '3' } });
    const options = get(linkOptions);
    expect(options.csv).toMatchObject({ sep: ',', encoding: 'latin1', skipLines: 2, tmpfilePersistence: '60000' });
    expect(options.api.candidateNumber).toBe(3);
    const stored = JSON.parse(localStorage.getItem('linkOptions'));
    expect(stored.csv).toMatchObject({ sep: ',', encoding: 'latin1', skipLines: 2, tmpfilePersistence: '60000' });
    expect(stored.api.candidateNumber).toBe(3);
    // store -> input
    linkOptions.update(o => ({ ...o, csv: { ...o.csv, sep: '\t' } }));
    await flush();
    expect(control('sep').value).toBe('\t');
  });
});
