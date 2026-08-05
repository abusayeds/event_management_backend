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
import { SCHEDULE_COMPETITION_LEVELS } from './event.constants';
import { normalizeCategoryGroupSlug } from './event.helpers';

const nonNegativeNumber = z.coerce.number().finite().nonnegative();

const tryParseJsonString = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
};

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
const parseKnownJsonFields = (input: Record<string, unknown>): Record<string, unknown> => {
  const out = { ...input };
  out.repeatConfig = tryParseJsonString(out.repeatConfig);
  out.schedule = tryParseJsonString(out.schedule);
  out.groups = tryParseJsonString(out.groups);
  out.previousEvents = tryParseJsonString(out.previousEvents);
  out.currentEventSession = tryParseJsonString(out.currentEventSession);
  return out;
};

const mergeAndHoistCreateBody = (raw: unknown): unknown => {
  const merged = mergeFormDataJson(raw);
  if (typeof merged !== 'object' || merged === null) return merged;
  const b = parseKnownJsonFields(merged as Record<string, unknown>);
  const sch = b.schedule;
  if (!sch || typeof sch !== 'object' || Array.isArray(sch)) return b;
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

const mergeAndHoistUpdateBody = (raw: unknown): unknown => {
  const merged = mergeFormDataJson(raw);
  if (typeof merged !== 'object' || merged === null) return merged;
  const b = parseKnownJsonFields(merged as Record<string, unknown>);
  const legacy = b.currentEventSession;
  if (legacy !== undefined) {
    const cur =
      typeof b.schedule === 'object' && b.schedule !== null && !Array.isArray(b.schedule)
        ? { ...(b.schedule as Record<string, unknown>) }
        : {};
    const leg =
      typeof legacy === 'object' && legacy !== null && !Array.isArray(legacy)
        ? (legacy as Record<string, unknown>)
        : {};
    b.schedule = { ...cur, ...leg };
  }
  const sch = b.schedule;
  if (sch && typeof sch === 'object' && !Array.isArray(sch)) {
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
  }
  return b;
};

const eventIdParamsValidationSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
});

const editLogParamsValidationSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  editLogId: z.string().min(1, 'editLogId is required'),
});

const repeatConfigValidationSchema = z
  .object({
    repeatFunction: z.nativeEnum(RepeatFrequency).optional(),
    startDate: z.coerce.date().optional().nullable(),
  })
  .optional()
  .nullable();

const scheduleCompetitionLevelSchema = z.enum(SCHEDULE_COMPETITION_LEVELS, {
  message: `competitionLevel must be one of: ${SCHEDULE_COMPETITION_LEVELS.join(', ')}`,
});

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
  competitionLevel: scheduleCompetitionLevelSchema,
  eventType: z.nativeEnum(EventType),
  registrationDate: z.coerce.date(),
  deadline: z.coerce.date(),
  cost: nonNegativeNumber,
  hasFinalDeadline: z.boolean().optional(),
  finalDeadline: z.coerce.date().optional().nullable(),
  lateFee: nonNegativeNumber.optional(),
});

// ── POST /events (body) ─────────────────────────────────────────────────────

const eventPreviousRecordValidationSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Previous event id is required')
    .uuid('Previous event id must be a valid UUID'),
  recordName: z
    .string()
    .trim()
    .min(1, 'recordName is required')
    .max(200, 'recordName must be at most 200 characters'),
});

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
  previousEvents: z
    .array(eventPreviousRecordValidationSchema)
    .max(50, 'Maximum 50 previous events allowed')
    .optional()
    .superRefine((items, ctx) => {
      if (!items?.length) return;
      const seen = new Set<string>();
      items.forEach((item, index) => {
        if (seen.has(item.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate previous event id at index ${index}`,
            path: [index, 'id'],
          });
        }
        seen.add(item.id);
      });
    }),
});

const createEventValidationSchema = z.object({
  body: z.preprocess(mergeAndHoistCreateBody, createEventBodyValidationSchema),
});

// ── GET /events (query) ───────────────────────────────────────────────────

const getEventsValidationSchema = z.object({
  query: z.object({
    eventName: z.string().optional(),
    filterType: z.enum(['today', 'upcoming', 'history']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

const feedListQueryFields = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  priceMin: z.string().optional(),
  priceMax: z.string().optional(),
  searchTerm: z.string().trim().max(200).optional(),
  programId: z.string().trim().min(1).max(64).optional(),
  type: z.nativeEnum(EventType).optional(),
  location: z.string().trim().max(300).optional(),
  categoryGroup: z
    .string()
    .trim()
    .max(40)
    .optional()
    .refine(
      val => val === undefined || val === '' || normalizeCategoryGroupSlug(val) !== null,
      'Invalid categoryGroup. Expected: 6year-10year, 11year-16year, or 17year+ (aliases like 6-10, 17+ accepted).'
    ),
} as const;

/** Shared query validation for feed list endpoints (today / upcoming / history). */
const feedListEventsQueryValidationSchema = z.object({
  query: z.object(feedListQueryFields),
});

const getTodayEventsValidationSchema = feedListEventsQueryValidationSchema;
const getUpcomingEventsValidationSchema = feedListEventsQueryValidationSchema;
const getHistoryEventsValidationSchema = feedListEventsQueryValidationSchema;

const searchHomeScreenEventsValidationSchema = z.object({
  query: z.object({
    ...feedListQueryFields,
    searchTerm: z.string().trim().min(1).max(200),
  }),
});

const getEventsByFamilyRelationValidationSchema = z.object({
  query: z.object({
    relationShip: z.nativeEnum(FamilyRelationShip),
    ...feedListQueryFields,
  }),
});

const getEventByIdValidationSchema = z.object({
  params: eventIdParamsValidationSchema,
});
const getEventEditLogByIdValidationSchema = z.object({
  params: editLogParamsValidationSchema,
});

const eventHistoryListQueryValidationSchema = z.object({
  searchTerm: z.string().optional(),
  date: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const getEventEditLogsByEventIdValidationSchema = z.object({
  params: eventIdParamsValidationSchema,
  query: eventHistoryListQueryValidationSchema,
});

const getAppliedEventsByEventIdValidationSchema = z.object({
  params: eventIdParamsValidationSchema,
  query: eventHistoryListQueryValidationSchema,
});

// ── PATCH /events/:eventId (body) — same sections as create, fields optional / partial where needed ─

const eventSchedulePatchValidationSchema = eventScheduleValidationSchema.partial();

const updateEventBodyValidationSchema = z.object({
  // Basic event info
  eventName: z.string().trim().min(1).max(200).optional(),
  coverImage: z.string().min(1).optional(),
  programId: z.string().min(1).optional(),
  organizer: z.string().trim().min(1).max(200).optional(),
  location: z.string().trim().max(300).optional().nullable(),
  eventPortal: z.string().min(1).optional(),
  registrationPortal: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  note: z.string().max(2000).optional().nullable(),
  isPublished: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  isVerified: z.coerce.boolean().optional(),
  // Repeat
  repeatConfig: repeatConfigValidationSchema.optional(),
  // Session
  sessionId: z.string().min(1).optional(),
  year: z.string().trim().min(2).max(16).optional(),
  session: z.nativeEnum(SessionBucketType).optional(),
  sessionValue: z.string().trim().min(1).max(120).optional(),
  sessionLevel: z.string().trim().min(1).max(120).optional(),
  // EventSchedule patch (same shape as create `schedule`, partial)
  schedule: eventSchedulePatchValidationSchema.optional(),
  // Event.groups — full replace when provided
  groups: z.array(eventGroupValidationSchema).optional(),
  // Previous events — full replace when provided (same shape as create)
  previousEvents: z
    .array(eventPreviousRecordValidationSchema)
    .max(50, 'Maximum 50 previous events allowed')
    .optional()
    .superRefine((items, ctx) => {
      if (!items?.length) return;
      const seen = new Set<string>();
      items.forEach((item, index) => {
        if (seen.has(item.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate previous event id at index ${index}`,
            path: [index, 'id'],
          });
        }
        seen.add(item.id);
      });
    }),
  // Community
  isSharedToCommunity: z.coerce.boolean().optional(),
  isUserAgreementAccepted: z.coerce.boolean().optional(),
});

const updateEventValidationSchema = z.object({
  params: eventIdParamsValidationSchema,
  body: z.preprocess(mergeAndHoistUpdateBody, updateEventBodyValidationSchema),
});

const deleteEventValidationSchema = z.object({
  params: eventIdParamsValidationSchema,
});

const patchEventDisabledValidationSchema = z.object({
  params: eventIdParamsValidationSchema,
  body: z.object({
    isDisabled: z.coerce.boolean(),
  }),
});

export const EventValidation = {
  createEventValidationSchema,
  getEventsValidationSchema,
  getTodayEventsValidationSchema,
  getUpcomingEventsValidationSchema,
  getHistoryEventsValidationSchema,
  searchHomeScreenEventsValidationSchema,
  getEventsByFamilyRelationValidationSchema,
  getEventByIdValidationSchema,
  getEventEditLogByIdValidationSchema,
  getEventEditLogsByEventIdValidationSchema,
  getAppliedEventsByEventIdValidationSchema,
  updateEventValidationSchema,
  deleteEventValidationSchema,
  patchEventDisabledValidationSchema,
};
