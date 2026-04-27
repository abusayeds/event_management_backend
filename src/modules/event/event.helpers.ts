import { Prisma } from '../../../prisma/generated/client';
import type { IUpdateEventPayload, IUpdateCurrentSchedulePayload } from './event.interface';
import type { EventAuditSnapshot } from './event.repository';

const EDIT_LOG_SCALAR_FIELDS = [
  'programId',
  'organizer',
  'location',
  'eventPortal',
  'registrationPortal',
  'description',
  'note',
  'isPublished',
  'isActive',
  'isVerified',
  'coverImage',
  'isSharedToCommunity',
  'isUserAgreementAccepted',
] as const;

export type EventEditLogPayload = {
  newVersion: number;
  changedFields: string[];
  previousValues: Prisma.InputJsonValue;
};

export type EventScheduleListScope = 'today' | 'upcoming' | 'history';

export type SessionForActivePick = {
  id: string;
  registrationDate: Date;
  deadline: Date;
};

export type SessionForDetailPick = SessionForActivePick & {
  createdAt?: Date;
};

const toJsonColumnValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(
    JSON.stringify(value, (_k, val) => (typeof val === 'bigint' ? val.toString() : val))
  ) as Prisma.InputJsonValue;

const sameScalar = (before: unknown, after: unknown): boolean => {
  if (before === after) return true;
  if (before == null && after == null) return true;
  if (before == null || after == null) return false;
  if (typeof before === 'object' && typeof after === 'object' && before && after) {
    if ('equals' in before && typeof (before as { equals?: (x: unknown) => boolean }).equals === 'function') {
      try {
        return Boolean((before as { equals: (x: unknown) => boolean }).equals(after));
      } catch {
        return String(before) === String(after);
      }
    }
  }
  return false;
};

const sameRepeatJson = (before: unknown, incoming: unknown): boolean => {
  try {
    return JSON.stringify(before ?? null) === JSON.stringify(incoming ?? null);
  } catch {
    return false;
  }
};

export function diffEventForEditLog(args: {
  before: EventAuditSnapshot;
  scalarPatch: Record<string, unknown>;
  repeatInPayload: boolean;
  incomingRepeat: IUpdateEventPayload['repeatConfig'];
  sessionPatchRequested: boolean;
}): EventEditLogPayload | null {
  const changedFields: string[] = [];
  const previousValues: Record<string, unknown> = {};

  for (const key of EDIT_LOG_SCALAR_FIELDS) {
    if (!(key in args.scalarPatch)) continue;
    const nextVal = args.scalarPatch[key];
    const prevVal = args.before[key];
    if (!sameScalar(prevVal, nextVal)) {
      changedFields.push(key);
      previousValues[key] = prevVal ?? null;
    }
  }

  if (args.repeatInPayload && !sameRepeatJson(args.before.repeatConfig, args.incomingRepeat)) {
    changedFields.push('repeatConfig');
    previousValues.repeatConfig = args.before.repeatConfig ?? null;
  }

  if (args.sessionPatchRequested) {
    changedFields.push('currentSchedule');
    previousValues.currentSchedule = args.before.schedule ?? null;
  }

  if (!changedFields.length) return null;

  return {
    changedFields,
    previousValues: toJsonColumnValue(previousValues),
    newVersion: args.before.version + 1,
  };
}

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export function endOfUtcDay(d: Date): Date {
  const s = startOfUtcDay(d);
  return new Date(s.getTime() + 86400000 - 1);
}

export function addUtcDays(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

export function pickActiveScheduleForEvent<T extends SessionForActivePick>(
  schedules: T[],
  now: Date = new Date()
): T | null {
  if (!schedules.length) return null;

  const inWindow = schedules.filter(
    s => s.registrationDate.getTime() <= now.getTime() && s.deadline.getTime() >= now.getTime()
  );
  if (inWindow.length) {
    return [...inWindow].sort((a, b) => a.deadline.getTime() - b.deadline.getTime())[0];
  }

  const future = schedules
    .filter(s => s.deadline.getTime() >= now.getTime())
    .sort((a, b) => a.registrationDate.getTime() - b.registrationDate.getTime());
  if (future.length) return future[0];

  return [...schedules].sort((a, b) => b.deadline.getTime() - a.deadline.getTime())[0];
}

export function pickScheduleForDetail<T extends SessionForDetailPick>(
  sessions: T[],
  now: Date = new Date()
): T | null {
  if (!sessions.length) return null;

  const upcoming = sessions.filter(s => s.deadline.getTime() >= now.getTime());
  if (upcoming.length) {
    return [...upcoming].sort((a, b) => a.deadline.getTime() - b.deadline.getTime())[0];
  }

  const ended = sessions.filter(s => s.deadline.getTime() < now.getTime());
  if (ended.length) {
    return [...ended].sort((a, b) => b.deadline.getTime() - a.deadline.getTime())[0];
  }

  return [...sessions].sort((a, b) => b.deadline.getTime() - a.deadline.getTime())[0];
}

export function scheduleScopeWhereInput(
  scope: EventScheduleListScope,
  now: Date = new Date()
): Prisma.EventScheduleWhereInput {
  const startToday = startOfUtcDay(now);
  const endToday = endOfUtcDay(now);
  const startTomorrow = startOfUtcDay(addUtcDays(now, 1));

  switch (scope) {
    case 'today':
      return {
        AND: [{ registrationDate: { lte: endToday } }, { deadline: { gte: startToday } }],
      };
    case 'upcoming':
      return {
        AND: [{ deadline: { gte: startTomorrow } }],
      };
    case 'history':
      return {
        OR: [{ deadline: { lt: startToday } }],
      };
    default:
      return {};
  }
}

export function priceRangeOnSchedule(
  priceMin?: string | number | null,
  priceMax?: string | number | null
): Prisma.EventScheduleWhereInput | null {
  if (priceMin == null && priceMax == null) return null;
  const cost: { gte?: Prisma.Decimal; lte?: Prisma.Decimal } = {};
  if (priceMin != null && priceMin !== '') {
    cost.gte = new Prisma.Decimal(String(priceMin));
  }
  if (priceMax != null && priceMax !== '') {
    cost.lte = new Prisma.Decimal(String(priceMax));
  }
  return Object.keys(cost).length ? { cost } : null;
}

export function hasCurrentSchedulePatchBody(
  body: IUpdateCurrentSchedulePayload | undefined
): body is IUpdateCurrentSchedulePayload {
  return Boolean(body && typeof body === 'object' && Object.keys(body).length > 0);
}

const toFiniteNumber = (value: unknown): number => {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === 'object' && value && 'toNumber' in value) {
    try {
      const n = (value as { toNumber: () => number }).toNumber();
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }
  return 0;
};

export function withScheduleCostEstimation<
  T extends {
    cost?: unknown;
    groups?: Array<{
      rounds?: Array<{ cost?: unknown }>;
    }>;
  },
>(session: T): T & {
  estimatedCost: {
    competitionLevelCost: number;
    roundsTotalCost: number;
    groupsTotalCost: number;
    totalEstimatedCost: number;
  };
  groups?: Array<
    NonNullable<T['groups']>[number] & {
      totalRoundCost: number;
    }
  >;
} {
  const baseCost = toFiniteNumber(session.cost);
  const groups = (session.groups ?? []).map(g => {
    const totalRoundCost = (g.rounds ?? []).reduce((sum, r) => sum + toFiniteNumber(r.cost), 0);
    return {
      ...g,
      totalRoundCost,
    };
  });
  const roundsTotalCost = groups.reduce((sum, g) => sum + g.totalRoundCost, 0);
  return {
    ...session,
    groups: groups as any,
    estimatedCost: {
      competitionLevelCost: baseCost,
      roundsTotalCost,
      groupsTotalCost: roundsTotalCost,
      totalEstimatedCost: baseCost + roundsTotalCost,
    },
  };
}
