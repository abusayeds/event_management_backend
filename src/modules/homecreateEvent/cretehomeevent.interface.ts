/**
 * Repeat options for a home calendar event.
 * Values must match the `HomeEventRepeat` enum in `prisma/schema/homeEvent.prisma`.
 * Once `prisma generate` is run after the migration, this can be replaced with:
 *   import { HomeEventRepeat } from '../../../prisma/generated/enums';
 */
export enum HomeEventRepeat {
  Never = 'Never',
  Daily = 'Daily',
  Weekly = 'Weekly',
  Monthly = 'Monthly',
  Yearly = 'Yearly',
}

/** Shape returned to API consumers. */
export interface IHomeEvent {
  id: string;
  title: string;
  location: string;
  member: string;
  startsAt: Date;
  endsAt: Date;
  repeatFunction: HomeEventRepeat;
  url?: string | null;
  note?: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Payload coming from the client (dates as ISO strings over HTTP). */
export interface ICreateHomeEventPayload {
  title: string;
  location: string;
  member: string;
  startsAt: string;
  endsAt: string;
  repeatFunction?: HomeEventRepeat;
  url?: string;
  note?: string;
}

/** Payload for partial updates. */
export interface IUpdateHomeEventPayload {
  title?: string;
  location?: string;
  member: string;
  startsAt?: string;
  endsAt?: string;
  repeatFunction?: HomeEventRepeat;
  url?: string;
  note?: string;
}
