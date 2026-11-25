import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';

const bullMocks = vi.hoisted(() => ({
  queueCalls: [] as [string, any][],
  chunkAdd: vi.fn(),
  getJobCounts: vi.fn(),
  getJobs: vi.fn(),
  getJob: vi.fn(),
  jobFromId: vi.fn(),
  chunkEventsInstance: { tag: 'chunkEvents' },
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn(function (name: string, opts: any) {
    bullMocks.queueCalls.push([name, opts]);
    return {
      add: name === 'chunks' ? bullMocks.chunkAdd : vi.fn(),
      getJobCounts: bullMocks.getJobCounts,
      getJobs: bullMocks.getJobs,
      getJob: bullMocks.getJob,
    };
  }),
  QueueEvents: vi.fn(function () {
    return bullMocks.chunkEventsInstance;
  }),
  Worker: vi.fn(function () {
    return {
      on: vi.fn(),
    };
  }),
  Job: {
    fromId: bullMocks.jobFromId,
  },
}));

vi.mock('./mail', () => ({
  sendJobUpdate: vi.fn(),
}));

vi.mock('./webhook', () => ({
  sendWebhook: vi.fn(),
}));

vi.mock('./runRequest', () => ({
  runBulkRequest: vi.fn(),
}));

vi.mock('./models/result', () => ({
  buildResultSingle: vi.fn(),
}));

vi.mock('./score', () => ({
  scoreResults: vi.fn(),
}));

import loggerStream from './logger';
import {
  CHUNK_EVENTS_MAX_LEN,
  CHUNK_REMOVE_ON_COMPLETE,
  JOB_EVENTS_MAX_LEN,
  ProcessStream,
} from './processStream';
import { JobsController } from './controllers/job.controller';

describe('BullMQ Redis memory bounds (streams.events.maxLen & chunks cleanup)', () => {
  const startupQueueCalls = [...bullMocks.queueCalls];

  beforeEach(() => {
    bullMocks.chunkAdd.mockReset();
    bullMocks.getJobCounts.mockReset();
    bullMocks.getJobs.mockReset();
    bullMocks.getJob.mockReset();
    bullMocks.jobFromId.mockReset();
  });

  it('caps jobs and chunks event streams while keeping jobs history intact', () => {
    const jobsCall = startupQueueCalls.find(([name]) => name === 'jobs');
    const chunksCall = startupQueueCalls.find(([name]) => name === 'chunks');

    expect(jobsCall).toBeDefined();
    expect(jobsCall[1].streams).toEqual({ events: { maxLen: JOB_EVENTS_MAX_LEN } });
    expect(jobsCall[1].defaultJobOptions?.removeOnComplete).toBeUndefined();
    expect(jobsCall[1].defaultJobOptions?.removeOnFail).toBeUndefined();

    expect(chunksCall).toBeDefined();
    expect(chunksCall[1].streams).toEqual({ events: { maxLen: CHUNK_EVENTS_MAX_LEN } });
    expect(chunksCall[1].defaultJobOptions).toEqual({
      removeOnComplete: CHUNK_REMOVE_ON_COMPLETE,
      removeOnFail: true,
    });
    expect(chunksCall[1].defaultJobOptions.removeOnComplete).not.toBe(true);
  });

  it('reads chunk returnvalue directly from waitUntilFinished without Job.fromId and removes the chunk', async () => {
    const expectedResult = [[{ id: 'person-1', score: 0.99 }]];
    const waitUntilFinished = vi.fn().mockResolvedValue(expectedResult);
    const remove = vi.fn().mockResolvedValue(undefined);
    bullMocks.chunkAdd.mockResolvedValue({
      id: 'parent-job-0',
      waitUntilFinished,
      remove,
    });

    const stream = new ProcessStream(
      {
        id: 'parent-job',
        data: { totalRows: 1, candidateNumber: 1, esIndex: 'deces-test' },
        opts: { priority: 1 },
      } as any,
      { Prenom: 'firstName' },
    );
    stream.inputHeaders = ['Prenom'];
    stream.batch = [{ source: { Prenom: 'Jean' }, sourceLineNumber: 1 }];

    await stream.processBatch();

    expect(waitUntilFinished).toHaveBeenCalledWith(bullMocks.chunkEventsInstance);
    expect(bullMocks.jobFromId).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(stream.jobs).toEqual([{ id: 'parent-job-0', result: expectedResult }]);
    expect(stream.batch).toEqual([]);
  });

  it('keeps the chunk result when job.remove() rejects after completion', async () => {
    const expectedResult = [[{ id: 'person-2', score: 0.95 }]];
    const logSpy = vi.spyOn(loggerStream, 'write').mockImplementation(() => true as any);
    bullMocks.chunkAdd.mockResolvedValue({
      id: 'parent-job-0',
      waitUntilFinished: vi.fn().mockResolvedValue(expectedResult),
      remove: vi.fn().mockRejectedValue(new Error('already removed')),
    });

    const stream = new ProcessStream(
      {
        id: 'parent-job',
        data: { totalRows: 1, candidateNumber: 1, esIndex: 'deces-test' },
        opts: { priority: 1 },
      } as any,
      { Prenom: 'firstName' },
    );
    stream.inputHeaders = ['Prenom'];
    stream.batch = [{ source: { Prenom: 'Marie' }, sourceLineNumber: 1 }];

    await stream.processBatch();

    expect(stream.jobs).toEqual([{ id: 'parent-job-0', result: expectedResult }]);
    expect(stream.batch).toEqual([]);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('removeChunkJobError'));
    logSpy.mockRestore();
  });

  it('propagates waitUntilFinished rejection without calling job.remove()', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    bullMocks.chunkAdd.mockResolvedValue({
      id: 'parent-job-0',
      waitUntilFinished: vi.fn().mockRejectedValue(new Error('chunk failed')),
      remove,
    });

    const stream = new ProcessStream(
      {
        id: 'parent-job',
        data: { totalRows: 1, candidateNumber: 1, esIndex: 'deces-test' },
        opts: { priority: 1 },
      } as any,
      { Prenom: 'firstName' },
    );
    stream.inputHeaders = ['Prenom'];
    stream.batch = [{ source: { Prenom: 'Paul' }, sourceLineNumber: 1 }];

    await expect(stream.processBatch()).rejects.toThrow('chunk failed');
    expect(remove).not.toHaveBeenCalled();
  });

  it('passes skipMetasUpdate: true in JobsController so read endpoints never reset opts.maxLenEvents', async () => {
    bullMocks.queueCalls.length = 0;
    bullMocks.getJobCounts.mockResolvedValue({ completed: 0 });
    bullMocks.getJobs.mockResolvedValue([]);

    const controller = new JobsController();
    await controller.jobName('chunks');
    await controller.getJobs(
      { user: { user: 'alice@example.org', scopes: ['user'] } } as unknown as express.Request,
      'jobs',
      undefined,
      'completed',
    );

    expect(bullMocks.queueCalls).toHaveLength(2);
    expect(bullMocks.queueCalls[0]).toEqual([
      'chunks',
      expect.objectContaining({ skipMetasUpdate: true }),
    ]);
    expect(bullMocks.queueCalls[1]).toEqual([
      'jobs',
      expect.objectContaining({ skipMetasUpdate: true }),
    ]);
  });
});
