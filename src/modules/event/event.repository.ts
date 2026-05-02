import { Prisma } from '../../../prisma/generated/client';
import {
  EventCreationMode,
  EventType,
  GroupCriteria,
  RepeatFrequency,
  RoundCondition,
  SessionBucketType,
  SessionCreationMode,
} from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import {
  createPaginationQuery,
  createPaginationResult,
  PaginationOptions,
  PaginationResult,
  parsePaginationOptions,
} from '../../utils/paginate';
import {
  ICreateEventPayload,
  IEventAdminListFilters,
  IEventFilters,
  IFeedListFilters,
  IRepeatConfigInput,
  IUpdateCurrentSchedulePayload,
} from './event.interface';
import {
  bandRangeForSlug,
  buildAgeBandGroupWhere,
  inferCategoryGroupSlugFromAgeRows,
  normalizeCategoryGroupSlug,
  priceRangeOnSchedule,
  scheduleScopeWhereInput,
  type CategoryGroupSlug,
  withScheduleCostEstimation,
} from './event.helpers';
import {
  attachActiveSchedules,
  eventGroupsToNestedCreate,
  eventListSelect,
  extractEventNameParts,
  frequencySuffix,
  publishedEventBaseWhere,
  repeatConfigFields,
  resolveRepeatFrequency,
  sessionTypeFromRepeatFrequency,
  toDecimal,
} from './event.utils';

const applyFeedSearchTerm = (where: Prisma.EventWhereInput, searchTerm?: string): Prisma.EventWhereInput => {
  const term = searchTerm?.trim();
  if (!term) {
    return where;
  }
  return {
    AND: [
      where,
      {
        OR: [
          { eventName: { contains: term, mode: 'insensitive' } },
          { baseEventName: { contains: term, mode: 'insensitive' } },
          { organizer: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { location: { contains: term, mode: 'insensitive' } },
          { program: { name: { contains: term, mode: 'insensitive' } } },
        ],
      },
    ],
  };
};

const applyFeedListProgramLocationCategoryWhere = (
  where: Prisma.EventWhereInput,
  filters?: IFeedListFilters
): Prisma.EventWhereInput => {
  let w = where;
  if (filters?.programId?.trim()) {
    w = { AND: [w, { programId: filters.programId.trim() }] };
  }
  if (filters?.location?.trim()) {
    w = {
      AND: [w, { location: { contains: filters.location.trim(), mode: 'insensitive' } }],
    };
  }
  const categorySlug = normalizeCategoryGroupSlug(filters?.categoryGroup);
  if (categorySlug) {
    const { lo, hi } = bandRangeForSlug(categorySlug);
    w = { AND: [w, { groups: { some: buildAgeBandGroupWhere(lo, hi) } }] };
  }
  return w;
};

const buildFeedEventsWhere = (
  scope: 'today' | 'upcoming' | 'history',
  filters?: IFeedListFilters
): Prisma.EventWhereInput => {
  const now = new Date();
  const sessionAnd: Prisma.EventScheduleWhereInput[] = [scheduleScopeWhereInput(scope, now)];
  const priceWhere = priceRangeOnSchedule(filters?.priceMin, filters?.priceMax);
  if (priceWhere) {
    sessionAnd.push(priceWhere);
  }
  if (filters?.type) {
    sessionAnd.push({ eventType: filters.type });
  }

  let where: Prisma.EventWhereInput = {
    ...publishedEventBaseWhere,
    schedule: {
      is: { AND: sessionAnd },
    },
  };

  where = applyFeedListProgramLocationCategoryWhere(where, filters);
  return applyFeedSearchTerm(where, filters?.searchTerm);
};

const attachFeedCategoryGroups = async <T extends { id: string }>(
  events: T[]
): Promise<Array<T & { categoryGroup: CategoryGroupSlug | null }>> => {
  if (!events.length) {
    return events.map(e => ({ ...e, categoryGroup: null }));
  }
  const ids = events.map(e => e.id);
  const ageRows = await database.eventGroup.findMany({
    where: { eventId: { in: ids }, criteria: GroupCriteria.Age },
    select: { eventId: true, criteria: true, condition: true, value: true },
  });
  const byEvent = new Map<
    string,
    Array<{ criteria: GroupCriteria; condition: RoundCondition; value: number }>
  >();
  for (const r of ageRows) {
    const arr = byEvent.get(r.eventId) ?? [];
    arr.push({ criteria: r.criteria, condition: r.condition, value: r.value });
    byEvent.set(r.eventId, arr);
  }
  return events.map(e => ({
    ...e,
    categoryGroup: inferCategoryGroupSlugFromAgeRows(byEvent.get(e.id) ?? []),
  }));
}

const eventAuditSnapshotSelect = {
  version: true,
  programId: true,
  organizer: true,
  location: true,
  eventPortal: true,
  registrationPortal: true,
  description: true,
  note: true,
  isPublished: true,
  isActive: true,
  isVerified: true,
  isDisabled: true,
  isDeleted: true,
  coverImage: true,
  repeatConfig: true,
  sessionId: true,
  isSharedToCommunity: true,
  isUserAgreementAccepted: true,
  groups: {
    select: {
      id: true,
      name: true,
      criteria: true,
      condition: true,
      value: true,
      rounds: {
        select: {
          id: true,
          roundType: true,
          deadline: true,
          cost: true,
          hasFinalDeadline: true,
          finalDeadline: true,
          lateFee: true,
          description: true,
        },
      },
    },
  },
  schedule: {
    select: {
      id: true,
      competitionLevel: true,
      eventType: true,
      registrationDate: true,
      deadline: true,
      cost: true,
      hasFinalDeadline: true,
      finalDeadline: true,
      lateFee: true,
    },
  },
} as const;

const createEvent = async (creatorId: string, payload: ICreateEventPayload) => {
  const coverImage = payload.coverImage?.trim();
  if (!coverImage) {
    throw new Error('coverImage is required to create an event.');
  }
  const {
    repeatConfig,
    schedule,
    coverImage: _omitCover,
    sessionId: payloadSessionId,
    year: payloadYear,
    session: payloadSession,
    sessionValue: payloadSessionValue,
    sessionLevel: payloadSessionLevel,
    isSharedToCommunity,
    isUserAgreementAccepted,
    groups,
    creationMode: payloadCreationMode,
    sourceEventId: payloadSourceEventId,
    ...eventScalarPayload
  } = payload;
  const repeatFrequency = resolveRepeatFrequency(repeatConfig);
  const firstSchedule = payload.schedule;
  const anchorDate = firstSchedule?.registrationDate
    ? new Date(firstSchedule.registrationDate)
    : repeatConfig?.startDate
      ? new Date(repeatConfig.startDate)
      : new Date();
  const manualSessionType = payloadSession ?? null;
  const manualSessionValue = payloadSessionValue?.trim() || '';
  const manualLevel = payloadSessionLevel?.trim() || '';
  const autoValue = frequencySuffix(
    repeatFrequency,
    anchorDate,
    repeatConfig?.startDate ? new Date(repeatConfig.startDate) : anchorDate
  );
  const yearForEvent =
    repeatFrequency === RepeatFrequency.DontRepeat
      ? (payloadYear?.trim() || String(anchorDate.getUTCFullYear()))
      : String(anchorDate.getUTCFullYear());
  const sessionTypeForEvent: SessionBucketType =
    repeatFrequency === RepeatFrequency.DontRepeat
      ? (manualSessionType ?? SessionBucketType.Custom)
      : sessionTypeFromRepeatFrequency(repeatFrequency);
  const isYearlySession = sessionTypeForEvent === SessionBucketType.Yearly;
  const sessionValueForEvent =
    repeatFrequency === RepeatFrequency.DontRepeat ? manualSessionValue || autoValue : autoValue;
  const suffixForEvent = (() => {
    if (repeatFrequency === RepeatFrequency.DontRepeat) {
      if (manualLevel && manualLevel.startsWith(`${yearForEvent}-`)) {
        return manualLevel.slice(yearForEvent.length + 1);
      }
      if (manualLevel) return manualLevel;
      return sessionValueForEvent;
    }
    // Repeating events: the bucket label is always derived from the chosen repeat frequency + anchor date.
    return sessionValueForEvent;
  })();
  const sessionLevelForEvent = isYearlySession ? `${yearForEvent}` : `${yearForEvent}-${suffixForEvent}`;
  const eventNameWithSuffix = isYearlySession
    ? `${payload.eventName.trim()}-${yearForEvent}`
    : `${payload.eventName.trim()}-${yearForEvent}-${suffixForEvent}`;
  const eventNameParts = extractEventNameParts(eventNameWithSuffix, payload.eventName);

  if (!schedule) {
    throw new Error('schedule is required to create an event.');
  }

  return database.$transaction(async tx => {
    const s = {
      ...schedule,
      sessionId: payloadSessionId,
      year: yearForEvent,
      sessionLevel: sessionLevelForEvent,
      session: sessionTypeForEvent,
      sessionValue: sessionValueForEvent,
      isSharedToCommunity,
      isUserAgreementAccepted,
      groups,
    };
    const sessionCreationMode: SessionCreationMode =
      s.sessionId || repeatFrequency === RepeatFrequency.DontRepeat
        ? SessionCreationMode.Manual
        : SessionCreationMode.Auto;
    let sessionId = s.sessionId ?? undefined;
    if (!sessionId && s.year) {
      const sessionLevelValue = (() => {
        return s.sessionLevel?.trim() || `${s.year}-${s.sessionValue}`;
      })();
      const existingSession = await tx.session.findUnique({
        where: { sessionLevel: sessionLevelValue },
        select: { id: true },
      });
      if (existingSession) {
        sessionId = existingSession.id;
      } else {
        const createdSession = await tx.session.create({
          data: {
            session: s.session ?? SessionBucketType.Custom,
            sessionValue: s.sessionValue ?? autoValue,
            sessionLevel: sessionLevelValue,
            year: s.year,
            creationMode: sessionCreationMode,
          },
        });
        sessionId = createdSession.id;
      }
    }

    if (!sessionId) {
      throw new Error('Could not resolve catalog sessionId for this event.');
    }

    const event = await tx.event.create({
      data: {
        ...eventScalarPayload,
        isVerified: false,
        isDeleted: false,
        creationMode: payloadCreationMode ?? EventCreationMode.Manual,
        sourceEventId: payloadSourceEventId ?? null,
        eventName: eventNameWithSuffix,
        baseEventName: payload.eventName.trim(),
        eventYear: eventNameParts.eventYear,
        scheduleLabel: eventNameParts.scheduleLabel,
        coverImage,
        creatorId,
        sessionId,
        isSharedToCommunity: s.isSharedToCommunity ?? false,
        isUserAgreementAccepted: s.isUserAgreementAccepted ?? false,
        groups: eventGroupsToNestedCreate(s.groups),
        schedule: {
          create: {
            competitionLevel: s.competitionLevel,
            eventType: s.eventType,
            registrationDate: new Date(s.registrationDate),
            deadline: new Date(s.deadline),
            cost: toDecimal(s.cost),
            hasFinalDeadline: s.hasFinalDeadline ?? false,
            finalDeadline: s.finalDeadline ? new Date(s.finalDeadline) : null,
            lateFee: toDecimal(s.lateFee ?? 0),
          },
        },
        repeatConfig: repeatConfig
          ? {
            create: repeatConfigFields(repeatConfig),
          }
          : undefined,
      },
      select: { id: true },
    });

    const created = await tx.event.findFirst({
      where: { id: event.id },
      select: eventListSelect,
    });
    if (!created) {
      throw new Error('Failed to load event after create.');
    }
    return created;
  });
};


const getEventById = async (id: string) => {
  const event = await database.event.findFirst({
    where: { id, deletedAt: null, isDeleted: false, isDisabled: false },
    select: {
      id: true,
      eventName: true,
      coverImage: true,
      programId: true,
      organizer: true,
      location: true,
      eventPortal: true,
      registrationPortal: true,
      description: true,
      note: true,
      creationMode: true,
      sourceEventId: true,
      isPublished: true,
      isActive: true,
      isVerified: true,
      isDisabled: true,
      sessionId: true,
      isSharedToCommunity: true,
      isUserAgreementAccepted: true,
      groups: {
        select: {
          id: true,
          name: true,
          criteria: true,
          condition: true,
          value: true,
          rounds: {
            select: {
              id: true,
              roundType: true,
              deadline: true,
              cost: true,
              hasFinalDeadline: true,
              finalDeadline: true,
              lateFee: true,
              description: true,
            },
          },
        },
      },
      program: { select: { id: true, name: true, description: true, imageUrl: true } },
      repeatConfig: {
        select: {
          id: true,
          frequency: true,
          startDate: true,
          nextAutoGenerateDate: true,
        },
      },
      creator: {
        select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
      },
      lastEditor: {
        select: { id: true, firstName: true, lastName: true, username: true },
      },
      schedule: {
        select: {
          id: true,
          competitionLevel: true,
          eventType: true,
          registrationDate: true,
          deadline: true,
          cost: true,
          hasFinalDeadline: true,
          finalDeadline: true,
          lateFee: true,
        },
      },
      results: {
        select: {
          id: true,
          placement: true,
          note: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' as const },
      },
      _count: { select: { eventApplieds: true } },
    },
  });
  if (!event) return null;
  const { schedule, groups, isSharedToCommunity, isUserAgreementAccepted, ...rest } = event;
  const mergedSchedule =
    schedule &&
    withScheduleCostEstimation({
      ...schedule,
      groups,
      isSharedToCommunity,
      isUserAgreementAccepted,
    });
  return {
    ...rest,
    schedule: mergedSchedule,
  };
};

const getEventByIdForAdmin = async (id: string) => {
  const event = await database.event.findFirst({
    where: { id, deletedAt: null, isDeleted: false },
    select: {
      id: true,
      eventName: true,
      coverImage: true,
      programId: true,
      organizer: true,
      location: true,
      eventPortal: true,
      registrationPortal: true,
      description: true,
      note: true,
      creationMode: true,
      sourceEventId: true,
      isPublished: true,
      isActive: true,
      isVerified: true,
      isDisabled: true,
      sessionId: true,
      isSharedToCommunity: true,
      isUserAgreementAccepted: true,
      groups: {
        select: {
          id: true,
          name: true,
          criteria: true,
          condition: true,
          value: true,
          rounds: {
            select: {
              id: true,
              roundType: true,
              deadline: true,
              cost: true,
              hasFinalDeadline: true,
              finalDeadline: true,
              lateFee: true,
              description: true,
            },
          },
        },
      },
      program: { select: { id: true, name: true, description: true, imageUrl: true } },
      repeatConfig: {
        select: {
          id: true,
          frequency: true,
          startDate: true,
          nextAutoGenerateDate: true,
        },
      },
      creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          profilePicture: true,
          contributionScore: true,
        },
      },
      lastEditor: {
        select: { id: true, firstName: true, lastName: true, username: true },
      },
      schedule: {
        select: {
          id: true,
          competitionLevel: true,
          eventType: true,
          registrationDate: true,
          deadline: true,
          cost: true,
          hasFinalDeadline: true,
          finalDeadline: true,
          lateFee: true,
        },
      },
      _count: { select: { eventApplieds: true } },
    },
  });
  if (!event) return null;
  const { schedule, groups, isSharedToCommunity, isUserAgreementAccepted, ...rest } = event;
  const mergedSchedule =
    schedule &&
    withScheduleCostEstimation({
      ...schedule,
      groups,
      isSharedToCommunity,
      isUserAgreementAccepted,
    });
  return {
    ...rest,
    schedule: mergedSchedule,
  };
};

const getEventEditLogById = async (eventId: string, editLogId: string) => {
  return database.editLog.findFirst({
    where: { id: editLogId, eventId },
    select: {
      id: true,
      eventId: true,
      version: true,
      changedFields: true,
      previousValues: true,
      createdAt: true,
      editor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          contributionScore: true,
        },
      },
    },
  });
};

const getEventEditLogsByEventId = async (
  eventId: string,
  filters: IEventAdminListFilters,
  options: PaginationOptions
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);
  const where: Prisma.EditLogWhereInput = { eventId };

  if (filters.searchTerm) {
    where.OR = [
      { changedFields: { has: filters.searchTerm } },
      { editor: { firstName: { contains: filters.searchTerm, mode: 'insensitive' } } },
      { editor: { lastName: { contains: filters.searchTerm, mode: 'insensitive' } } },
      { editor: { username: { contains: filters.searchTerm, mode: 'insensitive' } } },
    ];
  }

  if (filters.date) {
    const parsedDate = new Date(filters.date);
    if (!Number.isNaN(parsedDate.getTime())) {
      const start = new Date(parsedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.createdAt = {
        gte: start,
        lt: end,
      };
    }
  }

  const [rows, total] = await Promise.all([
    database.editLog.findMany({
      where,
      select: {
        id: true,
        eventId: true,
        version: true,
        changedFields: true,
        previousValues: true,
        createdAt: true,
        editor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            contributionScore: true,
          },
        },
      },
      skip,
      take,
      orderBy,
    }),
    database.editLog.count({ where }),
  ]);

  return createPaginationResult(rows, total, pagination);
};

const getAppliedEventsByEventId = async (
  eventId: string,
  filters: IEventAdminListFilters,
  options: PaginationOptions
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);
  const where: Prisma.EventAppliedWhereInput = {
    eventId,
    deletedAt: null,
  };

  if (filters.searchTerm) {
    where.OR = [
      { note: { contains: filters.searchTerm, mode: 'insensitive' } },
      { user: { firstName: { contains: filters.searchTerm, mode: 'insensitive' } } },
      { user: { lastName: { contains: filters.searchTerm, mode: 'insensitive' } } },
      { user: { username: { contains: filters.searchTerm, mode: 'insensitive' } } },
      { user: { email: { contains: filters.searchTerm, mode: 'insensitive' } } },
    ];
  }

  if (filters.date) {
    const parsedDate = new Date(filters.date);
    if (!Number.isNaN(parsedDate.getTime())) {
      const start = new Date(parsedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.createdAt = {
        gte: start,
        lt: end,
      };
    }
  }

  const [rows, total] = await Promise.all([
    database.eventApplied.findMany({
      where,
      select: {
        id: true,
        eventId: true,
        userId: true,
        note: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            email: true,
            contributionScore: true,
          },
        },
      },
      skip,
      take,
      orderBy,
    }),
    database.eventApplied.count({ where }),
  ]);

  return createPaginationResult(rows, total, pagination);
};


const getEventBare = async (id: string) => {
  return database.event.findFirst({
    where: { id, deletedAt: null, isDeleted: false },
    select: {
      id: true,
      eventName: true,
      creatorId: true,
      deletedAt: true,
      coverImage: true,
      version: true,
      isDisabled: true,
    },
  });
};

const getEventAuditSnapshot = async (id: string) => {
  return database.event.findFirst({
    where: { id, deletedAt: null, isDeleted: false },
    select: eventAuditSnapshotSelect,
  });
};

export type EventAuditSnapshot = NonNullable<Awaited<ReturnType<typeof getEventAuditSnapshot>>>;

const createEditLog = async (input: {
  eventId: string;
  version: number;
  editorId: string;
  changedFields: string[];
  previousValues: Prisma.InputJsonValue;
}) => {
  return database.editLog.create({
    data: {
      eventId: input.eventId,
      version: input.version,
      editorId: input.editorId,
      changedFields: input.changedFields,
      previousValues: input.previousValues,
    },
    select: { id: true, version: true, createdAt: true },
  });
};

const getEvents = async (
  filters: IEventFilters,
  options: PaginationOptions,
  includeDisabledForAdmin = false
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where: Prisma.EventWhereInput = {
    deletedAt: null,
    isDeleted: false,
    ...(!includeDisabledForAdmin ? { isDisabled: false } : {}),
  };

  if (filters.eventName) {
    where.eventName = { contains: filters.eventName, mode: 'insensitive' };
  }

  const sessionParts: Prisma.EventScheduleWhereInput[] = [];
  const now = new Date();
  if (filters.filterType) {
    sessionParts.push(scheduleScopeWhereInput(filters.filterType, now));
  }

  if (sessionParts.length > 0) {
    where.schedule = { is: { AND: sessionParts } };
  }

  const [data, total] = await Promise.all([
    database.event.findMany({
      where,
      select: eventListSelect,
      skip,
      take,
      orderBy,
    }),
    database.event.count({ where }),
  ]);

  const enriched = await attachActiveSchedules(data);
  return createPaginationResult(enriched, total, pagination);
};


const runFeedListQuery = async (
  scope: 'today' | 'upcoming' | 'history',
  filters: IFeedListFilters | undefined,
  options: PaginationOptions
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);
  const where = buildFeedEventsWhere(scope, filters);

  const [data, total] = await Promise.all([
    database.event.findMany({
      where,
      select: eventListSelect,
      skip,
      take,
      orderBy,
    }),
    database.event.count({ where }),
  ]);

  const withSchedule = await attachActiveSchedules(data);
  const enriched = await attachFeedCategoryGroups(withSchedule);
  return createPaginationResult(enriched, total, pagination);
};

const getUpcomingEvents = async (filters: IFeedListFilters | undefined, options: PaginationOptions) =>
  runFeedListQuery('upcoming', filters, options);

const getTodayEvents = async (filters: IFeedListFilters | undefined, options: PaginationOptions) =>
  runFeedListQuery('today', filters, options);

const getHistoryEvents = async (filters: IFeedListFilters | undefined, options: PaginationOptions) =>
  runFeedListQuery('history', filters, options);

const getPersonalizedUpcomingEvents = async (
  filters: IFeedListFilters | undefined,
  options: PaginationOptions,
  applicationProgramIds: string[],
  applicationLocations: string[],
  applicationEventTypes: string[]
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);
  const now = new Date();
  const priceWhere = priceRangeOnSchedule(filters?.priceMin, filters?.priceMax);
  const sessionAnd: Prisma.EventScheduleWhereInput[] = [scheduleScopeWhereInput('upcoming', now)];
  if (priceWhere) {
    sessionAnd.push(priceWhere);
  }
  if (filters?.type) {
    sessionAnd.push({ eventType: filters.type });
  }

  const orBranches: Prisma.EventWhereInput[] = [];
  const prefProgramIds = [
    ...new Set(applicationProgramIds.map(id => String(id).trim()).filter(id => id.length > 0)),
  ];
  if (prefProgramIds.length) {
    orBranches.push({ programId: { in: prefProgramIds } });
  }
  const locs = applicationLocations
    .map(l => String(l).trim())
    .filter(l => l.length > 0);
  if (locs.length) {
    orBranches.push({
      OR: locs.map(loc => ({
        location: { equals: loc, mode: 'insensitive' as const },
      })),
    });
  }
  const validEventTypes = [
    ...new Set(
      applicationEventTypes.filter((t): t is EventType =>
        (Object.values(EventType) as string[]).includes(String(t))
      )
    ),
  ];
  if (validEventTypes.length) {
    orBranches.push({
      schedule: {
        is: {
          eventType: { in: validEventTypes },
        },
      },
    });
  }

  if (!orBranches.length) {
    return getUpcomingEvents(filters, options);
  }

  let where: Prisma.EventWhereInput = {
    AND: [
      { ...publishedEventBaseWhere },
      {
        schedule: {
          is: { AND: sessionAnd },
        },
      },
      { OR: orBranches },
    ],
  };
  where = applyFeedListProgramLocationCategoryWhere(where, filters);
  where = applyFeedSearchTerm(where, filters?.searchTerm);

  const [data, total] = await Promise.all([
    database.event.findMany({
      where,
      select: eventListSelect,
      skip,
      take,
      orderBy,
    }),
    database.event.count({ where }),
  ]);

  const withSchedule = await attachActiveSchedules(data);
  const enriched = await attachFeedCategoryGroups(withSchedule);
  return createPaginationResult(enriched, total, pagination);
};

const searchHomeScreenEvents = async (
  filters: IFeedListFilters,
  options: PaginationOptions
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);
  const sessionAnd: Prisma.EventScheduleWhereInput[] = [];
  const priceWhere = priceRangeOnSchedule(filters?.priceMin, filters?.priceMax);
  if (priceWhere) {
    sessionAnd.push(priceWhere);
  }
  if (filters?.type) {
    sessionAnd.push({ eventType: filters.type });
  }

  let where: Prisma.EventWhereInput = { ...publishedEventBaseWhere };
  if (sessionAnd.length) {
    where = { AND: [where, { schedule: { is: { AND: sessionAnd } } }] };
  }
  where = applyFeedSearchTerm(where, filters.searchTerm);
  where = applyFeedListProgramLocationCategoryWhere(where, filters);

  const [data, total] = await Promise.all([
    database.event.findMany({
      where,
      select: eventListSelect,
      skip,
      take,
      orderBy,
    }),
    database.event.count({ where }),
  ]);

  const withSchedule = await attachActiveSchedules(data);
  const enriched = await attachFeedCategoryGroups(withSchedule);
  return createPaginationResult(enriched, total, pagination);
};

const getPublishedEventsByCreatorIds = async (
  creatorIds: string[],
  filters: IFeedListFilters | undefined,
  options: PaginationOptions
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  if (creatorIds.length === 0) {
    return createPaginationResult([], 0, pagination);
  }
  const { skip, take, orderBy } = createPaginationQuery(pagination);
  const sessionAnd: Prisma.EventScheduleWhereInput[] = [];
  const priceWhere = priceRangeOnSchedule(filters?.priceMin, filters?.priceMax);
  if (priceWhere) {
    sessionAnd.push(priceWhere);
  }
  if (filters?.type) {
    sessionAnd.push({ eventType: filters.type });
  }

  let where: Prisma.EventWhereInput = {
    ...publishedEventBaseWhere,
    creatorId: { in: creatorIds },
  };
  if (sessionAnd.length) {
    where = { AND: [where, { schedule: { is: { AND: sessionAnd } } }] };
  }
  where = applyFeedListProgramLocationCategoryWhere(where, filters);
  where = applyFeedSearchTerm(where, filters?.searchTerm);

  const [data, total] = await Promise.all([
    database.event.findMany({
      where,
      select: eventListSelect,
      skip,
      take,
      orderBy,
    }),
    database.event.count({ where }),
  ]);

  const enriched = await attachActiveSchedules(data);
  return createPaginationResult(enriched, total, pagination);
};

const setEventDisabledById = async (eventId: string, isDisabled: boolean, adminUserId: string) => {
  const existing = await database.event.findFirst({
    where: { id: eventId, deletedAt: null, isDeleted: false },
    select: { id: true },
  });
  if (!existing) {
    return null;
  }
  return database.event.update({
    where: { id: eventId },
    data: {
      isDisabled: isDisabled,
      lastEditorId: adminUserId,
      version: { increment: 1 },
    },
    select: eventListSelect,
  });
};

const updateEventById = async (id: string, data: Prisma.EventUpdateInput) => {
  return database.event.update({
    where: { id },
    data,
    select: eventListSelect,
  });
};

const updateCurrentScheduleForEvent = async (
  eventId: string,
  patch: IUpdateCurrentSchedulePayload
) => {
  const current = await database.eventSchedule.findFirst({
    where: { eventId },
    select: { id: true },
  });
  if (!current) {
    return null;
  }

  const data: Prisma.EventScheduleUpdateInput = {};
  if (patch.competitionLevel !== undefined) {
    data.competitionLevel = patch.competitionLevel;
  }
  if (patch.eventType !== undefined) {
    data.eventType = patch.eventType;
  }
  if (patch.registrationDate !== undefined) {
    data.registrationDate = new Date(patch.registrationDate);
  }
  if (patch.deadline !== undefined) {
    data.deadline = new Date(patch.deadline);
  }
  if (patch.cost !== undefined) {
    data.cost = toDecimal(patch.cost);
  }
  if (patch.hasFinalDeadline !== undefined) {
    data.hasFinalDeadline = patch.hasFinalDeadline;
  }
  if (patch.finalDeadline !== undefined) {
    data.finalDeadline = patch.finalDeadline ? new Date(patch.finalDeadline) : null;
  }
  if (patch.lateFee !== undefined) {
    data.lateFee = toDecimal(patch.lateFee);
  }
  if (Object.keys(data).length === 0) {
    return null;
  }

  await database.eventSchedule.update({
    where: { id: current.id },
    data,
  });

  const eventRow = await database.event.findFirst({
    where: { id: eventId },
    select: {
      catalogSession: {
        select: {
          id: true,
          session: true,
          sessionValue: true,
          sessionLevel: true,
          year: true,
          creationMode: true,
        },
      },
      groups: { include: { rounds: true } },
      isSharedToCommunity: true,
      isUserAgreementAccepted: true,
      schedule: true,
    },
  });
  if (!eventRow?.schedule) {
    return null;
  }
  return withScheduleCostEstimation({
    ...eventRow.schedule,
    catalogSession: eventRow.catalogSession,
    groups: eventRow.groups,
    isSharedToCommunity: eventRow.isSharedToCommunity,
    isUserAgreementAccepted: eventRow.isUserAgreementAccepted,
  });
};

const markEventVerifiedForPatch = async (eventId: string) => {
  const existing = await database.event.findFirst({
    where: { id: eventId, deletedAt: null, isDeleted: false },
    select: { id: true, isVerified: true },
  });
  if (!existing) {
    return null;
  }
  if (existing.isVerified) {
    return { id: existing.id, isVerified: true as const };
  }
  await database.event.update({
    where: { id: eventId },
    data: { isVerified: true },
  });
  return { id: eventId, isVerified: true as const };
};

const upsertRepeatConfig = async (eventId: string, input: IRepeatConfigInput) => {
  const fields = repeatConfigFields(input);
  return database.repeatConfig.upsert({
    where: { eventId },
    create: { eventId, ...fields },
    update: fields,
  });
};

const deleteRepeatConfigByEventId = async (eventId: string) => {
  return database.repeatConfig.deleteMany({ where: { eventId } });
};

const softDeleteEvent = async (id: string) => {
  return database.event.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false, isDeleted: true },
    select: { id: true, deletedAt: true, isDeleted: true },
  });
};

const programExists = async (programId: string) => {
  return database.program.findFirst({
    where: { id: programId, isDeleted: false },
    select: { id: true },
  });
};
const sessionsExist = async (sessionIds: string[]) => {
  const unique = [...new Set(sessionIds)];
  const rows = await database.session.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  return rows.length === unique.length;
};

export const EventRepository = {
  // Feed & discovery
  getUpcomingEvents,
  getPersonalizedUpcomingEvents,
  getTodayEvents,
  getHistoryEvents,
  searchHomeScreenEvents,
  getPublishedEventsByCreatorIds,
  // Paginated list & single reads
  getEvents,
  getEventById,
  getEventByIdForAdmin,
  getEventBare,
  getEventAuditSnapshot,
  // Admin: edit logs & applications
  getEventEditLogById,
  getEventEditLogsByEventId,
  getAppliedEventsByEventId,
  // Writes
  createEvent,
  createEditLog,
  updateEventById,
  updateCurrentScheduleForEvent,
  markEventVerifiedForPatch,
  upsertRepeatConfig,
  deleteRepeatConfigByEventId,
  softDeleteEvent,
  setEventDisabledById,
  // Catalog
  programExists,
  sessionsExist,
};
