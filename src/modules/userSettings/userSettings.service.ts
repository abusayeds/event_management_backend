import { StatusCodes } from 'http-status-codes';
import {
  EmailNotifyPreference,
  NotificationPreference,
} from '../../../prisma/generated/enums';
import ApiError from '../../utils/apiError';
import {
  CURRENCY_OPTIONS,
  DATE_TIME_FORMAT_OPTIONS,
  DISPLAY_LANGUAGE,
  DISPLAY_LANGUAGE_LABEL,
  IUpdateUserSettingsPayload,
  IUserSettingsOptions,
  IUserSettingsResponse,
  TIME_ZONE_OPTIONS,
} from './userSettings.interface';
import { UserSettingsRepository } from './userSettings.repository';

const toResponse = (row: {
  id: string;
  userId: string;
  displayLanguage: string;
  dateTimeFormat: string;
  timeZone: string;
  currency: string;
  notifications: NotificationPreference;
  eventShareEmail: EmailNotifyPreference;
  appliedEventUpdateEmail: EmailNotifyPreference;
  createdAt: Date;
  updatedAt: Date;
}): IUserSettingsResponse => ({
  ...row,
  displayLanguage: DISPLAY_LANGUAGE,
  displayLanguageLabel: DISPLAY_LANGUAGE_LABEL,
});

const assertEnglishOnly = (displayLanguage?: string) => {
  if (displayLanguage === undefined) {
    return;
  }
  const normalized = displayLanguage.trim().toLowerCase().replace('_', '-');
  const allowed = new Set(['en', 'en-us', 'english', 'english (us)', 'english(us)']);
  if (!allowed.has(normalized)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Display language is fixed to English (US). Other languages are not supported.'
    );
  }
};

const getMySettings = async (userId: string): Promise<IUserSettingsResponse> => {
  const existing = await UserSettingsRepository.getByUserId(userId);
  if (existing) {
    return toResponse(existing);
  }
  const created = await UserSettingsRepository.createDefaults(userId);
  return toResponse(created);
};

const updateMySettings = async (
  userId: string,
  payload: IUpdateUserSettingsPayload
): Promise<IUserSettingsResponse> => {
  assertEnglishOnly(payload.displayLanguage);

  const { displayLanguage: _ignored, ...updatable } = payload;
  const updated = await UserSettingsRepository.updateByUserId(userId, updatable);
  return toResponse(updated);
};

const getOptions = (): IUserSettingsOptions => ({
  displayLanguages: [
    {
      value: DISPLAY_LANGUAGE,
      label: DISPLAY_LANGUAGE_LABEL,
      locked: true,
    },
  ],
  dateTimeFormats: [...DATE_TIME_FORMAT_OPTIONS],
  timeZones: [...TIME_ZONE_OPTIONS],
  currencies: [...CURRENCY_OPTIONS],
  notifications: [
    { value: NotificationPreference.All, label: 'All' },
    { value: NotificationPreference.ImportantOnly, label: 'Important only' },
    { value: NotificationPreference.Off, label: 'Off' },
  ],
  eventShareEmail: [
    { value: EmailNotifyPreference.Instant, label: 'Instant' },
    { value: EmailNotifyPreference.Daily, label: 'Daily' },
    { value: EmailNotifyPreference.Off, label: 'Off' },
  ],
  appliedEventUpdateEmail: [
    { value: EmailNotifyPreference.Instant, label: 'Instant' },
    { value: EmailNotifyPreference.Daily, label: 'Daily' },
    { value: EmailNotifyPreference.Off, label: 'Off' },
  ],
});

export const UserSettingsService = {
  getMySettings,
  updateMySettings,
  getOptions,
};
