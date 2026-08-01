import { Queue } from 'bullmq';
import config from '../../config';
import { bullmqConnection, isRedisReady } from '../../config/redis';

// Create queue only if Redis is enabled; otherwise use a no-op stub
const emailQueue: Queue | null = config.redis.enabled
  ? new Queue('email', {
      connection: bullmqConnection,
      defaultJobOptions: {
        ...config.queue.defaultJobOptions,
        // ✅ Retry configuration for reliability
        attempts: 3,
        backoff: {
          type: 'exponential' as const,
          delay: 2000, // Start with 2 seconds
        },
        removeOnComplete: true,
        removeOnFail: false, // Keep failed jobs for debugging
      },
    })
  : null;

// Safe wrapper: no-op when Redis is unavailable
export default {
  async add(name: string, data: Record<string, unknown>, opts?: Parameters<Queue['add']>[2]) {
    if (!emailQueue || !isRedisReady()) {
      return null;
    }
    return emailQueue.add(name, data, opts);
  },
};
