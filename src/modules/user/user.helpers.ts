import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../utils/apiError';
import { ICreateUserPayload } from './user.interface';
import { UserRepository } from './user.repository';

export const normalizeUsername = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._]/g, '');

export const createUsernameBase = (payload: ICreateUserPayload): string => {
  const firstName = payload.firstName?.trim().toLowerCase() || '';
  const lastName = payload.lastName?.trim().toLowerCase() || '';
  const emailPrefix = payload.email?.split('@')[0]?.toLowerCase() || 'user';
  const base = normalizeUsername(`${firstName}${lastName}`) || normalizeUsername(emailPrefix);

  return base || 'user';
};

export const randomDigits = (length: number): string => {
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += crypto.randomInt(0, 10).toString();
  }
  return output;
};

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
