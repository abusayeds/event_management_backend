import { DonationPaymentStatus } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import {
  IDashboardOverviewData,
  IIncomeRatioData,
  IUserRatioData,
} from './dashboard.interface';

const getOverview = async (recentDays: number): Promise<IDashboardOverviewData> => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (recentDays - 1));

  const [totalUsers, totalDonationSum, totalCategories, recentUsers] = await Promise.all([
    database.user.count({
      where: {
        status: {
          not: 'DELETED',
        },
      },
    }),
    database.donationTransaction.aggregate({
      where: {
        paymentStatus: DonationPaymentStatus.Succeeded,
      },
      _sum: {
        amount: true,
      },
    }),
    database.category.count({
      where: {
        isDeleted: false,
      },
    }),
    database.user.count({
      where: {
        status: {
          not: 'DELETED',
        },
        createdAt: {
          gte: start,
        },
      },
    }),
  ]);

  return {
    totalUsers,
    totalDonation: Number(totalDonationSum._sum.amount ?? 0),
    totalCategories,
    recentUsers,
  };
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getIncomeRatio = async (year: number): Promise<IIncomeRatioData> => {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));

  const rows = await database.donationTransaction.findMany({
    where: {
      paymentStatus: DonationPaymentStatus.Succeeded,
      createdAt: {
        gte: start,
        lt: end,
      },
    },
    select: {
      amount: true,
      createdAt: true,
    },
  });

  const monthly = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    monthLabel: MONTH_LABELS[i]!,
    amount: 0,
  }));

  for (const row of rows) {
    const monthIndex = row.createdAt.getUTCMonth();
    monthly[monthIndex]!.amount += Number(row.amount);
  }

  const totalAmount = monthly.reduce((sum, item) => sum + item.amount, 0);

  return {
    year,
    currency: 'USD',
    items: monthly,
    totalAmount,
  };
};

const getUserRatio = async (year: number, month: number): Promise<IUserRatioData> => {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  const [totalUsers, monthNewUsers] = await Promise.all([
    database.user.count({
      where: {
        status: {
          not: 'DELETED',
        },
      },
    }),
    database.user.count({
      where: {
        status: {
          not: 'DELETED',
        },
        createdAt: {
          gte: start,
          lt: end,
        },
      },
    }),
  ]);

  return {
    year,
    month,
    monthLabel: MONTH_LABELS[month - 1]!,
    totalUsers,
    monthNewUsers,
  };
};

export const DashboardRepository = {
  getOverview,
  getIncomeRatio,
  getUserRatio,
};
