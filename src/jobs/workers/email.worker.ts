import { Job } from 'bullmq';
import { EmailJobData } from '../queues/email.queue';
import { sendEmailProcessor } from '../processors/email.processor';

export const emailWorker = async (job: Job<EmailJobData>) => {
  const { data } = job;  
  try {
    console.log(`Processing email job ${job.id}: ${data.subject}`);
    
    await sendEmailProcessor(data);
    
    console.log(`Email job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`Email job ${job.id} failed:`, error);
    throw error;
  }
};
