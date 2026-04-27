import { Prisma } from '../../../prisma/generated/client';
import { RepeatFrequency, SessionBucketType } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import { IEventGroupInput, IRepeatConfigInput } from './event.interface';
import { pickActiveScheduleForEvent } from './event.helpers';

export const toDecimal = (value: string | number | undefined | null): Prisma.Decimal => {
  if (value === undefined || value === null || value === '') {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(String(value));
};

export const eventGroupsToNestedCreate = (groups: IEventGroupInput[] | undefined) => {
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

const WEEKDAY_NAME_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const weekOfYearUtc = (date: Date) => {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const diffDays = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return Math.floor(diffDays / 7) + 1;
};

export const resolveRepeatFrequency = (input?: IRepeatConfigInput | null): RepeatFrequency =>
  input?.repeatFunction ?? RepeatFrequency.DontRepeat;

export const sessionTypeFromRepeatFrequency = (
  frequency: RepeatFrequency
): SessionBucketType => {
  switch (frequency) {
    case RepeatFrequency.Daily:
      return SessionBucketType.Daily;
    case RepeatFrequency.Weekly:
      return SessionBucketType.Weekly;
    case RepeatFrequency.Monthly:
      return SessionBucketType.Monthly;
    case RepeatFrequency.Quarterly:
      return SessionBucketType.Quarterly;
    case RepeatFrequency.Yearly:
      return SessionBucketType.Yearly;
    case RepeatFrequency.Custom:
      return SessionBucketType.Custom;
    case RepeatFrequency.DontRepeat:
    default:
      return SessionBucketType.Custom;
  }
};

export const frequencySuffix = (frequency: RepeatFrequency, anchorDate: Date) => {
  switch (frequency) {
    case RepeatFrequency.Daily:
      return WEEKDAY_NAME_EN[anchorDate.getUTCDay()] ?? 'Day';
    case RepeatFrequency.Weekly:
      return `Week${weekOfYearUtc(anchorDate)}`;
    case RepeatFrequency.Monthly:
      return MONTH_FULL[anchorDate.getUTCMonth()];
    case RepeatFrequency.Quarterly:
      return `Q${Math.floor(anchorDate.getUTCMonth() / 3) + 1}`;
    case RepeatFrequency.Yearly:
      return 'Year';
    case RepeatFrequency.Custom:
      return WEEKDAY_NAME_EN[anchorDate.getUTCDay()] ?? 'Day';
    default:
      return 'Session1';
  }
};

export const extractEventNameParts = (fullEventName: string, baseEventName: string) => {
  const normalizedBase = baseEventName.trim();
  const prefix = `${normalizedBase}-`;
  if (!fullEventName.startsWith(prefix)) {
    return { eventYear: null as string | null, scheduleLabel: null as string | null };
  }
  const suffix = fullEventName.slice(prefix.length);
  const [eventYear, ...rest] = suffix.split('-');
  const scheduleLabel = rest.join('-') || null;
  return {
    eventYear: eventYear || null,
    scheduleLabel,
  };
};

/** Advance `from` by one logical period for the given repeat frequency. */
export const addRepeatInterval = (from: Date, frequency: RepeatFrequency): Date => {
  switch (frequency) {
    case RepeatFrequency.Daily:
      return addDays(from, 1);
    case RepeatFrequency.Weekly:
      return addDays(from, 7);
    case RepeatFrequency.Monthly:
      return addMonths(from, 1);
    case RepeatFrequency.Quarterly:
      return addMonths(from, 3);
    case RepeatFrequency.Yearly:
      return addYears(from, 1);
    case RepeatFrequency.Custom:
      return addDays(from, 1);
    case RepeatFrequency.DontRepeat:
    default:
      return new Date(from.getTime());
  }
};

const computeNextAutoGenerateDate = (input: IRepeatConfigInput): Date | null => {
  const frequency = resolveRepeatFrequency(input);
  if (frequency === RepeatFrequency.DontRepeat) return null;

  const base = input.startDate ? new Date(input.startDate) : new Date();
  return addRepeatInterval(base, frequency);
};

/** Naming + catalog session key for a repeating occurrence (same rules as manual create). */
export const computeRepeatingEventNaming = (
  baseEventName: string,
  anchorDate: Date,
  repeatFrequency: RepeatFrequency
) => {
  const trimmedBase = baseEventName.trim();
  const autoValue = frequencySuffix(repeatFrequency, anchorDate);
  const yearForEvent = String(anchorDate.getUTCFullYear());
  const sessionTypeForEvent = sessionTypeFromRepeatFrequency(repeatFrequency);
  const isYearlySession = sessionTypeForEvent === SessionBucketType.Yearly;
  const sessionValueForEvent = autoValue;
  const suffixForEvent = autoValue;
  const sessionLevelForEvent = isYearlySession ? yearForEvent : `${yearForEvent}-${suffixForEvent}`;
  const eventNameWithSuffix = isYearlySession
    ? `${trimmedBase}-${yearForEvent}`
    : `${trimmedBase}-${yearForEvent}-${suffixForEvent}`;
  const eventNameParts = extractEventNameParts(eventNameWithSuffix, trimmedBase);
  return {
    yearForEvent,
    sessionTypeForEvent,
    sessionValueForEvent,
    sessionLevelForEvent,
    eventNameWithSuffix,
    eventNameParts,
  };
};

export const repeatConfigFields = (input: IRepeatConfigInput) => ({
  frequency: resolveRepeatFrequency(input),
  startDate: input.startDate ? new Date(input.startDate) : null,
  nextAutoGenerateDate: computeNextAutoGenerateDate(input),
});

export const sessionIncludeWithYearLevel = {
  id: true,
  session: true,
  sessionValue: true,
  sessionLevel: true,
  year: true,
  creationMode: true,
} as const;

export const eventListSelect = {
  id: true,
  eventName: true,
  coverImage: true,
  programId: true,
  organizer: true,
  location: true,
  isPublished: true,
  isActive: true,
  isVerified: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  sessionId: true,
  catalogSession: { select: sessionIncludeWithYearLevel },
  program: { select: { id: true, name: true, imageUrl: true } },
} as const;

export const publishedEventBaseWhere = {
  deletedAt: null,
  isDeleted: false,
  isActive: true,
  isPublished: true,
} as const;

const scheduleForActivePickSelect = {
  eventId: true,
  id: true,
  registrationDate: true,
  deadline: true,
  cost: true,
  eventType: true,
  competitionLevel: true,
} as const;

type EventScheduleForActiveRow = Prisma.EventScheduleGetPayload<{
  select: typeof scheduleForActivePickSelect;
}>;

async function schedulesByEventIdMap(eventIds: string[]) {
  const map = new Map<string, EventScheduleForActiveRow[]>();
  if (!eventIds.length) return map;
  const rows = await database.eventSchedule.findMany({
    where: { eventId: { in: eventIds } },
    select: scheduleForActivePickSelect,
    orderBy: { deadline: 'asc' as const },
  });
  for (const r of rows) {
    const arr = map.get(r.eventId) ?? [];
    arr.push(r);
    map.set(r.eventId, arr);
  }
  return map;
}

export async function attachActiveSchedules<
  T extends { id: string; catalogSession?: unknown },
>(events: T[]) {
  const map = await schedulesByEventIdMap(events.map(e => e.id));
  return events.map(e => ({
    ...e,
    schedule: (() => {
      const picked = pickActiveScheduleForEvent(map.get(e.id) ?? []);
      if (!picked) return null;
      return { ...picked, catalogSession: e.catalogSession };
    })(),
  }));
}

/** Schedule row + catalog/groups when loading with `Event` includes (detail / patch response). */
export const scheduleIncludeWithMeta = {
  groups: { include: { rounds: true } },
} as const;

export const scheduleForVerifyInclude = {
  groups: { include: { rounds: true } },
} as const;
