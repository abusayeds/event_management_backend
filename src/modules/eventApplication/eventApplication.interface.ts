import { PaginationOptions } from '../../interfaces';

/** Create payload for event apply only. */
export interface ICreateEventApplicationPayload {
  eventId: string;
  note?: string | null;
}

export interface IGetEventApplicationByUserQuery {
  search?: string;
  options: PaginationOptions;
}
