import logger from '../config/logger';
import { emailWorker } from './workers/email.worker';
import { repeatEventWorker } from './workers/repeatEvent.worker';

const workers = [emailWorker, repeatEventWorker];
// Initialize workers
export const initializeWorkers = () => {
  workers.forEach(worker => {
    worker.on('error', err => {
      logger.error('Worker error:', err);
    });
  });
  return workers;
};

// Graceful shutdown
export const shutdownWorkers = async () => {
  await Promise.all(workers.map(w => w.close()));
};
