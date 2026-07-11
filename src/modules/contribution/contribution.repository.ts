import { Prisma } from '../../../prisma/generated/client';
import { EventType, GroupCriteria, PlacementType, RoundCondition } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import {
  createPaginationQuery,
  createPaginationResult,
  PaginationOptions,
  parsePaginationOptions,
} from '../../utils/paginate';
import {
  bandRangeForSlug,
  buildAgeBandGroupWhere,
  CATEGORY_GROUP_SLUGS,
  inferCategoryGroupSlugFromAgeRows,
  normalizeCategoryGroupSlug,
  type CategoryGroupSlug,
} from '../event/event.helpers';
import { publishedEventBaseWhere } from '../event/event.utils';
import {
  contributionMetaLabel,
  decimalToNumber,
  formatHistoryLabel,
} from './contribution.helpers';
import type {
  ContributionTimeRange,
  IContributionCard,
  IContributionFilterOptions,
  IContributionListFilters,
  IContributionListMeta,
} from './contribution.interface';

const contributionListSelect = {
  id: true,
  eventName: true,
  coverImage: true,
  location: true,
  eventYear: true,
  programId: true,
  program: { select: { id: true, name: true } },
  schedule: {
    select: {
      eventType: true,
      cost: true,
      deadline: true,
    },
  },
  results: {
    select: {
      placement: true,
      note: true,
    },
  },
} as const;

const applySearch = (where: Prisma.EventWhereInput, search?: string): Prisma.EventWhereInput => {
  const term = search?.trim();
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

const buildTimeRangeWhere = (timeRange?: ContributionTimeRange): Prisma.EventWhereInput | null => {
  if (!timeRange) {
    return null;
  }

  const now = new Date();

  if (timeRange === 'last30days') {
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      schedule: {
        is: {
          deadline: { gte: from },
        },
      },
    };
  }

  if (timeRange === 'past3months') {
    const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    return {
      schedule: {
        is: {
          deadline: { gte: from },
        },
      },
    };
  }

  const year = timeRange;
  const yearStart = new Date(Date.UTC(Number(year), 0, 1, 0, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(Number(year), 11, 31, 23, 59, 59, 999));

  return {
    OR: [
      { eventYear: year },
      {
        schedule: {
          is: {
            deadline: { gte: yearStart, lte: yearEnd },
          },
        },
      },
    ],
  };
};

const buildContributionWhere = (filters?: IContributionListFilters): Prisma.EventWhereInput => {
  let where: Prisma.EventWhereInput = { ...publishedEventBaseWhere };

  const scheduleAnd: Prisma.EventScheduleWhereInput[] = [];

  if (filters?.type) {
    scheduleAnd.push({ eventType: filters.type });
  }

  if (scheduleAnd.length) {
    where = {
      AND: [
        where,
        {
          schedule: {
            is: { AND: scheduleAnd },
          },
        },
      ],
    };
  }

  if (filters?.programId?.trim()) {
    where = { AND: [where, { programId: filters.programId.trim() }] };
  } else if (filters?.program?.trim()) {
    const programTerm = filters.program.trim();
    where = {
      AND: [
        where,
        {
          program: {
            isDeleted: false,
            OR: [
              { id: programTerm },
              { name: { equals: programTerm, mode: 'insensitive' } },
              { name: { contains: programTerm, mode: 'insensitive' } },
            ],
          },
        },
      ],
    };
  }

  if (filters?.location?.trim()) {
    where = {
      AND: [where, { location: { contains: filters.location.trim(), mode: 'insensitive' } }],
    };
  }

  const categorySlug = normalizeCategoryGroupSlug(filters?.categoryGroup);
  if (categorySlug) {
    const { lo, hi } = bandRangeForSlug(categorySlug);
    where = { AND: [where, { groups: { some: buildAgeBandGroupWhere(lo, hi) } }] };
  }

  const timeWhere = buildTimeRangeWhere(filters?.timeRange);
  if (timeWhere) {
    where = { AND: [where, timeWhere] };
  }

  return applySearch(where, filters?.search);
};

const attachCategoryGroups = async <T extends { id: string }>(
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

  for (const row of ageRows) {
    const arr = byEvent.get(row.eventId) ?? [];
    arr.push({ criteria: row.criteria, condition: row.condition, value: row.value });
    byEvent.set(row.eventId, arr);
  }

  return events.map(e => ({
    ...e,
    categoryGroup: inferCategoryGroupSlugFromAgeRows(byEvent.get(e.id) ?? []),
  }));
};

type ContributionRow = {
  id: string;
  eventName: string;
  coverImage: string;
  location: string | null;
  eventYear: string | null;
  programId: string;
  program: { id: string; name: string } | null;
  schedule: {
    eventType: EventType;
    cost: Prisma.Decimal | number | string;
    deadline: Date;
  } | null;
  results: Array<{ placement: PlacementType; note: string | null }>;
  categoryGroup: CategoryGroupSlug | null;
};

const toCard = (row: ContributionRow): IContributionCard => ({
  id: row.id,
  title: row.eventName,
  imageUrl: row.coverImage,
  type: row.schedule?.eventType ?? null,
  location: row.location,
  history: formatHistoryLabel(row.eventYear, row.results),
  cost: decimalToNumber(row.schedule?.cost ?? null),
  deadline: row.schedule?.deadline ? row.schedule.deadline.toISOString() : null,
  program: row.program ? { id: row.program.id, name: row.program.name } : null,
  categoryGroup: row.categoryGroup,
});

const getContributions = async (
  filters: IContributionListFilters | undefined,
  options: PaginationOptions
): Promise<{ data: IContributionCard[]; meta: IContributionListMeta }> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);
  const where = buildContributionWhere(filters);

  const [rows, total] = await Promise.all([
    database.event.findMany({
      where,
      select: contributionListSelect,
      skip,
      take,
      orderBy,
    }),
    database.event.count({ where }),
  ]);

  const withCategory = await attachCategoryGroups(rows);
  const data = withCategory.map(row => toCard(row as ContributionRow));
  const pageResult = createPaginationResult(data, total, pagination);

  return {
    data: pageResult.data,
    meta: {
      ...pageResult.meta,
      label: contributionMetaLabel(filters?.timeRange),
    },
  };
};

const getFilterOptions = async (): Promise<IContributionFilterOptions> => {
  const programs = await database.program.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return {
    programs,
    types: [
      { value: EventType.Onsite, label: 'Onsite' },
      { value: EventType.Online, label: 'Online' },
      { value: EventType.Hybrid, label: 'Hybrid' },
    ],
    categoryGroups: [
      { value: CATEGORY_GROUP_SLUGS[0], label: '6 Year - 10 Year' },
      { value: CATEGORY_GROUP_SLUGS[1], label: '11 Year - 16 Year' },
      { value: CATEGORY_GROUP_SLUGS[2], label: '17 Year +' },
    ],
    timeRanges: [
      { value: 'last30days', label: 'Last 30 Days' },
      { value: 'past3months', label: 'Past 3 Months' },
      { value: '2024', label: '2024' },
      { value: '2023', label: '2023' },
      { value: '2022', label: '2022' },
      { value: '2021', label: '2021' },
    ],
  };
};

export const ContributionRepository = {
  getContributions,
  getFilterOptions,
};
