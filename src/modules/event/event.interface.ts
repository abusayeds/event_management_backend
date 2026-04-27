import { PaginationOptions } from '../../interfaces';
import {
  CompetitionLevel,
  EventType,
  GroupCriteria,
  RepeatFrequency,
  RoundCondition,
  SessionBucketType,
} from '../../../prisma/generated/enums';

export const EVENT_CONTRIBUTION_SCORE = {
  CREATE: 10,
  UPDATE: 5,
  VERIFY: 15,
  APPLY: 3,
} as const;

/** Filter list feeds by this event’s `EventSchedule` date/status window. */
export type EventScheduleListScope = 'today' | 'upcoming' | 'history';

/** Matches Prisma model `RepeatConfig` */
export interface IRepeatConfigInput {
  repeatFunction?: RepeatFrequency;
  startDate?: Date | string;
}

/** Matches Prisma model `EventRound` */
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

/** Matches Prisma `EventSchedule` (registration window + pricing only). */
export interface IEventScheduleInput {
  competitionLevel: CompetitionLevel;
  eventType: EventType;
  registrationDate: Date | string;
  deadline: Date | string;
  cost: string | number;
  hasFinalDeadline?: boolean;
  finalDeadline?: Date | string | null;
  lateFee?: string | number;
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
  isPublished?: boolean;
  repeatConfig?: IRepeatConfigInput | null;
  sessionId?: string;
  /** Prisma `Event` — only when creating/finding catalog session without `sessionId` (DontRepeat). */
  year?: string;
  session?: SessionBucketType | null;
  sessionValue?: string | null;
  sessionLevel?: string | null;
  isSharedToCommunity?: boolean;
  isUserAgreementAccepted?: boolean;
  groups?: IEventGroupInput[];
  schedule?: IEventScheduleInput;
}

export interface IUpdateCurrentSchedulePayload {
  competitionLevel?: CompetitionLevel;
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
  /** When true, sets this event’s `isVerified` to true (idempotent). */
  isVerified?: boolean;
  repeatConfig?: IRepeatConfigInput | null;
  sessionId?: string;
  year?: string;
  session?: SessionBucketType | null;
  sessionValue?: string | null;
  sessionLevel?: string | null;
  /** Partial `EventSchedule` patch (same fields as create `schedule`). */
  schedule?: IUpdateCurrentSchedulePayload;
  groups?: IEventGroupInput[];
}

export interface IEventFilters {
  search?: string;
  programId?: string;
  eventType?: EventType;
  location?: string;
  groupCriteria?: GroupCriteria;
  timeRangeFrom?: string;
  timeRangeTo?: string;
  sessionScope?: EventScheduleListScope;
  priceMin?: string;
  priceMax?: string;
}

export interface IFeedPriceFilters {
  priceMin?: string;
  priceMax?: string;
}

export interface IEventQuery {
  filters: IEventFilters;
  options: PaginationOptions;
}
