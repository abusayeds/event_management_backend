import { z } from 'zod';
import {
  EmailNotifyPreference,
  NotificationPreference,
} from '../../../prisma/generated/enums';
import {
  CURRENCY_OPTIONS,
  DATE_TIME_FORMAT_OPTIONS,
  TIME_ZONE_OPTIONS,
} from './userSettings.interface';

const dateTimeFormatValues = DATE_TIME_FORMAT_OPTIONS.map(o => o.value) as [
  string,
  ...string[],
];
const currencyValues = CURRENCY_OPTIONS.map(o => o.value) as [string, ...string[]];
const timeZoneValues = TIME_ZONE_OPTIONS.map(o => o.value) as [string, ...string[]];

const updateBody = z
  .object({
    displayLanguage: z.string().trim().optional(),
    dateTimeFormat: z.enum(dateTimeFormatValues).optional(),
    timeZone: z.enum(timeZoneValues).optional(),
    currency: z.enum(currencyValues).optional(),
    notifications: z.nativeEnum(NotificationPreference).optional(),
    eventShareEmail: z.nativeEnum(EmailNotifyPreference).optional(),
    appliedEventUpdateEmail: z.nativeEnum(EmailNotifyPreference).optional(),
  })
  .strict()
  .refine(
    data => Object.keys(data).length > 0,
    'At least one settings field is required to update.'
  );

const updateMySettings = z.object({
  body: updateBody,
});

const getMySettings = z.object({
  query: z.object({}).optional(),
});

const getOptions = z.object({
  query: z.object({}).optional(),
});

export const UserSettingsValidation = {
  updateMySettings,
  getMySettings,
  getOptions,
};
