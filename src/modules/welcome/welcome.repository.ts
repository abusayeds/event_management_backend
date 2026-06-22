import { WelcomeModuleKey } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import { IUpsertWelcomePagePayload } from './welcome.interface';

const welcomePageSelect = {
  id: true,
  key: true,
  title: true,
  content: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const upsertPage = async (key: WelcomeModuleKey, payload: IUpsertWelcomePagePayload) => {
  return database.welcomePage.upsert({
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
    select: welcomePageSelect,
  });
};

const getPageByKey = async (key: WelcomeModuleKey) => {
  return database.welcomePage.findUnique({
    where: { key },
    select: welcomePageSelect,
  });
};

export const WelcomeRepository = {
  upsertPage,
  getPageByKey,
};
