import { Job, Queue } from 'bullmq';
import { redisConnection } from '../../config/redis';
import config from '../../config';

export interface ReportJobData {
  reportType: 'sales' | 'users' | 'products' | 'orders' | 'analytics';
  format: 'pdf' | 'excel' | 'csv';
  filters?: Record<string, any>;
  userId: string;
  emailTo?: string;
  priority?: 'low' | 'normal' | 'high';
  delay?: number;
}

// Create report queue
const reportQueue = new Queue('report', {
  connection: redisConnection,
  defaultJobOptions: config.queue.defaultJobOptions,
});

// Add report job to queue
export const addReportJob = async (data: ReportJobData): Promise<Job> => {
  const job = await reportQueue.add('generate-report', data, {
    priority: data.priority === 'high' ? 10 : data.priority === 'low' ? 1 : 5,
    delay: data.delay || 0,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });

  console.log(`Report job added: ${job.id} for ${data.reportType} report`);
  return job;
};

// Get queue status
export const getReportQueueStatus = async () => {
  const waiting = await reportQueue.getWaiting();
  const active = await reportQueue.getActive();
  const completed = await reportQueue.getCompleted();
  const failed = await reportQueue.getFailed();

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
  };
};

// Clear queue
export const clearReportQueue = async () => {
  await reportQueue.drain();
  console.log('Report queue cleared');
};

export { reportQueue };
