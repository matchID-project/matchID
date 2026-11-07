// In-memory replacement for idb-keyval (jsdom has no IndexedDB).
// Usage in a test file:
//   vi.mock('idb-keyval', async () => (await import('./idb-mock.js')).idbKeyvalMock);
import { vi } from 'vitest';

export const idbData = new Map();

export const idbKeyvalMock = {
  get: vi.fn(async (key) => idbData.get(key)),
  set: vi.fn(async (key, value) => { idbData.set(key, value); }),
  del: vi.fn(async (key) => { idbData.delete(key); }),
  clear: vi.fn(async () => { idbData.clear(); })
};
