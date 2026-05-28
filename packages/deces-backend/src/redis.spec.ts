import { describe, it, expect, beforeEach, vi } from 'vitest';

// Locks the single-source Redis invariants so a future refactor cannot silently
// reintroduce a hardcoded host or a BullMQ connection that wedges on a Redis
// restart.
describe('redis.ts — single-source connection module', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
  });

  it('bullmqConnection forces maxRetriesPerRequest=null (BullMQ blocking + reconnect across a Redis outage)', async () => {
    const { bullmqConnection } = await import('./redis');
    expect(bullmqConnection.maxRetriesPerRequest).toBeNull();
  });

  it('resolves host/port from env, with docker-compose "redis" fallback', async () => {
    const def = await import('./redis');
    expect(def.bullmqConnection.host).toBe('redis');
    expect(def.bullmqConnection.port).toBe(6379);

    vi.resetModules();
    process.env.REDIS_HOST = 'redis.svc.cluster.local';
    process.env.REDIS_PORT = '6380';
    const k8s = await import('./redis');
    expect(k8s.bullmqConnection.host).toBe('redis.svc.cluster.local');
    expect(k8s.bullmqConnection.port).toBe(6380);
  });

  it('getRedis returns a singleton (one shared client for OTP/cache)', async () => {
    const mod = await import('./redis');
    const fake = { on: () => undefined } as any;
    mod.__setRedisClientForTests(fake);
    expect(mod.getRedis()).toBe(fake);
    expect(mod.getRedis()).toBe(mod.getRedis());
    mod.__setRedisClientForTests(null);
  });

  it('redisTarget mirrors the resolved connection and is frozen', async () => {
    process.env.REDIS_HOST = 'redis.svc.cluster.local';
    process.env.REDIS_PORT = '6380';
    const mod = await import('./redis');
    expect(mod.redisTarget).toEqual({ host: 'redis.svc.cluster.local', port: 6380 });
    expect(mod.bullmqConnection.host).toBe(mod.redisTarget.host);
    expect(Object.isFrozen(mod.redisTarget)).toBe(true);
  });
});
