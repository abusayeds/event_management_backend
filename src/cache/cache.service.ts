import logger from '../config/logger';
import { isRedisReady, redisClient } from '../config/redis';

interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  increment(key: string): Promise<number>;
  setTTL(key: string, ttlSeconds: number): Promise<void>;
  getTTL(key: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// In-memory fallback cache (used when Redis is disabled/unavailable)
// Supports TTL via expiry timestamps. Entries are lazily evicted on access.
// NOTE: Not suitable for multi-process / production deployments.
// ---------------------------------------------------------------------------
interface MemEntry {
  value: string;
  expiresAt: number | null; // ms epoch, null = no expiry
}

class MemoryCacheService implements CacheService {
  private store = new Map<string, MemEntry>();

  private isExpired(entry: MemEntry): boolean {
    return entry.expiresAt !== null && Date.now() > entry.expiresAt;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value: JSON.stringify(value),
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async increment(key: string): Promise<number> {
    const entry = this.store.get(key);
    let current = 0;
    let expiresAt: number | null = null;

    if (entry && !this.isExpired(entry)) {
      current = parseInt(entry.value, 10) || 0;
      expiresAt = entry.expiresAt;
    }

    const next = current + 1;
    this.store.set(key, { value: String(next), expiresAt });
    return next;
  }

  async setTTL(key: string, ttlSeconds: number): Promise<void> {
    const entry = this.store.get(key);
    if (entry && !this.isExpired(entry)) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
    }
  }

  async getTTL(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) return -2; // key doesn't exist
    if (entry.expiresAt === null) return -1; // no expiry
    return Math.max(0, Math.round((entry.expiresAt - Date.now()) / 1000));
  }
}

// ---------------------------------------------------------------------------
// Redis-backed cache service (production)
// Falls back to in-memory automatically when Redis is not ready.
// ---------------------------------------------------------------------------
const memoryCacheService = new MemoryCacheService();

class RedisCacheService implements CacheService {
  private useMemory(): boolean {
    return !redisClient || !isRedisReady();
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.useMemory()) {
      return memoryCacheService.get<T>(key);
    }

    try {
      const value = await redisClient!.get(key);
      return value ? JSON.parse(value as string) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}`, { error });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (this.useMemory()) {
      return memoryCacheService.set(key, value, ttlSeconds);
    }

    try {
      const stringValue = JSON.stringify(value);
      if (ttlSeconds) {
        await redisClient!.setex(key, ttlSeconds, stringValue);
      } else {
        await redisClient!.set(key, stringValue);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}`, { error });
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    if (this.useMemory()) {
      return memoryCacheService.del(key);
    }

    try {
      await redisClient!.del(key);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}`, { error });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (this.useMemory()) {
      return memoryCacheService.exists(key);
    }

    try {
      const result = await redisClient!.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}`, { error });
      return false;
    }
  }

  async increment(key: string): Promise<number> {
    if (this.useMemory()) {
      return memoryCacheService.increment(key);
    }

    try {
      const result = await redisClient!.incr(key);
      return result;
    } catch (error) {
      logger.error(`Cache increment error for key ${key}`, { error });
      throw error;
    }
  }

  async setTTL(key: string, ttlSeconds: number): Promise<void> {
    if (this.useMemory()) {
      return memoryCacheService.setTTL(key, ttlSeconds);
    }

    try {
      await redisClient!.expire(key, ttlSeconds);
    } catch (error) {
      logger.error(`Cache setTTL error for key ${key}`, { error });
      throw error;
    }
  }

  async getTTL(key: string): Promise<number> {
    if (this.useMemory()) {
      return memoryCacheService.getTTL(key);
    }

    try {
      const ttl = await redisClient!.ttl(key);
      return ttl;
    } catch (error) {
      logger.error(`Cache getTTL error for key ${key}`, { error });
      return -1;
    }
  }
}

export const cacheService = new RedisCacheService();
