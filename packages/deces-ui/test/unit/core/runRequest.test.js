import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  runSearchRequest, runIdRequest, runAggregationRequest, runSearchStreamRequest, runCompareRequest
} from '../../../src/components/tools/runRequest.js';
import { accessToken, cachedResponses } from '../../../src/components/tools/stores.js';

const jsonResponse = (payload, init) => new Response(JSON.stringify(payload), init);

let fetchMock;

beforeEach(() => {
  cachedResponses.set({});
  accessToken.set('');
  fetchMock = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  vi.useRealTimers();
});

const readStream = async (stream) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text;
    text += decoder.decode(value);
  }
};

describe('CO-053 in-memory response cache', () => {
  it('CO-053 serves an identical request within 59 s from cachedResponses', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ response: { total: 1 } }));
    const first = await runSearchRequest({ q: 'dupont' });
    const second = await runSearchRequest({ q: 'dupont' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(Object.keys(get(cachedResponses))).toHaveLength(1);
  });

  it('CO-053 refetches after 59 s, for another request, or when cache=false', async () => {
    vi.useFakeTimers({ now: 1_000_000, toFake: ['Date'] });
    fetchMock.mockImplementation(async () => jsonResponse({ response: { total: 1 } }));
    await runSearchRequest({ q: 'dupont' });
    await runSearchRequest({ q: 'durand' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await runSearchRequest({ q: 'dupont' }, false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.setSystemTime(1_000_000 + 60_000);
    await runSearchRequest({ q: 'durand' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('CO-053 distinguishes the API in the cache key', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ response: {} }));
    await runSearchRequest({ q: 'dupont' });
    await runCompareRequest({ q: 'dupont' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('/deces/api/v1/compare');
  });
});

describe('CO-054 Authorization header', () => {
  it('CO-054 adds "Bearer <token>" on POST requests when logged in', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ response: {} }));
    accessToken.set('jwt-123');
    await runSearchRequest({ q: 'dupont' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/deces/api/v1/search');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jwt-123');
    expect(JSON.parse(init.body)).toEqual({ q: 'dupont' });
  });

  it('CO-054 sends no Authorization header when anonymous', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ response: {} }));
    await runSearchRequest({ q: 'dupont' });
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });
});

describe('CO-055 Accept header', () => {
  it('CO-055 asks for JSON on search and CSV on streamed search / aggregations', async () => {
    fetchMock.mockImplementation(async () => new Response('a,b\n1,2\n'));
    await runSearchStreamRequest({ q: 'x' });
    await runAggregationRequest({ q: 'y' });
    fetchMock.mockImplementation(async () => jsonResponse({ response: {} }));
    await runSearchRequest({ q: 'z' });
    const accepts = fetchMock.mock.calls.map(([, init]) => init.headers.Accept);
    expect(accepts).toEqual(['text/csv', 'text/csv', 'application/json']);
    expect(fetchMock.mock.calls[1][0]).toBe('/deces/api/v1/agg');
    expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
  });
});

describe('CO-056 GET /id/<id>', () => {
  it('CO-056 builds the id path and sends a plain GET (no body, no Authorization header)', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ response: { persons: [] } }));
    accessToken.set('jwt-123');
    await runIdRequest('AbCdEfGhIjKl');
    expect(fetchMock).toHaveBeenCalledWith('/deces/api/v1/id/AbCdEfGhIjKl', { method: 'GET' });
  });
});

describe('CO-057 HTTP errors on the JSON API', () => {
  it.each([
    [429, 'Too Many Requests', { msg: 'rate limited' }, 'rate limited'],
    [500, 'Internal Server Error', null, undefined],
    [422, 'Unprocessable Entity', { msg: 'register' }, 'register']
  ])('CO-057 HTTP %i becomes a synthetic error result', async (status, statusText, payload, msg) => {
    fetchMock.mockImplementation(async () => new Response(payload ? JSON.stringify(payload) : 'not json', { status, statusText }));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await runSearchRequest({ q: 'dupont' });
    expect(result).toEqual({
      response: { total: 1, persons: [{ error: true, status, statusText, msg }] }
    });
  });

  it('CO-057 does not cache error responses', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ msg: 'x' }, { status: 503 }));
    await runSearchRequest({ q: 'dupont' });
    await runSearchRequest({ q: 'dupont' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(get(cachedResponses)).toEqual({});
  });
});

describe('CO-058 HTTP errors on the CSV stream API', () => {
  it('CO-058 returns the raw Response to the caller', async () => {
    const response = new Response('boom', { status: 500 });
    fetchMock.mockResolvedValue(response);
    expect(await runAggregationRequest({ q: 'dupont' })).toBe(response);
  });
});

describe('CO-059 CSV stream', () => {
  it('CO-059 re-emits the body as a ReadableStream with headers and caches the full text at the end', async () => {
    fetchMock.mockImplementation(async () => new Response('a,b\n1,2\n', { headers: { 'x-total': '1' } }));
    const stream = await runSearchStreamRequest({ q: 'dupont' });
    expect(stream).toBeInstanceOf(ReadableStream);
    expect(stream.headers.get('x-total')).toBe('1');
    expect(await readStream(stream)).toBe('a,b\n1,2\n');
    await vi.waitFor(() => expect(Object.values(get(cachedResponses)).map(c => c.response)).toEqual(['a,b\n1,2\n']));
    // a cached stream request is served as the cached text, not as a stream
    expect(await runSearchStreamRequest({ q: 'dupont' })).toBe('a,b\n1,2\n');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('CO-059 falls back to response.text() when the response has no body stream', async () => {
    fetchMock.mockResolvedValue({ status: 200, body: null, text: async () => 'x,y\n' });
    expect(await runAggregationRequest({ q: 'dupont' })).toBe('x,y\n');
    expect(Object.values(get(cachedResponses)).map(c => c.response)).toEqual(['x,y\n']);
  });
});
