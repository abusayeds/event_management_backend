import RedisIO from 'ioredis';
import config from './index';
import logger from './logger';

const localRedisHosts = new Set(['localhost', '127.0.0.1', '::1', 'redis']);

const baseRedisOptions = {
  maxRetriesPerRequest: null as null,
  lazyConnect: true,
  enableReadyCheck: false,
};

const buildRedisOptions = () => {
  if (config.redis.url) {
    return {
      ...baseRedisOptions,
      ...(config.redis.tls ? { tls: {} } : {}),
    };
  }

  const isLocalHost = localRedisHosts.has(config.redis.host);
  const useTls = config.redis.tls && !isLocalHost;

  const redisOptions = {
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

  return redisOptions;
};

export const redisConnection = config.redis.url
  ? new RedisIO(config.redis.url, buildRedisOptions())
  : new RedisIO(buildRedisOptions());
export const redisClient = redisConnection;

export const connectRedis = async (): Promise<void> => {
  try {
    if (redisClient.status === 'wait' || redisClient.status === 'end') {
      await redisClient.connect();
    }
    await redisClient.ping();
  } catch (error) {
    logger.error('Redis connection failed', { error });
    throw error;
  }
};

// Graceful shutdown
export const closeRedis = async (): Promise<void> => {
  try {
    await redisClient.quit();
    logger.info('Redis connections closed');
  } catch (error) {
    logger.error('Error closing Redis', { error });
  }
};
