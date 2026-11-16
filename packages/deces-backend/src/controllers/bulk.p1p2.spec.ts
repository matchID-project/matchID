import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import loggerStream from '../logger';
import { app } from '../server';
import { JobsController } from './job.controller';
import * as mailModule from '../mail';
import * as webhookModule from '../webhook';

const queueMocks = vi.hoisted(() => ({
  getJob: vi.fn(),
  getJobs: vi.fn(),
  add: vi.fn(),
}));

const workerHandlers = vi.hoisted(() => ({} as Record<string, (...args: any[]) => unknown>));

vi.mock('bullmq', () => ({
  Queue: vi.fn(function (this: unknown) { return queueMocks; }),
  QueueEvents: vi.fn(function (this: unknown) { return {}; }),
  Worker: vi.fn(function (this: unknown) { return { on: vi.fn((event: string, cb: (...args: any[]) => unknown) => { workerHandlers[event] = cb; }) }; }),
  Job: { fromId: vi.fn() },
}));

import {
  parseTmpfilePersistence,
  MAX_TMPFILE_PERSISTENCE,
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
    expect(parseTmpfilePersistence('')).toBe(3600000);
    expect(parseTmpfilePersistence('   ')).toBe(3600000);
    expect(parseTmpfilePersistence(null)).toBe(3600000);
    expect(parseTmpfilePersistence(undefined)).toBe(3600000);
    expect(parseTmpfilePersistence(false)).toBe(3600000);
    expect(parseTmpfilePersistence(true)).toBe(3600000);
  });

  it('falls back to BACKEND_TMPFILE_PERSISTENCE for 0, negatives and non-finite values', () => {
    process.env.BACKEND_TMPFILE_PERSISTENCE = '3600000';
    expect(parseTmpfilePersistence(0)).toBe(3600000);
    expect(parseTmpfilePersistence('0')).toBe(3600000);
    expect(parseTmpfilePersistence(-5)).toBe(3600000);
    expect(parseTmpfilePersistence('-100')).toBe(3600000);
    expect(parseTmpfilePersistence(Infinity)).toBe(3600000);
    expect(parseTmpfilePersistence(-Infinity)).toBe(3600000);
    expect(parseTmpfilePersistence('Infinity')).toBe(3600000);
  });

  it('falls back to the 1 h maximum when BACKEND_TMPFILE_PERSISTENCE itself is empty or invalid', () => {
    process.env.BACKEND_TMPFILE_PERSISTENCE = '';
    expect(parseTmpfilePersistence(undefined)).toBe(MAX_TMPFILE_PERSISTENCE);
    expect(parseTmpfilePersistence(null)).toBe(MAX_TMPFILE_PERSISTENCE);
    process.env.BACKEND_TMPFILE_PERSISTENCE = '0';
    expect(parseTmpfilePersistence(undefined)).toBe(MAX_TMPFILE_PERSISTENCE);
    process.env.BACKEND_TMPFILE_PERSISTENCE = '-5';
    expect(parseTmpfilePersistence(undefined)).toBe(MAX_TMPFILE_PERSISTENCE);
  });

  it('truncates floats and clamps small-but-valid values to 60 000', () => {
    process.env.BACKEND_TMPFILE_PERSISTENCE = '3600000';
    expect(parseTmpfilePersistence('1000')).toBe(60000);
    expect(parseTmpfilePersistence(1000)).toBe(60000);
    expect(parseTmpfilePersistence('90000.7')).toBe(90000);
    expect(parseTmpfilePersistence(90000.7)).toBe(90000);
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

  it('redacts case variants of the search path (Express matches case-insensitively)', () => {
    for (const url of [
      '/deces/api/v1/Search/csv/abc123def',
      '/deces/api/v1/search/CSV/abc123def',
      '/deces/api/v1/SEARCH/JSON/abc123def',
    ]) {
      const out = redactBulkKey(url);
      expect(out).not.toContain('abc123def');
      expect(out).toContain(BULK_KEY_REDACTION);
    }
  });

  it('redacts repeated and %-encoded slashes and keeps a trailing slash outside the key', () => {
    expect(redactBulkKey('/deces/api/v1/search//csv//abc123def'))
      .toBe(`/deces/api/v1/search//csv//${BULK_KEY_REDACTION}`);
    expect(redactBulkKey('/deces/api/v1/search%2Fcsv%2Fabc123def'))
      .toBe(`/deces/api/v1/search%2Fcsv%2F${BULK_KEY_REDACTION}`);
    expect(redactBulkKey('/deces/api/v1/search%2fjson%2fabc123def'))
      .toBe(`/deces/api/v1/search%2fjson%2f${BULK_KEY_REDACTION}`);
    const trailing = redactBulkKey('/deces/api/v1/search/csv/abc123def/');
    expect(trailing).toBe(`/deces/api/v1/search/csv/${BULK_KEY_REDACTION}/`);
    expect(trailing).not.toContain('abc123def');
  });

  it('redacts the job query parameter in any case and after other parameters', () => {
    for (const url of [
      'https://app/link?JOB=abc123def',
      'https://app/link?Job=abc123def',
      'https://app/foo?a=1&job=abc123def',
    ]) {
      const out = redactBulkKey(url);
      expect(out).not.toContain('abc123def');
      expect(out).toMatch(/[?&]job=\[REDACTED\]/i);
    }
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

describe('bulk key redaction over HTTP (P1, F5)', () => {
  const key = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  const savedTokenKey = process.env.BACKEND_TOKEN_KEY;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  const loggedText = () => writeSpy.mock.calls.map((c: [string]) => String(c[0])).join('\n');

  beforeEach(() => {
    writeSpy = vi.spyOn(loggerStream, 'write').mockImplementation(() => undefined as unknown as void);
  });

  afterEach(() => {
    if (savedTokenKey === undefined) {
      delete process.env.BACKEND_TOKEN_KEY;
    } else {
      process.env.BACKEND_TOKEN_KEY = savedTokenKey;
    }
    vi.restoreAllMocks();
  });

  it('never logs the key of GET /search/csv/:id (morgan url + auth error path)', async () => {
    const res = await request(app).get(`/deces/api/v1/search/csv/${key}`);
    expect(res.status).toBe(422);
    const logs = loggedText();
    expect(logs).not.toContain(key);
    expect(logs).toContain(BULK_KEY_REDACTION);
  });

  it('redacts case-variant paths and the referrer carrying ?job=<key>', async () => {
    const res = await request(app)
      .get(`/deces/api/v1/Search/csv/${key}`)
      .set('Referer', `https://app/link?job=${key}`);
    expect(res.status).toBe(422);
    const logs = loggedText();
    expect(logs).not.toContain(key);
    expect(logs).toContain(BULK_KEY_REDACTION);
  });

  it('redacts the key in the ValidateError branch (case-variant output format)', async () => {
    process.env.BACKEND_TOKEN_KEY = 'p1p2-spec-secret';
    const token = jwt.sign({ user: 'alice@example.org', scopes: ['user'] }, 'p1p2-spec-secret');
    const res = await request(app)
      .get(`/deces/api/v1/search/CSV/${key}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
    const logs = loggedText();
    expect(logs).not.toContain(key);
    expect(logs).toContain(BULK_KEY_REDACTION);
  });

  it('redacts the key on the authenticated download path when the job is unknown', async () => {
    process.env.BACKEND_TOKEN_KEY = 'p1p2-spec-secret';
    const token = jwt.sign({ user: 'alice@example.org', scopes: ['user'] }, 'p1p2-spec-secret');
    queueMocks.getJob.mockResolvedValue(null);
    const res = await request(app)
      .get(`/deces/api/v1/search/csv/${key}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ msg: "job doesn't exists" });
    const logs = loggedText();
    expect(logs).not.toContain(key);
    expect(logs).toContain(BULK_KEY_REDACTION);
  });
});

describe('completed-job deletion timer (P2, F5)', () => {
  const savedEnv = process.env.BACKEND_TMPFILE_PERSISTENCE;
  const savedJobs = process.env.JOBS;

  const silenceNotifications = () => {
    vi.spyOn(mailModule, 'sendJobUpdate').mockResolvedValue(true);
    vi.spyOn(webhookModule, 'sendWebhook').mockResolvedValue(true);
  };

  const unlinkSoon = () => vi.spyOn(fs, 'unlink').mockImplementation(((target: unknown, cb: (err: Error | null) => void) => {
    cb(null);
  }) as never);

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env.BACKEND_TMPFILE_PERSISTENCE;
    } else {
      process.env.BACKEND_TMPFILE_PERSISTENCE = savedEnv;
    }
    if (savedJobs === undefined) {
      delete process.env.JOBS;
    } else {
      process.env.JOBS = savedJobs;
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('deletes the result file parseTmpfilePersistence(job.data.tmpfilePersistence) ms after completion', async () => {
    process.env.BACKEND_TMPFILE_PERSISTENCE = '3600000';
    process.env.JOBS = '/tmp/bulk-jobs-test';
    vi.useFakeTimers();
    const unlinkSpy = unlinkSoon();
    silenceNotifications();
    await workerHandlers.completed({ id: 'hash123', data: { user: 'alice@example.org', randomKey: 'secret-key', tmpfilePersistence: 120000 } });
    expect(unlinkSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(119999);
    expect(unlinkSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(unlinkSpy).toHaveBeenCalledTimes(1);
    expect(unlinkSpy.mock.calls[0][0]).toBe('/tmp/bulk-jobs-test/hash123.out.enc');
  });

  it('a null retention (legacy BullMQ NaN) waits for the 1 h default, not 1 min', async () => {
    process.env.BACKEND_TMPFILE_PERSISTENCE = '3600000';
    process.env.JOBS = '/tmp/bulk-jobs-test';
    vi.useFakeTimers();
    const unlinkSpy = unlinkSoon();
    silenceNotifications();
    await workerHandlers.completed({ id: 'hash456', data: { user: 'alice@example.org', randomKey: 'secret-key', tmpfilePersistence: null } });
    await vi.advanceTimersByTimeAsync(60000);
    expect(unlinkSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3600000 - 60000);
    expect(unlinkSpy).toHaveBeenCalledTimes(1);
  });
});

describe('JobsController.getJobs ownership and redaction (F1, F5)', () => {
  const userReq = (user?: string, scopes: string[] = ['user']) =>
    ({ user: user === undefined ? undefined : { user, scopes } }) as unknown as express.Request;
  const ownedJob = (overrides: any = {}) => ({
    id: 'jobhash',
    status: 'active',
    data: { user: 'alice@example.org', randomKey: 'key-alice', webhook: 'https://example.com/hook' },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    queueMocks.getJobs.mockResolvedValue([]);
  });

  it('jobId branch: serves the key to the owner', async () => {
    const job = ownedJob();
    queueMocks.getJob.mockResolvedValue(job);
    const res = await new JobsController().getJobs(userReq('alice@example.org'), 'jobs', 'jobhash');
    expect(queueMocks.getJob).toHaveBeenCalledWith('jobhash');
    expect(res).toEqual({ job });
    expect(res.job.data.randomKey).toBe('key-alice');
  });

  it('jobId branch: answers exactly "job not found" to another user, leaking neither key nor owner', async () => {
    queueMocks.getJob.mockResolvedValue(ownedJob());
    const res = await new JobsController().getJobs(userReq('mallory@example.org'), 'jobs', 'jobhash');
    expect(res).toEqual({ msg: 'job not found' });
    expect(JSON.stringify(res)).not.toContain('key-alice');
    expect(JSON.stringify(res)).not.toContain('alice@example.org');
  });

  it('jobId branch: a legacy job without an owner is not found for non-admins', async () => {
    queueMocks.getJob.mockResolvedValue(ownedJob({ data: { totalRows: 10 } }));
    const res = await new JobsController().getJobs(userReq('alice@example.org'), 'jobs', 'jobhash');
    expect(res).toEqual({ msg: 'job not found' });
  });

  it('jobId branch: an unknown id is not found', async () => {
    queueMocks.getJob.mockResolvedValue(null);
    const res = await new JobsController().getJobs(userReq('alice@example.org'), 'jobs', 'nope');
    expect(res).toEqual({ msg: 'job not found' });
  });

  it("jobId branch: admin sees the metadata but never another owner's key", async () => {
    queueMocks.getJob.mockResolvedValue(ownedJob());
    const res = await new JobsController().getJobs(userReq('root@example.org', ['admin', 'user']), 'jobs', 'jobhash');
    expect(res.job.data.randomKey).toBeUndefined();
    expect(res.job.data.user).toBe('alice@example.org');
  });

  it('jobId branch: admin keeps their own key (admin self-service)', async () => {
    queueMocks.getJob.mockResolvedValue(ownedJob({ data: { user: 'root@example.org', randomKey: 'key-root' } }));
    const res = await new JobsController().getJobs(userReq('root@example.org', ['admin', 'user']), 'jobs', 'jobhash');
    expect(res.job.data.randomKey).toBe('key-root');
  });

  it('jobsType branch: a non-admin only sees their own jobs, with keys', async () => {
    queueMocks.getJobs.mockResolvedValue([
      ownedJob(),
      ownedJob({ id: 'other', data: { user: 'mallory@example.org', randomKey: 'key-mallory' } }),
      ownedJob({ id: 'legacy', data: { totalRows: 1 } }),
    ]);
    const res = await new JobsController().getJobs(userReq('alice@example.org'), 'jobs', undefined, 'active');
    expect(res.jobs).toHaveLength(1);
    expect(res.jobs[0].data.randomKey).toBe('key-alice');
  });

  it('jobsType branch: admin sees every job but only their own key', async () => {
    queueMocks.getJobs.mockResolvedValue([
      ownedJob(),
      ownedJob({ id: 'own', data: { user: 'root@example.org', randomKey: 'key-root' } }),
    ]);
    const res = await new JobsController().getJobs(userReq('root@example.org', ['admin', 'user']), 'jobs', undefined, 'active');
    expect(res.jobs).toHaveLength(2);
    expect(res.jobs.find((j: any) => j.id === 'jobhash').data.randomKey).toBeUndefined();
    expect(res.jobs.find((j: any) => j.id === 'own').data.randomKey).toBe('key-root');
  });

  it('default branch: a non-admin only sees their own jobs with statuses and keys', async () => {
    queueMocks.getJobs
      .mockResolvedValueOnce([ownedJob()])
      .mockResolvedValue([]);
    const controller = new JobsController();
    const res = await controller.getJobs(userReq('alice@example.org'), 'jobs');
    const mine = res.jobs.filter((j: any) => j.data && j.data.user === 'alice@example.org');
    expect(mine).toHaveLength(1);
    expect(mine[0].data.randomKey).toBe('key-alice');
    expect(mine[0].status).toBe('completed');
    expect(JSON.stringify(res.jobs)).not.toContain('key-mallory');
  });

  it('default branch: a request without identity sees no jobs', async () => {
    queueMocks.getJobs.mockResolvedValue([ownedJob()]);
    const res = await new JobsController().getJobs(userReq(undefined), 'jobs');
    expect(res).toEqual({ jobs: [] });
  });
});
