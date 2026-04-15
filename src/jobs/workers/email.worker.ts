import { Worker } from 'bullmq';
import { redisConnection } from '../../config/redis';
import logger from '../../config/logger';
import colors from 'colors';
import { processEmail } from '../processors/email.processor';

export const emailWorker = new Worker('email', processEmail, {
  connection: redisConnection,
  concurrency: 5,
});

emailWorker.on('completed', job => {
  logger.info(colors.green(`Email job ${job.id} completed successfully.`));
});

emailWorker.on('failed', (job, err) => {
  logger.error(colors.red(`Failed to process email job ${err.message}:`), err);
});
