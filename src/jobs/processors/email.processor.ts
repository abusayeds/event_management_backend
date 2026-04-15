import { Job } from 'bullmq';
import sendEmail from '../../modules/email/email.sender';

export const processEmail = async (job: Job) => {
  const { to, subject, html, attachments } = job.data;
  await sendEmail({ to, subject, html, attachments });
  return true;
};
