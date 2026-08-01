import logger from '../config/logger';
import repeatEventQueue from './queues/repeatEvent.queue';

export async function enqueueRepeatEventJob(eventId: string, runAt: Date): Promise<void> {
  const delay = Math.max(0, runAt.getTime() - Date.now());
  const job = await repeatEventQueue.add(
    'generate-next',
    { eventId },
    {
      delay,
      jobId: `repeat-event-${eventId}-${runAt.getTime()}`,
    }
  );
  if (job) {
    logger.info(
      `repeat-event job enqueued jobId=${job.id} eventId=${eventId} runAt=${runAt.toISOString()} delayMs=${delay}`
    );
  } else {
    logger.warn(
      `repeat-event job skipped (Redis unavailable) eventId=${eventId} runAt=${runAt.toISOString()}`
    );
  }
}
