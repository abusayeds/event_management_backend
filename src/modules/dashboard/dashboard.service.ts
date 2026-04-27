import {
  IDashboardOverviewData,
  IDashboardOverviewQuery,
  IIncomeRatioData,
  IIncomeRatioQuery,
  IUserRatioData,
  IUserRatioQuery,
} from './dashboard.interface';
import { DashboardRepository } from './dashboard.repository';

const toOptionalInt = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
};

const getOverview = async (query: IDashboardOverviewQuery): Promise<IDashboardOverviewData> => {
  const recentDays = toOptionalInt(query.recentDays) ?? 7;
  return DashboardRepository.getOverview(recentDays);
};

const getIncomeRatio = async (query: IIncomeRatioQuery): Promise<IIncomeRatioData> => {
  const year = toOptionalInt(query.year) ?? new Date().getUTCFullYear();
  return DashboardRepository.getIncomeRatio(year);
};

const getUserRatio = async (query: IUserRatioQuery): Promise<IUserRatioData> => {
  const now = new Date();
  const year = toOptionalInt(query.year) ?? now.getUTCFullYear();
  const month = toOptionalInt(query.month) ?? now.getUTCMonth() + 1;
  return DashboardRepository.getUserRatio(year, month);
};

export const DashboardService = {
  getOverview,
  getIncomeRatio,
  getUserRatio,
};
