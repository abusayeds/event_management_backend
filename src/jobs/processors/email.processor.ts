import { Job } from 'bullmq';
import sendEmail from '../../modules/email/email.sender';

export const processEmail = async (job: Job) => {
  const { to, subject, html } = job.data;
  await sendEmail({ to, subject, html });
  return true;
};
