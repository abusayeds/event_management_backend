import colors from 'colors';
import RedisIO from 'ioredis';
import config from './index';

const redisUrl = process.env.REDIS_URL;

export const redisConnection = redisUrl
  ? new RedisIO(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableReadyCheck: false,
    })
  : new RedisIO({
      host: config.queue.redis.host,
      port: config.queue.redis.port,
      password: config.queue.redis.password,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableReadyCheck: false,
    });

// Use local Redis for cache and queue operations
export const redisClient = redisConnection;

export const connectRedis = async (): Promise<void> => {
  try {
    if (redisConnection.status === 'wait' || redisConnection.status === 'end') {
      await redisConnection.connect();
    }
    await redisConnection.ping();
  } catch (error) {
    console.error(colors.red(' Local Redis connection failed:'), error);
    throw error;
  }
};

// Graceful shutdown
export const closeRedis = async (): Promise<void> => {
  try {
    await redisConnection.quit();
    console.log(colors.green(' Redis connections closed'));
  } catch (error) {
    console.error(colors.red(' Error closing Redis:'), error);
  }
};
