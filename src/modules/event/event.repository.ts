import { Prisma } from '../../../prisma/generated/client';
import {
  PlacementType,
  RepeatFrequency,
  SessionStatus,
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
  IEventFilters,
  IEventGroupInput,
  IFeedPriceFilters,
  IRepeatConfigInput,
  IUpdateCurrentEventSessionPayload,
} from './event.interface';
import {
  addUtcDays,
  buildSessionIdentifier,
  defaultSessionBucketFormat,
  endOfUtcDay,
  pickActiveEventSession,
  priceRangeOnSession,
  sessionScopeWhereInput,
  startOfUtcDay,
  withEventSessionCostEstimation,
} from './event.helpers';

const toDecimal = (value: string | number | undefined | null): Prisma.Decimal => {
  if (value === undefined || value === null || value === '') {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(String(value));
};
const eventGroupsToNestedCreate = (groups: IEventGroupInput[] | undefined) => {
  if (!groups?.length) {
    return undefined;
  }
  return {
    create: groups.map(g => ({
      name: g.name,
      criteria: g.criteria,
      condition: g.condition,
      value: g.value,
      rounds: g.rounds?.length
        ? {
            create: g.rounds.map(r => ({
              roundType: r.roundType,
              deadline: new Date(r.deadline),
              cost: toDecimal(r.cost),
              hasFinalDeadline: r.hasFinalDeadline ?? false,
              finalDeadline: r.finalDeadline ? new Date(r.finalDeadline) : null,
              lateFee: toDecimal(r.lateFee ?? 0),
              description: r.description ?? null,
            })),
          }
        : undefined,
    })),
  };
};

const addDays = (base: Date, days: number) => new Date(base.getTime() + days * 86400000);
const addMonths = (base: Date, months: number) => {
  const d = new Date(base.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
};
const addYears = (base: Date, years: number) => {
  const d = new Date(base.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
};

const MONTH_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const weekOfYearUtc = (date: Date) => {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const diffDays = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return Math.floor(diffDays / 7) + 1;
};

const resolveRepeatFrequency = (input?: IRepeatConfigInput | null): RepeatFrequency =>
  input?.repeatFunction ?? RepeatFrequency.DontRepeat;

const sessionSuffixFromInput = (input: { sessionLevel?: string | null }) => {
  const level = input.sessionLevel?.trim();
  if (level) return level;
  return null;
};

const frequencySuffix = (
  frequency: RepeatFrequency,
  anchorDate: Date
) => {
  switch (frequency) {
    case RepeatFrequency.Daily:
      return `${String(anchorDate.getUTCMonth() + 1).padStart(2, '0')}-${String(anchorDate.getUTCDate()).padStart(2, '0')}`;
    case RepeatFrequency.Weekly:
      return `Week${weekOfYearUtc(anchorDate)}`;
    case RepeatFrequency.Monthly:
      return MONTH_FULL[anchorDate.getUTCMonth()];
    case RepeatFrequency.Quarterly:
      return `Q${Math.floor(anchorDate.getUTCMonth() / 3) + 1}`;
    case RepeatFrequency.Yearly:
      return 'Year';
    case RepeatFrequency.Custom:
      return `${String(anchorDate.getUTCMonth() + 1).padStart(2, '0')}-${String(anchorDate.getUTCDate()).padStart(2, '0')}`;
    default:
      return 'Session1';
  }
};

const resolveSessionIdentity = (args: {
  repeatFrequency: RepeatFrequency;
  anchorDate: Date;
  incomingYear?: string;
  incomingLevel?: string | null;
}) => {
  if (args.repeatFrequency === RepeatFrequency.DontRepeat) {
    return {
      year: args.incomingYear?.trim() || String(args.anchorDate.getUTCFullYear()),
      sessionLevel: args.incomingLevel ?? null,
    };
  }
  return {
    year: String(args.anchorDate.getUTCFullYear()),
    sessionLevel: frequencySuffix(args.repeatFrequency, args.anchorDate),
  };
};

const buildEventNameWithSessionSuffix = (args: {
  baseEventName: string;
  year?: string;
  sessionLevel?: string | null;
  repeatFrequency: RepeatFrequency;
  anchorDate: Date;
}) => {
  const year =
    args.year?.trim() ||
    String(args.anchorDate.getUTCFullYear());
  const fallbackSuffix = frequencySuffix(args.repeatFrequency, args.anchorDate);
  const sessionSuffix = sessionSuffixFromInput({ sessionLevel: args.sessionLevel }) ?? fallbackSuffix;

  return `${args.baseEventName.trim()}-${year}-${sessionSuffix}`;
};

const extractEventNameParts = (fullEventName: string, baseEventName: string) => {
  const normalizedBase = baseEventName.trim();
  const prefix = `${normalizedBase}-`;
  if (!fullEventName.startsWith(prefix)) {
    return { eventYear: null as string | null, eventSessionLabel: null as string | null };
  }
  const suffix = fullEventName.slice(prefix.length);
  const [eventYear, ...rest] = suffix.split('-');
  const eventSessionLabel = rest.join('-') || null;
  return {
    eventYear: eventYear || null,
    eventSessionLabel,
  };
};

const computeNextAutoGenerateDate = (input: IRepeatConfigInput): Date | null => {
  const frequency = resolveRepeatFrequency(input);
  if (frequency === RepeatFrequency.DontRepeat) return null;

  const base = input.startDate ? new Date(input.startDate) : new Date();

  switch (frequency) {
    case RepeatFrequency.Daily:
      return addDays(base, 1);
    case RepeatFrequency.Weekly:
      return addDays(base, 7);
    case RepeatFrequency.Monthly:
      return addMonths(base, 1);
    case RepeatFrequency.Quarterly:
      return addMonths(base, 3);
    case RepeatFrequency.Yearly:
      return addYears(base, 1);
    case RepeatFrequency.Custom:
      return addDays(base, 1);
    default:
      return null;
  }
};

const repeatConfigFields = (input: IRepeatConfigInput) => ({
  frequency: resolveRepeatFrequency(input),
  startDate: input.startDate ? new Date(input.startDate) : null,
  nextAutoGenerateDate: computeNextAutoGenerateDate(input),
});

export const eventListSelect = {
  id: true,
  eventName: true,
  coverImage: true,
  programId: true,
  organizer: true,
  location: true,
  isPublished: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  program: { select: { id: true, name: true, imageUrl: true } },
} as const;

const publishedEventBaseWhere = {
  deletedAt: null,
  isActive: true,
  isPublished: true,
} as const;

const eventSessionForActivePickSelect = {
  eventId: true,
  id: true,
  status: true,
  registrationDate: true,
  deadline: true,
  cost: true,
  eventType: true,
  competitionLevel: true,
} as const;

type EventSessionForActiveRow = Prisma.EventSessionGetPayload<{
  select: typeof eventSessionForActivePickSelect;
}>;

async function sessionsByEventIdMap(eventIds: string[]) {
  const map = new Map<string, EventSessionForActiveRow[]>();
  if (!eventIds.length) return map;
  const rows = await database.eventSession.findMany({
    where: { eventId: { in: eventIds } },
    select: eventSessionForActivePickSelect,
    orderBy: { deadline: 'asc' as const },
  });
  for (const r of rows) {
    const arr = map.get(r.eventId) ?? [];
    arr.push(r);
    map.set(r.eventId, arr);
  }
  return map;
}

async function attachActiveSessions<T extends { id: string }>(events: T[]) {
  const map = await sessionsByEventIdMap(events.map(e => e.id));
  return events.map(e => ({
    ...e,
    activeSession: (() => {
      const picked = pickActiveEventSession(map.get(e.id) ?? []);
      return picked ? withEventSessionCostEstimation(picked) : null;
    })(),
  }));
}

const createEvent = async (creatorId: string, payload: ICreateEventPayload) => {
  const coverImage = payload.coverImage?.trim();
  if (!coverImage) {
    throw new Error('coverImage is required to create an event.');
  }
  const { repeatConfig, eventSession, coverImage: _omitCover, ...eventFields } = payload;
  const repeatFrequency = resolveRepeatFrequency(repeatConfig);
  const firstEventSession = payload.eventSession;
  const anchorDate = firstEventSession?.registrationDate
    ? new Date(firstEventSession.registrationDate)
    : repeatConfig?.startDate
      ? new Date(repeatConfig.startDate)
      : new Date();
  const resolvedSessionIdentity = resolveSessionIdentity({
    repeatFrequency,
    anchorDate,
    incomingYear: firstEventSession?.year,
    incomingLevel: firstEventSession?.sessionLevel,
  });
  const eventNameWithSuffix = buildEventNameWithSessionSuffix({
    baseEventName: payload.eventName,
    year: resolvedSessionIdentity.year,
    sessionLevel: resolvedSessionIdentity.sessionLevel,
    repeatFrequency,
    anchorDate,
  });
  const eventNameParts = extractEventNameParts(eventNameWithSuffix, payload.eventName);

  return database.$transaction(async tx => {
    const event = await tx.event.create({
      data: {
        ...eventFields,
        eventName: eventNameWithSuffix,
        baseEventName: payload.eventName.trim(),
        eventYear: eventNameParts.eventYear,
        eventSessionLabel: eventNameParts.eventSessionLabel,
        coverImage,
        creatorId,
        repeatConfig: repeatConfig
          ? {
              create: repeatConfigFields(repeatConfig),
            }
          : undefined,
      },
      select: { id: true },
    });

    if (eventSession) {
      const s = {
        ...eventSession,
        year: resolvedSessionIdentity.year,
        sessionLevel: resolvedSessionIdentity.sessionLevel ?? eventSession.sessionLevel,
      };
      let sessionId = s.sessionId;
      if (!sessionId && s.year) {
        const agg = await tx.session.aggregate({
          where: { year: s.year },
          _max: { sessionNumber: true },
        });
        const sessionNumber = (agg._max.sessionNumber ?? 0) + 1;
        const bucketFormat = defaultSessionBucketFormat(repeatFrequency);
        const level = s.sessionLevel?.trim();
        const autoIdentifier = buildSessionIdentifier({
          year: s.year,
          format: bucketFormat,
          anchorDate: new Date(s.registrationDate),
        });
        const baseIdentifier = level
          ? level.startsWith(`${s.year}-`)
            ? level
            : `${s.year}-${level}`
          : autoIdentifier;
        const existingSession = await tx.session.findUnique({
          where: { sessionIdentifier: baseIdentifier },
          select: { id: true },
        });
        if (existingSession) {
          sessionId = existingSession.id;
        } else {
          const createdSession = await tx.session.create({
            data: {
              sessionIdentifier: baseIdentifier,
              sessionNumber,
              year: s.year,
              bucketFormat,
            },
          });
          sessionId = createdSession.id;
        }
      }

      await tx.eventSession.create({
        data: {
          eventId: event.id,
          sessionId: sessionId!,
          competitionLevel: s.competitionLevel,
          eventType: s.eventType,
          registrationDate: new Date(s.registrationDate),
          deadline: new Date(s.deadline),
          cost: toDecimal(s.cost),
          hasFinalDeadline: s.hasFinalDeadline ?? false,
          finalDeadline: s.finalDeadline ? new Date(s.finalDeadline) : null,
          lateFee: toDecimal(s.lateFee ?? 0),
          status: s.status ?? SessionStatus.Unverified,
          isSharedToCommunity: s.isSharedToCommunity ?? false,
          isUserAgreementAccepted: s.isUserAgreementAccepted ?? false,
          autoGenerated: false,
          isCurrentSession: true,
          groups: eventGroupsToNestedCreate(s.groups),
        },
      });
    }

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
    where: { id, deletedAt: null },
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
      isPublished: true,
      isActive: true,
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
      eventSession: {
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
          status: true,
          isCurrentSession: true,
          session: { select: { id: true, sessionIdentifier: true, year: true, sessionNumber: true } },
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
        },
      },
      results: {
        include: {
          session: { select: { id: true, sessionIdentifier: true, year: true, sessionNumber: true } },
        },
        orderBy: { createdAt: 'desc' as const },
      },
      _count: { select: { applications: true } },
    },
  });
  if (!event) return null;
  return {
    ...event,
    eventSession: event.eventSession ? withEventSessionCostEstimation(event.eventSession) : null,
  };
};

const getEventBare = async (id: string) => {
  return database.event.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      eventName: true,
      creatorId: true,
      isLocked: true,
      deletedAt: true,
      coverImage: true,
      version: true,
    },
  });
};

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
  isLocked: true,
  coverImage: true,
  repeatConfig: true,
  eventSession: {
    select: {
      id: true,
      competitionLevel: true,
      eventType: true,
      registrationDate: true,
      deadline: true,
      cost: true,
      status: true,
      hasFinalDeadline: true,
      finalDeadline: true,
      lateFee: true,
      isSharedToCommunity: true,
      isUserAgreementAccepted: true,
      autoGenerated: true,
    },
  },
} as const;

const getEventAuditSnapshot = async (id: string) => {
  return database.event.findFirst({
    where: { id, deletedAt: null },
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
  options: PaginationOptions
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (filters.programId) {
    where.programId = filters.programId;
  }

  if (filters.location) {
    where.location = { contains: filters.location, mode: 'insensitive' };
  }

  if (filters.search) {
    where.OR = [
      { eventName: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
      { organizer: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const sessionParts: Prisma.EventSessionWhereInput[] = [];
  if (filters.eventType) {
    sessionParts.push({ eventType: filters.eventType });
  }
  if (filters.groupCriteria) {
    sessionParts.push({
      groups: { some: { criteria: filters.groupCriteria } },
    });
  }
  if (filters.timeRangeFrom && filters.timeRangeTo) {
    const from = new Date(filters.timeRangeFrom);
    const to = new Date(filters.timeRangeTo);
    sessionParts.push({
      AND: [{ registrationDate: { lte: to } }, { deadline: { gte: from } }],
    });
  }
  if (filters.sessionScope) {
    sessionParts.push(sessionScopeWhereInput(filters.sessionScope));
  }
  const priceWhere = priceRangeOnSession(filters.priceMin, filters.priceMax);
  if (priceWhere) {
    sessionParts.push(priceWhere);
  }

  if (sessionParts.length > 0) {
    where.eventSession = { is: { AND: sessionParts } };
  }

  const [data, total] = await Promise.all([
    database.event.findMany({
      where: where as any,
      select: eventListSelect,
      skip,
      take,
      orderBy,
    }),
    database.event.count({ where: where as any }),
  ]);

  const enriched = await attachActiveSessions(data);
  return createPaginationResult(enriched, total, pagination);
};

const getActiveEvents = async (
  options: PaginationOptions,
  price?: IFeedPriceFilters
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);
  const priceWhere = priceRangeOnSession(price?.priceMin, price?.priceMax);
  const where: Record<string, unknown> = {
    ...publishedEventBaseWhere,
    ...(priceWhere
      ? {
          eventSession: {
            is: priceWhere,
          },
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    database.event.findMany({
      where: where as any,
      select: eventListSelect,
      skip,
      take,
      orderBy,
    }),
    database.event.count({ where: where as any }),
  ]);

  const enriched = await attachActiveSessions(data);
  return createPaginationResult(enriched, total, pagination);
};

const getUpcomingEvents = async (
  options: PaginationOptions,
  price?: IFeedPriceFilters
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);
  const now = new Date();
  const priceWhere = priceRangeOnSession(price?.priceMin, price?.priceMax);
  const sessionAnd: Prisma.EventSessionWhereInput[] = [
    { deadline: { gte: now } },
    { status: { notIn: [SessionStatus.Completed, SessionStatus.Cancelled] } },
  ];
  if (priceWhere) sessionAnd.push(priceWhere);

  const where: Record<string, unknown> = {
    ...publishedEventBaseWhere,
    eventSession: {
      is: { AND: sessionAnd },
    },
  };

  const [data, total] = await Promise.all([
    database.event.findMany({
      where: where as any,
      select: eventListSelect,
      skip,
      take,
      orderBy,
    }),
    database.event.count({ where: where as any }),
  ]);

  const enriched = await attachActiveSessions(data);
  return createPaginationResult(enriched, total, pagination);
};

const getFeedToday = async (
  options: PaginationOptions,
  price?: IFeedPriceFilters
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);
  const now = new Date();
  const startToday = startOfUtcDay(now);
  const endToday = endOfUtcDay(now);
  const priceWhere = priceRangeOnSession(price?.priceMin, price?.priceMax);
  const sessionAnd: Prisma.EventSessionWhereInput[] = [
    { registrationDate: { lte: endToday } },
    { deadline: { gte: startToday } },
    { status: { notIn: [SessionStatus.Cancelled] } },
  ];
  if (priceWhere) sessionAnd.push(priceWhere);

  const where = {
    ...publishedEventBaseWhere,
    eventSession: { is: { AND: sessionAnd } },
  };

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

  const enriched = await attachActiveSessions(data);
  return createPaginationResult(enriched, total, pagination);
};

const getFeedHistory = async (
  options: PaginationOptions,
  price?: IFeedPriceFilters
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);
  const priceWhere = priceRangeOnSession(price?.priceMin, price?.priceMax);
  const sessionAnd: Prisma.EventSessionWhereInput[] = [sessionScopeWhereInput('history')];
  if (priceWhere) sessionAnd.push(priceWhere);

  const where = {
    ...publishedEventBaseWhere,
    eventSession: { is: { AND: sessionAnd } },
  };

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

  const enriched = await attachActiveSessions(data);
  return createPaginationResult(enriched, total, pagination);
};

const updateEventById = async (id: string, data: Record<string, unknown>) => {
  return database.event.update({
    where: { id },
    data: data as any,
    select: eventListSelect,
  });
};

const updateCurrentEventSessionForEvent = async (
  eventId: string,
  patch: IUpdateCurrentEventSessionPayload
) => {
  const current = await database.eventSession.findFirst({
    where: { eventId },
    select: { id: true },
  });
  if (!current) {
    return null;
  }

  const data: Prisma.EventSessionUpdateInput = {};
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
  if (patch.status !== undefined) {
    data.status = patch.status;
  }
  if (patch.isSharedToCommunity !== undefined) {
    data.isSharedToCommunity = patch.isSharedToCommunity;
  }
  if (patch.isUserAgreementAccepted !== undefined) {
    data.isUserAgreementAccepted = patch.isUserAgreementAccepted;
  }
  if (patch.autoGenerated !== undefined) {
    data.autoGenerated = patch.autoGenerated;
  }

  if (Object.keys(data).length === 0) {
    return null;
  }

  const updated = await database.eventSession.update({
    where: { id: current.id },
    data,
    include: {
      session: { select: { id: true, sessionIdentifier: true, year: true, sessionNumber: true } },
      groups: { include: { rounds: true } },
    },
  });
  return withEventSessionCostEstimation(updated);
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
    data: { deletedAt: new Date(), isActive: false },
    select: { id: true, deletedAt: true },
  });
};

const verifyCurrentSessionForEvent = async (eventId: string) => {
  const current = await database.eventSession.findFirst({
    where: { eventId },
    include: {
      session: { select: { id: true, sessionIdentifier: true, year: true, sessionNumber: true } },
      groups: { include: { rounds: true } },
    },
  });
  if (!current) {
    return null;
  }
  if (current.status !== SessionStatus.Unverified) {
    return withEventSessionCostEstimation(current);
  }
  const updated = await database.eventSession.update({
    where: { id: current.id },
    data: { status: SessionStatus.Published },
    include: {
      session: { select: { id: true, sessionIdentifier: true, year: true, sessionNumber: true } },
      groups: { include: { rounds: true } },
    },
  });
  return withEventSessionCostEstimation(updated);
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
  createEvent,
  getEventById,
  getEventBare,
  getEventAuditSnapshot,
  createEditLog,
  getEvents,
  getActiveEvents,
  getUpcomingEvents,
  getFeedToday,
  getFeedHistory,
  updateEventById,
  updateCurrentEventSessionForEvent,
  upsertRepeatConfig,
  deleteRepeatConfigByEventId,
  softDeleteEvent,
  verifyCurrentSessionForEvent,
  programExists,
  sessionsExist,
};
