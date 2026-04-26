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

const mergeEventFormDataField = (raw: unknown) => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const b = raw as Record<string, unknown>;
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
  const normalizeRepeatConfig = (value: unknown) => {
    if (!value || typeof value !== 'object') return value;
    const rc = value as Record<string, unknown>;
    return {
      ...rc,
      repeatFunction: rc.repeatFunction ?? rc.frequency,
      repeatEvery: rc.repeatEvery ?? rc.interval,
      repeatUnit: rc.repeatUnit ?? rc.unit,
      daysOfWeek: rc.daysOfWeek ?? rc.weekDays,
      dayOfMonth: rc.dayOfMonth ?? rc.monthDay,
      weekOfMonth: rc.weekOfMonth ?? rc.monthWeek,
      weekDay: rc.weekDay ?? rc.monthWeekDay,
      startDate: rc.startDate ?? rc.startsOn,
      untilDate: rc.untilDate ?? rc.endDate,
    };
  };
  const normalizeEventSession = (value: unknown) => {
    if (!value || typeof value !== 'object') return value;
    const s = value as Record<string, unknown>;
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
    const mappedSession =
      normalizeSessionType(s.session) ?? normalizeSessionType(s.sessionType);
    const mappedSessionValue =
      (s.sessionValue as string | undefined)?.trim() ||
      (s.value as string | undefined)?.trim() ||
      (s.label as string | undefined)?.trim() ||
      null;
    let mappedLevel =
      (s.sessionLevel as string | undefined) ??
      (s.sessionKey as string | undefined) ??
      (s.sessionIdentifier as string | undefined);
    if (!mappedLevel) {
      const q = s.quarter ?? s.bucketQuarter;
      const m = s.month ?? s.bucketMonth;
      if (q != null && q !== '') mappedLevel = `Q${q}`;
      else if (m != null && m !== '') mappedLevel = String(m);
    }
    if (!mappedLevel && typeof s.year === 'string' && mappedSessionValue) {
      mappedLevel = `${s.year.trim()}-${mappedSessionValue}`;
    }
    return {
      ...s,
      ...(mappedSession ? { session: mappedSession } : {}),
      ...(mappedSessionValue ? { sessionValue: mappedSessionValue } : {}),
      sessionLevel: mappedLevel,
    };
  };
  const normalizeEventSessionField = (value: unknown) => {
    if (Array.isArray(value)) {
      return value.length ? normalizeEventSession(value[0]) : undefined;
    }
    return normalizeEventSession(value);
  };

  if (typeof b.data === 'string' && b.data.trim()) {
    try {
      const parsed = JSON.parse(b.data) as Record<string, unknown>;
      const { data: _omit, ...rest } = b;
      return {
        ...parsed,
        ...rest,
        repeatConfig: normalizeRepeatConfig(parseJsonLikeField(rest.repeatConfig)),
        eventSession: normalizeEventSessionField(
          parseJsonLikeField((rest as Record<string, unknown>).eventSession ?? rest.eventSessions)
        ),
        currentEventSession: parseJsonLikeField(rest.currentEventSession),
      };
    } catch {
      return raw;
    }
  }
  return {
    ...b,
    repeatConfig: normalizeRepeatConfig(parseJsonLikeField(b.repeatConfig)),
    eventSession: normalizeEventSessionField(parseJsonLikeField(b.eventSession ?? b.eventSessions)),
    currentEventSession: parseJsonLikeField(b.currentEventSession),
  };
};

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
  cost: z.union([z.string(), z.number()]),
  hasFinalDeadline: z.boolean().optional(),
  finalDeadline: z.coerce.date().optional().nullable(),
  lateFee: z.union([z.string(), z.number()]).optional(),
  description: z.string().max(2000).optional().nullable(),
});

const eventGroupInput = z.object({
  name: z.string().trim().min(1).max(200),
  criteria: z.nativeEnum(GroupCriteria),
  condition: z.nativeEnum(RoundCondition),
  value: z.coerce.number().int(),
  rounds: z.array(eventRoundInput).optional(),
});

const eventSessionInput = z
  .object({
    sessionId: z.string().min(1).optional(),
    year: z.string().trim().min(2).max(16).optional(),
    session: z.nativeEnum(SessionBucketType).optional(),
    sessionValue: z.string().trim().min(1).max(120).optional(),
    sessionLevel: z.string().trim().min(1).max(120).optional(),
    competitionLevel: z.nativeEnum(CompetitionLevel),
    eventType: z.nativeEnum(EventType),
    registrationDate: z.coerce.date(),
    deadline: z.coerce.date(),
    cost: z.union([z.string(), z.number()]),
    hasFinalDeadline: z.boolean().optional(),
    finalDeadline: z.coerce.date().optional().nullable(),
    lateFee: z.union([z.string(), z.number()]).optional(),
    status: z.nativeEnum(SessionStatus).optional(),
    isSharedToCommunity: z.boolean().optional(),
    isUserAgreementAccepted: z.boolean().optional(),
    groups: z.array(eventGroupInput).optional(),
  })
  .superRefine((val, ctx) => {
    const hasSessionId = Boolean(val.sessionId);
    const hasNewSession = Boolean(val.year);
    if (hasSessionId && hasNewSession) {
      ctx.addIssue({
        code: 'custom',
        message: 'eventSession cannot include both sessionId and year together.',
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
          path: ['eventSession'],
          message: 'sessionLevel is required when repeatFunction is DontRepeat.',
        });
      }
      if (
        data.eventSession.year?.trim() &&
        data.eventSession.sessionValue?.trim() &&
        data.eventSession.sessionLevel?.trim()
      ) {
        const expected = `${data.eventSession.year.trim()}-${data.eventSession.sessionValue.trim()}`;
        if (data.eventSession.sessionLevel.trim() !== expected) {
          ctx.addIssue({
            code: 'custom',
            path: ['eventSession', 'sessionLevel'],
            message: `sessionLevel must be ${expected} when repeatFunction is DontRepeat.`,
          });
        }
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

const getEventById = z.object({
  params: eventIdParam,
});

const updateCurrentEventSessionBody = z.object({
  competitionLevel: z.nativeEnum(CompetitionLevel).optional(),
  eventType: z.nativeEnum(EventType).optional(),
  registrationDate: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
  cost: z.union([z.string(), z.number()]).optional(),
  hasFinalDeadline: z.boolean().optional(),
  finalDeadline: z.coerce.date().optional().nullable(),
  lateFee: z.union([z.string(), z.number()]).optional(),
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
    isVerifyActive: z.coerce.boolean().optional(),
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

const verifyEvent = z.object({
  params: eventIdParam,
});

export const EventValidation = {
  createEvent,
  getEvents,
  listFeed,
  getEventById,
  updateEvent,
  deleteEvent,
  verifyEvent,
};
