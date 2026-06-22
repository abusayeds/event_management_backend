import { Queue } from 'bullmq';
import config from '../../config';
import { bullmqConnection } from '../../config/redis';

export interface NotificationJobPayload {
  notificationId: string;
}

const notificationQueue = new Queue<NotificationJobPayload>('notification', {
  connection: bullmqConnection,
  defaultJobOptions: {
    ...config.queue.defaultJobOptions,
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export default notificationQueue;
