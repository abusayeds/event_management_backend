import colors from 'colors';
import RedisIO from 'ioredis';
import config from './index';
const localRedisHosts = new Set(['localhost', '127.0.0.1', '::1', 'redis']);
const redisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  db: config.redis.db || 0,
  ...(config.redis.password ? { password: config.redis.password } : {}),
  ...(config.redis.password && config.redis.username ? { username: config.redis.username } : {}),
  maxRetriesPerRequest: null as null,
  lazyConnect: true,
  enableReadyCheck: false,
};

if (localRedisHosts.has(config.redis.host)) {
  delete (redisOptions as { password?: string }).password;
  delete (redisOptions as { username?: string }).username;
}

export const redisConnection = new RedisIO(redisOptions);
export const redisClient = redisConnection;

export const connectRedis = async (): Promise<void> => {
  try {
    if (redisClient.status === 'wait' || redisClient.status === 'end') {
      await redisClient.connect();
    }
    await redisClient.ping();
  } catch (error) {
    console.error(colors.red(' Local Redis connection failed:'), error);
    throw error;
  }
};

// Graceful shutdown
export const closeRedis = async (): Promise<void> => {
  try {
    await redisClient.quit();
    console.log(colors.green(' Redis connections closed'));
  } catch (error) {
    console.error(colors.red(' Error closing Redis:'), error);
  }
};
