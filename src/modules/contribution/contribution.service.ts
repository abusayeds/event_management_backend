import { PaginationOptions } from '../../utils/paginate';
import type { IContributionListFilters } from './contribution.interface';
import { ContributionRepository } from './contribution.repository';

const getContributions = async (
  filters: IContributionListFilters | undefined,
  options: PaginationOptions
) => ContributionRepository.getContributions(filters, options);

const getFilterOptions = async () => ContributionRepository.getFilterOptions();

export const ContributionService = {
  getContributions,
  getFilterOptions,
};
