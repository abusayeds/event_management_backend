import { Queue, Worker } from 'bullmq';
import config from '../config';
import { redisConnection } from '../config/redis';
import { emailWorker } from './workers/email.worker';
import { notificationWorker } from './workers/notification.worker';
import { reportWorker } from './workers/report.worker';
// Queue registry
const queues = new Map<string, Queue>();
// Worker registry
const workers = new Map<string, Worker>();
// Initialize queues
export const initializeQueues = () => {
  // Email queue
  const emailQ = new Queue('email', {
    connection: redisConnection,
    defaultJobOptions: config.queue.defaultJobOptions,
  });
  queues.set('email', emailQ);

  // Notification queue
  const notificationQ = new Queue('notification', {
    connection: redisConnection,
    defaultJobOptions: config.queue.defaultJobOptions,
  });
  queues.set('notification', notificationQ);

  // Report queue
  const reportQ = new Queue('report', {
    connection: redisConnection,
    defaultJobOptions: config.queue.defaultJobOptions,
  });
  queues.set('report', reportQ);

  console.log('BullMQ queues initialized');
};

// Initialize workers
export const initializeWorkers = () => {
  // Email worker
  const emailW = new Worker('email', emailWorker, {
    connection: redisConnection,
    concurrency: 5,
  });
  workers.set('email', emailW);

  // Notification worker
  const notificationW = new Worker('notification', notificationWorker, {
    connection: redisConnection,
    concurrency: 10,
  });
  workers.set('notification', notificationW);

  // Report worker
  const reportW = new Worker('report', reportWorker, {
    connection: redisConnection,
    concurrency: 2,
  });
  workers.set('report', reportW);

  // Worker event listeners
  emailW.on('completed', (job) => {
    console.log(`Email job completed: ${job.id}`);
  });

  emailW.on('failed', (job, err) => {
    console.error(`Email job failed: ${job?.id}`, err);
  });

  notificationW.on('completed', (job) => {
    console.log(`Notification job completed: ${job?.id}`);
  });

  notificationW.on('failed', (job, err) => {
    console.error(`Notification job failed: ${job?.id}`, err);
  });

  reportW.on('completed', (job) => {
    console.log(`Report job completed: ${job?.id}`);
  });

  reportW.on('failed', (job, err) => {
    console.error(`Report job failed: ${job?.id}`, err);
  });

  console.log('BullMQ workers initialized');
};

// Graceful shutdown
export const closeQueues = async () => {
  const closePromises = Array.from(workers.values()).map(worker => worker.close());
  await Promise.all(closePromises);
  console.log('BullMQ workers closed');
};
