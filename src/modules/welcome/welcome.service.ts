import { StatusCodes } from 'http-status-codes';
import { WelcomeModuleKey } from '../../../prisma/generated/enums';
import ApiError from '../../utils/apiError';
import { IUpsertWelcomePagePayload } from './welcome.interface';
import { WelcomeRepository } from './welcome.repository';

const resolveWelcomeKey = (input: string): WelcomeModuleKey => {
  const normalized = input.trim().toLowerCase().replace(/_/g, '-');

  if (normalized === 'event-calendars' || normalized === 'eventcalendars') {
    return WelcomeModuleKey.EventCalendars;
  }
  if (normalized === 'activity-suggestions' || normalized === 'activitysuggestions') {
    return WelcomeModuleKey.ActivitySuggestions;
  }
  if (normalized === 'resource-sharing' || normalized === 'resourcesharing') {
    return WelcomeModuleKey.ResourceSharing;
  }
  if (normalized === 'customizable-profiles' || normalized === 'customizableprofiles') {
    return WelcomeModuleKey.CustomizableProfiles;
  }

  throw new ApiError(
    StatusCodes.BAD_REQUEST,
    'Invalid key. Supported keys: event-calendars, activity-suggestions, resource-sharing, customizable-profiles.'
  );
};

const upsertPage = async (keyInput: string, payload: IUpsertWelcomePagePayload) => {
  const key = resolveWelcomeKey(keyInput);
  return WelcomeRepository.upsertPage(key, payload);
};

const getPage = async (keyInput: string) => {
  const key = resolveWelcomeKey(keyInput);
  const page = await WelcomeRepository.getPageByKey(key);
  if (page) {
    return page;
  }

  return {
    id: null,
    key,
    title: null,
    content: '',
    isActive: true,
    createdAt: null,
    updatedAt: null,
  };
};

export const WelcomeService = {
  upsertPage,
  getPage,
};
