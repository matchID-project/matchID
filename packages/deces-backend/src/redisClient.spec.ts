import { afterEach, describe, expect, it } from 'vitest';
import { buildRedisConnectionOptions } from './redisClient';

const originalRedisHost = process.env.REDIS_HOST;
const originalRedisPort = process.env.REDIS_PORT;

describe('buildRedisConnectionOptions', () => {
  afterEach(() => {
    process.env.REDIS_HOST = originalRedisHost;
    process.env.REDIS_PORT = originalRedisPort;
  });

  it('uses redis service defaults', () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;

    expect(buildRedisConnectionOptions()).toMatchObject({
      host: 'redis',
      port: 6379,
    });
  });

  it('uses REDIS_HOST and REDIS_PORT when set', () => {
    process.env.REDIS_HOST = 'prod-redis.internal';
    process.env.REDIS_PORT = '6380';

    expect(buildRedisConnectionOptions()).toMatchObject({
      host: 'prod-redis.internal',
      port: 6380,
    });
  });
});
