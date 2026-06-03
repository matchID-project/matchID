import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusController } from './status.controller';
import { checkClientHealth } from '../elasticsearch';
import { checkRedisHealth } from '../redisClient';

vi.mock('../elasticsearch', () => ({
  checkClientHealth: vi.fn(),
}));

vi.mock('../redisClient', () => ({
  checkRedisHealth: vi.fn(),
}));

describe('status.controller.ts', () => {
  beforeEach(() => {
    vi.mocked(checkClientHealth).mockReset();
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
});
