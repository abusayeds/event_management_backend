import { EventType } from '../../../prisma/generated/enums';
import type { CategoryGroupSlug } from '../event/event.helpers';

export const CONTRIBUTION_TIME_RANGES = [
  'last30days',
  'past3months',
  '2024',
  '2023',
  '2022',
  '2021',
] as const;

export type ContributionTimeRange = (typeof CONTRIBUTION_TIME_RANGES)[number];

export interface IContributionListFilters {
  search?: string;
  programId?: string;
  program?: string;
  type?: EventType;
  location?: string;
  categoryGroup?: string;
  timeRange?: ContributionTimeRange;
}

export const CONTRIBUTION_LIST_QUERY_KEYS = [
  'search',
  'programId',
  'program',
  'type',
  'location',
  'categoryGroup',
  'timeRange',
] as const;

export interface IContributionCard {
  id: string;
  title: string;
  imageUrl: string;
  type: EventType | null;
  location: string | null;
  history: string | null;
  cost: number | null;
  deadline: string | null;
  program: { id: string; name: string } | null;
  categoryGroup: CategoryGroupSlug | null;
}

export interface IContributionListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  label: string;
}

export interface IContributionFilterOption {
  value: string;
  label: string;
}

export interface IContributionFilterOptions {
  programs: Array<{ id: string; name: string }>;
  types: IContributionFilterOption[];
  categoryGroups: IContributionFilterOption[];
  timeRanges: IContributionFilterOption[];
}
