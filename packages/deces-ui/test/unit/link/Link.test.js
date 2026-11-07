import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte';
import { get } from 'svelte/store';

vi.mock('idb-keyval', async () => (await import('./idb-mock.js')).idbKeyvalMock);
// Heavy step bodies are replaced by named placeholders: these tests only
// exercise the step orchestration of Link.svelte.
vi.mock('../../../src/components/views/LinkConfigure.svelte', async () =>
  ({ default: (await import('./stubs/index.js')).stubComponent('LinkConfigure') }));
vi.mock('../../../src/components/views/LinkJob.svelte', async () =>
  ({ default: (await import('./stubs/index.js')).stubComponent('LinkJob') }));
vi.mock('../../../src/components/views/LinkCheck.svelte', async () =>
  ({ default: (await import('./stubs/index.js')).stubComponent('LinkCheck') }));

const { idbData, idbKeyvalMock } = await import('./idb-mock.js');
const { stubSelector } = await import('./stubs/index.js');
const { default: Link } = await import('../../../src/components/views/Link.svelte');
const { default: LinkStep } = await import('../../../src/components/views/LinkStep.svelte');
const stores = await import('../../../src/components/tools/stores.js');
const { resetLinkStores, makeFile, flush } = await import('./helpers.js');

const {
  linkStep, linkFile, linkFileName, linkFileSize, linkMapping, linkJob, linkResults,
  linkCompleteResults, linkValidations, linkOptions, linkWaiter, linkSourceHeader,
  linkSourceHeaderTypes, linkCompleted
} = stores;

const stepTitles = () => [...document.querySelectorAll('strong')]
  .map(s => s.textContent.trim())
  .filter(t => /^Étape \d\./.test(t));

// Card (LinkFile or LinkStep) of step `n` (1-based), found by its title.
const card = (n) => [...document.querySelectorAll('div.rf-callout')]
  .find(div => div.querySelector('p strong')?.textContent.trim().startsWith(`Étape ${n}.`));

// Render Link and wait for its onMount restore (and the reset it triggers on
// an empty browser state) to settle.
const renderLink = async () => {
  const result = render(Link);
  await waitFor(() => expect(idbKeyvalMock.clear).toHaveBeenCalled());
  await flush();
  return result;
};

const results = () => ({
  header: ['name', 'sourceLineNumber', 'score'],
  rows: [[['a', '1', '0.9']], [['b', '2', '0.5'], ['b2', '2', '0.4']]]
});

describe('Link page (Link.svelte, LinkStep.svelte)', () => {
  beforeEach(() => {
    resetLinkStores();
    idbData.clear();
    window.history.replaceState({}, '', '/link');
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('LK-001 renders the title "Appariement" and the 4 step cards', async () => {
    await renderLink();
    expect(screen.getByText('Appariement')).toBeTruthy();
    expect(stepTitles()).toEqual([
      'Étape 1. Fichier', 'Étape 2. Configuration', 'Étape 3. Traitement', 'Étape 4. Validez'
    ]);
  });

  it('LK-002 renders the step intro paragraphs as HTML (RGPD, 100Mo, AES-256, 1h deletion)', async () => {
    const { container } = await renderLink();
    const text = container.textContent;
    expect(text).toContain('mise en conformité RGPD');
    expect(text).toContain('100Mo');
    expect(text).toContain('chiffrées (AES-256)');
    expect(text).toContain('supprimées 1h après');
    // {@html}: markup is interpreted, not escaped
    expect([...container.querySelectorAll('p strong')].map(s => s.textContent)).toContain('format CSV');
    expect(text).not.toContain('<strong>');
  });

  it('LK-003 shows the LinkFile dropzone for the active step 1 and LinkStep cards for the others', async () => {
    await renderLink();
    expect(card(1).classList.contains('hover-parent')).toBe(true);
    expect(card(1).querySelector('a[href="#step1"]')).not.toBeNull();
    for (const n of [2, 3, 4]) {
      expect(card(n).classList.contains('hover-parent')).toBe(false);
      expect(card(n).querySelector('a')).toBeNull();
    }
  });

  it('LK-004 labels step 1 with the drop hint and the __API_MAX_BODY__ size limit', async () => {
    await renderLink();
    const label = card(1).querySelector('a p').innerHTML;
    expect(label).toContain('Glissez un fichier au format CSV ou Gedcom ici');
    expect(label).toContain('(100Mo maximum)');
    expect(card(1).querySelector('a').getAttribute('aria-label')).toContain('(100Mo maximum)');
  });

  it('LK-005 narrows the left column and shows "Étape N" with the step text on the right after step 1', async () => {
    const { container } = await renderLink();
    const left = () => container.querySelector('div[class*="rf-col-md-"][style*="position: relative"]');
    expect(container.querySelector('.rf-col-3')).not.toBeNull();
    expect(left().className).toContain('rf-col-md-6');
    expect(left().className).toContain('rf-col-xl-6');
    expect(left().className).toContain('rf-margin-top-2N');
    linkStep.set(2);
    await flush();
    expect(container.querySelector('.rf-col-3')).toBeNull();
    expect(left().className).toContain('rf-col-md-4');
    expect(left().className).toContain('rf-col-xl-3');
    expect(left().className).not.toContain('rf-margin-top-2N');
    const right = container.querySelector('.rf-col-12.rf-padding-2N.rf-hide--mobile');
    expect(right.querySelector('strong').textContent.trim()).toBe('Étape 2');
    expect(right.textContent).toContain('configurer les colonnes à rapprocher');
  });

  it('LK-006 hides non-current steps on mobile and the step texts on desktop after step 1', async () => {
    const { container } = await renderLink();
    const blocks = () => [...container.querySelectorAll('.rf-col-12.rf-padding-1N')]
      .filter(div => div.parentElement.parentElement.parentElement.matches('.rf-col-12.rf-padding-1N'));
    // 4 steps x (text, card)
    expect(blocks()).toHaveLength(8);
    const hidden = (cls) => blocks().map(b => b.classList.contains(cls));
    expect(hidden('rf-hide--mobile')).toEqual([false, false, true, true, true, true, true, true]);
    expect(hidden('rf-hide--desktop')).toEqual(new Array(8).fill(false));
    linkStep.set(3);
    await flush();
    expect(hidden('rf-hide--mobile')).toEqual([true, true, true, true, false, false, true, true]);
    // texts (even blocks) hidden on desktop, cards kept
    expect(hidden('rf-hide--desktop')).toEqual([true, false, true, false, true, false, true, false]);
  });

  it('LK-007 shows the "Bêta" badge only for a Gedcom input', async () => {
    const { container } = await renderLink();
    expect(container.querySelector('.rf-badge')).toBeNull();
    linkOptions.update(o => ({ ...o, csv: { gedcom: { head: {} } } }));
    await flush();
    expect(container.querySelector('.rf-badge').textContent.trim()).toBe('Bêta');
  });

  it('LK-008 shows the loading overlay while the browser session is restored, hidden after >= 500 ms', async () => {
    let release;
    idbKeyvalMock.get.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const { container } = render(Link);
    expect(get(linkWaiter)).toBe('Chargement des données du navigateur');
    await waitFor(() => expect(container.querySelector('.rf-wait-container')).not.toBeNull());
    expect(container.querySelector('.rf-wait-container').textContent).toContain('Chargement des données du navigateur');
    expect(container.querySelector('.rf-wait-container .spin')).not.toBeNull();
    const releasedAt = Date.now();
    release(undefined);
    await waitFor(() => expect(get(linkWaiter)).toBe(false));
    await flush();
    // still displayed right after the restore: minimum display time
    expect(container.querySelector('.rf-wait-container')).not.toBeNull();
    await waitFor(() => expect(container.querySelector('.rf-wait-container')).toBeNull(), { timeout: 3000 });
    expect(Date.now() - releasedAt).toBeGreaterThanOrEqual(450);
  });

  it('LK-009 mirrors the $linkWaiter text in the overlay', async () => {
    const { container } = await renderLink();
    linkWaiter.set('Préparation de la visualisation des résultats');
    await waitFor(() => expect(container.querySelector('.rf-wait-container strong').textContent)
      .toBe('Préparation de la visualisation des résultats'));
  });

  it('LK-010 accepts a file under the size limit: stores name and size, moves to step 2, labels step 1 "name<br/>X.YMo"', async () => {
    await renderLink();
    linkFile.set(makeFile('a;b;c', 'clients.csv', { size: 1.5 * 1024 ** 2 }));
    await flush();
    expect(get(linkFileName)).toBe('clients.csv');
    expect(get(linkFileSize)).toBe(1.5 * 1024 ** 2);
    expect(get(linkStep)).toBe(2);
    expect(card(1).querySelector('p.rf-text--center').innerHTML).toMatch(/^clients\.csv<br>\d+(\.\d)?Mo$/);
    expect(card(1).classList.contains('rf-fi-checkbox-line')).toBe(true);
  });

  // BUG: the size is meant to be shown with one decimal ("X.YMo") but
  // `10 * Math.round(size / 1024 ** 2) / 10` rounds to an integer first, so a
  // 1.5 MiB file is labelled "2Mo".
  it.fails('LK-010 labels the accepted file size with one decimal (1.5 MiB -> "1.5Mo")', async () => {
    await renderLink();
    linkFile.set(makeFile('a;b;c', 'clients.csv', { size: 1.5 * 1024 ** 2 }));
    await flush();
    expect(card(1).querySelector('p.rf-text--center').innerHTML).toBe('clients.csv<br>1.5Mo');
  });

  it('LK-011 rejects a file over the size limit with an error label and stays on step 1', async () => {
    await renderLink();
    linkFile.set(makeFile('x', 'big.csv', { size: 100000001 }));
    await flush();
    expect(get(linkStep)).toBe(1);
    expect(get(linkFileName)).toBeFalsy();
    const label = card(1).querySelector('a p').textContent;
    expect(label).toContain('big.csv: volume > 100Mo');
    expect(label).toContain('réessayez avec un fichier plus petit');
    expect(card(1).classList.contains('rf-fi-alert-line')).toBe(true);
    expect(card(1).classList.contains('rf-text--error')).toBe(true);
  });

  it('LK-012 labels step 2 "colonnes: a, b, c" once at least 3 fields are mapped', async () => {
    await renderLink();
    linkStep.set(2);
    linkMapping.set({ direct: { nom: 'lastName', prenom: 'firstName' }, reverse: {} });
    await flush();
    expect(card(2).textContent).toContain('Choisissez les colonnes à apparier');
    linkMapping.set({ direct: { nom: 'lastName', prenom: 'firstName', naissance: 'birthDate' }, reverse: {} });
    await flush();
    expect(card(2).textContent).toContain('colonnes: nom, prenom, naissance');
  });

  it('LK-013 moves to step 3 with "traitement en cours <br/> {jobId}" once a job exists without results', async () => {
    await renderLink();
    linkJob.set('job-123');
    await flush();
    expect(get(linkStep)).toBe(3);
    const label = card(3).querySelector('p.rf-text--center');
    expect(label.textContent).toContain('traitement en cours');
    expect(label.textContent).toContain('job-123');
    expect(label.querySelector('br')).not.toBeNull();
  });

  it('LK-014 shows "le traitement a échoué" in error on the step 3 card for a failed job', async () => {
    await renderLink();
    linkJob.set('failed');
    await flush();
    expect(card(3).textContent).toContain('le traitement a échoué');
    expect(card(3).classList.contains('rf-fi-alert-line')).toBe(true);
    expect(card(3).classList.contains('rf-text--error')).toBe(true);
  });

  it('LK-015 moves to step 4 when results are available', async () => {
    await renderLink();
    linkCompleteResults.set({ header: results().header, rows: results().rows });
    linkResults.set(results());
    await flush();
    expect(get(linkStep)).toBe(4);
  });

  it('LK-016 labels steps 3/4 with "X/Y identifications potentielles" and "A/X identifications validées"', async () => {
    await renderLink();
    linkCompleteResults.set({ header: results().header, rows: [...results().rows, [['c', '3', '']]] });
    linkValidations.set([[{ checked: 'auto', valid: true }], [{ checked: false }, { checked: false }]]);
    linkResults.set(results());
    await flush();
    expect(card(3).textContent).toContain('2/3 identifications potentielles');
    expect(card(4).textContent).toContain('1/2 identifications validées');
  });

  it('LK-017 the trash icon performs a FULL reset (IDB, labels, step 1, stores, ?job removed from the URL)', async () => {
    await renderLink();
    window.history.replaceState({}, '', '/link?job=abc&foo=1');
    linkFile.set(makeFile('a', 'f.csv', { size: 10 }));
    linkOptions.update(o => ({ ...o, csv: { sep: ';' } }));
    linkSourceHeader.set(['a']);
    linkSourceHeaderTypes.set({ a: {} });
    linkMapping.set({ direct: { a: 'lastName', b: 'firstName', c: 'sex' }, reverse: {} });
    linkJob.set('failed');
    await flush();
    idbKeyvalMock.clear.mockClear();
    const trash = document.querySelector('a[href="#reset"]').closest('div[style*="absolute"]');
    expect(trash.closest('[title], div').querySelector('[aria-label="réinitialiser le traitement"]')).not.toBeNull();
    await fireEvent.click(trash);
    await flush();
    expect(idbKeyvalMock.clear).toHaveBeenCalled();
    expect(get(linkStep)).toBe(1);
    expect(get(linkFile)).toBeUndefined();
    expect(get(linkFileName)).toBeUndefined();
    expect(get(linkFileSize)).toBeUndefined();
    expect(get(linkOptions).csv).toBeUndefined();
    expect(get(linkSourceHeader)).toBeUndefined();
    expect(get(linkSourceHeaderTypes)).toBeUndefined();
    expect(get(linkJob)).toBeUndefined();
    expect(get(linkResults)).toBeUndefined();
    expect(get(linkCompleteResults)).toBeUndefined();
    expect(get(linkValidations)).toBeUndefined();
    expect(get(linkCompleted)).toBe(false);
    expect(get(linkMapping)).toEqual({});
    expect(window.location.search).toBe('?foo=1');
    expect(card(1).querySelector('a p').innerHTML).toContain('Glissez un fichier');
    expect(card(2).textContent).toContain('Choisissez les colonnes à apparier');
    expect(card(3).textContent).toContain('Attendez le traitement');
    expect(card(3).classList.contains('rf-text--error')).toBe(false);
    expect(document.querySelector('a[href="#reset"]')).toBeNull();
  });

  it('LK-018 resets on any keydown on the trash wrapper', async () => {
    await renderLink();
    linkStep.set(2);
    linkFileName.set('f.csv');
    await flush();
    const trash = document.querySelector('a[href="#reset"]').closest('div[style*="absolute"]');
    await fireEvent.keyDown(trash, { key: 'x' });
    await flush();
    expect(get(linkStep)).toBe(1);
    expect(get(linkFileName)).toBeUndefined();
  });

  const storeSession = (values) => Object.entries(values)
    .forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));

  const consistentSession = {
    linkFileName: 'clients.csv',
    linkFileSize: 2048,
    linkSourceHeader: ['nom', 'prenom', 'naissance'],
    linkOptions: { csv: { sep: ';' }, api: { candidateNumber: 10, pruneScore: 0.3 }, check: { autoCheckThreshold: 0.85, filter: '' } },
    linkMapping: { direct: { nom: 'lastName', prenom: 'firstName', naissance: 'birthDate' }, reverse: {} },
    linkJob: 'job-42'
  };

  it('LK-019 restores the session from localStorage/IndexedDB on mount: back to step 3 while processing', async () => {
    storeSession(consistentSession);
    render(Link);
    await waitFor(() => expect(get(linkStep)).toBe(3));
    await flush();
    expect(get(linkJob)).toBe('job-42');
    expect(get(linkFileName)).toBe('clients.csv');
    expect(idbKeyvalMock.clear).not.toHaveBeenCalled();
    expect(card(1).textContent).toContain('clients.csv');
  });

  it('LK-019 restores results stored in IndexedDB (large values) and returns to step 4', async () => {
    storeSession(consistentSession);
    idbData.set('linkResults', JSON.stringify(results()));
    idbData.set('linkCompleteResults', JSON.stringify(results()));
    idbData.set('linkValidations', JSON.stringify([[{ checked: 'auto', valid: true }], [{ checked: false }, { checked: false }]]));
    render(Link);
    await waitFor(() => expect(get(linkStep)).toBe(4));
    await flush();
    expect(get(linkResults)).toEqual(results());
    expect(card(4).textContent).toContain('1/2 identifications validées');
  });

  it('LK-020 deep link /link?job=<key>: partial reset, then resumes the job from the URL', async () => {
    storeSession(consistentSession);
    window.history.replaceState({}, '', '/link?job=other-key');
    render(Link);
    await waitFor(() => expect(get(linkJob)).toBe('other-key'));
    await flush();
    expect(idbKeyvalMock.clear).toHaveBeenCalled();
    expect(get(linkFileName)).toBeUndefined();
    expect(get(linkMapping)).toEqual({});
    expect(get(linkStep)).toBe(3);
    // partial reset: the job parameter stays in the URL
    expect(window.location.search).toBe('?job=other-key');
  });

  it('LK-020 keeps the stored session when ?job equals the stored job', async () => {
    storeSession(consistentSession);
    window.history.replaceState({}, '', '/link?job=job-42');
    render(Link);
    await waitFor(() => expect(get(linkStep)).toBe(3));
    await flush();
    expect(idbKeyvalMock.clear).not.toHaveBeenCalled();
    expect(get(linkFileName)).toBe('clients.csv');
  });

  // BUG: `!$linkMapping` can never be true: the store default (and the value
  // restored after a reset) is `{}`, so a stored session without a mapping is
  // not detected as inconsistent and resumes at step 3 instead of resetting.
  it.fails('LK-021 fully resets an inconsistent stored session (missing linkMapping)', async () => {
    const session = { ...consistentSession };
    delete session.linkMapping;
    storeSession(session);
    render(Link);
    await vi.waitFor(() => expect(idbKeyvalMock.clear).toHaveBeenCalled(), { timeout: 300 });
    await flush();
    expect(get(linkStep)).toBe(1);
  });

  for (const missing of ['linkFileName', 'linkSourceHeader', 'linkJob']) {
    it(`LK-021 fully resets an inconsistent stored session (missing ${missing})`, async () => {
      const session = { ...consistentSession };
      delete session[missing];
      storeSession(session);
      window.history.replaceState({}, '', '/link?other=1');
      render(Link);
      await waitFor(() => expect(idbKeyvalMock.clear).toHaveBeenCalled());
      await flush();
      expect(get(linkStep)).toBe(1);
      expect(get(linkJob)).toBeUndefined();
      expect(get(linkMapping)).toEqual({});
    });
  }

  it('LK-021 fully resets a stored failed job and a session without csv options', async () => {
    storeSession({ ...consistentSession, linkJob: 'failed' });
    render(Link);
    await waitFor(() => expect(idbKeyvalMock.clear).toHaveBeenCalled());
    await flush();
    expect(get(linkJob)).toBeUndefined();
    cleanup();
    resetLinkStores();
    idbKeyvalMock.clear.mockClear();
    storeSession({ ...consistentSession, linkOptions: { ...consistentSession.linkOptions, csv: undefined } });
    render(Link);
    await waitFor(() => expect(idbKeyvalMock.clear).toHaveBeenCalled());
    await flush();
    expect(get(linkJob)).toBeUndefined();
    expect(get(linkStep)).toBe(1);
  });

  it('LK-022 lazily loads the step 4 body (LinkCheck) with a dynamic import', async () => {
    const { container } = await renderLink();
    linkCompleteResults.set(results());
    linkResults.set(results());
    await waitFor(() => expect(container.textContent).toContain('LinkCheck'));
  });

  it('LK-023 renders the step bodies in the right column: 2 LinkConfigure, 3 LinkJob, 4 LinkCheck', async () => {
    const { container } = await renderLink();
    const body = () => container.querySelector(`.rf-col-md-8 ${stubSelector}`)?.textContent.trim();
    expect(body()).toBeUndefined();
    linkStep.set(2);
    await flush();
    expect(body()).toBe('LinkConfigure');
    linkStep.set(3);
    await flush();
    expect(body()).toBe('LinkJob');
    linkStep.set(4);
    await waitFor(() => expect(body()).toBe('LinkCheck'));
  });

  describe('LinkStep card', () => {
    const renderStep = (props) => render(LinkStep, { step: 2, title: 'Configuration', label: 'label', error: false, ...props })
      .container.querySelector('.rf-callout');

    it('LK-024 active state: play icon, blue', () => {
      linkStep.set(2);
      const el = renderStep();
      expect([...el.classList]).toEqual(expect.arrayContaining(['rf-fi-play-line', 'rf-callout--scheme-soft-blue-soft']));
      expect(el.classList.contains('rf-inactive')).toBe(false);
    });

    it('LK-024 done state: checkbox, green (also when linkCompleted)', () => {
      linkStep.set(3);
      const el = renderStep();
      expect([...el.classList]).toEqual(expect.arrayContaining(['rf-fi-checkbox-line', 'rf-callout--scheme-soft-green-soft']));
      cleanup();
      linkStep.set(2);
      linkCompleted.set(true);
      const el2 = renderStep();
      expect([...el2.classList]).toEqual(expect.arrayContaining(['rf-fi-checkbox-line', 'rf-callout--scheme-soft-green-soft']));
    });

    it('LK-024 locked state: lock icon, inactive', () => {
      linkStep.set(1);
      const el = renderStep();
      expect([...el.classList]).toEqual(expect.arrayContaining(['rf-inactive', 'rf-fi-lock-fill']));
      expect(el.classList.contains('rf-fi-play-line')).toBe(false);
    });

    it('LK-024 error state: alert icon, red, no active/done styling', () => {
      linkStep.set(2);
      const el = renderStep({ error: true });
      expect([...el.classList]).toEqual(expect.arrayContaining(['rf-fi-alert-line', 'rf-text--error']));
      expect(el.classList.contains('rf-fi-play-line')).toBe(false);
      expect(el.classList.contains('rf-callout--scheme-soft-blue-soft')).toBe(false);
    });

    it('LK-025 shows "Étape N. Title" and the label as HTML', () => {
      const el = renderStep({ label: 'ligne 1<br/>ligne 2' });
      expect(el.querySelector('strong').textContent).toBe('Étape 2. Configuration');
      const label = el.querySelector('p.rf-text--center');
      expect(label.querySelector('br')).not.toBeNull();
      expect(label.textContent).toBe('ligne 1ligne 2');
    });
  });
});
