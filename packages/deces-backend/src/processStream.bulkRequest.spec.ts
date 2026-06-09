import { describe, expect, it, vi } from 'vitest';

vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({
    add: vi.fn(),
    getJobs: vi.fn(),
    getJob: vi.fn(),
  })),
  QueueEvents: vi.fn(),
  Worker: vi.fn(() => ({
    on: vi.fn(),
  })),
  Job: {
    fromId: vi.fn(),
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

import { buildBulkSearchRequest, buildJobInput } from './processStream';

describe('processStream.ts - bulk request builder', () => {
  it('builds bulk searches against the concrete index captured by the job', () => {
    const request = buildBulkSearchRequest(
      [{firstName: 'jean', lastName: 'pierre'}],
      {
        dateFormatA: 'dd/MM/yyyy',
        esIndex: 'deces-esdata_202606',
      }
    );

    expect(request.searches[0]).toEqual({index: 'deces-esdata_202606'});
  });

  it('rebuilds the job input from persisted BullMQ job data', () => {
    const input = buildJobInput({
      id: 'job-123',
      data: {
        inputFile: '/data/jobs/job-123.in.enc',
        totalRows: 42,
      },
      opts: {
        priority: 7,
      },
    } as any);

    expect(input).toEqual({
      id: 'job-123',
      file: '/data/jobs/job-123.in.enc',
      size: 42,
      priority: 7,
    });
  });
});
