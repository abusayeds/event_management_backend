import { StatusCodes } from 'http-status-codes';
import { SettingsPageKey } from '../../../prisma/generated/enums';
import ApiError from '../../utils/apiError';
import { IUpsertSettingsPagePayload } from './settings.interface';
import { SettingsRepository } from './settings.repository';

const resolveSettingsKey = (input: string): SettingsPageKey => {
  const normalized = input.trim().toLowerCase();
  if (normalized === 'about') return SettingsPageKey.About;
  if (normalized === 'privacy') {
    return SettingsPageKey.PrivacyPolicy;
  }
  if (normalized === 'terms') {
    return SettingsPageKey.TermsCondition;
  }
  throw new ApiError(
    StatusCodes.BAD_REQUEST,
    'Invalid key. Supported keys: about, privacy, terms.'
  );
};

const addOrEditPage = async (payload: IUpsertSettingsPagePayload) => {
  const key = resolveSettingsKey(payload.key);
  return SettingsRepository.upsertPage(key, payload);
};

const getPage = async (keyInput: string) => {
  const key = resolveSettingsKey(keyInput);
  const page = await SettingsRepository.getPageByKey(key);
  if (!page) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Settings page not found.');
  }
  return page;
};

export const SettingsService = {
  addOrEditPage,
  getPage,
};
