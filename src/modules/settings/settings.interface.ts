import { SettingsPageKey } from '../../../prisma/generated/enums';

export type SettingsPageKeyInput =
  | 'about'
  | 'privacy'
  | 'terms'


export interface IUpsertSettingsPagePayload {
  key: SettingsPageKeyInput;
  title?: string | null;
  content: string;
  isActive?: boolean;
}

export interface ISettingsPageResponse {
  id: string | null;
  key: SettingsPageKey;
  title: string | null;
  content: string;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}
