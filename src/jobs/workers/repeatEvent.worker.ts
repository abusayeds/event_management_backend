import { Worker } from 'bullmq';
import logger from '../../config/logger';
import { bullmqConnection } from '../../config/redis';
import { processRepeatEvent } from '../processors/repeatEvent.processor';

export const repeatEventWorker = new Worker('repeat-event', processRepeatEvent, {
  connection: bullmqConnection,
  concurrency: 1,
});

repeatEventWorker.on('completed', job => {
  logger.info(`Repeat-event job ${job.id} completed successfully.`);
});

repeatEventWorker.on('failed', (job, err) => {
  logger.error(`Failed to process repeat-event job ${job?.id}: ${err.message}`, { error: err });
});
