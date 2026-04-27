import { Queue } from 'bullmq';
import config from '../../config';
import { redisConnection } from '../../config/redis';

export interface NotificationJobPayload {
  notificationId: string;
}

const notificationQueue = new Queue<NotificationJobPayload>('notification', {
  connection: redisConnection,
  defaultJobOptions: {
    ...config.queue.defaultJobOptions,
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export default notificationQueue;
