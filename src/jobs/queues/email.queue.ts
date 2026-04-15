import { Queue } from 'bullmq';
import config from '../../config';
import { redisConnection } from '../../config/redis';

const emailQueue = new Queue('email', {
  connection: redisConnection,
  defaultJobOptions: config.queue.defaultJobOptions,
});

export default emailQueue;
