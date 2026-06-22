import { Queue } from 'bullmq';
import config from '../../config';
import { bullmqConnection } from '../../config/redis';

const repeatEventQueue = new Queue('repeat-event', {
  connection: bullmqConnection,
  defaultJobOptions: {
    ...config.queue.defaultJobOptions,
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export default repeatEventQueue;
