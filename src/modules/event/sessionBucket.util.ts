import { RepeatFrequency, SessionBucketFormat } from '../../../prisma/generated/enums';

const MONTH_MMM = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

export function defaultSessionBucketFormat(
  repeatFrequency?: RepeatFrequency | null
): SessionBucketFormat {
  switch (repeatFrequency) {
    case RepeatFrequency.Monthly:
      return SessionBucketFormat.Year_MMM;
    case RepeatFrequency.Quarterly:
      return SessionBucketFormat.Year_Q;
    case RepeatFrequency.Yearly:
      return SessionBucketFormat.Year_Only;
    case RepeatFrequency.Weekly:
      return SessionBucketFormat.Year_ISOWeek;
    case RepeatFrequency.Daily:
      return SessionBucketFormat.Year_Month_Day;
    case RepeatFrequency.Custom:
      return SessionBucketFormat.Year_MM;
    case RepeatFrequency.DontRepeat:
    default:
      return SessionBucketFormat.Year_Only;
  }
}

export type BuildSessionIdentifierParams = {
  year: string;
  format: SessionBucketFormat;
  bucketQuarter?: number | null;
  bucketMonth?: number | null;
  bucketDate?: Date | null;
};

function formatIsoWeekLabel(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const isoYear = t.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7) || 1;
  return `${isoYear}-W${pad2(week)}`;
}

const calendarYearFromLabel = (yearLabel: string): number | null => {
  const n = parseInt(yearLabel.trim(), 10);
  if (!Number.isFinite(n) || n < 1000 || n > 9999) return null;
  return n;
};

export function buildSessionIdentifier(params: BuildSessionIdentifierParams): string {
  const y = params.year.trim();
  const now = new Date();
  const yNum = calendarYearFromLabel(y);

  switch (params.format) {
    case SessionBucketFormat.Year_Only:
      return y;
    case SessionBucketFormat.Year_Q: {
      const ref = params.bucketDate ?? (yNum !== null ? new Date(Date.UTC(yNum, 0, 15)) : now);
      const q =
        params.bucketQuarter ??
        (Number.isFinite(ref.getMonth()) ? Math.floor(ref.getMonth() / 3) + 1 : 1);
      const clamped = Math.min(4, Math.max(1, q));
      return `${y}-Q${clamped}`;
    }
    case SessionBucketFormat.Year_MMM: {
      const m =
        params.bucketMonth ??
        (params.bucketDate
          ? params.bucketDate.getMonth() + 1
          : yNum !== null
            ? 1
            : now.getMonth() + 1);
      const clamped = Math.min(12, Math.max(1, m));
      return `${y}-${MONTH_MMM[clamped - 1]}`;
    }
    case SessionBucketFormat.Year_MM: {
      const m =
        params.bucketMonth ??
        (params.bucketDate
          ? params.bucketDate.getMonth() + 1
          : yNum !== null
            ? 1
            : now.getMonth() + 1);
      const clamped = Math.min(12, Math.max(1, m));
      return `${y}-${pad2(clamped)}`;
    }
    case SessionBucketFormat.Year_Month_Day: {
      if (params.bucketDate) {
        const d = params.bucketDate;
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      }
      if (yNum !== null) {
        return `${yNum}-01-01`;
      }
      const d = now;
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
    case SessionBucketFormat.Year_ISOWeek: {
      const ref =
        params.bucketDate ??
        (yNum !== null ? new Date(Date.UTC(yNum, 0, 4)) : now);
      return formatIsoWeekLabel(ref);
    }
    default:
      return y;
  }
}
