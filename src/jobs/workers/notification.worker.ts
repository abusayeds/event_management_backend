import colors from 'colors';
import { Worker } from 'bullmq';
import { bullmqConnection } from '../../config/redis';
import logger from '../../config/logger';
import { processNotification } from '../processors/notification.processor';

export const createNotificationWorker = (): Worker => {
  const worker = new Worker('notification', processNotification, {
    connection: bullmqConnection,
    concurrency: 10,
  });

  worker.on('completed', job => {
    logger.info(colors.green(`Notification job ${job.id} completed successfully.`));
  });

  worker.on('failed', (job, err) => {
    logger.error(colors.red(`Failed to process notification job ${job?.id}: ${err.message}`), err);
  });

  return worker;
};
