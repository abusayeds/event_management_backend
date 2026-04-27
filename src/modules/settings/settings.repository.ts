import { SettingsPageKey } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import { IUpsertSettingsPagePayload } from './settings.interface';

const settingsPageSelect = {
  id: true,
  key: true,
  title: true,
  content: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const upsertPage = async (key: SettingsPageKey, payload: IUpsertSettingsPagePayload) => {
  return database.settingsPage.upsert({
    where: { key },
    create: {
      key,
      title: payload.title ?? null,
      content: payload.content,
      isActive: payload.isActive ?? true,
    },
    update: {
      title: payload.title ?? null,
      content: payload.content,
      isActive: payload.isActive ?? true,
    },
    select: settingsPageSelect,
  });
};

const getPageByKey = async (key: SettingsPageKey) => {
  return database.settingsPage.findUnique({
    where: { key },
    select: settingsPageSelect,
  });
};

export const SettingsRepository = {
  upsertPage,
  getPageByKey,
};
