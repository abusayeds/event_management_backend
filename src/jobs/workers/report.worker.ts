import { Job } from 'bullmq';
import { ReportJobData } from '../queues/report.queue';
import { generateReportProcessor } from '../processors/report.processor';

export const reportWorker = async (job: Job<ReportJobData>) => {
  const { data } = job;
  
  try {
    console.log(`Processing report job ${job.id}: ${data.reportType} report`);
    
    const result = await generateReportProcessor(data);
    
    console.log(`Report job ${job.id} completed successfully`);
    return result;
  } catch (error) {
    console.error(`Report job ${job.id} failed:`, error);
    throw error;
  }
};
