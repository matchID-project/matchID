import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusController } from './status.controller';
import { checkClientHealth, getClient, getSearchIndex } from '../elasticsearch';
import { checkRedisHealth } from '../redisClient';

vi.mock('../elasticsearch', () => ({
  checkClientHealth: vi.fn(),
  getClient: vi.fn(),
  getSearchIndex: vi.fn(),
}));

vi.mock('../redisClient', () => ({
  checkRedisHealth: vi.fn(),
}));

describe('status.controller.ts', () => {
  beforeEach(() => {
    vi.mocked(checkClientHealth).mockReset();
    vi.mocked(getClient).mockReset();
    vi.mocked(getSearchIndex).mockReset();
    vi.mocked(getSearchIndex).mockReturnValue('deces');
    vi.mocked(checkRedisHealth).mockReset();
  });

  it('/readiness returns OK when Elasticsearch and Redis are reachable', async () => {
    vi.mocked(checkClientHealth).mockResolvedValue(true);
    vi.mocked(checkRedisHealth).mockResolvedValue(true);

    const controller = new StatusController();
    const result = await (controller as any).readiness();

    expect(controller.getStatus()).toBe(200);
    expect(result).toEqual({
      msg: 'OK',
      dependencies: {
        elasticsearch: true,
        redis: true,
      },
    });
  });

  it('/readiness returns 503 when a runtime dependency is unavailable', async () => {
    vi.mocked(checkClientHealth).mockResolvedValue(false);
    vi.mocked(checkRedisHealth).mockResolvedValue(true);

    const controller = new StatusController();
    const result = await (controller as any).readiness();

    expect(controller.getStatus()).toBe(503);
    expect(result).toEqual({
      msg: 'Unavailable',
      dependencies: {
        elasticsearch: false,
        redis: true,
      },
    });
  });

  it('/version refreshes Elasticsearch metadata on each call', async () => {
    const count = vi
      .fn()
      .mockResolvedValueOnce({ count: 10 })
      .mockResolvedValueOnce({ count: 11 });
    const search = vi
      .fn()
      .mockResolvedValueOnce({
        hits: {
          hits: [
            {
              _source: {
                DATE_DECES: '20240531',
                SOURCE: 'deces-2024-m05.txt.gz',
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        hits: {
          hits: [
            {
              _source: {
                DATE_DECES: '20240630',
                SOURCE: 'deces-2024-m06.txt.gz',
              },
            },
          ],
        },
      });
    const cat = {
      indices: vi
        .fn()
        .mockResolvedValueOnce([{ 'creation.date.string': '2024-05-31T00:00:00.000Z' }])
        .mockResolvedValueOnce([{ 'creation.date.string': '2024-06-30T00:00:00.000Z' }]),
    };
    vi.mocked(getClient).mockReturnValue({ count, search, cat } as any);

    const controller = new StatusController();
    const first = await (controller as any).version();
    const second = await (controller as any).version();

    expect(first).toMatchObject({
      uniqRecordsCount: 10,
      lastRecordDate: '31/05/2024',
      lastDataset: 'deces-2024-m05.txt.gz',
      updateDate: '31/05/2024',
    });
    expect(second).toMatchObject({
      uniqRecordsCount: 11,
      lastRecordDate: '30/06/2024',
      lastDataset: 'deces-2024-m06.txt.gz',
      updateDate: '30/06/2024',
    });
    expect(count).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenCalledTimes(2);
    expect(cat.indices).toHaveBeenCalledTimes(2);
  });
});
