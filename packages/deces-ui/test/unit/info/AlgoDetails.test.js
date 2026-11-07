// Inventory zone IN, /explain page AlgoDetails.svelte + Iframe.svelte
// (rows IN-163, IN-165 .. IN-182).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';

vi.mock('../../../src/components/tools/runRequest.js', async (importOriginal) => ({
  ...(await importOriginal()),
  runCompareRequest: vi.fn()
}));

const { default: AlgoDetails } = await import('../../../src/components/views/AlgoDetails.svelte');
const { default: Iframe } = await import('../../../src/components/views/Iframe.svelte');
const { runCompareRequest } = await import('../../../src/components/tools/runRequest.js');
const { searchInput, searchTyping } = await import('../../../src/components/tools/stores.js');
const { resetStores } = await import('./helpers.js');

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

const explainResult = (overrides = {}) => ({
  score: 0.856,
  name: { score: 0.9, first: 1, last: 0.9 },
  sex: 1,
  birthDate: 1,
  birthLocation: { score: 1, city: 1, code: 1, codePostal: 1, departmentCode: 1, country: 1, countryCode: 1, geo: 1 },
  ...overrides
});

const svgTexts = (container) => [...container.querySelectorAll('svg tspan')].map(text);
const columns = (container) => [...container.querySelectorAll('.rf-col-xl-6 .rf-container-fluid .rf-grid-row')];
const inputsOf = (column) => [...column.querySelectorAll('input')];

// Let the compare request scheduled 500 ms after mount run (fake timers).
const mountAndCompare = async (result = explainResult()) => {
  runCompareRequest.mockResolvedValue(result);
  const view = render(AlgoDetails);
  await vi.advanceTimersByTimeAsync(500);
  expect(runCompareRequest).toHaveBeenCalledTimes(1);
  await vi.waitFor(() => expect(svgTexts(view.container)).toContain('score'));
  return view;
};

let initialSearchInput;

// AlgoDetails schedules its first compare request with setTimeout(500) on
// mount; fake timers keep those callbacks from leaking into later tests.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
  resetStores();
  initialSearchInput = get(searchInput);
  runCompareRequest.mockReset();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  searchInput.set(initialSearchInput);
});

// Compare style attributes declaration by declaration: Svelte 3 and Svelte 5
// serialise them differently (spaces, trailing semicolon).
const cssText = (style) => { const e = document.createElement('div'); e.setAttribute('style', style); return e.style.cssText; };

describe('Iframe', () => {
  it('IN-163 iframe titled "documentation de l\'api" with src/style props in an overflow-hidden wrapper', () => {
    const { container } = render(Iframe, { src: 'https://example.org/doc', style: 'height: 10px;' });
    const iframe = container.querySelector('iframe');
    expect(iframe.getAttribute('title')).toBe('documentation de l\'api');
    expect(iframe.getAttribute('src')).toBe('https://example.org/doc');
    expect(iframe.getAttribute('style')).toBe('height: 10px;');
    expect(iframe.parentElement.style.overflow).toBe('hidden');
  });

  it('IN-163 default style crops the embedded page (margin-top -330px, 2200px high)', () => {
    const { container } = render(Iframe);
    expect(container.querySelector('iframe').style.cssText).toBe(cssText('margin-top:-330px;width: 100%;height: 2200px;border-width: 0px;'));
  });
});

describe('AlgoDetails', () => {
  describe('static content', () => {
    it('IN-165 explanation blocks: title and 4 section headings', () => {
      runCompareRequest.mockResolvedValue(undefined);
      render(AlgoDetails);
      expect(text(screen.getByRole('heading', { level: 3 }))).toBe('Appariement sur deces.matchid.io, explications');
      expect(screen.getAllByRole('heading', { level: 4 }).map(text)).toEqual([
        'Recherche des identités', 'Scoring', 'Mise au point et évaluation', 'Interface de validation intelligente'
      ]);
    });

    it('IN-166 GitHub links (buildRequest.ts, score.ts, matchID backend) and EIG link', () => {
      runCompareRequest.mockResolvedValue(undefined);
      const { container } = render(AlgoDetails);
      expect([...container.querySelectorAll('a')].map(a => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')])).toEqual([
        ['https://github.com/matchID-project/deces-backend/blob/dev/backend/src/buildRequest.ts', '_blank', 'noreferrer'],
        ['https://github.com/matchID-project/deces-backend/blob/dev/backend/src/score.ts', '_blank', 'noreferrer'],
        ['https://github.com/matchID-project/backend', '_blank', 'noreferrer'],
        ['https://eig.etalab.gouv.fr/defis/mi-matchid/', '_blank', 'noreferrer']
      ]);
    });

    it('IN-167 validation UI screenshot from matchid.io', () => {
      runCompareRequest.mockResolvedValue(undefined);
      render(AlgoDetails);
      expect(screen.getByAltText('valider l\'appariement').getAttribute('src')).toBe('https://matchid.io/assets/images/deces-ui-link-validate.png');
    });
  });

  describe('identity forms', () => {
    it('IN-168 identity A/B are prefilled (pompidous vs Pompidou, M, 01/11/1969)', () => {
      runCompareRequest.mockResolvedValue(undefined);
      const { container } = render(AlgoDetails);
      const [a, b] = columns(container).slice(-2).map(inputsOf);
      const values = (inputs) => Object.fromEntries(inputs.map(i => [i.id, i.value]).filter(([, v]) => v));
      expect(values(a)).toEqual({ ln: 'pompidous', fn: 'georges', bd: '01/11/1969' });
      expect(values(b)).toEqual({ ln: 'Pompidou', fn: 'Georges', sex: 'M', bd: '01/11/1969' });
    });

    it('IN-169 fields = search form keys minus fullText, headers "Identité A/B", "Naissance", "Décès"', () => {
      runCompareRequest.mockResolvedValue(undefined);
      const { container } = render(AlgoDetails);
      const [a, b] = columns(container).slice(-2);
      expect([...a.querySelectorAll('strong')].map(text)).toEqual(['Identité A', 'Naissance', 'Décès']);
      expect([...b.querySelectorAll('strong')].map(text)).toEqual(['Identité B', 'Naissance', 'Décès']);
      const keys = Object.keys(get(searchInput)).filter(k => k !== 'fullText');
      expect(inputsOf(a).map(i => i.id)).toEqual(keys.map(k => get(searchInput)[k].url));
      expect(inputsOf(a)).toHaveLength(12);
      expect(inputsOf(b)).toHaveLength(12);
      expect(container.querySelector('input#q')).toBeNull();
      expect([...a.querySelectorAll('label')].map(text).slice(0, 4)).toEqual(['Nom', 'Prénom', 'Genre', 'Date']);
    });

    // BUG: identity A and B inputs reuse the search form ids (e.g. "ln"), so
    // ids are duplicated and every `label for` points to identity A.
    it.fails('IN-181 BUG: identity A and B inputs have unique ids', () => {
      runCompareRequest.mockResolvedValue(undefined);
      const { container } = render(AlgoDetails);
      const ids = [...container.querySelectorAll('input')].map(i => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('IN-181 identity A and B inputs currently share their ids (pinned)', () => {
      runCompareRequest.mockResolvedValue(undefined);
      const { container } = render(AlgoDetails);
      expect(container.querySelectorAll('input#ln')).toHaveLength(2);
      expect(container.querySelectorAll('label[for="ln"]')).toHaveLength(2);
    });

    it('IN-179 typing masks are not applied to A/B (mask functions lost in the JSON clone, pinned)', async () => {
      runCompareRequest.mockResolvedValue(undefined);
      const { container } = render(AlgoDetails);
      const sexA = columns(container).slice(-2)[0].querySelector('input#sex');
      await fireEvent.input(sexA, { target: { value: 'X' } });
      expect(sexA.value).toBe('X');
    });

    // BUG: `JSON.parse(JSON.stringify($searchInput))` drops the mask
    // functions, so A/B never apply the typing masks (AlgoDetails.svelte:738).
    it.fails('IN-179 BUG: the sex typing mask rejects an invalid character in identity A', async () => {
      runCompareRequest.mockResolvedValue(undefined);
      const { container } = render(AlgoDetails);
      const sexA = columns(container).slice(-2)[0].querySelector('input#sex');
      await fireEvent.input(sexA, { target: { value: 'X' } });
      expect(sexA.value).toBe('');
    });

    it('IN-180 the input error style follows the main search form value, not the A/B value (pinned)', () => {
      searchInput.update(v => ({ ...v, sex: { ...v.sex, value: 'X' } }));
      runCompareRequest.mockResolvedValue(undefined);
      const { container } = render(AlgoDetails);
      const [sexA, sexB] = container.querySelectorAll('input#sex');
      // A/B start from a copy of the current main search form, then the
      // defaults are applied (B has a default sex, A has none)
      expect(sexA.value).toBe('X');
      expect(sexA.classList.contains('rf-input--error')).toBe(true);
      expect(sexB.value).toBe('M');
      expect(sexB.classList.contains('rf-input--error')).toBe(true);
    });

    // BUG: isValid(key) validates $searchInput[key].value, the main search
    // form, instead of the A/B values (AlgoDetails.svelte:742-748).
    it.fails('IN-180 BUG: valid A/B values are not flagged because of the main search form', () => {
      searchInput.update(v => ({ ...v, sex: { ...v.sex, value: 'X' } }));
      runCompareRequest.mockResolvedValue(undefined);
      const { container } = render(AlgoDetails);
      const sexB = container.querySelectorAll('input#sex')[1];
      expect(sexB.classList.contains('rf-input--error')).toBe(false);
    });
  });

  describe('compare request', () => {
    it('IN-170 a compare request (explain, dd/MM/yyyy) is sent 500 ms after mount', async () => {
      runCompareRequest.mockResolvedValue(undefined);
      render(AlgoDetails);
      vi.advanceTimersByTime(499);
      expect(runCompareRequest).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(runCompareRequest).toHaveBeenCalledTimes(1);
      expect(runCompareRequest).toHaveBeenCalledWith({
        personA: { lastName: 'pompidous', firstName: 'georges', birthDate: '01/11/1969' },
        personB: { lastName: 'Pompidou', firstName: 'Georges', sex: 'M', birthDate: '01/11/1969' },
        params: { dateFormatA: 'dd/MM/yyyy', dateFormatB: 'dd/MM/yyyy', explain: true }
      }, false);
    });

    it('IN-171 typing re-runs the compare after a 355 ms debounce through the shared $searchTyping store', async () => {
      runCompareRequest.mockResolvedValue(undefined);
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { container } = render(AlgoDetails);
      vi.advanceTimersByTime(500);
      expect(runCompareRequest).toHaveBeenCalledTimes(1);
      const lnB = container.querySelectorAll('input#ln')[1];
      await fireEvent.input(lnB, { target: { value: 'Pompido' } });
      vi.advanceTimersByTime(100);
      await fireEvent.input(lnB, { target: { value: 'Pompidoux' } });
      expect(get(searchTyping)).toBeGreaterThan(0);
      vi.advanceTimersByTime(354);
      expect(runCompareRequest).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith('key input limiter');
      vi.advanceTimersByTime(1);
      expect(runCompareRequest).toHaveBeenCalledTimes(2);
      expect(runCompareRequest.mock.calls[1][0].personB.lastName).toBe('Pompidoux');
    });

    it('IN-182 a failed compare (falsy result) keeps the previous diagram', async () => {
      const { container } = await mountAndCompare();
      expect(svgTexts(container)).toContain('85%');
      runCompareRequest.mockResolvedValue(undefined);
      await fireEvent.input(container.querySelectorAll('input#ln')[1], { target: { value: 'Pompidoux' } });
      await vi.advanceTimersByTimeAsync(400);
      expect(runCompareRequest).toHaveBeenCalledTimes(2);
      expect(svgTexts(container)).toContain('85%');
    });
  });

  describe('scoring diagram', () => {
    it('IN-172 global score "score NN%" (truncated)', async () => {
      const { container } = await mountAndCompare();
      const texts = svgTexts(container);
      expect(texts.slice(0, 2)).toEqual(['score', '85%']);
    });

    it('IN-172 no score text before the first response', () => {
      runCompareRequest.mockReturnValue(new Promise(() => {}));
      const { container } = render(AlgoDetails);
      expect(svgTexts(container)).not.toContain('score');
    });

    it('IN-173 name node: score + Prénom / Nom subscores, "Nom de jeune fille" only when present', async () => {
      const { container, unmount } = await mountAndCompare();
      expect(svgTexts(container)).toEqual(expect.arrayContaining(['90%', 'Prénom: 100%', 'Nom: 90%']));
      expect(svgTexts(container).join('|')).not.toContain('Nom de jeune fille');
      unmount();
      runCompareRequest.mockReset();
      const second = await mountAndCompare(explainResult({ name: { score: 0.5, first: 1, last: 0.2, legal: 0.8 } }));
      expect(svgTexts(second.container)).toEqual(expect.arrayContaining(['50%', 'Nom: 20%', 'Nom de jeune fille: 80%']));
    });

    it('IN-174 sex node', async () => {
      const { container } = await mountAndCompare(explainResult({ sex: 0.5 }));
      expect(text(container.querySelector('#tspan674'))).toBe('50%');
    });

    it('IN-175 birth date node', async () => {
      const { container } = await mountAndCompare(explainResult({ birthDate: 0.75 }));
      expect(text(container.querySelector('#tspan670'))).toBe('75%');
    });

    it('IN-176 birth location node + subscores', async () => {
      const { container } = await mountAndCompare(explainResult({
        birthLocation: { score: 0.5, city: 0.5, code: 1, codePostal: 0.25, departmentCode: 1, country: 1, countryCode: 1, geo: 0.1 }
      }));
      expect(text(container.querySelector('#tspan668'))).toBe('50%');
      expect(svgTexts(container)).toEqual(expect.arrayContaining([
        'Commune: 50%', 'Code INSEE: 100%', 'Code postal: 25%', 'Département: 100%', 'Pays: 100%', 'Code pays: 100%', 'Coordonnées géo: 10%'
      ]));
    });

    it('IN-177 SVG height: 90 mm (birth only), 100 mm (death date), 137 mm (death location)', async () => {
      const height = (c) => c.querySelector('svg').getAttribute('height');
      const first = await mountAndCompare();
      expect(height(first.container)).toBe('90mm');
      first.unmount();
      runCompareRequest.mockReset();
      const second = await mountAndCompare(explainResult({ deathDate: 0.5 }));
      expect(height(second.container)).toBe('100mm');
      expect(text(second.container.querySelector('#tspan616'))).toBe('50%');
      second.unmount();
      runCompareRequest.mockReset();
      const third = await mountAndCompare(explainResult({ deathDate: 1, deathLocation: { score: 1, city: 1 } }));
      expect(height(third.container)).toBe('137mm');
      expect(third.container.querySelector('svg').getAttribute('viewBox')).toBe('0 0 137.94624 137');
    });

    it('IN-178 death location node: subscores, INSEE code shown without x100 and geo raw (pinned)', async () => {
      const { container } = await mountAndCompare(explainResult({
        deathDate: 1,
        deathLocation: { score: 0.5, city: 1, code: 1, codePostal: 1, departmentCode: 1, country: 1, countryCode: 1, geo: 0.3 }
      }));
      expect(text(container.querySelector('#tspan672'))).toBe('50%');
      expect(svgTexts(container)).toEqual(expect.arrayContaining([
        'Code INSEE: 1%', 'Coordonnées géo: 0.3', 'Code postal: 100%', 'Département: 100%', 'Pays: 100%', 'Code pays: 100%'
      ]));
    });

    // BUG: the death location INSEE code subscore is not multiplied by 100
    // and the geo subscore is shown raw (AlgoDetails.svelte:331, 366).
    it.fails('IN-178 BUG: death location INSEE code and geo subscores are shown as percentages', async () => {
      const { container } = await mountAndCompare(explainResult({
        deathDate: 1,
        deathLocation: { score: 0.5, code: 1, geo: 0.3 }
      }));
      expect(svgTexts(container)).toEqual(expect.arrayContaining(['Code INSEE: 100%', 'Coordonnées géo: 30%']));
    });
  });
});
