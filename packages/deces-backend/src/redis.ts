import Redis, { RedisOptions } from 'ioredis';
import loggerStream from './logger';

/**
 * Single source of truth for every Redis connection in the backend.
 *
 * One module resolves the connection target (REDIS_HOST / REDIS_PORT, injected by
 * the k8s manifests, falling back to the docker-compose host "redis"), so OTP
 * storage and BullMQ can never diverge on where Redis lives.
 *
 * - getRedis()             shared client for plain commands (OTP store, cache).
 *                          Bounded per-request retries so a single command fails
 *                          fast during an outage, but the connection auto-reconnects
 *                          so the backend self-heals after a Redis restart without
 *                          needing to be bounced.
 * - bullmqConnection       connection options for BullMQ Queues/Workers/QueueEvents.
 *                          maxRetriesPerRequest MUST be null for BullMQ blocking
 *                          consumers (Worker/QueueEvents); null also makes BullMQ
 *                          reconnect indefinitely across a Redis outage instead of
 *                          throwing MaxRetriesPerRequestError and wedging the worker.
 * - duplicateForBlocking() dedicated connection for blocking / pub-sub subscriber
 *                          use (e.g. future S3 transaction tracking) derived from the
 *                          same target, so it can never diverge from the rest.
 */

const log = (json: any) => {
  loggerStream.write(JSON.stringify({
    backend: {
      'server-date': new Date(Date.now()).toISOString(),
      ...json,
    },
  }));
};

const target = {
  host: process.env.REDIS_HOST || 'redis',
  port: Number(process.env.REDIS_PORT) || 6379,
};

// Exposed so startup can log the resolved target. The OTP-vs-BullMQ divergence
// bug (OTP read REDIS_HOST while BullMQ hardcoded 'redis') was invisible at
// runtime; logging the single resolved target at boot makes a misconfigured
// REDIS_HOST obvious in the deploy logs instead of surfacing as silent retries.
export const redisTarget: Readonly<{ host: string; port: number }> = Object.freeze({ ...target });

export const logRedisTarget = (): void => {
  log({ info: 'Redis target resolved', host: redisTarget.host, port: redisTarget.port });
};

// Plain-command client (OTP / cache): bounded retries so a request fails fast on
// outage, while ioredis auto-reconnects in the background so the backend recovers
// on its own when Redis comes back.
const sharedOptions: RedisOptions = {
  ...target,
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true,
  retryStrategy: (times: number) => Math.min(times * 200, 2000),
};

// BullMQ requires maxRetriesPerRequest: null on connections used by blocking
// consumers; null also keeps BullMQ reconnecting across a Redis restart instead
// of erroring out and stalling the worker (which previously forced a backend
// restart after every Redis outage).
export const bullmqConnection: RedisOptions = {
  ...target,
  maxRetriesPerRequest: null,
};

let client: Redis | null = null;

export const getRedis = (): Redis => {
  if (!client) {
    client = new Redis(sharedOptions);
    client.on('error', (err) => {
      log({ warn: 'Redis client error', details: err && err.message });
    });
  }
  return client;
};

/**
 * Dedicated connection for blocking commands or pub/sub subscribers (e.g. the
 * upcoming S3 transaction tracking). Built from the same target as everything
 * else so the single-source guarantee holds.
 */
export const duplicateForBlocking = (overrides: RedisOptions = {}): Redis =>
  new Redis({ ...bullmqConnection, ...overrides });

/**
 * Test/teardown hook: swap the shared client for an in-memory mock (ioredis-mock).
 * Not exported through index.ts; only specs should reach for this.
 */
export const __setRedisClientForTests = (mock: Redis | null) => {
  client = mock;
};
