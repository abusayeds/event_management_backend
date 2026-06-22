import { Queue } from 'bullmq';
import config from '../../config';
import { bullmqConnection } from '../../config/redis';

const emailQueue = new Queue('email', {
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
});

export default emailQueue;
