import { UserAppliedStatus } from '../../../prisma/generated/enums';

/** Create payload for event apply only. */
export interface ICreateEventApplicationPayload {
  eventId: string;
  note?: string | null;
}

/** Allowed PATCH fields on `UserApplied` (rules enforced in service for non-admins). */
export interface IUpdateEventApplicationPayload {
  status?: UserAppliedStatus;
  note?: string | null;
}

/** Query filters for listing event applications. */
export interface IEventApplicationFilters {
  userId?: string;
  eventId?: string;
  status?: UserAppliedStatus;
}
