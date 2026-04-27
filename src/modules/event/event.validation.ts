import { z } from 'zod';
import {
  CompetitionLevel,
  EventType,
  FamilyRelationShip,
  GroupCriteria,
  RepeatFrequency,
  RoundCondition,
  SessionBucketType,
} from '../../../prisma/generated/enums';

const nonNegativeNumber = z.coerce.number().finite().nonnegative();

/** Multipart: `body.data` JSON merge into body (optional). */
const mergeFormDataJson = (raw: unknown): unknown => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const b = raw as Record<string, unknown>;
  if (typeof b.data !== 'string' || !b.data.trim()) return raw;
  try {
    const parsed = JSON.parse(b.data) as Record<string, unknown>;
    return typeof parsed === 'object' && parsed !== null ? { ...b, ...parsed } : raw;
  } catch {
    return raw;
  }
};

/** Purono payload: catalog/group/flag `schedule` er vitore thakle root e tulbo (Prisma `Event` moto). */
const mergeAndHoistCreateBody = (raw: unknown): unknown => {
  const merged = mergeFormDataJson(raw);
  if (typeof merged !== 'object' || merged === null) return merged;
  const b = merged as Record<string, unknown>;
  const sch = b.schedule;
  if (!sch || typeof sch !== 'object' || Array.isArray(sch)) return merged;
  const s = { ...(sch as Record<string, unknown>) };
  const hoist = [
    'sessionId',
    'year',
    'session',
    'sessionValue',
    'sessionLevel',
    'groups',
    'isSharedToCommunity',
    'isUserAgreementAccepted',
  ] as const;
  for (const k of hoist) {
    if (b[k] === undefined && s[k] !== undefined) {
      b[k] = s[k];
      delete s[k];
    }
  }
  b.schedule = s;
  return b;
};

const eventIdParamsValidationSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
});

const repeatConfigValidationSchema = z
  .object({
    repeatFunction: z.nativeEnum(RepeatFrequency).optional(),
    startDate: z.coerce.date().optional().nullable(),
  })
  .optional()
  .nullable();

const eventRoundValidationSchema = z.object({
  roundType: z.nativeEnum(CompetitionLevel),
  deadline: z.coerce.date(),
  cost: nonNegativeNumber,
  hasFinalDeadline: z.boolean().optional(),
  finalDeadline: z.coerce.date().optional().nullable(),
  lateFee: nonNegativeNumber.optional(),
  description: z.string().max(2000).optional().nullable(),
});

const eventGroupValidationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  criteria: z.nativeEnum(GroupCriteria),
  condition: z.nativeEnum(RoundCondition),
  value: z.coerce.number().int(),
  rounds: z.array(eventRoundValidationSchema).optional(),
});

const eventScheduleValidationSchema = z.object({
  competitionLevel: z.nativeEnum(CompetitionLevel),
  eventType: z.nativeEnum(EventType),
  registrationDate: z.coerce.date(),
  deadline: z.coerce.date(),
  cost: nonNegativeNumber,
  hasFinalDeadline: z.boolean().optional(),
  finalDeadline: z.coerce.date().optional().nullable(),
  lateFee: nonNegativeNumber.optional(),
});

// ── POST /events (body) ─────────────────────────────────────────────────────

const createEventBodyValidationSchema = z.object({
  eventName: z.string().trim().min(1).max(200),
  coverImage: z.string().min(1).optional(),
  programId: z.string().min(1),
  organizer: z.string().trim().min(1).max(200),
  location: z.string().trim().max(300).optional().nullable(),
  eventPortal: z.string().min(1),
  registrationPortal: z.string().min(1),
  description: z.string().min(1),
  note: z.string().max(2000).optional().nullable(),
  isPublished: z.coerce.boolean().optional(),
  repeatConfig: repeatConfigValidationSchema,
  sessionId: z.string().min(1).optional(),
  year: z.string().trim().min(2).max(16).optional(),
  session: z.nativeEnum(SessionBucketType).optional(),
  sessionValue: z.string().trim().min(1).max(120).optional(),
  sessionLevel: z.string().trim().min(1).max(120).optional(),
  schedule: eventScheduleValidationSchema,
  groups: z.array(eventGroupValidationSchema).optional(),
  isSharedToCommunity: z.coerce.boolean().optional(),
  isUserAgreementAccepted: z.coerce.boolean().optional(),
});

const createEventValidationSchema = z.object({
  body: z.preprocess(mergeAndHoistCreateBody, createEventBodyValidationSchema),
});

// ── GET /events (query) ───────────────────────────────────────────────────

const getEventsValidationSchema = z.object({
  query: z
    .object({
      search: z.string().optional(),
      programId: z.string().optional(),
      eventType: z.nativeEnum(EventType).optional(),
      location: z.string().optional(),
      groupCriteria: z.nativeEnum(GroupCriteria).optional(),
      timeRangeFrom: z.coerce.date().optional(),
      timeRangeTo: z.coerce.date().optional(),
      sessionScope: z.enum(['today', 'upcoming', 'history']).optional(),
      priceMin: z.string().optional(),
      priceMax: z.string().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    })
    .refine(
      q =>
        !q.timeRangeFrom ||
        !q.timeRangeTo ||
        q.timeRangeFrom.getTime() <= q.timeRangeTo.getTime(),
      { message: 'timeRangeFrom must be before or equal to timeRangeTo.' }
    ),
});

const getEventsByFamilyRelationValidationSchema = z.object({
  query: z.object({
    relationShip: z.nativeEnum(FamilyRelationShip),
  }),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  priceMin: z.string().optional(),
  priceMax: z.string().optional(),
});

const getTodayEventsValidationSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    priceMin: z.string().optional(),
    priceMax: z.string().optional(),
  }),
});

const getUpcomingEventsValidationSchema = z.object({  
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});
const getHistoryEventsValidationSchema = z.object({
  query: z.object({
    relationShip: z.nativeEnum(FamilyRelationShip),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    priceMin: z.string().optional(),
    priceMax: z.string().optional(),
  }),
});

const getEventByIdValidationSchema = z.object({
  params: eventIdParamsValidationSchema,
});

// ── PATCH /events/:eventId (body) ─────────────────────────────────────────

const updateEventBodyValidationSchema = z.object({
  eventName: z.string().trim().optional(),
  coverImage: z.string().min(1).optional(),
  programId: z.string().min(1).optional(),
  organizer: z.string().trim().optional(),
  location: z.string().trim().max(300).optional().nullable(),
  eventPortal: z.string().min(1).optional(),
  registrationPortal: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  note: z.string().max(2000).optional().nullable(),
  isPublished: z.coerce.boolean().optional(),
  repeatConfig: repeatConfigValidationSchema.optional(),
  sessionId: z.string().min(1).optional(),
  year: z.string().trim().min(2).max(16).optional(),
  session: z.nativeEnum(SessionBucketType).optional(),
  sessionValue: z.string().trim().min(1).max(120).optional(),
  sessionLevel: z.string().trim().min(1).max(120).optional(),
  schedule: eventScheduleValidationSchema.optional(),
  groups: z.array(eventGroupValidationSchema).optional(),
  isSharedToCommunity: z.coerce.boolean().optional(),
  isUserAgreementAccepted: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  isVerified: z.coerce.boolean().optional(),
});

const updateEventValidationSchema = z.object({
  params: eventIdParamsValidationSchema,
  body: z.preprocess(mergeFormDataJson, updateEventBodyValidationSchema),
});

const deleteEventValidationSchema = z.object({
  params: eventIdParamsValidationSchema,
});

export const EventValidation = {
  createEventValidationSchema,
  getEventsValidationSchema,
  getTodayEventsValidationSchema,
  getUpcomingEventsValidationSchema,
  getHistoryEventsValidationSchema,
  getEventsByFamilyRelationValidationSchema,
  getEventByIdValidationSchema,
  updateEventValidationSchema,
  deleteEventValidationSchema,
};
