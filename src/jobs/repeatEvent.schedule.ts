import logger from '../config/logger';
import repeatEventQueue from './queues/repeatEvent.queue';

export async function enqueueRepeatEventJob(eventId: string, runAt: Date): Promise<void> {
  const delay = Math.max(0, runAt.getTime() - Date.now());
  await repeatEventQueue.add(
    'generate-next',
    { eventId },
    {
      delay,
      jobId: `repeat-event-${eventId}-${runAt.getTime()}`,
    }
  );
  logger.debug(
    `repeat-event job enqueued eventId=${eventId} runAt=${runAt.toISOString()} delayMs=${delay}`
  );
}
