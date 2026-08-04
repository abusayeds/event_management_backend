import { PaginationOptions } from '../../interfaces';
import {
  CompetitionLevel,
  EventCreationMode,
  EventType,
  GroupCriteria,
  RepeatFrequency,
  RoundCondition,
  SessionBucketType,
} from '../../../prisma/generated/enums';
import type { ScheduleCompetitionLevel } from './event.constants';

export const EVENT_CONTRIBUTION_SCORE = {
  CREATE: 3,
  UPDATE: 1,
  VERIFY: 15,
  APPLY: 3,
} as const;
export type EventScheduleListScope = 'today' | 'upcoming' | 'history';

export interface IRepeatConfigInput {
  repeatFunction?: RepeatFrequency;
  startDate?: Date | string;
}

export interface IEventRoundInput {
  roundType: CompetitionLevel;
  deadline: Date | string;
  cost: string | number;
  hasFinalDeadline?: boolean;
  finalDeadline?: Date | string | null;
  lateFee?: string | number;
  description?: string | null;
}

export interface IEventGroupInput {
  name: string;
  criteria: GroupCriteria;
  condition: RoundCondition;
  value: number;
  rounds?: IEventRoundInput[];
}

export interface IEventScheduleInput {
  competitionLevel: ScheduleCompetitionLevel;
  eventType: EventType;
  registrationDate: Date | string;
  deadline: Date | string;
  cost: string | number;
  hasFinalDeadline?: boolean;
  finalDeadline?: Date | string | null;
  lateFee?: string | number;
}

export interface IEventPreviousRecordInput {
  /** Previous event id — required and must exist */
  id: string;
  /** What the user achieved in that previous event (e.g. "1 Prize", "Gold") */
  recordName: string;
}

export interface ICreateEventPayload {
  eventName: string;
  coverImage?: string;
  programId: string;
  organizer: string;
  location?: string | null;
  eventPortal: string;
  registrationPortal: string;
  description: string;
  note?: string | null;
  creationMode?: EventCreationMode;
  sourceEventId?: string | null;
  isPublished?: boolean;
  repeatConfig?: IRepeatConfigInput | null;
  sessionId?: string;
  year?: string;
  session?: SessionBucketType | null;
  sessionValue?: string | null;
  sessionLevel?: string | null;
  isSharedToCommunity?: boolean;
  isUserAgreementAccepted?: boolean;
  groups?: IEventGroupInput[];
  schedule?: IEventScheduleInput;
  /** Previous events the user participated in, with achievement record name */
  previousEvents?: IEventPreviousRecordInput[];
}

export interface IUpdateCurrentSchedulePayload {
  competitionLevel?: ScheduleCompetitionLevel;
  eventType?: EventType;
  registrationDate?: Date | string;
  deadline?: Date | string;
  cost?: string | number;
  hasFinalDeadline?: boolean;
  finalDeadline?: Date | string | null;
  lateFee?: string | number;
}

export interface IUpdateEventPayload {
  eventName?: string;
  coverImage?: string;
  programId?: string;
  organizer?: string;
  location?: string | null;
  eventPortal?: string;
  registrationPortal?: string;
  description?: string;
  note?: string | null;
  isPublished?: boolean;
  isActive?: boolean;
  isSharedToCommunity?: boolean;
  isUserAgreementAccepted?: boolean;
  isVerified?: boolean;
  repeatConfig?: IRepeatConfigInput | null;
  sessionId?: string;
  year?: string;
  session?: SessionBucketType | null;
  sessionValue?: string | null;
  sessionLevel?: string | null;
  schedule?: IUpdateCurrentSchedulePayload;
  groups?: IEventGroupInput[];
  /** Replace previous-event records when provided (full list). Empty array clears. */
  previousEvents?: IEventPreviousRecordInput[];
}

export interface IEventFilters {
  eventName?: string;
  filterType?: EventScheduleListScope;
}

/** Home feed + global search: single program/location/type plus price, category, text. */
export interface IFeedListFilters {
  searchTerm?: string;
  programId?: string;
  type?: EventType;
  location?: string;
  categoryGroup?: string;
  priceMin?: string;
  priceMax?: string;
}
export const FEED_LIST_QUERY_KEYS = [
  'priceMin',
  'priceMax',
  'searchTerm',
  'programId',
  'type',
  'location',
  'categoryGroup',
] as const;

/** Admin: paginated edit-log or application lists for one event (`GET` query). */
export interface IEventAdminListFilters {
  searchTerm?: string;
  date?: string;
}

export const EVENT_ADMIN_LIST_QUERY_KEYS = ['searchTerm', 'date'] as const;

export interface IEventQuery {
  filters: IEventFilters;
  options: PaginationOptions;
}
