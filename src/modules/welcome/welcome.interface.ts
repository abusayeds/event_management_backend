import { WelcomeModuleKey } from '../../../prisma/generated/enums';

export type WelcomeModuleKeyInput =
  | 'event-calendars'
  | 'activity-suggestions'
  | 'resource-sharing'
  | 'customizable-profiles';

export interface IUpsertWelcomePagePayload {
  title?: string | null;
  content: string;
  isActive?: boolean;
}

export interface IWelcomePageResponse {
  id: string | null;
  key: WelcomeModuleKey;
  title: string | null;
  content: string;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export const WELCOME_MODULE_PARAM_KEYS = [
  'event-calendars',
  'activity-suggestions',
  'resource-sharing',
  'customizable-profiles',
] as const;
