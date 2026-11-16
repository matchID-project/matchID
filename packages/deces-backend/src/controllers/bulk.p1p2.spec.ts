import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import crypto from 'crypto';

const queueMocks = vi.hoisted(() => ({
  getJob: vi.fn(),
  getJobs: vi.fn(),
  add: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn(function (this: unknown) { return queueMocks; }),
  QueueEvents: vi.fn(function (this: unknown) { return {}; }),
  Worker: vi.fn(function (this: unknown) { return { on: vi.fn() }; }),
  Job: { fromId: vi.fn() },
}));

import {
  parseTmpfilePersistence,
  MAX_TMPFILE_PERSISTENCE,
  MIN_TMPFILE_PERSISTENCE,
  returnBulkResults,
  deleteThreadJob,
} from '../processStream';
import * as processStream from '../processStream';
import { BulkController } from './bulk.controller';
import { redactBulkKey, BULK_KEY_REDACTION } from '../server';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

const makeResponse = () => {
  const res: any = {};
  res.send = vi.fn();
  res.status = vi.fn(() => res);
  res.setHeader = vi.fn();
  return res;
};

const makeJob = (overrides: any = {}) => ({
  id: 'jobhash',
  data: { user: 'alice@example.org', totalRows: 100, sep: ',' },
  progress: { percentage: 40 },
  timestamp: 1000,
  opts: { priority: 1 },
  getState: vi.fn(() => Promise.resolve('active')),
  remove: vi.fn(() => Promise.resolve(undefined)),
  ...overrides,
});

describe('bulk retention parsing (P2)', () => {
  const savedEnv = process.env.BACKEND_TMPFILE_PERSISTENCE;

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env.BACKEND_TMPFILE_PERSISTENCE;
    } else {
      process.env.BACKEND_TMPFILE_PERSISTENCE = savedEnv;
    }
  });

  it('falls back to BACKEND_TMPFILE_PERSISTENCE for a missing value', () => {
    process.env.BACKEND_TMPFILE_PERSISTENCE = '120000';
    expect(parseTmpfilePersistence(undefined)).toBe(120000);
  });

  it('falls back to BACKEND_TMPFILE_PERSISTENCE for the "undefined" string the UI used to send', () => {
    process.env.BACKEND_TMPFILE_PERSISTENCE = '3600000';
    expect(parseTmpfilePersistence('undefined')).toBe(3600000);
  });

  it('falls back to BACKEND_TMPFILE_PERSISTENCE for NaN and non-numeric values', () => {
    process.env.BACKEND_TMPFILE_PERSISTENCE = '3600000';
    expect(parseTmpfilePersistence(NaN)).toBe(3600000);
    expect(parseTmpfilePersistence('abc')).toBe(3600000);
    expect(parseTmpfilePersistence('')).toBe(MIN_TMPFILE_PERSISTENCE);
  });

  it('clamps too-small values to 60 000', () => {
    process.env.BACKEND_TMPFILE_PERSISTENCE = '3600000';
    expect(parseTmpfilePersistence('1000')).toBe(60000);
    expect(parseTmpfilePersistence(0)).toBe(60000);
    expect(parseTmpfilePersistence(-5)).toBe(60000);
  });

  it('clamps too-large values to the published 1 h maximum', () => {
    process.env.BACKEND_TMPFILE_PERSISTENCE = '3600000';
    expect(parseTmpfilePersistence('28800000')).toBe(3600000);
    expect(parseTmpfilePersistence('14400000')).toBe(3600000);
    expect(parseTmpfilePersistence(99999999)).toBe(3600000);
  });

  it('keeps valid values inside [60 000, 3 600 000]', () => {
    process.env.BACKEND_TMPFILE_PERSISTENCE = '3600000';
    expect(parseTmpfilePersistence('60000')).toBe(60000);
    expect(parseTmpfilePersistence('3600000')).toBe(3600000);
    expect(parseTmpfilePersistence(120000)).toBe(120000);
  });

  it('falls back to the 1 h maximum when the env default itself is missing or invalid', () => {
    delete process.env.BACKEND_TMPFILE_PERSISTENCE;
    expect(parseTmpfilePersistence(undefined)).toBe(MAX_TMPFILE_PERSISTENCE);
    process.env.BACKEND_TMPFILE_PERSISTENCE = 'not-a-number';
    expect(parseTmpfilePersistence(undefined)).toBe(MAX_TMPFILE_PERSISTENCE);
    expect(parseTmpfilePersistence('undefined')).toBe(MAX_TMPFILE_PERSISTENCE);
  });

  it('uploadCsv stores the parsed retention, never NaN', async () => {
    process.env.BACKEND_TMPFILE_PERSISTENCE = '3600000';
    const controller = new BulkController();
    vi.spyOn(controller as any, 'handleFile').mockResolvedValue(true);
    const csvHandleSpy = vi.spyOn(processStream, 'csvHandle').mockResolvedValue({ msg: 'started' } as any);
    const post = async (tmpfilePersistence: any) => {
      const req = {
        headers: {},
        body: { tmpfilePersistence },
        files: [{ buffer: Buffer.from('a,b\nc,d') }],
        user: { user: 'alice@example.org' },
      } as unknown as express.Request;
      await controller.uploadCsv(req);
      const calls = csvHandleSpy.mock.calls;
      return (calls[calls.length - 1] as any[])[1].tmpfilePersistence;
    };
    expect(await post(undefined)).toBe(3600000);
    expect(await post('undefined')).toBe(3600000);
    expect(await post('28800000')).toBe(3600000);
    expect(await post('1000')).toBe(60000);
    expect(await post('60000')).toBe(60000);
    vi.restoreAllMocks();
  });
});

describe('bulk job key redaction in logs (P1)', () => {
  it('redacts the csv/json path parameter with a fixed placeholder', () => {
    expect(redactBulkKey('/search/csv/abc123def')).toBe(`/search/csv/${BULK_KEY_REDACTION}`);
    expect(redactBulkKey('/search/json/abc123def')).toBe(`/search/json/${BULK_KEY_REDACTION}`);
    expect(BULK_KEY_REDACTION).not.toMatch(/[0-9a-f]{8}/);
  });

  it('keeps the rest of the URL (query string included) and never leaks the key', () => {
    const out = redactBulkKey('/search/csv/abc123def?order=true');
    expect(out).toBe(`/search/csv/${BULK_KEY_REDACTION}?order=true`);
    expect(out).not.toContain('abc123def');
  });

  it('redacts the job query parameter used by the UI job links', () => {
    const out = redactBulkKey('https://app/link?job=abc123def');
    expect(out).toBe(`https://app/link?job=${BULK_KEY_REDACTION}`);
    expect(out).not.toContain('abc123def');
  });

  it('leaves unrelated URLs untouched and preserves undefined', () => {
    expect(redactBulkKey('/search')).toBe('/search');
    expect(redactBulkKey('/queue/jobs?jobsType=completed')).toBe('/queue/jobs?jobsType=completed');
    expect(redactBulkKey(undefined)).toBeUndefined();
  });
});

describe('bulk job ownership (P1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueMocks.getJobs.mockResolvedValue([]);
  });

  it('serves polling to the owner', async () => {
    queueMocks.getJob.mockResolvedValue(makeJob());
    const res = makeResponse();
    await returnBulkResults(res, 'secret-key', 'csv', undefined as any, 'alice@example.org');
    expect(queueMocks.getJob).toHaveBeenCalledWith(sha256('secret-key'));
    expect(res.send).toHaveBeenCalledWith({ status: 'active', id: 'secret-key', progress: { percentage: 40 } });
  });

  it('answers another user exactly as for a non-existent job', async () => {
    queueMocks.getJob.mockResolvedValue(makeJob());
    const res = makeResponse();
    await returnBulkResults(res, 'secret-key', 'csv', undefined as any, 'mallory@example.org');
    expect(res.send).toHaveBeenCalledWith({ msg: "job doesn't exists" });
  });

  it('answers the same for a legacy job without an owner', async () => {
    queueMocks.getJob.mockResolvedValue(makeJob({ data: { totalRows: 100 } }));
    const res = makeResponse();
    await returnBulkResults(res, 'secret-key', 'json', undefined as any, 'alice@example.org');
    expect(res.send).toHaveBeenCalledWith({ msg: "job doesn't exists" });
  });

  it('answers the same when no job matches the key', async () => {
    queueMocks.getJob.mockResolvedValue(null);
    const res = makeResponse();
    await returnBulkResults(res, 'secret-key', 'csv', undefined as any, 'alice@example.org');
    expect(res.send).toHaveBeenCalledWith({ msg: "job doesn't exists" });
  });

  it('lets the owner cancel with the key', async () => {
    vi.useFakeTimers();
    try {
      queueMocks.getJob.mockResolvedValue(makeJob());
      const res = makeResponse();
      await deleteThreadJob(res, 'secret-key', 'alice@example.org');
      expect(queueMocks.getJob).toHaveBeenCalledTimes(1);
      expect(queueMocks.getJob).toHaveBeenCalledWith(sha256('secret-key'));
      expect(res.send).toHaveBeenCalledWith({ msg: 'Job secret-key cancelled' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('no longer accepts the job hash: it answers "no job found" with a single lookup', async () => {
    queueMocks.getJob.mockResolvedValue(null);
    const res = makeResponse();
    await deleteThreadJob(res, 'jobhash', 'alice@example.org');
    expect(queueMocks.getJob).toHaveBeenCalledTimes(1);
    expect(res.send).toHaveBeenCalledWith({ msg: 'no job found' });
  });

  it('refuses cancellation to another user and to legacy ownerless jobs', async () => {
    queueMocks.getJob.mockResolvedValue(makeJob());
    const resOther = makeResponse();
    await deleteThreadJob(resOther, 'secret-key', 'mallory@example.org');
    expect(resOther.send).toHaveBeenCalledWith({ msg: 'no job found' });
    queueMocks.getJob.mockResolvedValue(makeJob({ data: { totalRows: 100 } }));
    const resLegacy = makeResponse();
    await deleteThreadJob(resLegacy, 'secret-key', 'alice@example.org');
    expect(resLegacy.send).toHaveBeenCalledWith({ msg: 'no job found' });
  });

  it('forwards the JWT user claim from the controller to the job functions', async () => {
    const controller = new BulkController();
    const resultsSpy = vi.spyOn(processStream, 'returnBulkResults').mockResolvedValue(undefined);
    const deleteSpy = vi.spyOn(processStream, 'deleteThreadJob').mockResolvedValue(undefined);
    try {
      const req = { res: makeResponse(), user: { user: 'alice@example.org' } } as unknown as express.Request;
      await controller.downloadResults(req, 'csv', 'secret-key');
      expect(resultsSpy).toHaveBeenCalledWith(expect.anything(), 'secret-key', 'csv', undefined, 'alice@example.org');
      await controller.deleteJob(req, 'secret-key');
      expect(deleteSpy).toHaveBeenCalledWith(expect.anything(), 'secret-key', 'alice@example.org');
    } finally {
      vi.restoreAllMocks();
    }
  });
});
