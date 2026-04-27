export interface IDashboardOverviewQuery {
  recentDays?: number;
}

export interface IIncomeRatioQuery {
  year?: number;
}

export interface IUserRatioQuery {
  year?: number;
  month?: number;
}

export interface IDashboardOverviewData {
  totalUsers: number;
  totalDonation: number;
  totalCategories: number;
  recentUsers: number;
}

export interface IIncomeRatioItem {
  month: number;
  monthLabel: string;
  amount: number;
}

export interface IIncomeRatioData {
  year: number;
  currency: string;
  items: IIncomeRatioItem[];
  totalAmount: number;
}

export interface IUserRatioData {
  year: number;
  month: number;
  monthLabel: string;
  totalUsers: number;
  monthNewUsers: number;
}
