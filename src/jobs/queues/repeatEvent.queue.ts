import { Queue } from 'bullmq';
import config from '../../config';
import { redisConnection } from '../../config/redis';

const repeatEventQueue = new Queue('repeat-event', {
  connection: redisConnection,
  defaultJobOptions: {
    ...config.queue.defaultJobOptions,
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export default repeatEventQueue;
