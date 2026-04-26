import { EventApplicationStatus } from '../../../prisma/generated/enums';

/** Create payload for event apply only. */
export interface ICreateEventApplicationPayload {
  eventId: string;
  note?: string | null;
}

/** Allowed PATCH fields on `EventApplied` (rules enforced in service for non-admins). */
export interface IUpdateEventApplicationPayload {
  status?: EventApplicationStatus;
  note?: string | null;
}

/** Query filters for listing event applications. */
export interface IEventApplicationFilters {
  userId?: string;
  eventId?: string;
  status?: EventApplicationStatus;
}
