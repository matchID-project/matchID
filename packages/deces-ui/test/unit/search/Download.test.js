import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import axios from 'axios';
import { resetSearchStores, setAdvanced, setInput } from './helpers.js';

const { default: Download } = await import('../../../src/components/views/Download.svelte');
const stores = await import('../../../src/components/tools/stores.js');

const idleTitle = "téléchargez l'ensemble des résultats en tableur CSV";

// The CSV download link created by the component.
const captureDownloads = () => {
  const clicks = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    clicks.push({ href: this.href, download: this.download, attached: document.body.contains(this) });
  });
  URL.createObjectURL = vi.fn(() => 'blob:csv');
  URL.revokeObjectURL = vi.fn();
  return clicks;
};

// Note: download() first awaits a 500 ms reset of the progress tween, so the
// request is only sent after that delay (generous timeout for loaded CI hosts).
const afterTween = { timeout: 5000 };

// Progress event with the XMLHttpRequest shape the component reads
// (`target.getResponseHeader`, `currentTarget.response` as bytes).
const xhrProgress = (total, csv) => ({
  target: { getResponseHeader: (h) => (h === 'total-results' ? `${total}` : null) },
  currentTarget: { response: new TextEncoder().encode(csv) }
});

// Grab the click listener registered on the idle icon: the Svelte handler
// returns the download promise, which lets a test await its rejection.
const clickListener = () => {
  const added = vi.spyOn(HTMLSpanElement.prototype, 'addEventListener');
  return () => added.mock.calls.find(([type], i) => type === 'click' && added.mock.contexts[i].title === idleTitle)[1];
};

describe('Download', () => {
  beforeEach(() => {
    resetSearchStores(stores);
    setInput(stores, { fullText: 'jean dupont' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('SR-220 shows the idle download icon with its title', () => {
    render(Download);
    const icon = screen.getByTitle(idleTitle);
    expect(icon.querySelector('.rf-fi--icon').className).toContain('rf-color--bf rf-href');
  });

  it('SR-221 disabled: forbid icon, "téléchargement limité à 500000 lignes", click is a no-op', async () => {
    const post = vi.spyOn(axios, 'post');
    render(Download, { disabled: true });
    const icon = screen.getByTitle('téléchargement limité à 500000 lignes');
    expect(icon.querySelector('.rf-fi--icon').className).toContain('rf-color--g400');
    await fireEvent.click(icon);
    expect(post).not.toHaveBeenCalled();
  });

  it('SR-222 a click POSTs /search as text/csv with headerLang=french, the criteria and the fuzzy flag (no auth header)', async () => {
    stores.accessToken.set('token-not-sent');
    captureDownloads();
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: 'a;b\n' });
    render(Download);
    await fireEvent.click(screen.getByTitle(idleTitle));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), afterTween);
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('/deces/api/v1/search');
    // fullText has no per-field fuzzy setting: fuzzy=false (see the BUG below)
    expect(body).toEqual({ headerLang: 'french', q: 'jean_dupont', fuzzy: 'false' });
    expect(config.headers).toEqual({ Accept: 'text/csv' });
    expect(typeof config.onDownloadProgress).toBe('function');
    stores.accessToken.set('');
  });

  it('SR-223 encodes the criteria: backendQuery keys, first whitespace to "_", upper case otherwise', async () => {
    captureDownloads();
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: '' });
    setAdvanced(stores);
    setInput(stores, { fullText: '', lastName: 'de la tour', firstName: 'jean pierre' });
    render(Download);
    await fireEvent.click(screen.getByTitle(idleTitle));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), afterTween);
    expect(post.mock.calls[0][1]).toEqual({ headerLang: 'french', lastName: 'DE_LA TOUR', firstName: 'JEAN_PIERRE', fuzzy: 'true' });
  });

  // BUG: the `fuzzy` flag is overwritten by each filled criterion with its own
  // per-field setting (Download.svelte:70-74), so a fuzzy search with an exact
  // criterion such as the death department exports with fuzzy=false: the CSV
  // does not match the displayed results.
  it.fails('SR-222 the export keeps the fuzzy flag of the displayed (fuzzy) search', async () => {
    captureDownloads();
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: '' });
    setAdvanced(stores);
    setInput(stores, { fullText: '', lastName: 'dupont', deathDepartment: '33' });
    render(Download);
    await fireEvent.click(screen.getByTitle(idleTitle));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), afterTween);
    expect(post.mock.calls[0][1].fuzzy).toBe('true');
  });

  it('SR-224 shows the progress pie and "téléchargement en cours N%" while downloading', async () => {
    captureDownloads();
    let resolve;
    let onProgress;
    vi.spyOn(axios, 'post').mockImplementation((url, body, config) => {
      onProgress = config.onDownloadProgress;
      return new Promise(r => { resolve = r; });
    });
    const { container } = render(Download);
    await fireEvent.click(screen.getByTitle(idleTitle));
    await waitFor(() => expect(onProgress).toBeDefined(), afterTween);
    onProgress(xhrProgress(4, 'h\nl1\n'));
    await waitFor(() => expect(container.querySelector('[title^="téléchargement en cours"]')).not.toBeNull());
    expect(container.querySelector('svg circle[stroke-dasharray]')).not.toBeNull();
    await waitFor(() => expect(container.querySelector('[title^="téléchargement en cours"]').title).toBe('téléchargement en cours 50%'), afterTween);
    resolve({ data: '' });
    await waitFor(() => expect(screen.getByTitle('téléchargement terminé')).toBeTruthy(), afterTween);
  });

  // BUG: axios >= 1 passes an AxiosProgressEvent ({loaded, total, event...})
  // to onDownloadProgress, without `target`/`currentTarget`: the handler
  // (Download.svelte:80-91) throws on every progress event, so the pie shows
  // "NaN%". The response text is also a string, on which countLines()'s
  // indexOf(10) looks for "10" instead of a newline.
  it.fails('SR-224 the progress works with the axios 1.x progress event', async () => {
    captureDownloads();
    const errors = [];
    let resolve;
    vi.spyOn(axios, 'post').mockImplementation((url, body, config) => {
      try {
        config.onDownloadProgress({ loaded: 10, total: undefined, progress: undefined, bytes: 10, event: {}, download: true });
      } catch (e) {
        errors.push(e);
      }
      return new Promise(r => { resolve = r; });
    });
    const { container } = render(Download);
    await fireEvent.click(screen.getByTitle(idleTitle));
    await waitFor(() => expect(container.querySelector('[title^="téléchargement en cours"]')).not.toBeNull());
    resolve({ data: '' });
    expect(errors).toEqual([]);
    expect(container.querySelector('[title^="téléchargement en cours"]').title).not.toContain('NaN');
  });

  // Drives the 2 s throttle through Date.now() only: the progress tween keeps
  // running on real animation frames (fake timers would mix two clocks).
  it('SR-225 above 5000 rows the progress is refreshed at most every 2 s', async () => {
    captureDownloads();
    let onProgress;
    vi.spyOn(axios, 'post').mockImplementation((url, body, config) => {
      onProgress = config.onDownloadProgress;
      return new Promise(() => {});
    });
    const { container } = render(Download);
    await fireEvent.click(screen.getByTitle(idleTitle));
    await waitFor(() => expect(onProgress).toBeDefined(), afterTween);
    let clock = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const title = () => container.querySelector('[title^="téléchargement en cours"]').title;
    onProgress(xhrProgress(10000, '\n'.repeat(1000)));
    await waitFor(() => expect(title()).toBe('téléchargement en cours 10%'), afterTween);
    clock += 1000;
    onProgress(xhrProgress(10000, '\n'.repeat(5000)));
    // throttled: the progress target is not updated (a tween would start on the next frame)
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(title()).toBe('téléchargement en cours 10%');
    clock += 1500;
    onProgress(xhrProgress(10000, '\n'.repeat(5000)));
    await waitFor(() => expect(title()).toBe('téléchargement en cours 50%'), afterTween);
  });

  it('SR-226 a successful download saves the file deces-<VALUES>.csv', async () => {
    const clicks = captureDownloads();
    vi.spyOn(axios, 'post').mockResolvedValue({ data: 'nom;prenom\nDUPONT;Jean\n' });
    setAdvanced(stores);
    setInput(stores, { fullText: '', lastName: 'dupont', firstName: 'jean pierre', deathDate: '2020' });
    render(Download);
    await fireEvent.click(screen.getByTitle(idleTitle));
    await waitFor(() => expect(clicks).toHaveLength(1), afterTween);
    expect(clicks[0]).toEqual({ href: 'blob:csv', download: 'deces-DUPONT-JEAN_PIERRE-2020.csv', attached: true });
    const [blob] = URL.createObjectURL.mock.calls[0];
    expect(blob.type).toBe('text/csv');
    expect(await blob.text()).toBe('nom;prenom\nDUPONT;Jean\n');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:csv');
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('SR-227 shows the success icon "téléchargement terminé"', async () => {
    captureDownloads();
    vi.spyOn(axios, 'post').mockResolvedValue({ data: '' });
    render(Download);
    await fireEvent.click(screen.getByTitle(idleTitle));
    expect(await screen.findByTitle('téléchargement terminé', {}, afterTween)).toBeTruthy();
  });

  it('SR-228 a failure shows "problème de téléchargement" and rethrows', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('Network Error'));
    const listener = clickListener();
    render(Download);
    const click = listener();
    await expect(click(new MouseEvent('click', { cancelable: true }))).rejects.toThrow('Network Error');
    expect(await screen.findByTitle('problème de téléchargement')).toBeTruthy();
  });

  it('SR-229 the download state resets when the criteria change', async () => {
    captureDownloads();
    vi.spyOn(axios, 'post').mockResolvedValue({ data: '' });
    render(Download);
    await fireEvent.click(screen.getByTitle(idleTitle));
    await screen.findByTitle('téléchargement terminé', {}, afterTween);
    setInput(stores, { fullText: 'martin' });
    await waitFor(() => expect(screen.getByTitle(idleTitle)).toBeTruthy());
  });
});
