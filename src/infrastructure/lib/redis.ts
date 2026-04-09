// src/infrastructure/lib/redis.ts

import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

const createRedisClient = () =>
  new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

// Separate clients for pub/sub vs commands
export const redisPublisher = createRedisClient();
export const redisSubscriber = createRedisClient();
export const redisCache = createRedisClient();

// Cache helpers
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const val = await redisCache.get(key);
    if (!val) return null;
    return JSON.parse(val) as T;
  },

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    await redisCache.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  },

  async del(key: string): Promise<void> {
    await redisCache.del(key);
  },

  async invalidateRoom(roomId: string): Promise<void> {
    const keys = await redisCache.keys(`room:${roomId}:*`);
    if (keys.length > 0) await redisCache.del(...keys);
  },
};

export default redisCache;
