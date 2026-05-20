import Redis, { RedisOptions } from 'ioredis';
import loggerStream from './logger';

/**
 * Shared Redis client for non-BullMQ usage (OTP store, rate-limit, etc.).
 *
 * BullMQ already manages its own ioredis connections via `new Queue/Worker(...,
 * { connection: { host: 'redis' } })` calls scattered through processStream.ts /
 * job.controller.ts. Those are kept untouched on purpose (P0 focus is OTP).
 *
 * This module owns a single lazy ioredis connection driven by the standard
 * REDIS_HOST / REDIS_PORT env vars that the K8s manifests already inject (see
 * deploy/k8s/base/deces-backend.deployment.yaml). Falls back to host "redis"
 * for the legacy docker-compose layout.
 */

const log = (json: any) => {
  loggerStream.write(JSON.stringify({
    backend: {
      'server-date': new Date(Date.now()).toISOString(),
      ...json,
    },
  }));
};

const buildOptions = (): RedisOptions => ({
  host: process.env.REDIS_HOST || 'redis',
  port: Number(process.env.REDIS_PORT) || 6379,
  // Keep retry strategy bounded so a Redis blip cannot wedge the event loop
  // forever; callers must handle thrown errors / null results gracefully.
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
  retryStrategy: (times: number) => Math.min(times * 200, 2000),
  lazyConnect: false,
});

let client: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!client) {
    client = new Redis(buildOptions());
    client.on('error', (err) => {
      log({ warn: 'Redis client error', details: err && err.message });
    });
  }
  return client;
};

/**
 * Test/teardown hook: swap the singleton out (used by ioredis-mock in specs).
 * Not exported through index.ts; only specs should reach for this.
 */
export const __setRedisClientForTests = (mock: Redis | null) => {
  client = mock;
};
