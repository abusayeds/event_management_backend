import logger from '../config/logger';
import { emailWorker } from './workers/email.worker';

const workers = [emailWorker];
// Initialize workers
export const initializeWorkers = () => {
  logger.info('Initializing BullMQ workers...');
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
  logger.info('BullMQ workers closed');
};
