import { Job, Queue } from 'bullmq';
import { redisConnection } from '../../config/redis';
import config from '../../config';

// Email job data interface
export interface EmailJobData {
  to: string | string[];
  subject: string;
  template: string;
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
  delay?: number;
}
// Create email queue
const emailQueue = new Queue('email', {
  connection: redisConnection,
  defaultJobOptions: config.queue.defaultJobOptions,
});
// Add email job to queue
export const addEmailJob = async (data: EmailJobData): Promise<Job> => {
  const job = await emailQueue.add('send-email', data, {
    priority: data.priority === 'high' ? 10 : data.priority === 'low' ? 1 : 5,
    delay: data.delay || 0,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });

  console.log(`Email job added: ${job.id} for ${data.to}`);
  return job;
};
// Add bulk email jobs
export const addBulkEmailJobs = async (jobs: EmailJobData[]): Promise<Job[]> => {
  const jobPromises = jobs.map(data => addEmailJob(data));
  return Promise.all(jobPromises);
};

// Get queue status
export const getEmailQueueStatus = async () => {
  const waiting = await emailQueue.getWaiting();
  const active = await emailQueue.getActive();
  const completed = await emailQueue.getCompleted();
  const failed = await emailQueue.getFailed();
  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
  };
};

// Clear queue
export const clearEmailQueue = async () => {
  await emailQueue.drain();
  console.log('Email queue cleared');
};

export { emailQueue };
