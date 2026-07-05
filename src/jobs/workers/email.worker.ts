import colors from 'colors';
import { Worker } from 'bullmq';
import { bullmqConnection } from '../../config/redis';
import logger from '../../config/logger';
import { processEmail } from '../processors/email.processor';

export const createEmailWorker = (): Worker => {
  const worker = new Worker('email', processEmail, {
    connection: bullmqConnection,
    concurrency: 5,
  });

  worker.on('completed', job => {
    logger.info(colors.green(`Email job ${job.id} completed successfully.`));
  });

  worker.on('failed', (job, err) => {
    logger.error(colors.red(`Failed to process email job ${err.message}:`), err);
  });

  return worker;
};
