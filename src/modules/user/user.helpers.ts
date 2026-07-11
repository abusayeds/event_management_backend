import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../utils/apiError';
import { ICreateUserPayload, IUserSkillInput, IUserSkillResponse } from './user.interface';
import { UserRepository } from './user.repository';

// Normalize username: lowercase, no spaces, only alphanumeric, dots, underscores
export const normalizeUsername = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._]/g, '');

// Create username base from first name, last name, or email prefix
export const createUsernameBase = (payload: ICreateUserPayload): string => {
  const firstName = payload.firstName?.trim().toLowerCase() || '';
  const lastName = payload.lastName?.trim().toLowerCase() || '';
  const emailPrefix = payload.email?.split('@')[0]?.toLowerCase() || 'user';
  const base = normalizeUsername(`${firstName}${lastName}`) || normalizeUsername(emailPrefix);

  return base || 'user';
};

// Generate random digits for unique username suffix
export const randomDigits = (length: number): string => {
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += crypto.randomInt(0, 10).toString();
  }
  return output;
};

// Create unique account ID with retry mechanism
export const createUniqueAccountId = async (): Promise<string> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const length = crypto.randomInt(8, 13);
    const candidate = randomDigits(length);
    const exists = await UserRepository.isAccountIdExists(candidate);
    if (!exists) {
      return candidate;
    }
  }

  throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Unable to generate unique account id.');
};

// Resolve username: validate provided or generate unique one
export const resolveUsername = async (payload: ICreateUserPayload): Promise<string> => {
  const providedUsername = payload.username ? normalizeUsername(payload.username) : '';

  if (payload.username && !providedUsername) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'username format is invalid.');
  }

  if (providedUsername) {
    const exists = await UserRepository.isUsernameExists(providedUsername);
    if (exists) {
      throw new ApiError(StatusCodes.CONFLICT, 'username already in use.');
    }
    return providedUsername;
  }

  const base = createUsernameBase(payload);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = attempt === 0 ? '' : randomDigits(crypto.randomInt(3, 6));
    const candidate = `${base}${suffix}`;
    const exists = await UserRepository.isUsernameExists(candidate);
    if (!exists) {
      return candidate;
    }
  }

  throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Unable to generate unique username.');
};

// Prepare user creation payload with normalized email, resolved username, and account ID
export const prepareCreateUserPayload = async (
  payload: ICreateUserPayload
): Promise<ICreateUserPayload> => {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const username = await resolveUsername({ ...payload, email: normalizedEmail });
  const accountId = await createUniqueAccountId();

  return {
    ...payload,
    email: normalizedEmail,
    username,
    accountId,
  };
};

export const currentYear = (): number => new Date().getFullYear();

/** Last 100 years inclusive: current year down to currentYear - 99. */
export const buildStartYearOptions = (): number[] => {
  const end = currentYear();
  const start = end - 99;
  const years: number[] = [];
  for (let y = end; y >= start; y -= 1) {
    years.push(y);
  }
  return years;
};

export const skillLabel = (programName: string, startYear: number): string =>
  `${programName} since ${startYear}`;

const LEGACY_SKILL_RE = /^(.+?)\s+since\s+(\d{4})$/i;

export const parseLegacySkillLabel = (raw: string): IUserSkillInput | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(LEGACY_SKILL_RE);
  if (match) {
    const year = Number(match[2]);
    if (!Number.isInteger(year)) {
      return null;
    }
    return { program: match[1].trim(), startYear: year };
  }
  return { program: trimmed, startYear: currentYear() };
};

export const toSkillResponse = (row: {
  id: string;
  programId: string | null;
  programName: string;
  startYear: number;
}): IUserSkillResponse => ({
  id: row.id,
  programId: row.programId,
  programName: row.programName,
  startYear: row.startYear,
  label: skillLabel(row.programName, row.startYear),
});

export const isStartYearAllowed = (year: number): boolean => {
  const end = currentYear();
  return Number.isInteger(year) && year >= end - 99 && year <= end;
};
