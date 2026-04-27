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
  query: z.object({
    eventName: z.string().optional(),
    filterType: z.enum(['today', 'upcoming', 'history']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

const getEventsByFamilyRelationValidationSchema = z.object({
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
    priceMin: z.string().optional(),
    priceMax: z.string().optional(),
  }),
});

const getHistoryEventsValidationSchema = z.object({
  query: z.object({
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
const getEventEditLogByIdValidationSchema = z.object({
  params: editLogParamsValidationSchema,
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
  // Event.groups
  groups: z.array(eventGroupValidationSchema).optional(),
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

export const EventValidation = {
  createEventValidationSchema,
  getEventsValidationSchema,
  getTodayEventsValidationSchema,
  getUpcomingEventsValidationSchema,
  getHistoryEventsValidationSchema,
  getEventsByFamilyRelationValidationSchema,
  getEventByIdValidationSchema,
  getEventEditLogByIdValidationSchema,
  updateEventValidationSchema,
  deleteEventValidationSchema,
};
