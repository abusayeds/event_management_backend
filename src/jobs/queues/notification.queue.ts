import { Queue } from 'bullmq';
import config from '../../config';
import { bullmqConnection, isRedisReady } from '../../config/redis';

export interface NotificationJobPayload {
  notificationId: string;
}

// Create queue only if Redis is enabled; otherwise use a no-op stub
const notificationQueue: Queue<NotificationJobPayload> | null = config.redis.enabled
  ? new Queue<NotificationJobPayload>('notification', {
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
  async add(
    name: string,
    data: NotificationJobPayload,
    opts?: Parameters<Queue<NotificationJobPayload>['add']>[2]
  ) {
    if (!notificationQueue || !isRedisReady()) {
      return null;
    }
    return notificationQueue.add(name, data, opts);
  },
};
