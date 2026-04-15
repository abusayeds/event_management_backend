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
import { emailTemplates } from '../email/email.templates';
import { UserService } from '../user/user.service';
import {
  generateOtp,
  getPasswordHash,
  handleOtpAttempt,
  hashOtp,
  normalizeEmail,
  securityLogger,
  validateUserStatus,
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
    ...payload,
    passwordHash,
    otpHash: hashOtp('registration', normalizedEmail, otp),
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  // Send verification email
  await cacheService.set(
    CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail),
    pendingEmailVerification,
    CACHE_KEYS.TTL.MEDIUM
  );

  try {
    // In a real implementation, you would want to handle email sending failures more gracefully,
    await emailTemplates.sendVerificationEmail(normalizedEmail, otp);
  } catch (error) {
    await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail));
    throw error;
  }
};

const verifyEmail = async (email: string, otp: string) => {
  const normalizedEmail = normalizeEmail(email);
  const pendingEmailVerificationData = await cacheService.get<IPendingEmailVerification>(
    CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail)
  );

  if (!pendingEmailVerificationData) {
    throw new ApiError(StatusCodes.GONE, 'Verification code has expired. Please register again.');
  }

  if (
    pendingEmailVerificationData.otpHash !==
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

  const createdUser = await UserService.createUser({
    firstName: pendingEmailVerificationData.firstName,
    lastName: pendingEmailVerificationData.lastName,
    gender: pendingEmailVerificationData.gender,
    birthdate: pendingEmailVerificationData.birthdate,
    location: pendingEmailVerificationData.location,
    country: pendingEmailVerificationData.country,
    state: pendingEmailVerificationData.state,
    city: pendingEmailVerificationData.city,
    email: pendingEmailVerificationData.email,
    password: pendingEmailVerificationData.passwordHash,
    username: pendingEmailVerificationData.username,
  });

  await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail));
  await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION_ATTEMPTS(normalizedEmail));

  // Send welcome email
  await emailTemplates.sendWelcomeEmail(createdUser.email, `${createdUser.firstName} ${createdUser.lastName}`);
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

  // ✅ Validate user account status
  validateUserStatus(existingUser.status);

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
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      email: existingUser.email,
      role: existingUser.role,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
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
    // In a real implementation, you would want to handle email sending failures more gracefully,
    await emailTemplates.sendVerificationEmail(normalizedEmail, otp);
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

  // ✅ Validate user account status
  validateUserStatus(user.status);

  // Generate new tokens in parallel
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

  // ✅ Validate user account status
  validateUserStatus(user.status);

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
    // In a real implementation, you would want to handle email sending failures more gracefully,
    await emailTemplates.sendResetPasswordEmail(user.email, otp);
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
