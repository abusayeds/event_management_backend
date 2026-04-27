import colors from 'colors';
import { Worker } from 'bullmq';
import logger from '../../config/logger';
import { redisConnection } from '../../config/redis';
import { processRepeatEvent } from '../processors/repeatEvent.processor';

export const repeatEventWorker = new Worker('repeat-event', processRepeatEvent, {
  connection: redisConnection,
  concurrency: 1,
});

repeatEventWorker.on('completed', job => {
  logger.info(colors.green(`Repeat-event job ${job.id} completed successfully.`));
});

repeatEventWorker.on('failed', (job, err) => {
  logger.error(colors.red(`Failed to process repeat-event job ${job?.id}: ${err.message}`), err);
});
