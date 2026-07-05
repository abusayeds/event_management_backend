import type { Worker } from 'bullmq';
import config from '../config';
import logger from '../config/logger';
import { createEmailWorker } from './workers/email.worker';
import { createNotificationWorker } from './workers/notification.worker';
import { createRepeatEventWorker } from './workers/repeatEvent.worker';

let activeWorkers: Worker[] = [];
let workersStoppedForQuota = false;

const isQuotaExceededError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('max requests limit exceeded');
};

const stopWorkersAfterQuotaError = async (): Promise<void> => {
  if (workersStoppedForQuota) {
    return;
  }

  workersStoppedForQuota = true;
  logger.warn(
    'Upstash Redis command quota exceeded. BullMQ workers were stopped to prevent log spam. ' +
      'Upgrade your Upstash plan or set QUEUE_WORKERS_ENABLED=false until the quota resets.'
  );
  await shutdownWorkers();
};

export const initializeWorkers = (): Worker[] => {
  if (!config.queue.workersEnabled) {
    logger.warn('BullMQ workers disabled (QUEUE_WORKERS_ENABLED=false)');
    return [];
  }

  workersStoppedForQuota = false;
  activeWorkers = [
    createEmailWorker(),
    createNotificationWorker(),
    createRepeatEventWorker(),
  ];

  activeWorkers.forEach(worker => {
    worker.on('error', err => {
      if (isQuotaExceededError(err)) {
        void stopWorkersAfterQuotaError();
        return;
      }

      logger.error('Worker error:', err);
    });
  });

  return activeWorkers;
};

export const shutdownWorkers = async (): Promise<void> => {
  if (activeWorkers.length === 0) {
    return;
  }

  await Promise.all(activeWorkers.map(worker => worker.close()));
  activeWorkers = [];
};
