import { Prisma } from '../../../prisma/generated/client';
import { GroupCriteria, RoundCondition } from '../../../prisma/generated/enums';
import type {
  EventScheduleListScope,
  IUpdateCurrentSchedulePayload,
  IUpdateEventPayload,
} from './event.interface';
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
    changedFields.push('schedule');
    previousValues.schedule = args.before.schedule ?? null;
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
  switch (scope) {
    case 'today':
      return {
        AND: [{ deadline: { gte: startToday } }, { registrationDate: { lte: endToday } }],
      };
    case 'upcoming':
      return {
        AND: [{ registrationDate: { gt: endToday } }, { deadline: { gte: startToday } }],
      };
    case 'history':
      return {
        AND: [{ deadline: { lt: startToday } }],
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

export function hasSchedulePatchBody(
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

const AGE_CAP = 120;

export const CATEGORY_GROUP_SLUGS = ['6year-10year', '11year-16year', '17year+'] as const;
export type CategoryGroupSlug = (typeof CATEGORY_GROUP_SLUGS)[number];

const BAND_BY_SLUG: Record<CategoryGroupSlug, { lo: number; hi: number }> = {
  '6year-10year': { lo: 6, hi: 10 },
  '11year-16year': { lo: 11, hi: 16 },
  '17year+': { lo: 17, hi: AGE_CAP },
};

export function normalizeCategoryGroupSlug(raw?: string | null): CategoryGroupSlug | null {
  if (!raw?.trim()) {
    return null;
  }
  const key = raw.trim().toLowerCase().replace(/\s+/g, '');
  const aliases: Record<string, CategoryGroupSlug> = {
    '6year-10year': '6year-10year',
    '6-10': '6year-10year',
    '6to10': '6year-10year',
    '11year-16year': '11year-16year',
    '11-16': '11year-16year',
    '11to16': '11year-16year',
    '17year+': '17year+',
    '17+': '17year+',
    '17yearplus': '17year+',
  };
  const mapped = aliases[key];
  if (mapped) {
    return mapped;
  }
  return (CATEGORY_GROUP_SLUGS as readonly string[]).includes(key) ? (key as CategoryGroupSlug) : null;
}

export function bandRangeForSlug(slug: CategoryGroupSlug): { lo: number; hi: number } {
  return BAND_BY_SLUG[slug];
}

export function ageRowToYearRange(row: { condition: RoundCondition; value: number }): { lo: number; hi: number } | null {
  const v = row.value;
  switch (row.condition) {
    case RoundCondition.GreaterAndEqual:
      return { lo: v, hi: AGE_CAP };
    case RoundCondition.Greater:
      return { lo: v + 1, hi: AGE_CAP };
    case RoundCondition.LowerAndEqual:
      return { lo: 0, hi: v };
    case RoundCondition.Lower:
      return { lo: 0, hi: Math.max(0, v - 1) };
    case RoundCondition.UpTo:
      return { lo: 0, hi: v };
    case RoundCondition.DownTo:
      return { lo: v, hi: AGE_CAP };
    default:
      return null;
  }
}

function mergeYearRanges(ranges: { lo: number; hi: number }[]): { lo: number; hi: number }[] {
  if (!ranges.length) {
    return [];
  }
  const sorted = [...ranges].sort((a, b) => a.lo - b.lo);
  const out: { lo: number; hi: number }[] = [];
  let cur = { ...sorted[0] };
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i];
    if (n.lo <= cur.hi + 1) {
      cur.hi = Math.max(cur.hi, n.hi);
    } else {
      out.push(cur);
      cur = { ...n };
    }
  }
  out.push(cur);
  return out;
}

function overlapSize(a: { lo: number; hi: number }, b: { lo: number; hi: number }): number {
  const lo = Math.max(a.lo, b.lo);
  const hi = Math.min(a.hi, b.hi);
  return lo <= hi ? hi - lo + 1 : 0;
}

export function inferCategoryGroupSlugFromAgeRows(
  rows: Array<{ criteria: GroupCriteria; condition: RoundCondition; value: number }>
): CategoryGroupSlug | null {
  const ageRows = rows.filter(r => r.criteria === GroupCriteria.Age);
  if (!ageRows.length) {
    return null;
  }
  const ranges = ageRows.map(r => ageRowToYearRange(r)).filter((x): x is { lo: number; hi: number } => x !== null);
  if (!ranges.length) {
    return null;
  }
  const merged = mergeYearRanges(ranges);
  let best: CategoryGroupSlug | null = null;
  let bestScore = 0;
  for (const slug of CATEGORY_GROUP_SLUGS) {
    const band = BAND_BY_SLUG[slug];
    let score = 0;
    for (const r of merged) {
      score += overlapSize(r, band);
    }
    if (score > bestScore) {
      bestScore = score;
      best = slug;
    }
  }
  return bestScore > 0 ? best : null;
}

export function buildAgeBandGroupWhere(lo: number, hi: number): Prisma.EventGroupWhereInput {
  return {
    criteria: GroupCriteria.Age,
    OR: [
      { AND: [{ condition: RoundCondition.GreaterAndEqual }, { value: { lte: hi } }] },
      { AND: [{ condition: RoundCondition.Greater }, { value: { lte: Math.max(0, hi - 1) } }] },
      { AND: [{ condition: RoundCondition.LowerAndEqual }, { value: { gte: lo } }] },
      { AND: [{ condition: RoundCondition.Lower }, { value: { gte: lo + 1 } }] },
      { AND: [{ condition: RoundCondition.UpTo }, { value: { gte: lo } }] },
      { AND: [{ condition: RoundCondition.DownTo }, { value: { lte: hi } }] },
    ],
  };
}
