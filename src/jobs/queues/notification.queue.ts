import { Job, Queue } from 'bullmq';
import { redisConnection } from '../../config/redis';
import config from '../../config';

// Notification job data interface
export interface NotificationJobData {
  userId: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: string[];
  priority?: 'low' | 'normal' | 'high';
  delay?: number;
}

// Create notification queue
const notificationQueue = new Queue('notification', {
  connection: redisConnection,
  defaultJobOptions: config.queue.defaultJobOptions,
});

// Add notification job to queue
export const addNotificationJob = async (data: NotificationJobData): Promise<Job> => {
  const job = await notificationQueue.add('send-notification', data, {
    priority: data.priority === 'high' ? 10 : data.priority === 'low' ? 1 : 5,
    delay: data.delay || 0,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });

  console.log(`Notification job added: ${job.id} for user ${data.userId}`);
  return job;
};

// Add bulk notification jobs
export const addBulkNotificationJobs = async (jobs: NotificationJobData[]): Promise<Job[]> => {
  const jobPromises = jobs.map(data => addNotificationJob(data));
  return Promise.all(jobPromises);
};

// Get queue status
export const getNotificationQueueStatus = async () => {
  const waiting = await notificationQueue.getWaiting();
  const active = await notificationQueue.getActive();
  const completed = await notificationQueue.getCompleted();
  const failed = await notificationQueue.getFailed();

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
  };
};

// Clear queue
export const clearNotificationQueue = async () => {
  await notificationQueue.drain();
  console.log('Notification queue cleared');
};

export { notificationQueue };
