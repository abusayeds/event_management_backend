import type { ConnectionOptions } from 'bullmq';
import RedisIO from 'ioredis';
import config from './index';
import logger from './logger';

const localRedisHosts = new Set(['localhost', '127.0.0.1', '::1', 'redis']);

let redisReady = false;

const baseRedisOptions = {
  maxRetriesPerRequest: null as null,
  lazyConnect: true,
  enableReadyCheck: false,
};

const buildConnectionConfig = () => {
  if (config.redis.url) {
    return {
      ...baseRedisOptions,
      ...(config.redis.tls ? { tls: {} } : {}),
    };
  }

  const isLocalHost = localRedisHosts.has(config.redis.host);
  const useTls = config.redis.tls && !isLocalHost;

  return {
    ...baseRedisOptions,
    host: config.redis.host,
    port: config.redis.port,
    db: config.redis.db || 0,
    ...(useTls ? { tls: {} } : {}),
    ...(config.redis.password && !isLocalHost ? { password: config.redis.password } : {}),
    ...(config.redis.password && config.redis.username && !isLocalHost
      ? { username: config.redis.username }
      : {}),
  };
};

export const redisConnection = config.redis.enabled
  ? config.redis.url
    ? new RedisIO(config.redis.url, buildConnectionConfig())
    : new RedisIO(buildConnectionConfig())
  : null;

// BullMQ uses its own connection config so worker shutdown does not close the shared client.
export const bullmqConnection = buildConnectionConfig() as ConnectionOptions;

export const redisClient = redisConnection;

export const isRedisReady = (): boolean => redisReady;

const isQuotaExceededError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('max requests limit exceeded');
};

export const connectRedis = async (): Promise<boolean> => {
  if (!config.redis.enabled) {
    logger.warn('Redis is disabled (REDIS_ENABLED=false)');
    redisReady = false;
    return false;
  }

  if (!redisClient) {
    redisReady = false;
    return false;
  }

  try {
    if (redisClient.status === 'wait' || redisClient.status === 'end') {
      await redisClient.connect();
    }
    await redisClient.ping();
    redisReady = true;
    return true;
  } catch (error) {
    redisReady = false;

    if (isQuotaExceededError(error)) {
      logger.warn(
        'Upstash Redis command quota exceeded. API will start without cache and background workers.'
      );
      if (config.redis.required) {
        throw error;
      }
      return false;
    }

    logger.error('Redis connection failed', { error });

    if (config.redis.required) {
      throw error;
    }

    logger.warn(
      'Continuing without Redis. Background jobs and cache are unavailable until Redis is restored.'
    );
    return false;
  }
};

export const closeRedis = async (): Promise<void> => {
  if (!redisClient) {
    return;
  }

  try {
    await redisClient.quit();
    redisReady = false;
    logger.info('Redis connections closed');
  } catch (error) {
    logger.error('Error closing Redis', { error });
  }
};
