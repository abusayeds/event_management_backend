import { z } from 'zod';
import {
  CompetitionLevel,
  EventType,
  GroupCriteria,
  RepeatFrequency,
  RoundCondition,
  SessionBucketType,
  SessionStatus,
} from '../../../prisma/generated/enums';

const eventIdParam = z.object({
  eventId: z.string().min(1, 'eventId is required'),
});

const parseJsonLikeField = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
};

const normalizeSessionType = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim().toLowerCase();
  if (!t) return null;
  if (t === 'daily') return 'Daily';
  if (t === 'weekly') return 'Weekly';
  if (t === 'monthly') return 'Monthly';
  if (t === 'quarterly') return 'Quarterly';
  if (t === 'yearly') return 'Yearly';
  if (t === 'custom') return 'Custom';
  return v.trim();
};

const normalizeRepeatConfig = (value: unknown) => {
  if (!value || typeof value !== 'object') return value;
  const rc = value as Record<string, unknown>;
  return {
    ...rc,
    repeatFunction: rc.repeatFunction ?? rc.frequency,
    startDate: rc.startDate ?? rc.startsOn,
  };
};

const normalizeEventSession = (value: unknown) => {
  if (!value || typeof value !== 'object') return value;
  const s = value as Record<string, unknown>;
  const mappedSession = normalizeSessionType(s.session) ?? normalizeSessionType(s.sessionType);
  const mappedSessionValue =
    (s.sessionValue as string | undefined)?.trim() ||
    (s.value as string | undefined)?.trim() ||
    (s.label as string | undefined)?.trim() ||
    null;
  const mappedYear = typeof s.year === 'string' ? s.year.trim() : undefined;
  let mappedLevel =
    (s.sessionLevel as string | undefined)?.trim() ||
    (s.sessionKey as string | undefined)?.trim() ||
    (s.sessionIdentifier as string | undefined)?.trim();
  if (!mappedLevel && mappedYear && mappedSessionValue) {
    mappedLevel = `${mappedYear}-${mappedSessionValue}`;
  }
  return {
    ...s,
    ...(mappedSession ? { session: mappedSession } : {}),
    ...(mappedSessionValue ? { sessionValue: mappedSessionValue } : {}),
    ...(mappedLevel ? { sessionLevel: mappedLevel } : {}),
  };
};

const normalizeEventSessionField = (value: unknown) => {
  const parsed = parseJsonLikeField(value);
  if (Array.isArray(parsed)) {
    return parsed.map(item => normalizeEventSession(item));
  }
  return normalizeEventSession(parsed);
};

const mergeEventFormDataField = (raw: unknown) => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const body = raw as Record<string, unknown>;

  const parsedData =
    typeof body.data === 'string' && body.data.trim()
      ? (parseJsonLikeField(body.data) as Record<string, unknown>)
      : null;

  const { data: _omitData, ...rest } = body;
  // Parsed payload should be the source of truth and should not be overwritten by duplicate form fields.
  const merged = parsedData && typeof parsedData === 'object' ? { ...rest, ...parsedData } : rest;

  const eventSessionSource =
    (merged as Record<string, unknown>).eventSession ??
    (merged as Record<string, unknown>).eventSessions;

  return {
    ...merged,
    repeatConfig: normalizeRepeatConfig(parseJsonLikeField((merged as Record<string, unknown>).repeatConfig)),
    eventSession: normalizeEventSessionField(eventSessionSource),
    currentEventSession: parseJsonLikeField((merged as Record<string, unknown>).currentEventSession),
  };
};

const nonNegativeNumber = z.coerce.number().finite().nonnegative();

const repeatConfigBody = z
  .object({
    repeatFunction: z.nativeEnum(RepeatFrequency).optional(),
    startDate: z.coerce.date().optional().nullable(),
  })
  .optional()
  .nullable();

const eventRoundInput = z.object({
  roundType: z.nativeEnum(CompetitionLevel),
  deadline: z.coerce.date(),
  cost: nonNegativeNumber,
  hasFinalDeadline: z.boolean().optional(),
  finalDeadline: z.coerce.date().optional().nullable(),
  lateFee: nonNegativeNumber.optional(),
  description: z.string().max(2000).optional().nullable(),
});

const eventGroupInput = z.object({
  name: z.string().trim().min(1).max(200),
  criteria: z.nativeEnum(GroupCriteria),
  condition: z.nativeEnum(RoundCondition),
  value: z.coerce.number().int(),
  rounds: z.array(eventRoundInput).optional(),
});

const baseEventSessionInput = z.object({
  sessionId: z.string().min(1).optional(),
  year: z.string().trim().min(2).max(16).optional(),
  session: z.nativeEnum(SessionBucketType).optional(),
  sessionValue: z.string().trim().min(1).max(120).optional(),
  sessionLevel: z.string().trim().min(1).max(120).optional(),
  competitionLevel: z.nativeEnum(CompetitionLevel),
  eventType: z.nativeEnum(EventType),
  registrationDate: z.coerce.date(),
  deadline: z.coerce.date(),
  cost: nonNegativeNumber,
  hasFinalDeadline: z.boolean().optional(),
  finalDeadline: z.coerce.date().optional().nullable(),
  lateFee: nonNegativeNumber.optional(),
  status: z.nativeEnum(SessionStatus).optional(),
  isSharedToCommunity: z.boolean().optional(),
  isUserAgreementAccepted: z.boolean().optional(),
  groups: z.array(eventGroupInput).optional(),
});

const eventSessionInput = z
  .union([
    baseEventSessionInput,
    z
      .array(baseEventSessionInput)
      .length(1, 'eventSession must be a single object (or a one-item array).')
      .transform(arr => arr[0]),
  ])
  .superRefine((val, ctx) => {
    const hasSessionId = Boolean(val.sessionId);
    const hasYear = Boolean(val.year?.trim());
    if (hasSessionId && hasYear) {
      ctx.addIssue({
        code: 'custom',
        path: ['sessionId'],
        message: 'eventSession cannot include both sessionId and year together.',
      });
    }
    if (!hasSessionId && !hasYear) {
      ctx.addIssue({
        code: 'custom',
        path: ['year'],
        message: 'Either sessionId or year is required in eventSession.',
      });
    }
  });

const createEventBodySchema = z
  .object({
    eventName: z.string().trim().min(1).max(200),
    /** Omit when sending file `coverImage`; otherwise required URL (validated in service). */
    coverImage: z.string().min(1).optional(),
    programId: z.string().min(1),
    organizer: z.string().trim().min(1).max(200),
    location: z.string().trim().max(300).optional().nullable(),
    eventPortal: z.string().min(1),
    registrationPortal: z.string().min(1),
    description: z.string().min(1),
    note: z.string().max(2000).optional().nullable(),
    isPublished: z.coerce.boolean().optional(),
    repeatConfig: repeatConfigBody,
    eventSession: eventSessionInput.optional(),
  })
  .superRefine((data, ctx) => {
    const repeatFunction = data.repeatConfig?.repeatFunction ?? RepeatFrequency.DontRepeat;
    if (!data.eventSession) {
      ctx.addIssue({
        code: 'custom',
        path: ['eventSession'],
        message: 'eventSession is required.',
      });
      return;
    }

    if (repeatFunction === RepeatFrequency.DontRepeat) {
      if (!data.eventSession.year?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['eventSession', 'year'],
          message: 'year is required when repeatFunction is DontRepeat.',
        });
      }
      if (!data.eventSession.session) {
        ctx.addIssue({
          code: 'custom',
          path: ['eventSession', 'session'],
          message: 'session is required when repeatFunction is DontRepeat.',
        });
      }
      if (!data.eventSession.sessionValue?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['eventSession', 'sessionValue'],
          message: 'sessionValue is required when repeatFunction is DontRepeat.',
        });
      }
      if (!data.eventSession.sessionLevel?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['eventSession', 'sessionLevel'],
          message: 'sessionLevel is required when repeatFunction is DontRepeat.',
        });
      }
      return;
    }

    if (data.eventSession.sessionId) {
      ctx.addIssue({
        code: 'custom',
        path: ['eventSession', 'sessionId'],
        message:
          'sessionId cannot be provided when repeatFunction is Daily/Monthly/Quarterly/Yearly/Custom.',
      });
    }
  });

const createEvent = z.object({
  body: z.preprocess(mergeEventFormDataField, createEventBodySchema),
});

const sessionScopeEnum = z.enum(['today', 'upcoming', 'history']);

const priceQuery = {
  priceMin: z.string().optional(),
  priceMax: z.string().optional(),
} as const;

const getEvents = z.object({
  query: z
    .object({
      search: z.string().optional(),
      programId: z.string().optional(),
      eventType: z.nativeEnum(EventType).optional(),
      location: z.string().optional(),
      groupCriteria: z.nativeEnum(GroupCriteria).optional(),
      timeRangeFrom: z.coerce.date().optional(),
      timeRangeTo: z.coerce.date().optional(),
      sessionScope: sessionScopeEnum.optional(),
      ...priceQuery,
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

const listFeed = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    ...priceQuery,
  }),
});

/** Family filter chips: omit `memberUserId` for self; pass another member’s user id when allowed. */
const listFamilyFeed = z.object({
  query: z.object({
    memberUserId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    ...priceQuery,
  }),
});

const getEventById = z.object({
  params: eventIdParam,
});

const updateCurrentEventSessionBody = z.object({
  competitionLevel: z.nativeEnum(CompetitionLevel).optional(),
  eventType: z.nativeEnum(EventType).optional(),
  registrationDate: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
  cost: nonNegativeNumber.optional(),
  hasFinalDeadline: z.boolean().optional(),
  finalDeadline: z.coerce.date().optional().nullable(),
  lateFee: nonNegativeNumber.optional(),
  status: z.nativeEnum(SessionStatus).optional(),
  isSharedToCommunity: z.boolean().optional(),
  isUserAgreementAccepted: z.boolean().optional(),
  autoGenerated: z.boolean().optional(),
});

const updateEventBodySchema = z
  .object({
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
    repeatConfig: repeatConfigBody,
    currentEventSession: updateCurrentEventSessionBody.optional(),
  })
  .superRefine((data, ctx) => {
    const cs = data.currentEventSession;
    if (cs != null && typeof cs === 'object' && Object.keys(cs).length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'currentEventSession cannot be an empty object; omit the key or send at least one field.',
      });
    }
  });

const updateEvent = z.object({
  params: eventIdParam,
  body: z.preprocess(mergeEventFormDataField, updateEventBodySchema),
});

const deleteEvent = z.object({
  params: eventIdParam,
});

export const EventValidation = {
  createEvent,
  getEvents,
  listFeed,
  listFamilyFeed,
  getEventById,
  updateEvent,
  deleteEvent,
};
