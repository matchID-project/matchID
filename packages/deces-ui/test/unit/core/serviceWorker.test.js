import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/svelte';

vi.mock('register-service-worker', () => ({ register: vi.fn() }));
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {}, clear: async () => {} }));

const { register } = await import('register-service-worker');

afterEach(async () => {
  await vi.dynamicImportSettled();
  cleanup();
  delete navigator.serviceWorker;
});

const renderApp = async () => {
  window.history.replaceState({}, '', '/about');
  document.head.innerHTML = '<meta name="description" content="x"><link rel="canonical" href="/">';
  const info = document.createElement('div');
  info.id = 'infoNotWorking';
  document.body.appendChild(info);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const { default: App } = await import('../../../src/App.svelte');
  return render(App);
};

describe('CO-083 service worker registration', () => {
  it('CO-083 registers /sw.js with scope "./" when the browser supports service workers', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
    await renderApp();
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    const [url, options] = register.mock.calls[0];
    expect(url).toBe('/sw.js');
    expect(options.registrationOptions).toEqual({ scope: './' });
    expect(Object.keys(options).sort()).toEqual(
      ['cached', 'error', 'offline', 'ready', 'registered', 'registrationOptions', 'updated', 'updatefound']
    );
  });

  it('CO-083 on "updated" it unregisters the worker and reloads the page', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
    register.mockClear();
    await renderApp();
    await waitFor(() => expect(register).toHaveBeenCalled());
    const { updated } = register.mock.calls[0][1];
    const registration = { unregister: vi.fn() };
    // jsdom cannot reload: it reports "Not implemented: navigation" instead
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    updated(registration);
    expect(registration.unregister).toHaveBeenCalledTimes(1);
    errors.mockRestore();
  });

  it('CO-083 is skipped when the browser has no service worker support', async () => {
    register.mockClear();
    expect('serviceWorker' in navigator).toBe(false);
    await renderApp();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/liveConfig.json'));
    // let onMount run to its end (registration happens after the fetches)
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(register).not.toHaveBeenCalled();
  });
});
