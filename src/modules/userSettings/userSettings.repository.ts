import {
  EmailNotifyPreference,
  NotificationPreference,
} from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import type { IUpdateUserSettingsPayload } from './userSettings.interface';
import { DISPLAY_LANGUAGE } from './userSettings.interface';

const userSettingsSelect = {
  id: true,
  userId: true,
  displayLanguage: true,
  dateTimeFormat: true,
  timeZone: true,
  currency: true,
  notifications: true,
  eventShareEmail: true,
  appliedEventUpdateEmail: true,
  createdAt: true,
  updatedAt: true,
} as const;

const getByUserId = async (userId: string) => {
  return database.userSettings.findUnique({
    where: { userId },
    select: userSettingsSelect,
  });
};

const createDefaults = async (userId: string) => {
  return database.userSettings.create({
    data: {
      userId,
      displayLanguage: DISPLAY_LANGUAGE,
    },
    select: userSettingsSelect,
  });
};

const updateByUserId = async (userId: string, payload: IUpdateUserSettingsPayload) => {
  const data = {
    ...(payload.dateTimeFormat !== undefined ? { dateTimeFormat: payload.dateTimeFormat } : {}),
    ...(payload.timeZone !== undefined ? { timeZone: payload.timeZone } : {}),
    ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
    ...(payload.notifications !== undefined
      ? { notifications: payload.notifications as NotificationPreference }
      : {}),
    ...(payload.eventShareEmail !== undefined
      ? { eventShareEmail: payload.eventShareEmail as EmailNotifyPreference }
      : {}),
    ...(payload.appliedEventUpdateEmail !== undefined
      ? { appliedEventUpdateEmail: payload.appliedEventUpdateEmail as EmailNotifyPreference }
      : {}),
    displayLanguage: DISPLAY_LANGUAGE,
  };

  return database.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      ...data,
    },
    update: data,
    select: userSettingsSelect,
  });
};

export const UserSettingsRepository = {
  getByUserId,
  createDefaults,
  updateByUserId,
};
