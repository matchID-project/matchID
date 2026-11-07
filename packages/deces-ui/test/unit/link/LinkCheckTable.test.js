import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { flushSync as flushSvelte } from 'svelte';

vi.mock('idb-keyval', async () => (await import('./idb-mock.js')).idbKeyvalMock);

const { idbData, idbKeyvalMock } = await import('./idb-mock.js');
const { default: LinkCheckTable } = await import('../../../src/components/views/LinkCheckTable.svelte');
const { default: LinkCheck } = await import('../../../src/components/views/LinkCheck.svelte');
const {
  linkResults, linkCompleteResults, linkValidations, linkOptions, linkMapping, linkSourceHeader, linkFileName
} = await import('../../../src/components/tools/stores.js');
const { useLocalSync } = await import('../../../src/components/tools/useLocalStorage.js');
const { resetLinkStores, stubFetch, jsonResponse, flush, captureTableHeightTimer } = await import('./helpers.js');
const { buildResults, mapping, sourceHeader, resultsHeader, col } = await import('./fixtures.js');

const validationsFor = (results, threshold = 0.85) => results.rows.map(group => group.map(r =>
  (Number(r[col('score')]) >= threshold ? { valid: true, checked: 'auto' } : { checked: false })));

const setResults = (built = buildResults(), { validations, check = {} } = {}) => {
  linkSourceHeader.set([...sourceHeader]);
  linkMapping.set(structuredClone(mapping));
  linkFileName.set('clients.csv');
  linkOptions.update(o => ({ ...o, csv: { sep: ';', dateFormat: 'dd/MM/yyyy', type: 'csv' }, check: { ...o.check, ...check } }));
  linkCompleteResults.set(built.complete);
  linkResults.set(built.results);
  linkValidations.set(validations || validationsFor(built.results));
  return built;
};

const renderTable = (props = {}) => render(LinkCheckTable, { sort: 'scoreDesc', master: true, actionTitle: 'à valider', ...props }).container;
const scoreTable = (root = document) => root.querySelector('table[style*="border-right"]');
const dataTable = (root = document) => root.querySelector('.rf-col-10 table');
const scoreRows = (root) => [...scoreTable(root).querySelectorAll('tr')].slice(1);
const dataRows = (root) => [...dataTable(root).querySelectorAll('tr')].slice(1);
const cells = (tr) => [...tr.querySelectorAll('td')].map(td => td.innerHTML.trim());
const headers = (root) => [...dataTable(root).querySelectorAll('th')].map(th => th.textContent.trim());
const text = () => document.body.textContent.replace(/\s+/g, ' ');

describe('LinkCheckTable (validation tables)', () => {
  let fetchMock;
  let flushTableHeight;
  beforeEach(() => {
    resetLinkStores();
    idbData.clear();
    flushTableHeight = captureTableHeightTimer();
    fetchMock = stubFetch({ 'POST /deces/api/v1/compare': { explain: { lastName: 'exact match' } } });
  });
  afterEach(() => {
    vi.useRealTimers();
    flushTableHeight();
  });

  it('LK-128 renders nothing when no row passes the filter; the title shows the count and the action', async () => {
    setResults();
    const empty = renderTable({ filter: { check: () => false } });
    await flush();
    expect(empty.textContent.trim()).toBe('');
    document.body.innerHTML = '';
    const table = renderTable();
    await flush();
    expect(table.querySelector('p strong').textContent).toBe('3 identités à valider :');
  });

  it('LK-129 shows the rounded score as % with the detailed scores as title', async () => {
    const { results } = setResults();
    const table = renderTable();
    await flush();
    const scoreCells = scoreRows(table).map(tr => tr.querySelector('td.hcenter'));
    expect(scoreCells.map(td => td.textContent.trim())).toEqual(['95%', '70%', '60%', '50%']);
    expect(scoreCells[0].getAttribute('title')).toBe(results.rows[0][0][col('scores')]);
  });

  it('LK-130 shows the mapped columns compared with the matched record; unmapped columns hidden', async () => {
    setResults();
    const table = renderTable();
    await flush();
    expect(headers(table)).toEqual(['nom', 'prenom', 'naissance', 'deces']);
    // Dupont / DUPONT: same ignoring case -> plain source value
    expect(cells(dataRows(table)[0]).slice(0, 3)).toEqual(['Dupont', 'Jean', '01/02/1950']);
  });

  it('LK-131 colours the character diff (removed red, added blue) and shows missing values in red', async () => {
    const built = buildResults();
    built.results.rows[0][0][col('prenom')] = '';
    built.results.rows[0][0][col('name.last')] = 'DUPON';
    built.results.rows[2][0][col('nom')] = '';
    built.results.rows[2][0][col('name.last')] = '';
    setResults(built);
    const table = renderTable();
    await flush();
    const [dupont, petit, martin, martine] = dataRows(table).map(cells);
    // the common part is taken from the matched record (case-insensitive diff)
    expect(dupont[0]).toBe('DUPON<strong style="color: var(--rm500);">t</strong><br>DUPON');
    expect(dupont[1]).toBe('<strong style="color: var(--rm500);">JEAN</strong>');
    expect(dataRows(table)[1].querySelector('td strong[style="color: var(--rm500);"]')).not.toBeNull();
    expect(martin[0]).toBe('Martin');
    expect(martine[0]).toBe('MARTIN<br>MARTIN<strong style="color: var(--bf500);">E</strong>');
  });

  // BUG: the "<vide>" placeholder of a value missing on both sides is
  // injected with {@html}, so it is parsed as an unknown <vide> element and
  // nothing is visible in the cell.
  it.fails('LK-131 shows a visible "<vide>" when the value is missing on both sides', async () => {
    const built = buildResults();
    built.results.rows[2][0][col('nom')] = '';
    built.results.rows[2][0][col('name.last')] = '';
    setResults(built);
    const table = renderTable();
    await flush();
    expect(dataRows(table)[1].querySelector('td').textContent).toBe('<vide>');
  });

  it('LK-132 reformats the matched birth date to the date format and shows the death date as "src <br/> date †"', async () => {
    setResults();
    const table = renderTable();
    await flush();
    const [dupont, petit, , martine] = dataRows(table).map(cells);
    expect(dupont[2]).toBe('01/02/1950');
    expect(martine[2]).toBe('0<strong style="color: var(--rm500);">3</strong>/04/1960<br>0<strong style="color: var(--bf500);">4</strong>/04/1960');
    expect(dupont[3]).toBe('01/01/2020 †');
    expect(petit[3]).toBe('01/01/2020 <br> 01/01/2020 †');
  });

  it('LK-132 uses the dateFormat option for matched dates', async () => {
    setResults();
    linkOptions.update(o => ({ ...o, csv: { ...o.csv, dateFormat: 'yyyy-MM-dd' } }));
    const table = renderTable();
    await flush();
    expect(cells(dataRows(table)[0])[3]).toBe('2020-01-01 †');
  });

  const manyResults = (n) => {
    const built = buildResults();
    const template = built.results.rows[0][0];
    const rows = Array.from({ length: n }, (_, i) => {
      const r = [...template];
      r[col('nom')] = `Nom${i}`;
      r[col('sourceLineNumber')] = `${i + 1}`;
      r[col('score')] = `${0.5 + i / 100}`;
      r[col('scores')] = JSON.stringify({ score: 0.5 + i / 100 });
      return [r];
    });
    return { complete: { header: [...resultsHeader], rows }, results: { header: [...resultsHeader], rows } };
  };

  it('LK-133 displays only the first 5 groups and a "..." row when there are more (no pagination)', async () => {
    setResults(manyResults(7));
    const table = renderTable();
    await flush();
    expect(table.querySelector('p strong').textContent).toBe('7 identités à valider :');
    const rows = scoreRows(table);
    expect(rows).toHaveLength(6);
    expect(cells(rows[5])).toEqual(['...', '...']);
    expect(dataRows(table)).toHaveLength(6);
    expect(table.querySelector('button, .rf-pagination')).toBeNull();
  });

  it('LK-133 has no "..." row with 5 groups or less', async () => {
    setResults(manyResults(5));
    const table = renderTable();
    await flush();
    expect(scoreRows(table)).toHaveLength(5);
  });

  it('LK-134 the master table auto-selects the first row; clicking a row selects it, others are dimmed', async () => {
    setResults();
    const table = renderTable();
    await waitFor(() => expect(scoreRows(table)[0].classList.contains('rf-inactive')).toBe(false));
    expect(scoreRows(table).map(tr => tr.classList.contains('rf-inactive'))).toEqual([false, true, true, true]);
    await fireEvent.click(dataRows(table)[2]);
    // both candidates of source line 2 are selected
    await waitFor(() => expect(scoreRows(table).map(tr => tr.classList.contains('rf-inactive'))).toEqual([true, true, false, false]));
  });

  it('LK-134 a row of the "validées" table can be selected (shared selection) while rows remain to validate', async () => {
    setResults();
    render(LinkCheck);
    await waitFor(() => expect(document.querySelectorAll('table[style*="border-right"]')).toHaveLength(2));
    const checkedTable = document.querySelectorAll('table[style*="border-right"]')[1];
    const row = () => [...checkedTable.querySelectorAll('tr')][1];
    await fireEvent.click(row().querySelector('td'));
    await waitFor(() => expect(row().classList.contains('rf-inactive')).toBe(false));
    const masterRows = [...document.querySelectorAll('table[style*="border-right"]')[0].querySelectorAll('tr')].slice(1);
    expect(masterRows.every(tr => tr.classList.contains('rf-inactive'))).toBe(true);
  });

  it('LK-135 selecting a row POSTs /compare with explain and shows the explanation as cell title', async () => {
    setResults();
    const table = renderTable();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/deces/api/v1/compare');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      personA: { lastName: 'Dupont', firstName: 'Jean', birthDate: '01/02/1950', deathDate: '' },
      personB: { lastName: 'DUPONT', firstName: 'JEAN', birthDate: '01/02/1950', deathDate: '01/01/2020' },
      params: { dateFormatA: 'dd/MM/yyyy', dateFormatB: 'dd/MM/yyyy', explain: true }
    });
    await waitFor(() => expect(dataRows(table)[0].querySelector('td').getAttribute('title')).toBe('"exact match"'));
  });

  const validateIcon = (root, i) => scoreRows(root)[i].querySelector('span.rf-fi-checkbox-line');
  const invalidateIcon = (root, i) => scoreRows(root)[i].querySelector('span.rf-fi-close-circle-line');

  it('LK-136 the validate icon sets valid=true and checked="<ts> - manual"; a second click un-checks', async () => {
    setResults();
    const table = renderTable();
    await flush();
    await fireEvent.click(validateIcon(table, 1)); // Petit, 70 %
    await flush();
    const v = get(linkValidations)[2][0];
    expect(v.valid).toBe(true);
    expect(v.checked).toMatch(/^\d+ - manual$/);
    expect(validateIcon(table, 1).classList.contains('rf-color--bf')).toBe(true);
    await fireEvent.click(validateIcon(table, 1));
    await flush();
    expect(get(linkValidations)[2][0]).toEqual({ checked: false, valid: undefined });
  });

  it('LK-137 the invalidate icon sets valid=false; a second click un-checks', async () => {
    setResults();
    const table = renderTable();
    await flush();
    await fireEvent.click(invalidateIcon(table, 1));
    await flush();
    const v = get(linkValidations)[2][0];
    expect(v.valid).toBe(false);
    expect(v.checked).toMatch(/ - manual$/);
    expect(invalidateIcon(table, 1).classList.contains('rf-color--rm')).toBe(true);
    await fireEvent.click(invalidateIcon(table, 1));
    await flush();
    expect(get(linkValidations)[2][0].checked).toBe(false);
  });

  const similarResults = () => {
    const built = buildResults();
    // Petit gets the same detailed scores as the first Martin candidate
    built.results.rows[2][0][col('scores')] = built.results.rows[1][0][col('scores')];
    return built;
  };

  it('LK-138 propagates a validation to the similar group when autoCheckSimilar is on', async () => {
    setResults(similarResults());
    const table = renderTable();
    await flush();
    await fireEvent.click(validateIcon(table, 2)); // Martin candidate 1 (60 %)
    await flush();
    expect(get(linkValidations)[1][0]).toMatchObject({ valid: true });
    expect(get(linkValidations)[1][0].checked).toMatch(/ - manual$/);
    expect(get(linkValidations)[2][0]).toMatchObject({ valid: true });
    expect(get(linkValidations)[2][0].checked).toMatch(/ - similar group$/);
  });

  it('LK-138 does not propagate when autoCheckSimilar is off', async () => {
    setResults(similarResults(), { check: { autoCheckSimilar: false } });
    const table = renderTable();
    await flush();
    await fireEvent.click(validateIcon(table, 2));
    await flush();
    expect(get(linkValidations)[1][0].valid).toBe(true);
    expect(get(linkValidations)[2][0]).toEqual({ checked: false });
  });

  it('LK-139 hovering an icon previews the similar rows and shows "valider/invalider l\'appariement et N paire(s) similaire(s)"', async () => {
    setResults(similarResults());
    const table = renderTable();
    await flush();
    const icon = validateIcon(table, 2);
    await fireEvent.mouseEnter(icon);
    expect(icon.classList.contains('tooltip')).toBe(true);
    expect(icon.getAttribute('data-tooltip')).toBe('valider l\'appariement et 1 paire(s) similaire(s)');
    expect(invalidateIcon(table, 2).getAttribute('data-tooltip')).toBe('invalider l\'appariement et 1 paire(s) similaire(s)');
    // the similar Petit row (not selected) reveals its validate icon
    expect(validateIcon(table, 1).classList.contains('is-hidden')).toBe(false);
    await fireEvent.mouseLeave(icon);
    expect(icon.classList.contains('tooltip')).toBe(false);
    expect(validateIcon(table, 1).classList.contains('is-hidden')).toBe(true);
  });

  it('LK-139 without autoCheckSimilar the tooltip is "valider l\'appariement"', async () => {
    setResults(similarResults(), { check: { autoCheckSimilar: false } });
    const table = renderTable();
    await flush();
    expect(validateIcon(table, 2).getAttribute('data-tooltip')).toBe('valider l\'appariement');
  });

  it('LK-140 validated rows move from "à valider" to "validées" and the counts update', async () => {
    setResults();
    render(LinkCheck);
    const titles = () => [...document.querySelectorAll('p > strong')].map(s => s.textContent.trim()).filter(t => /identités/.test(t));
    await waitFor(() => expect(titles()).toEqual(['2 identités à valider :', '1 identités validées :']));
    const toCheck = document.querySelectorAll('.rf-container-fluid .rf-container-fluid')[0];
    const petit = [...scoreTable(toCheck).querySelectorAll('tr')].find(tr => tr.textContent.includes('70%'));
    await fireEvent.click(petit.querySelector('span.rf-fi-checkbox-line'));
    await waitFor(() => expect(titles()).toEqual(['1 identités à valider :', '2 identités validées :']));
  });

  it('LK-141 filters the rows with a case-insensitive regex and warns when the filter is too restrictive', async () => {
    setResults();
    const table = renderTable();
    await flush();
    linkOptions.update(o => ({ ...o, check: { ...o.check, filter: 'MARTIN' } }));
    await flush();
    expect(scoreRows(table).map(tr => tr.querySelector('td').textContent.trim())).toEqual(['60%', '50%']);
    linkOptions.update(o => ({ ...o, check: { ...o.check, filter: 'pet.t' } }));
    await flush();
    expect(scoreRows(table).map(tr => tr.querySelector('td').textContent.trim())).toEqual(['70%']);
    linkOptions.update(o => ({ ...o, check: { ...o.check, filter: 'zzz' } }));
    await flush();
    expect(text()).toContain('attention, le filtre zzz est trop restrictif');
    expect(scoreTable(table)).toBeNull();
  });

  // BUG: the filter is compiled with `new RegExp(filter)` inside a reactive
  // statement: typing an invalid pattern such as "dupont(" throws and breaks
  // the component update.
  it.fails('LK-141 an invalid regex in the filter does not break the table', async () => {
    setResults();
    renderTable();
    await flush();
    linkOptions.update(o => ({ ...o, check: { ...o.check, filter: 'dupont(' } }));
    // run the scheduled component update synchronously to catch its error
    expect(() => flushSvelte()).not.toThrow();
  });

  it('LK-142 "Afficher toutes les colonnes" shows the unmapped columns', async () => {
    setResults();
    const table = renderTable();
    await flush();
    expect(headers(table)).not.toContain('extra');
    linkOptions.update(o => ({ ...o, check: { ...o.check, displayUnmappedColumns: true } }));
    await flush();
    expect(headers(table)).toEqual(['nom', 'prenom', 'naissance', 'deces', 'extra']);
    expect(dataRows(table)[0].textContent).toContain('x1');
  });

  it('LK-143 syncs the score column header height with the data header after 500 ms', async () => {
    vi.mocked(globalThis.setTimeout).mockRestore();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    setResults();
    const table = renderTable();
    await vi.advanceTimersByTimeAsync(0);
    const head = scoreTable(table).querySelector('tr');
    expect(head.getAttribute('style')).toBe('height: 28px;');
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(42);
    await vi.advanceTimersByTimeAsync(500);
    expect(head.getAttribute('style')).toBe('height: 42px;');
  });

  // BUG: the 500 ms header measurement started on mount reads
  // `document.getElementById('table-content')` without checking that the
  // table is still mounted (nor which table owns that duplicated id): when the
  // table is destroyed within 500 ms it throws "Cannot read properties of
  // null (reading 'offsetHeight')".
  it.fails('LK-143 unmounting the table within 500 ms does not throw', async () => {
    vi.mocked(globalThis.setTimeout).mockRestore();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    setResults();
    const { unmount } = render(LinkCheckTable, { sort: 'scoreDesc', master: true, actionTitle: 'à valider' });
    await vi.advanceTimersByTimeAsync(0);
    unmount();
    expect(() => vi.advanceTimersByTime(500)).not.toThrow();
  });

  it('LK-144 persists validations to localStorage, or to IndexedDB (lazily) above 1 MB, and restores them', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await useLocalSync(linkValidations, 'linkValidations');
    linkValidations.set([[{ valid: true, checked: '1 - manual' }]]);
    expect(JSON.parse(localStorage.getItem('linkValidations'))).toEqual([[{ valid: true, checked: '1 - manual' }]]);
    const big = [Array.from({ length: 40000 }, () => ({ valid: false, checked: '1700000000000 - manual' }))];
    linkValidations.set(big);
    expect(idbKeyvalMock.set).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(idbKeyvalMock.set).toHaveBeenCalledWith('linkValidations', JSON.stringify(big));
    // restore (IndexedDB first)
    linkValidations.set(null);
    expect(localStorage.getItem('linkValidations')).toBeNull();
    expect(idbKeyvalMock.del).toHaveBeenCalledWith('linkValidations');
    idbData.set('linkValidations', JSON.stringify(big));
    await useLocalSync(linkValidations, 'linkValidations');
    expect(get(linkValidations)).toEqual(big);
  });
});
