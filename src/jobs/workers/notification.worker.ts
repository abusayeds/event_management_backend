import colors from 'colors';
import { Worker } from 'bullmq';
import { bullmqConnection } from '../../config/redis';
import logger from '../../config/logger';
import { processNotification } from '../processors/notification.processor';

export const notificationWorker = new Worker('notification', processNotification, {
  connection: bullmqConnection,
  concurrency: 10,
});

notificationWorker.on('completed', job => {
  logger.info(colors.green(`Notification job ${job.id} completed successfully.`));
});

notificationWorker.on('failed', (job, err) => {
  logger.error(colors.red(`Failed to process notification job ${job?.id}: ${err.message}`), err);
});
