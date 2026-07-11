import {
  EmailNotifyPreference,
  NotificationPreference,
} from '../../../prisma/generated/enums';

/** Only English is supported for display language. */
export const DISPLAY_LANGUAGE = 'en-US' as const;
export const DISPLAY_LANGUAGE_LABEL = 'English (US)' as const;

export const DATE_TIME_FORMAT_OPTIONS = [
  { value: 'MMM. dd yyyy HH:mm:ss', label: 'Dec. 01 2024 08:30:12' },
  { value: 'yyyy-MM-dd HH:mm:ss', label: '2024-12-01 08:30:12' },
  { value: 'dd/MM/yyyy HH:mm', label: '01/12/2024 08:30' },
  { value: 'MM/dd/yyyy hh:mm a', label: '12/01/2024 08:30 AM' },
] as const;

export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'CAD', label: 'CAD' },
  { value: 'AUD', label: 'AUD' },
  { value: 'BDT', label: 'BDT' },
] as const;

export const TIME_ZONE_OPTIONS = [
  { value: 'UTC', label: '(UTC+00:00) UTC' },
  { value: 'America/New_York', label: '(UTC-05:00) Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: '(UTC-06:00) Central Time (US & Canada)' },
  { value: 'America/Denver', label: '(UTC-07:00) Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: '(UTC-08:00) Pacific Time (US & Canada)' },
  { value: 'Europe/London', label: '(UTC+00:00) London' },
  { value: 'Asia/Dhaka', label: '(UTC+06:00) Dhaka' },
  { value: 'Asia/Dubai', label: '(UTC+04:00) Dubai' },
  { value: 'Asia/Kolkata', label: '(UTC+05:30) India Standard Time' },
  { value: 'Asia/Tokyo', label: '(UTC+09:00) Tokyo' },
  { value: 'Australia/Sydney', label: '(UTC+10:00) Sydney' },
] as const;

export interface IUserSettingsResponse {
  id: string;
  userId: string;
  displayLanguage: typeof DISPLAY_LANGUAGE;
  displayLanguageLabel: typeof DISPLAY_LANGUAGE_LABEL;
  dateTimeFormat: string;
  timeZone: string;
  currency: string;
  notifications: NotificationPreference;
  eventShareEmail: EmailNotifyPreference;
  appliedEventUpdateEmail: EmailNotifyPreference;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUpdateUserSettingsPayload {
  dateTimeFormat?: string;
  timeZone?: string;
  currency?: string;
  notifications?: NotificationPreference;
  eventShareEmail?: EmailNotifyPreference;
  appliedEventUpdateEmail?: EmailNotifyPreference;
  /** Rejected unless English / en-US if provided. */
  displayLanguage?: string;
}

export interface IUserSettingsOptions {
  displayLanguages: Array<{ value: string; label: string; locked: boolean }>;
  dateTimeFormats: Array<{ value: string; label: string }>;
  timeZones: Array<{ value: string; label: string }>;
  currencies: Array<{ value: string; label: string }>;
  notifications: Array<{ value: NotificationPreference; label: string }>;
  eventShareEmail: Array<{ value: EmailNotifyPreference; label: string }>;
  appliedEventUpdateEmail: Array<{ value: EmailNotifyPreference; label: string }>;
}
