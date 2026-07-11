import { PlacementType } from '../../../prisma/generated/enums';
import type { ContributionTimeRange } from './contribution.interface';

const PLACEMENT_RANK: Record<PlacementType, number> = {
  [PlacementType.First]: 1,
  [PlacementType.Gold]: 2,
  [PlacementType.Second]: 3,
  [PlacementType.Silver]: 4,
  [PlacementType.Third]: 5,
  [PlacementType.Bronze]: 6,
  [PlacementType.Fourth]: 7,
  [PlacementType.Finalist]: 8,
  [PlacementType.HonorableMention]: 9,
  [PlacementType.Participation]: 10,
};

const PLACEMENT_LABEL: Record<PlacementType, string> = {
  [PlacementType.First]: '1st winner',
  [PlacementType.Second]: '2nd winner',
  [PlacementType.Third]: '3rd winner',
  [PlacementType.Fourth]: '4th winner',
  [PlacementType.Gold]: 'Gold',
  [PlacementType.Silver]: 'Silver',
  [PlacementType.Bronze]: 'Bronze',
  [PlacementType.Finalist]: 'Finalist',
  [PlacementType.HonorableMention]: 'Honorable mention',
  [PlacementType.Participation]: 'Participation',
};

export function formatPlacementLabel(placement: PlacementType): string {
  return PLACEMENT_LABEL[placement] ?? placement;
}

export function pickBestPlacement(
  results: Array<{ placement: PlacementType }>
): PlacementType | null {
  if (!results.length) {
    return null;
  }
  return [...results].sort((a, b) => PLACEMENT_RANK[a.placement] - PLACEMENT_RANK[b.placement])[0]
    .placement;
}

export function formatHistoryLabel(
  eventYear: string | null | undefined,
  results: Array<{ placement: PlacementType }>
): string | null {
  const best = pickBestPlacement(results);
  if (best && eventYear?.trim()) {
    return `${eventYear.trim()}- ${formatPlacementLabel(best)}`;
  }
  if (best) {
    return formatPlacementLabel(best);
  }
  if (eventYear?.trim()) {
    return eventYear.trim();
  }
  return null;
}

export function contributionMetaLabel(timeRange?: ContributionTimeRange): string {
  switch (timeRange) {
    case 'last30days':
      return 'Last 30 Days Contribution';
    case 'past3months':
      return 'Past 3 Months Contribution';
    case '2024':
      return 'Year 2024 Contribution';
    case '2023':
      return 'Year 2023 Contribution';
    case '2022':
      return 'Year 2022 Contribution';
    case '2021':
      return 'Year 2021 Contribution';
    default:
      return 'All Contributions';
  }
}

export function decimalToNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    try {
      return (value as { toNumber: () => number }).toNumber();
    } catch {
      return Number(String(value));
    }
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
