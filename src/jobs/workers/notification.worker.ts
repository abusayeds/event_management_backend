import { Job } from 'bullmq';
import { NotificationJobData } from '../queues/notification.queue';
import { sendNotificationProcessor } from '../processors/notification.processor';

export const notificationWorker = async (job: Job<NotificationJobData>) => {
  const { data } = job;
  try {
    console.log(`Processing notification job ${job.id}: ${data.title}`); 
    await sendNotificationProcessor(data);
    
    console.log(`Notification job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`Notification job ${job.id} failed:`, error);
    throw error;
  }
};
