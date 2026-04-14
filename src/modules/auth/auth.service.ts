import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import { CACHE_KEYS } from '../../cache/cache.keys';
import { cacheService } from '../../cache/cache.service';
import config from '../../config';
import logger from '../../config/logger';
import ApiError from '../../utils/apiError';
import {
  decodeToken,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../utils/generateToken';
import {
  sendResetPasswordEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from '../../utils/sendEmail';
import { UserService } from '../user/user.service';
import {
  ILoginPayload,
  ILogoutPayload,
  IPasswordResetChallenge,
  IRegisterPayload,
  IRegistrationChallenge,
} from './auth.interface';

// Helper functions
const normalizeEmail = (email: string) => email.toLowerCase().trim();
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const hashOtp = (purpose: string, email: string, otp: string) => 
  crypto.createHash('sha256').update(`${purpose}:${email}:${otp}`).digest('hex');
const getPasswordHash = async (password: string) => await bcrypt.hash(password, 12);

// Constants
const OTP_MAX_ATTEMPTS = 5;
const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid credentials.',
  EMAIL_ALREADY_EXISTS: 'Email already in use.',
  USER_NOT_FOUND: 'User not found.',
  INVALID_OTP: 'Invalid or expired OTP.',
  TOO_MANY_OTP_ATTEMPTS: 'Too many invalid OTP attempts. Request a new code.',
  ACCOUNT_LOCKED: (minutes: number) => `Too many failed attempts. Try again after ${minutes} minute(s).`,
};

// Security logging helper
const securityLogger = {
  loginAttempt: (email: string, ip: string, success: boolean) => {
    logger.warn('Login attempt', {
      type: 'AUTHENTICATION',
      email,
      ip,
      success,
      timestamp: new Date().toISOString()
    });
  }
};

// OTP attempt handler
const handleOtpAttempt = async (
  challengeKey: string,
  attemptKey: string,
  maxAttempts: number
): Promise<void> => {
  const attempts = await cacheService.increment(attemptKey);

  if (attempts === 1) {
    await cacheService.setTTL(attemptKey, CACHE_KEYS.TTL.MEDIUM);
  }

  if (attempts >= maxAttempts) {
    await cacheService.del(challengeKey);
    await cacheService.del(attemptKey);
    throw new ApiError(
      StatusCodes.TOO_MANY_REQUESTS,
      ERROR_MESSAGES.TOO_MANY_OTP_ATTEMPTS
    );
  }

  throw new ApiError(StatusCodes.UNAUTHORIZED, ERROR_MESSAGES.INVALID_OTP);
};

const createRegistrationChallenge = async (payload: IRegisterPayload) => {
  const normalizedEmail = normalizeEmail(payload.email);
  const existingUser = await UserService.getUserByEmail(normalizedEmail);

  if (existingUser) {
    throw new ApiError(StatusCodes.CONFLICT, 'Email already in use.');
  }
  const passwordHash = await bcrypt.hash(payload.password, 12);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const registrationChallenge: IRegistrationChallenge = {
    fullName: payload.fullName.trim(),
    email: normalizedEmail,
    passwordHash,
    otpHash: hashOtp('registration', normalizedEmail, otp),
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  await cacheService.set(
    CACHE_KEYS.AUTH.REGISTRATION(payload.email),
    registrationChallenge,
    CACHE_KEYS.TTL.MEDIUM
  );

  try {
    await sendVerificationEmail(normalizedEmail, otp);
  } catch (error) {
    await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION(payload.email));
    throw error;
  }
};

const failLoginAttempt = async (email: string): Promise<never> => {
  const attemptsKey = CACHE_KEYS.AUTH.ATTEMPTS(email);
  const lockKey = CACHE_KEYS.AUTH.LOCK(email);
  const lockSeconds = config.auth.lockTime * 60;

  const attempts = await cacheService.increment(attemptsKey);

  if (attempts === 1) {
    await cacheService.setTTL(attemptsKey, lockSeconds);
  }

  if (attempts >= config.auth.maxLoginAttempts) {
    await cacheService.set(lockKey, true, lockSeconds);
    await cacheService.del(attemptsKey);
    throw new ApiError(
      StatusCodes.TOO_MANY_REQUESTS,
      `Too many failed attempts. Try again after ${config.auth.lockTime} minute(s).`
    );
  }

  throw new ApiError(StatusCodes.UNAUTHORIZED, ERROR_MESSAGES.INVALID_CREDENTIALS);
};

const login = async (payload: ILoginPayload) => {
  const normalizedEmail = normalizeEmail(payload.email);
  const isLocked = await cacheService.exists(CACHE_KEYS.AUTH.LOCK(normalizedEmail));
  if (isLocked) {
    securityLogger.loginAttempt(normalizedEmail, 'unknown', false);
    throw new ApiError(
      StatusCodes.TOO_MANY_REQUESTS,
      `Too many failed attempts. Try again after ${config.auth.lockTime} minute(s).`
    );
  }

  const user = await UserService.getUserByEmail(normalizedEmail);
  if (!user) {
    await failLoginAttempt(normalizedEmail);
    securityLogger.loginAttempt(normalizedEmail, 'unknown', false);
  }

  const existingUser = user!;

  if (existingUser.status === 'SUSPENDED') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Your account has been suspended.');
  }
  if (existingUser.status === 'BANNED') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Your account has been banned.');
  }

  const isPasswordValid = await bcrypt.compare(payload.password, existingUser.password);
  if (!isPasswordValid) {
    await failLoginAttempt(normalizedEmail);
  }

  await cacheService.del(CACHE_KEYS.AUTH.ATTEMPTS(normalizedEmail));
  await cacheService.del(CACHE_KEYS.AUTH.LOCK(normalizedEmail));

  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(existingUser.id, existingUser.email, existingUser.role),
    generateRefreshToken(existingUser.id, existingUser.email, existingUser.role),
  ]);

  await cacheService.set(
    CACHE_KEYS.AUTH.REFRESH_TOKEN(existingUser.id),
    refreshToken,
    CACHE_KEYS.TTL.WEEK
  );

  return {
    user: {
      id: existingUser.id,
      fullName: existingUser.fullName,
      email: existingUser.email,
      role: existingUser.role,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
};

const register = async (payload: IRegisterPayload) => {
  await createRegistrationChallenge(payload);
};

const verifyEmail = async (email: string, otp: string) => {
  const normalizedEmail = normalizeEmail(email);
  const challenge = await cacheService.get<IRegistrationChallenge>(
    CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail)
  );

  if (!challenge) {
    throw new ApiError(StatusCodes.GONE, 'Verification code has expired. Please register again.');
  }

  if (challenge.otpHash !== crypto.createHash('sha256').update(`registration:${normalizedEmail}:${otp}`).digest('hex')) {
    const attempts = await cacheService.increment(CACHE_KEYS.AUTH.REGISTRATION_ATTEMPTS(normalizedEmail));
    if (attempts === 1) {
      await cacheService.setTTL(CACHE_KEYS.AUTH.REGISTRATION_ATTEMPTS(normalizedEmail), CACHE_KEYS.TTL.MEDIUM);
    }
    if (attempts >= 5) {
      await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail));
      await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION_ATTEMPTS(normalizedEmail));
      throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Too many invalid OTP attempts. Request a new code.');
    }
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid or expired OTP.');
  }

  const existingUser = await UserService.getUserByEmail(normalizedEmail);
  if (existingUser) {
    await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail));
    await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION_ATTEMPTS(normalizedEmail));
    throw new ApiError(StatusCodes.CONFLICT, 'Email already in use.');
  }

  const createdUser = await UserService.createUser({
    fullName: challenge.fullName,
    email: challenge.email,
    password: challenge.passwordHash,
  }, 'system', 'system');

  await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail));
  await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION_ATTEMPTS(normalizedEmail));

  void sendWelcomeEmail(createdUser.email, createdUser.fullName).catch(() => undefined);
};

const resendVerificationOtp = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  const challenge = await cacheService.get<IRegistrationChallenge>(
    CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail)
  );

  if (!challenge) {
    const existingUser = await UserService.getUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new ApiError(StatusCodes.CONFLICT, 'Email is already verified.');
    }
    throw new ApiError(StatusCodes.GONE, 'Verification session expired. Please register again.');
  }

  const otp = generateOtp();
  const updatedChallenge: IRegistrationChallenge = {
    ...challenge,
    otpHash: hashOtp('registration', normalizedEmail, otp),
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  await cacheService.set(
    CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail),
    updatedChallenge,
    CACHE_KEYS.TTL.MEDIUM
  );

  try {
    await sendVerificationEmail(normalizedEmail, otp);
  } catch (error) {
    await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail));
    throw error;
  }
};

const refresh = async (refreshToken: string) => {
  const decoded = verifyRefreshToken(refreshToken);

  const stored = await cacheService.get<string>(CACHE_KEYS.AUTH.REFRESH_TOKEN(decoded.userId));
  if (!stored || stored !== refreshToken) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid credentials.');
  }

  const user = await UserService.getUserById(decoded.userId);
  if (!user) throw new ApiError(StatusCodes.UNAUTHORIZED, 'User not found.');

  if (user.status === 'SUSPENDED') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Your account has been suspended.');
  }
  if (user.status === 'BANNED') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Your account has been banned.');
  }

  const [newAccessToken, newRefreshToken] = await Promise.all([
    generateAccessToken(user.id, user.email, user.role),
    generateRefreshToken(user.id, user.email, user.role),
  ]);

  await cacheService.set(
    CACHE_KEYS.AUTH.REFRESH_TOKEN(user.id),
    newRefreshToken,
    CACHE_KEYS.TTL.WEEK // 7 days in seconds
  );

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

const forgotPassword = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await UserService.getUserByEmail(normalizedEmail);

  if (!user) {
    return;
  }

  if (user.status === 'SUSPENDED') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Your account has been suspended.');
  }
  if (user.status === 'BANNED') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Your account has been banned.');
  }

  const otp = generateOtp();
  const resetChallenge: IPasswordResetChallenge = {
    userId: user.id,
    email: user.email,
    otpHash: hashOtp('reset-password', normalizedEmail, otp),
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  await cacheService.set(
    CACHE_KEYS.AUTH.PASSWORD_RESET(normalizedEmail),
    resetChallenge,
    CACHE_KEYS.TTL.MEDIUM
  );

  try {
    await sendResetPasswordEmail(user.email, otp);
  } catch (error) {
    await cacheService.del(CACHE_KEYS.AUTH.PASSWORD_RESET(normalizedEmail));
    throw error;
  }
};

const resetPassword = async (email: string, otp: string, newPassword: string) => {
  const normalizedEmail = normalizeEmail(email);
  const challenge = await cacheService.get<IPasswordResetChallenge>(
    CACHE_KEYS.AUTH.PASSWORD_RESET(normalizedEmail)
  );

  if (!challenge) {
    throw new ApiError(StatusCodes.GONE, 'Reset code has expired. Please request a new one.');
  }

  if (challenge.otpHash !== hashOtp('reset-password', normalizedEmail, otp)) {
    await handleOtpAttempt(
      CACHE_KEYS.AUTH.PASSWORD_RESET(normalizedEmail),
      CACHE_KEYS.AUTH.PASSWORD_RESET_ATTEMPTS(normalizedEmail),
      OTP_MAX_ATTEMPTS
    );
  }

  const user = await UserService.getUserById(challenge.userId);
  if (!user) {
    await cacheService.del(CACHE_KEYS.AUTH.PASSWORD_RESET(normalizedEmail));
    await cacheService.del(CACHE_KEYS.AUTH.PASSWORD_RESET_ATTEMPTS(normalizedEmail));
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  const hashedPassword = await getPasswordHash(newPassword);
  await UserService.updateUserPassword(user.id, hashedPassword);

  await cacheService.del(CACHE_KEYS.AUTH.PASSWORD_RESET(normalizedEmail));
  await cacheService.del(CACHE_KEYS.AUTH.PASSWORD_RESET_ATTEMPTS(normalizedEmail));

  await cacheService.del(`refreshToken:${user.id}`);
  await cacheService.del(`permissions:${user.id}`);
};

const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await UserService.getUserByIdForAuth(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Current password is incorrect.');
  }

  const hashedPassword = await getPasswordHash(newPassword);
  await UserService.updateUserPassword(userId, hashedPassword);

  await cacheService.del(`refreshToken:${userId}`);
};

const logout = async (payload: ILogoutPayload) => {
  const decoded = decodeToken(payload.accessToken);
  if (decoded && decoded.exp) {
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await cacheService.set(`blacklist:${payload.accessToken}`, 'true', ttl);
    }
  }

  await cacheService.del(`refreshToken:${payload.userId}`);
  await cacheService.del(`permissions:${payload.userId}`);
};

export const AuthService = {
  register,
  verifyEmail,
  resendVerificationOtp,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
};
