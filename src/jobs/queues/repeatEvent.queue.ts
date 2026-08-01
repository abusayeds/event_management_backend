import { Queue } from 'bullmq';
import config from '../../config';
import { bullmqConnection, isRedisReady } from '../../config/redis';

// Create queue only if Redis is enabled; otherwise use a no-op stub
const repeatEventQueue: Queue | null = config.redis.enabled
  ? new Queue('repeat-event', {
      connection: bullmqConnection,
      defaultJobOptions: {
        ...config.queue.defaultJobOptions,
        removeOnComplete: true,
        removeOnFail: false,
      },
    })
  : null;

// Safe wrapper: no-op when Redis is unavailable
export default {
  async add(name: string, data: Record<string, unknown>, opts?: Parameters<Queue['add']>[2]) {
    if (!repeatEventQueue || !isRedisReady()) {
      return null;
    }
    return repeatEventQueue.add(name, data, opts);
  },
};
