import logger from '../config/logger';
import { redisClient } from '../config/redis';

interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  increment(key: string): Promise<number>;
  setTTL(key: string, ttlSeconds: number): Promise<void>;
  getTTL(key: string): Promise<number>;
}

class RedisCacheService implements CacheService {
  async get<T>(key: string): Promise<T | null> {
    if (!redisClient) {
      return null;
    }

    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value as string) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}`, { error });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!redisClient) {
      return;
    }

    try {
      const stringValue = JSON.stringify(value);
      if (ttlSeconds) {
        await redisClient.setex(key, ttlSeconds, stringValue);
      } else {
        await redisClient.set(key, stringValue);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}`, { error });
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    if (!redisClient) {
      return;
    }

    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}`, { error });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!redisClient) {
      return false;
    }

    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}`, { error });
      return false;
    }
  }

  async increment(key: string): Promise<number> {
    if (!redisClient) {
      return 0;
    }

    try {
      const result = await redisClient.incr(key);
      return result;
    } catch (error) {
      logger.error(`Cache increment error for key ${key}`, { error });
      throw error;
    }
  }

  async setTTL(key: string, ttlSeconds: number): Promise<void> {
    if (!redisClient) {
      return;
    }

    try {
      await redisClient.expire(key, ttlSeconds);
    } catch (error) {
      logger.error(`Cache setTTL error for key ${key}`, { error });
      throw error;
    }
  }

  async getTTL(key: string): Promise<number> {
    if (!redisClient) {
      return -1;
    }

    try {
      const ttl = await redisClient.ttl(key);
      return ttl;
    } catch (error) {
      logger.error(`Cache getTTL error for key ${key}`, { error });
      return -1;
    }
  }
}

export const cacheService = new RedisCacheService();
