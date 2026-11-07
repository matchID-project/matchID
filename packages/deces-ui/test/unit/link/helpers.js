// Shared helpers for the /link, login, jobs and edits unit tests (zone LK).
import { vi } from 'vitest';
import * as stores from '../../../src/components/tools/stores.js';

export const defaultLinkOptions = () => ({
  csv: undefined,
  api: { candidateNumber: 10, pruneScore: 0.3 },
  check: {
    autoCheckSimilar: true,
    displayUnmappedColumns: false,
    autoCheckThreshold: 0.85,
    similarThreshold: 0.97,
    filter: ''
  }
});

// Stores are module singletons shared by every test of a file: put the ones
// used by the LK components back to their initial values.
export const resetLinkStores = () => {
  stores.linkFile.set(null);
  stores.linkWaiter.set(false);
  stores.linkFileSizeLimit.set('100000000');
  stores.linkFileName.set(null);
  stores.linkFileSize.set(null);
  stores.linkStep.set(1);
  stores.linkSourceHeader.set(null);
  stores.linkSourceHeaderTypes.set(null);
  stores.linkOptions.set(defaultLinkOptions());
  stores.linkMapping.set({});
  stores.linkMinFields.set(3);
  stores.linkJob.set(null);
  stores.linkResults.set(null);
  stores.linkCompleteResults.set(null);
  stores.linkValidations.set(null);
  stores.linkCompleted.set(false);
  stores.accessToken.set('');
  stores.accessTokenInfos.set({});
  stores.user.set(undefined);
  stores.admin.set(false);
  stores.route.set({});
  stores.themeDnum.set(0);
  stores.cachedResponses.set({});
};

export const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// fetch stub routing on "METHOD path" prefixes; unmatched calls resolve to {}.
export const stubFetch = (routes = {}) => vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init = {}) => {
  const method = (init.method || 'GET').toUpperCase();
  const key = Object.keys(routes).find(k => {
    const [m, p] = k.split(' ');
    return m === method && `${url}`.startsWith(p);
  });
  if (!key) return jsonResponse({});
  const handler = routes[key];
  const result = typeof handler === 'function' ? await handler(url, init) : handler;
  return result instanceof Response ? result : jsonResponse(result);
});

// A File whose `size` can be faked (jsdom computes it from the content).
export const makeFile = (content, name = 'people.csv', { size, type = 'text/csv' } = {}) => {
  const file = new File([content], name, { type });
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  return file;
};

// Minimal DataTransfer for drag & drop events (jsdom has none).
export const makeDataTransfer = ({ items, files, data = {} } = {}) => {
  const store = { ...data };
  return {
    items,
    files: files || [],
    effectAllowed: undefined,
    dropEffect: undefined,
    setData: (type, value) => { store[type] = value; },
    getData: (type) => store[type],
    store
  };
};

export const flush = () => new Promise(resolve => setTimeout(resolve, 0));
