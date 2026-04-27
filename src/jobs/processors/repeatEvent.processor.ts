import { Job } from 'bullmq';
import { generateNextRepeatedEvent } from '../../modules/event/repeatEventClone.service';

type RepeatEventJobData = {
  eventId: string;
};

export const processRepeatEvent = async (job: Job<RepeatEventJobData>) => {
  const { eventId } = job.data;
  await generateNextRepeatedEvent(eventId);
  return true;
};
