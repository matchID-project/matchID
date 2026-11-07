import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, createEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { iconMarkup, mockFetch, person, resetSearchStores, searchResponse, setAdvanced, setInput } from './helpers.js';

vi.mock('@beyonk/svelte-google-analytics', () => ({ ga: { all: { search: vi.fn() } } }));
// Spy on the search entry points used by SearchBox while keeping their real
// implementation (URL sync, request building, stores).
vi.mock('../../../src/components/tools/search.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    searchSubmit: vi.fn(mod.searchSubmit),
    searchURLUpdate: vi.fn(mod.searchURLUpdate)
  };
});

const { default: SearchBox } = await import('../../../src/components/views/SearchBox.svelte');
const stores = await import('../../../src/components/tools/stores.js');
const search = await import('../../../src/components/tools/search.js');
const { icons } = await import('../../../src/components/tools/icons.js');
const { ga } = await import('@beyonk/svelte-google-analytics');

const advancedIds = ['ln', 'fn', 'sex', 'bd', 'bc', 'bdep', 'bco', 'dd', 'dage', 'dc', 'ddep', 'dco'];

let fetchMock;
const searchCalls = () => fetchMock.mock.calls.filter(([url]) => `${url}`.endsWith('/search'));
const lastSearchBody = () => JSON.parse(searchCalls().at(-1)[1].body);

// Render and let the on-mount submissions (page size, sort, token) settle.
const renderBox = async () => {
  const view = render(SearchBox);
  await waitFor(() => expect(search.searchSubmit).toHaveBeenCalled());
  await new Promise(resolve => setTimeout(resolve, 0));
  search.searchSubmit.mockClear();
  search.searchURLUpdate.mockClear();
  ga.all.search.mockClear();
  return view;
};

const type = async (input, value) => fireEvent.input(input, { target: { value } });

describe('SearchBox', () => {
  beforeEach(() => {
    resetSearchStores(stores);
    stores.accessToken.set('');
    search.searchSubmit.mockClear();
    search.searchURLUpdate.mockClear();
    fetchMock = mockFetch(url => url.endsWith('/search') ? searchResponse([person()]) : undefined);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('form and toolbar', () => {
    it('SR-014 submitting the form (Enter) runs a search without reloading the page', async () => {
      setInput(stores, { fullText: 'dupont' });
      const { container } = await renderBox();
      const form = container.querySelector('form');
      const event = createEvent.submit(form);
      await fireEvent(form, event);
      expect(event.defaultPrevented).toBe(true);
      expect(search.searchSubmit).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(searchCalls().length).toBeGreaterThan(0));
      expect(lastSearchBody().q).toBe('dupont');
    });

    it('SR-015 shows the "Réinitialiser" eraser only when an input has a value', async () => {
      await renderBox();
      vi.useFakeTimers();
      expect(screen.queryByTitle('Réinitialiser')).toBeNull();
      await type(document.getElementById('q'), 'dupont');
      expect(screen.getByTitle('Réinitialiser')).toBeTruthy();
    });

    it('SR-016 clicking the eraser clears every input value, without updating the URL', async () => {
      setAdvanced(stores);
      setInput(stores, { lastName: 'dupont', firstName: 'jean', deathDepartment: '33' });
      await renderBox();
      await fireEvent.click(screen.getByTitle('Réinitialiser'));
      expect(Object.values(get(stores.searchInput)).every(i => i.value === '')).toBe(true);
      expect(document.getElementById('ln').value).toBe('');
      expect(search.searchURLUpdate).not.toHaveBeenCalled();
    });

    it('SR-017 the eraser also reacts to any keydown (and is not focusable)', async () => {
      setInput(stores, { fullText: 'dupont' });
      await renderBox();
      const eraser = screen.getByTitle('Réinitialiser');
      expect(eraser.getAttribute('tabindex')).toBeNull();
      expect(eraser.getAttribute('role')).toBeNull();
      const event = createEvent.keyDown(eraser, { key: 'a' });
      await fireEvent(eraser, event);
      expect(event.defaultPrevented).toBe(true);
      expect(get(stores.searchInput).fullText.value).toBe('');
    });

    it('SR-018 the mode toggle is titled "Recherche avancée" in simple mode and "Recherche simplifiée" in advanced mode', async () => {
      await renderBox();
      expect(screen.getByTitle('Recherche avancée')).toBeTruthy();
      setAdvanced(stores);
      await waitFor(() => expect(screen.getByTitle('Recherche simplifiée')).toBeTruthy());
    });

    it('SR-019 the mode toggle shows zoom-in in simple mode and zoom-out in advanced mode', async () => {
      await renderBox();
      expect(screen.getByTitle('Recherche avancée').innerHTML).toContain(iconMarkup(icons, 'ri:zoom-in-line'));
      setAdvanced(stores);
      await waitFor(() => expect(screen.getByTitle('Recherche simplifiée').innerHTML).toContain(iconMarkup(icons, 'ri:zoom-out-line')));
    });

    it('SR-020 the toggle switches the canvas, moves the full text to last/first name and back, resubmits and syncs the URL', async () => {
      await renderBox();
      setInput(stores, { fullText: 'dupont jean' });
      await fireEvent.click(screen.getByTitle('Recherche avancée'));
      await waitFor(() => expect(document.getElementById('ln')).not.toBeNull());
      expect(document.getElementById('q')).toBeNull();
      expect(document.getElementById('ln').value).toBe('dupont');
      expect(document.getElementById('fn').value).toBe('jean');
      await waitFor(() => expect(location.search).toBe('?advanced=true&ln=dupont&fn=jean'));
      await waitFor(() => expect(searchCalls()).toHaveLength(1));

      await fireEvent.click(screen.getByTitle('Recherche simplifiée'));
      await waitFor(() => expect(document.getElementById('q')).not.toBeNull());
      expect(document.getElementById('q').value).toBe('dupont jean');
      await waitFor(() => expect(location.search).toBe('?q=dupont+jean'));
    });

    // BUG (consequence of SR-036): the advanced fields mount while the canvas
    // switches, and their mount-time `handleSubmit()` sends the search with
    // the stale full-text criterion `q`; the toggle's own resubmission is then
    // skipped (`waitSearch`), so the results do not match the ln/fn in the URL.
    it.fails('SR-020 the search sent after the toggle uses the moved last/first name criteria', async () => {
      await renderBox();
      setInput(stores, { fullText: 'dupont jean' });
      await fireEvent.click(screen.getByTitle('Recherche avancée'));
      await waitFor(() => expect(location.search).toBe('?advanced=true&ln=dupont&fn=jean'));
      await waitFor(() => expect(searchCalls()).toHaveLength(1));
      expect(lastSearchBody()).toMatchObject({ lastName: 'dupont', firstName: 'jean' });
      expect(lastSearchBody().q).toBeUndefined();
    });

    it('SR-021 the mode toggle also reacts to any keydown', async () => {
      await renderBox();
      const toggle = screen.getByTitle('Recherche avancée');
      expect(toggle.getAttribute('tabindex')).toBeNull();
      await fireEvent.keyDown(toggle, { key: 'Enter' });
      await waitFor(() => expect(get(stores.advancedSearch)).toBe(true));
    });
  });

  describe('fields', () => {
    it('SR-022 simple mode shows only the full-text field #q with its label', async () => {
      const { container } = await renderBox();
      expect([...container.querySelectorAll('input.rf-input')].map(i => i.id)).toEqual(['q']);
      expect(screen.getByLabelText('Nom, prénom, date de naissance ou de décès').id).toBe('q');
    });

    it('SR-023 advanced mode shows the 12 fields ln, fn, sex, bd, bc, bdep, bco, dd, dage, dc, ddep, dco', async () => {
      setAdvanced(stores);
      const { container } = await renderBox();
      expect([...container.querySelectorAll('input.rf-input')].map(i => i.id)).toEqual(advancedIds);
    });

    it('SR-024 shows the section headings of each mode', async () => {
      const { container } = await renderBox();
      const headings = () => [...container.querySelectorAll('strong')].map(s => s.textContent.trim()).filter(t => t !== 'Recherche floue');
      expect(headings()).toEqual(['Recherche simplifiée']);
      setAdvanced(stores);
      await waitFor(() => expect(headings()).toEqual(['Recherche avancée', 'Naissance', 'Décès']));
    });

    it('SR-025 each label targets its input, whose id is the URL key', async () => {
      setAdvanced(stores);
      const { container } = await renderBox();
      const labels = [...container.querySelectorAll('label.rf-label')];
      expect(labels.map(l => l.getAttribute('for'))).toEqual(advancedIds);
      expect(screen.getByLabelText('Nom').id).toBe('ln');
      expect(screen.getByLabelText('Prénom').id).toBe('fn');
      expect(screen.getByLabelText('Genre').id).toBe('sex');
      expect(screen.getByLabelText('Âge').id).toBe('dage');
    });

    it('SR-026 each field has its placeholder (used as e2e selector)', async () => {
      setAdvanced(stores);
      await renderBox();
      const placeholders = Object.fromEntries(advancedIds.map(id => [id, document.getElementById(id).getAttribute('placeholder')]));
      expect(placeholders).toEqual({
        ln: 'Pompidou', fn: 'Georges', sex: 'F/M', bd: '1910-1912 ou 1911 ou 05/07/1911', bc: 'Montboudif',
        bdep: '15', bco: 'France', dd: '1970-1980 ou 1974 ou 04/02/1974', dage: '78', dc: 'Paris', ddep: '75', dco: 'France'
      });
    });

    it('SR-026 the simple field placeholder is "Pompidou Georges 02/04/1974"', async () => {
      await renderBox();
      expect(document.getElementById('q').getAttribute('placeholder')).toBe('Pompidou Georges 02/04/1974');
    });

    it('SR-027 inputs have autocomplete off, a title tooltip and the store path as name', async () => {
      setAdvanced(stores);
      await renderBox();
      const ln = document.getElementById('ln');
      expect(ln.getAttribute('autocomplete')).toBe('off');
      expect(ln.getAttribute('title')).toBe('Saisissez le nom');
      expect(ln.getAttribute('name')).toBe('name');
      expect(document.getElementById('bd').getAttribute('name')).toBe('birth.date');
      expect(document.getElementById('dc').getAttribute('name')).toBe('death.location');
    });

    it('SR-028 an invalid value gets the red error style (datalist mismatch or failed mask validation)', async () => {
      setAdvanced(stores);
      await renderBox();
      const sex = document.getElementById('sex');
      const ddep = document.getElementById('ddep');
      const dd = document.getElementById('dd');
      expect(sex.className).not.toContain('rf-input--error');
      setInput(stores, { deathDepartment: '999', deathDate: '1990-1980' });
      await waitFor(() => expect(ddep.className).toContain('rf-input--error'));
      expect(ddep.className).toContain('rf-color--rm');
      expect(dd.className).toContain('rf-input--error');
      setInput(stores, { deathDepartment: '33', deathDate: '1980-1990' });
      await waitFor(() => expect(ddep.className).not.toContain('rf-input--error'));
      expect(dd.className).not.toContain('rf-input--error');
    });

    it('SR-029 sex, departments and countries offer datalist suggestions; other fields have no list', async () => {
      setAdvanced(stores);
      const { container } = await renderBox();
      expect(document.getElementById('sex').getAttribute('list')).toBe('sex-datalist');
      expect([...container.querySelectorAll('#sex-datalist option')].map(o => o.value)).toEqual(['F', 'M']);
      expect(container.querySelector('#birthDepartment-datalist option[value="2A"]')).not.toBeNull();
      expect(container.querySelector('#deathDepartment-datalist option[value="20"]')).toBeNull();
      expect(container.querySelector('#birthDepartment-datalist option[value="20"]')).not.toBeNull();
      expect(container.querySelector('#birthCountry-datalist option[value="France"]')).not.toBeNull();
      expect(container.querySelector('#deathCountry-datalist')).not.toBeNull();
      expect(document.getElementById('ln').hasAttribute('list')).toBe(false);
    });
  });

  describe('typing and auto-search', () => {
    it('SR-030 a department from the datalist ("33") is valid and triggers a search', async () => {
      setAdvanced(stores);
      await renderBox();
      vi.useFakeTimers();
      await type(document.getElementById('ddep'), '33');
      expect(document.getElementById('ddep').className).not.toContain('rf-input--error');
      await vi.advanceTimersByTimeAsync(400);
      expect(search.searchSubmit).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
      await waitFor(() => expect(lastSearchBody().deathDepartment).toBe('33'));
    });

    it('SR-031 the typing mask rejects invalid characters and restores the last valid value', async () => {
      setAdvanced(stores);
      await renderBox();
      vi.useFakeTimers();
      const bd = document.getElementById('bd');
      await type(bd, '1');
      await type(bd, '19');
      await type(bd, '19a');
      expect(bd.value).toBe('19');
      expect(get(stores.searchInput).birthDate.value).toBe('19');
      const age = document.getElementById('dage');
      await type(age, '7');
      await type(age, '7x');
      expect(age.value).toBe('7');
      const sex = document.getElementById('sex');
      await type(sex, 'Z');
      expect(sex.value).toBe('');
    });

    it('SR-032 a year "2020" is accepted by the date mask and triggers a search', async () => {
      setAdvanced(stores);
      await renderBox();
      vi.useFakeTimers();
      const dd = document.getElementById('dd');
      for (const value of ['2', '20', '202', '2020']) {
        await type(dd, value);
      }
      expect(dd.value).toBe('2020');
      expect(dd.className).not.toContain('rf-input--error');
      await vi.advanceTimersByTimeAsync(400);
      expect(search.searchSubmit).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
      await waitFor(() => expect(lastSearchBody().deathDate).toBe('2020'));
    });

    it('SR-033 debounces auto-search: one submit about 355 ms after the last keystroke', async () => {
      await renderBox();
      vi.useFakeTimers();
      const q = document.getElementById('q');
      await type(q, 'd');
      await vi.advanceTimersByTimeAsync(100);
      await type(q, 'du');
      await vi.advanceTimersByTimeAsync(100);
      await type(q, 'dup');
      await vi.advanceTimersByTimeAsync(300);
      expect(search.searchSubmit).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(100);
      expect(search.searchSubmit).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1000);
      expect(search.searchSubmit).toHaveBeenCalledTimes(1);
      expect(search.searchURLUpdate).toHaveBeenCalledTimes(1);
      expect(location.search).toBe('?q=dup');
    });

    it('SR-034 no auto-search while the current value is invalid', async () => {
      setAdvanced(stores);
      await renderBox();
      vi.useFakeTimers();
      await type(document.getElementById('bdep'), '9');
      await vi.advanceTimersByTimeAsync(1000);
      expect(search.searchSubmit).not.toHaveBeenCalled();
    });

    it('SR-035 no auto-search on typing in agg mode (the "Rechercher" button is needed)', async () => {
      stores.displayMode.set('agg');
      await renderBox();
      vi.useFakeTimers();
      await type(document.getElementById('q'), 'dupont');
      await vi.advanceTimersByTimeAsync(1000);
      expect(search.searchSubmit).not.toHaveBeenCalled();
    });

    // BUG: `on:change={handleSubmit()}` (SearchBox.svelte:55) does not depend
    // on any reactive value, so Svelte 3 evaluates `handleSubmit()` once when
    // each field is mounted (an extra search + URL update + GA hit per field)
    // and registers the returned Promise as the listener: a real change event
    // then throws "parameter 2 does not correctly implement EventListener" and
    // never submits. The test inspects the registered listener instead of
    // dispatching, so that the expected TypeError does not leak into the run.
    it.fails('SR-036 a change event submits immediately', async () => {
      const added = vi.spyOn(HTMLInputElement.prototype, 'addEventListener');
      await renderBox();
      const q = document.getElementById('q');
      const [, listener] = added.mock.calls.find(([type], i) => type === 'change' && added.mock.contexts[i] === q);
      expect(typeof listener).toBe('function');
      q.value = 'martin';
      await fireEvent.change(q);
      expect(search.searchSubmit).toHaveBeenCalledTimes(1);
    });

    it('SR-036 (current behaviour) handleSubmit runs once per mounted field instead of on change', async () => {
      setAdvanced(stores);
      render(SearchBox);
      // one call per advanced field, before onMount runs
      expect(search.searchSubmit).toHaveBeenCalledTimes(12);
    });

    it('SR-037 focus and blur update searchInputFocus[key] after 300 ms', async () => {
      await renderBox();
      vi.useFakeTimers();
      const q = document.getElementById('q');
      await fireEvent.focus(q);
      expect(get(stores.searchInputFocus).fullText.focus).toBe(false);
      await vi.advanceTimersByTimeAsync(300);
      expect(get(stores.searchInputFocus).fullText.focus).toBe(true);
      await fireEvent.blur(q);
      await vi.advanceTimersByTimeAsync(300);
      expect(get(stores.searchInputFocus).fullText.focus).toBe(false);
    });

    it('SR-038 a field is disabled when its config says so', async () => {
      setAdvanced(stores);
      stores.searchInput.update(v => { v.lastName.disabled = true; return v; });
      await renderBox();
      expect(document.getElementById('ln').disabled).toBe(true);
      expect(document.getElementById('fn').disabled).toBe(false);
      stores.searchInput.update(v => { delete v.lastName.disabled; return v; });
    });
  });

  describe('submit side effects', () => {
    it('SR-039 a submit writes every criterion, the advanced/fuzzy flags, view, size and page in the URL (replaceState)', async () => {
      setAdvanced(stores);
      const { container } = await renderBox();
      const historyLength = history.length;
      setInput(stores, {
        lastName: 'dupont', firstName: 'jean', sex: 'M', birthDate: '1932', birthCity: 'eysines', birthDepartment: '33',
        birthCountry: 'France', deathDate: '2020', deathAge: '87', deathCity: 'pessac', deathDepartment: '33', deathCountry: 'France'
      });
      stores.fuzzySearch.set(false);
      stores.displayMode.set('table');
      await fireEvent.submit(container.querySelector('form'));
      expect(history.length).toBe(historyLength);
      const params = new URLSearchParams(location.search);
      expect([...params.keys()]).toEqual(['advanced', 'fuzzy', 'view', ...advancedIds]);
      expect(params.get('view')).toBe('table');
      expect(params.get('dage')).toBe('87');
      stores.resultsPerPage.set(40);
      await waitFor(() => expect(new URLSearchParams(location.search).get('size')).toBe('n_40_n'));
    });

    it('SR-040 every submit sends the search string to Google Analytics', async () => {
      setAdvanced(stores);
      const { container } = await renderBox();
      setInput(stores, { lastName: 'dupont', firstName: 'jean', deathDate: '2020' });
      await fireEvent.submit(container.querySelector('form'));
      expect(ga.all.search).toHaveBeenCalledWith('DUPONT Jean décédé.e en 2020');
    });
  });

  describe('fuzzy toggle and agg mode', () => {
    it('SR-041 the fuzzy toggle is shown only in advanced mode', async () => {
      await renderBox();
      expect(screen.queryByText('Recherche floue')).toBeNull();
      setAdvanced(stores);
      await waitFor(() => expect(screen.getByText('Recherche floue')).toBeTruthy());
    });

    it('SR-042 clicking the fuzzy toggle flips fuzzySearch, sets fuzzy on all inputs, resubmits and writes fuzzy=false', async () => {
      setAdvanced(stores);
      await renderBox();
      setInput(stores, { lastName: 'dupont' });
      await fireEvent.click(screen.getByText('Recherche floue'));
      await waitFor(() => expect(get(stores.fuzzySearch)).toBe(false));
      expect(Object.values(get(stores.searchInput)).every(i => i.fuzzy === false)).toBe(true);
      await waitFor(() => expect(location.search).toBe('?advanced=true&fuzzy=false&ln=dupont'));
      await waitFor(() => expect(lastSearchBody()).toMatchObject({ lastName: 'dupont', fuzzy: 'false' }));
      await fireEvent.click(screen.getByText('Recherche floue'));
      await waitFor(() => expect(get(stores.fuzzySearch)).toBe(true));
      expect(Object.values(get(stores.searchInput)).every(i => i.fuzzy === 'auto')).toBe(true);
      await waitFor(() => expect(location.search).toBe('?advanced=true&ln=dupont'));
    });

    it('SR-043 the fuzzy label is struck through when fuzzy search is disabled', async () => {
      setAdvanced(stores);
      const { container } = await renderBox();
      expect(container.querySelector('strike')).toBeNull();
      stores.fuzzySearch.set(false);
      await waitFor(() => expect(container.querySelector('strike').textContent.trim()).toBe('Recherche floue'));
    });

    it('SR-044 the fuzzy wrapper toggles on any keydown and swallows it (Tab on the checkbox is prevented)', async () => {
      setAdvanced(stores);
      await renderBox();
      const checkbox = document.getElementById('switchRoundedInfo');
      const event = createEvent.keyDown(checkbox, { key: 'Tab' });
      await fireEvent(checkbox, event);
      expect(event.defaultPrevented).toBe(true);
      await waitFor(() => expect(get(stores.fuzzySearch)).toBe(false));
    });

    it('SR-045 the fuzzy toggle takes half the width next to "Rechercher" in agg mode', async () => {
      setAdvanced(stores);
      await renderBox();
      const wrapper = () => document.getElementById('switchRoundedInfo').parentElement.parentElement;
      expect(wrapper().className).toContain('rf-col-12');
      stores.displayMode.set('agg');
      await waitFor(() => expect(wrapper().className).toContain('rf-col-6'));
    });

    it('SR-046 the "Rechercher" submit button is shown only in agg mode', async () => {
      await renderBox();
      expect(screen.queryByDisplayValue('Rechercher')).toBeNull();
      stores.displayMode.set('agg');
      await waitFor(() => expect(screen.getByDisplayValue('Rechercher').type).toBe('submit'));
    });

    it('SR-047 a submit in agg mode sets triggerAggregations', async () => {
      stores.displayMode.set('agg');
      await renderBox();
      stores.triggerAggregations.set(false);
      await fireEvent.click(screen.getByDisplayValue('Rechercher'));
      expect(get(stores.triggerAggregations)).toBe(true);
    });
  });

  describe('deep link', () => {
    it('SR-280 a /search deep link restores the advanced canvas, the fields, the fuzzy flag and the view', async () => {
      await search.URLSearchSubmit(new URLSearchParams('advanced=true&fuzzy=false&view=table&ln=dupont&dd=2020&ddep=33'));
      const { container } = await renderBox();
      expect(document.getElementById('q')).toBeNull();
      expect(document.getElementById('ln').value).toBe('dupont');
      expect(document.getElementById('dd').value).toBe('2020');
      expect(document.getElementById('ddep').value).toBe('33');
      expect(container.querySelector('strike').textContent.trim()).toBe('Recherche floue');
      expect(get(stores.displayMode)).toBe('table');
      expect(Object.values(get(stores.searchInput)).every(i => i.fuzzy === false)).toBe(true);
    });
  });

  describe('reactive re-submissions', () => {
    it('SR-048 changing the results per page re-runs the search after mount', async () => {
      await renderBox();
      stores.resultsPerPage.set(40);
      await waitFor(() => expect(search.searchSubmit).toHaveBeenCalledTimes(1));
    });

    it('SR-049 changing the sort keys, or getting an access token, re-runs the search', async () => {
      await renderBox();
      stores.sortInput.update(v => v.slice().reverse());
      await waitFor(() => expect(search.searchSubmit).toHaveBeenCalledTimes(1));
      stores.accessToken.set('token-sr-049');
      await waitFor(() => expect(search.searchSubmit).toHaveBeenCalledTimes(2));
      stores.sortInput.update(v => v.slice().reverse());
    });

    it('SR-050 the access token is restored from storage on mount and persisted on change', async () => {
      localStorage.setItem('accessToken', JSON.stringify('token-restored'));
      await renderBox();
      await waitFor(() => expect(get(stores.accessToken)).toBe('token-restored'));
      stores.accessToken.set('token-changed');
      expect(JSON.parse(localStorage.getItem('accessToken'))).toBe('token-changed');
    });
  });
});
