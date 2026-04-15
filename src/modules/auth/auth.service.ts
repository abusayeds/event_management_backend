import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import { CACHE_KEYS } from '../../cache/cache.keys';
import { cacheService } from '../../cache/cache.service';
import config from '../../config';
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
  generateOtp,
  getPasswordHash,
  handleOtpAttempt,
  hashOtp,
  normalizeEmail,
  securityLogger,
} from './auth.helpers';
import {
  ILoginPayload,
  ILogoutPayload,
  IPasswordResetChallenge,
  IPendingEmailVerification,
  IRegisterPayload,
} from './auth.interface';

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

  throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid credentials.');
};

const register = async (payload: IRegisterPayload) => {
  const normalizedEmail = normalizeEmail(payload.email);

  // Check if email is already registered or pending verification
  const existingUser = await UserService.getUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new ApiError(StatusCodes.CONFLICT, 'Email is already registered. Please login instead.');
  }

  // Hash password and generate OTP
  const passwordHash = await bcrypt.hash(payload?.password, 12);
  const otp = generateOtp();

  // Store registration challenge in cache
  const pendingEmailVerification: IPendingEmailVerification = {
    fullName: payload.fullName.trim(),
    email: normalizedEmail,
    passwordHash,
    otpHash: hashOtp('registration', normalizedEmail, otp),
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  // Send verification email
  await cacheService.set(
    CACHE_KEYS.AUTH.REGISTRATION(payload.email),
    pendingEmailVerification,
    CACHE_KEYS.TTL.MEDIUM
  );

  try {
    // In a real implementation, you would want to handle email sending failures more gracefully,
    await sendVerificationEmail(normalizedEmail, otp);
  } catch (error) {
    await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION(payload.email));
    throw error;
  }
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

  if (existingUser.status === 'BANNED') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Your account has been banned.');
  }
  if (existingUser.status === 'DELETED') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Your account has been deleted.');
  }

  const isPasswordValid = await bcrypt.compare(payload.password, existingUser.password);
  if (!isPasswordValid) {
    await failLoginAttempt(normalizedEmail);
  }

  // Successful login - reset attempts and lock
  await cacheService.del(CACHE_KEYS.AUTH.ATTEMPTS(normalizedEmail));
  await cacheService.del(CACHE_KEYS.AUTH.LOCK(normalizedEmail));

  // Generate tokens in parallel
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(existingUser.id, existingUser.email, existingUser.role),
    generateRefreshToken(existingUser.id, existingUser.email, existingUser.role),
  ]);

  // Store refresh token in cache with expiration
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

const verifyEmail = async (email: string, otp: string) => {
  const normalizedEmail = normalizeEmail(email);
  const challenge = await cacheService.get<IPendingEmailVerification>(
    CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail)
  );

  if (!challenge) {
    throw new ApiError(StatusCodes.GONE, 'Verification code has expired. Please register again.');
  }

  if (
    challenge.otpHash !==
    crypto.createHash('sha256').update(`registration:${normalizedEmail}:${otp}`).digest('hex')
  ) {
    const attempts = await cacheService.increment(
      CACHE_KEYS.AUTH.REGISTRATION_ATTEMPTS(normalizedEmail)
    );
    if (attempts === 1) {
      await cacheService.setTTL(
        CACHE_KEYS.AUTH.REGISTRATION_ATTEMPTS(normalizedEmail),
        CACHE_KEYS.TTL.MEDIUM
      );
    }
    if (attempts >= 5) {
      await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail));
      await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION_ATTEMPTS(normalizedEmail));
      throw new ApiError(
        StatusCodes.TOO_MANY_REQUESTS,
        'Too many invalid OTP attempts. Request a new code.'
      );
    }
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid or expired OTP.');
  }

  const existingUser = await UserService.getUserByEmail(normalizedEmail);
  if (existingUser) {
    await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail));
    await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION_ATTEMPTS(normalizedEmail));
    throw new ApiError(StatusCodes.CONFLICT, 'Email already in use.');
  }

  const createdUser = await UserService.createUser(
    {
      fullName: challenge.fullName,
      email: challenge.email,
      password: challenge.passwordHash,
    },
    'system',
    'system'
  );

  await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail));
  await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION_ATTEMPTS(normalizedEmail));

  void sendWelcomeEmail(
    createdUser.email,
    `${createdUser.firstName} (${createdUser.lastName})`
  ).catch(() => undefined);
};

const resendVerificationOtp = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  const challenge = await cacheService.get<IPendingEmailVerification>(
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
  const updatedChallenge: IPendingEmailVerification = {
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

  if (user.status === 'DELETED') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Your account has been deleted.');
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

  if (user.status === 'DELETED') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Your account has been deleted  .');
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
      config.auth.otpMaxAttempts
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

  await cacheService.del(CACHE_KEYS.AUTH.REFRESH_TOKEN(user.id));
  await cacheService.del(CACHE_KEYS.AUTH.PERMISSIONS(user.id));
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

  await cacheService.del(CACHE_KEYS.AUTH.REFRESH_TOKEN(userId));
};

const logout = async (payload: ILogoutPayload) => {
  const decoded = decodeToken(payload.accessToken);
  if (decoded && decoded.exp) {
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await cacheService.set(CACHE_KEYS.AUTH.TOKEN_BLACKLIST(payload.accessToken), 'true', ttl);
    }
  }

  await cacheService.del(CACHE_KEYS.AUTH.REFRESH_TOKEN(payload.userId));
  await cacheService.del(CACHE_KEYS.AUTH.PERMISSIONS(payload.userId));
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
