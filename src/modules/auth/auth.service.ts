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
  generateOpaqueToken,
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
  IPasswordResetGrant,
  IPendingEmailVerification,
  IRegisterPayload,
} from './auth.interface';

const failLoginAttempt = async (email: string): Promise<never> => {
  // Step:1 Get cache keys for attempt tracking and account locking
  const attemptsKey = CACHE_KEYS.AUTH.ATTEMPTS(email);
  const lockKey = CACHE_KEYS.AUTH.LOCK(email);
  const lockSeconds = config.auth.lockTime * 60;

  // Step:2 Increment failed attempt counter
  const attempts = await cacheService.increment(attemptsKey);

  // Step:3 Set TTL on first attempt
  if (attempts === 1) {
    await cacheService.setTTL(attemptsKey, lockSeconds);
  }

  // Step:4 Lock account if max attempts exceeded, then throw error
  if (attempts >= config.auth.maxLoginAttempts) {
    await cacheService.set(lockKey, true, lockSeconds);
    await cacheService.del(attemptsKey);
    throw new ApiError(
      StatusCodes.TOO_MANY_REQUESTS,
      `Too many failed attempts. Try again after ${config.auth.lockTime} minute(s).`
    );
  }

  // Step:5 Throw unauthorized error
  throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid credentials.');
};

const register = async (payload: IRegisterPayload): Promise<{ sessionId: string }> => {
  // Step:1 Normalize email
  const normalizedEmail = normalizeEmail(payload.email);

  // Step:2 Check if email is already registered or pending verification
  const existingUser = await UserService.getUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new ApiError(StatusCodes.CONFLICT, 'Email is already registered. Please login instead.');
  }

  // Step:3 Generate OTP and session ID
  const otp = generateOtp();
  const sessionId = generateOpaqueToken('sess');

  // Step:4 Create registration challenge with hashed OTP
  const pendingEmailVerification: IPendingEmailVerification = {
    ...payload,
    otpHash: hashOtp('registration', normalizedEmail, otp),
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  // Step:5 Store in Redis by both email and sessionId for flexibility
  await cacheService.set(
    CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail),
    pendingEmailVerification,
    CACHE_KEYS.TTL.MEDIUM
  );

  await cacheService.set(
    CACHE_KEYS.AUTH.REGISTRATION_SESSION(sessionId),
    pendingEmailVerification,
    CACHE_KEYS.TTL.MEDIUM
  );

  // Step:6 Send verification email with OTP
  try {
    await emailTemplates.sendVerificationEmail(normalizedEmail, otp);
  } catch (error) {
    // Step:7 Cleanup on email send failure
    await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail));
    await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION_SESSION(sessionId));
    throw error;
  }

  // Step:8 Return session ID for next step
  return { sessionId };
};

const verifyEmail = async (sessionId: string, otp: string) => {
  // Step:1 Fetch pending registration from cache by sessionId
  const pendingEmailVerificationData = await cacheService.get<IPendingEmailVerification>(
    CACHE_KEYS.AUTH.REGISTRATION_SESSION(sessionId)
  );

  // Step:2 Check if session exists and not expired
  if (!pendingEmailVerificationData) {
    throw new ApiError(StatusCodes.GONE, 'Verification code has expired. Please register again.');
  }

  // Step:3 Normalize email
  const normalizedEmail = normalizeEmail(pendingEmailVerificationData.email);

  // Step:4 Verify OTP hash matches
  if (
    pendingEmailVerificationData.otpHash !==
    crypto.createHash('sha256').update(`registration:${normalizedEmail}:${otp}`).digest('hex')
  ) {
    // Step:5a Track failed OTP attempts
    const attempts = await cacheService.increment(
      CACHE_KEYS.AUTH.REGISTRATION_ATTEMPTS(normalizedEmail)
    );
    if (attempts === 1) {
      await cacheService.setTTL(
        CACHE_KEYS.AUTH.REGISTRATION_ATTEMPTS(normalizedEmail),
        CACHE_KEYS.TTL.MEDIUM
      );
    }
    // Step:5b Lock registration if max attempts exceeded
    if (attempts >= 5) {
      await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail));
      await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION_SESSION(sessionId));
      await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION_ATTEMPTS(normalizedEmail));
      throw new ApiError(
        StatusCodes.TOO_MANY_REQUESTS,
        'Too many invalid OTP attempts. Request a new code.'
      );
    }
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid or expired OTP.');
  }

  // Step:6 Check if email not already registered during verification
  const existingUser = await UserService.getUserByEmail(normalizedEmail);
  if (existingUser) {
    await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail));
    await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION_SESSION(sessionId));
    await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION_ATTEMPTS(normalizedEmail));
    throw new ApiError(StatusCodes.CONFLICT, 'Email already in use.');
  }

  // Step:7 Create user account with verified data
  const createdUser = await UserService.createUser({
    firstName: pendingEmailVerificationData.firstName,
    lastName: pendingEmailVerificationData.lastName,
    gender: pendingEmailVerificationData.gender,
    birthDate: pendingEmailVerificationData.birthDate,
    location: pendingEmailVerificationData.location,
    country: pendingEmailVerificationData.country,
    state: pendingEmailVerificationData.state,
    city: pendingEmailVerificationData.city,
    email: pendingEmailVerificationData.email,
    isEmailVerified: true,
    isIndependent: true,
    password: pendingEmailVerificationData.password,
    username: pendingEmailVerificationData.username,
  });

  // Step:8 Cleanup cache entries
  await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail));
  await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION_SESSION(sessionId));
  await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION_ATTEMPTS(normalizedEmail));

  // Step:9 Send welcome email
  await emailTemplates.sendWelcomeEmail(
    createdUser.email,
    `${createdUser.firstName} ${createdUser.lastName}`
  );

  // Step:10 Generate tokens in parallel
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(createdUser.id, createdUser.email, createdUser.role),
    generateRefreshToken(createdUser.id, createdUser.email, createdUser.role),
  ]);

  // Step:11 Store refresh token in cache with TTL
  await cacheService.set(
    CACHE_KEYS.AUTH.REFRESH_TOKEN(createdUser.id),
    refreshToken,
    CACHE_KEYS.TTL.WEEK
  );

  // Step:12 Return user and tokens
  return {
    user: {
      id: createdUser.id,
      firstName: createdUser.firstName,
      lastName: createdUser.lastName,
      email: createdUser.email,
      role: createdUser.role,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
};

const login = async (payload: ILoginPayload) => {
  // Step:1 Normalize email
  const normalizedEmail = normalizeEmail(payload.email);
  
  // Step:2 Check if account is locked due to failed attempts
  const isLocked = await cacheService.exists(CACHE_KEYS.AUTH.LOCK(normalizedEmail));
  if (isLocked) {
    securityLogger.loginAttempt(normalizedEmail, 'unknown', false);
    throw new ApiError(
      StatusCodes.TOO_MANY_REQUESTS,
      `Too many failed attempts. Try again after ${config.auth.lockTime} minute(s).`
    );
  }

  // Step:3 Fetch user by email
  const user = await UserService.getUserByEmail(normalizedEmail);
  if (!user) {
    securityLogger.loginAttempt(normalizedEmail, 'unknown', false);
    await failLoginAttempt(normalizedEmail);
  }
  const existingUser = user!;

  // Step:4 Validate user account status (not banned or deleted)
  validateUserStatus(existingUser.status);

  // Step:5 Verify password hash
  const isPasswordValid = await bcrypt.compare(payload.password, existingUser.password);
  if (!isPasswordValid) {
    securityLogger.loginAttempt(normalizedEmail, 'unknown', false);
    await failLoginAttempt(normalizedEmail);
  }

  // Step:6 Clear attempt counter and lock on successful login
  await cacheService.del(CACHE_KEYS.AUTH.ATTEMPTS(normalizedEmail));
  await cacheService.del(CACHE_KEYS.AUTH.LOCK(normalizedEmail));

  // Step:7 Generate tokens in parallel
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(existingUser.id, existingUser.email, existingUser.role),
    generateRefreshToken(existingUser.id, existingUser.email, existingUser.role),
  ]);

  // Step:8 Store refresh token in cache with TTL
  await cacheService.set(
    CACHE_KEYS.AUTH.REFRESH_TOKEN(existingUser.id),
    refreshToken,
    CACHE_KEYS.TTL.WEEK
  );

  // Step:9 Log successful login
  securityLogger.loginAttempt(normalizedEmail, 'unknown', true);

  // Step:10 Return user and tokens
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

const resendVerificationOtp = async (sessionId: string) => {
  const challenge = await cacheService.get<IPendingEmailVerification>(
    CACHE_KEYS.AUTH.REGISTRATION_SESSION(sessionId)
  );

  if (!challenge) {
    throw new ApiError(StatusCodes.GONE, 'Verification session expired. Please register again.');
  }

  const normalizedEmail = normalizeEmail(challenge.email);
  const otp = generateOtp();
  const updatedChallenge: IPendingEmailVerification = {
    ...challenge,
    otpHash: hashOtp('registration', normalizedEmail, otp),
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  // Update both email and sessionId cache entries
  await cacheService.set(
    CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail),
    updatedChallenge,
    CACHE_KEYS.TTL.MEDIUM
  );

  await cacheService.set(
    CACHE_KEYS.AUTH.REGISTRATION_SESSION(sessionId),
    updatedChallenge,
    CACHE_KEYS.TTL.MEDIUM
  );

  try {
    await emailTemplates.sendVerificationEmail(normalizedEmail, otp);
  } catch (error) {
    await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION(normalizedEmail));
    await cacheService.del(CACHE_KEYS.AUTH.REGISTRATION_SESSION(sessionId));
    throw error;
  }
};

const refresh = async (refreshToken: string) => {
  // Step:1 Decode refresh token to get user ID
  const decoded = verifyRefreshToken(refreshToken);

  // Step:2 Verify token is stored in cache and matches
  const stored = await cacheService.get<string>(CACHE_KEYS.AUTH.REFRESH_TOKEN(decoded.userId));
  if (!stored || stored !== refreshToken) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid credentials.');
  }

  // Step:3 Fetch user from database
  const user = await UserService.getUserById(decoded.userId);
  if (!user) throw new ApiError(StatusCodes.UNAUTHORIZED, 'User not found.');

  // Step:4 Validate user account status
  validateUserStatus(user.status);

  // Step:5 Generate new tokens in parallel
  const [newAccessToken, newRefreshToken] = await Promise.all([
    generateAccessToken(user.id, user.email, user.role),
    generateRefreshToken(user.id, user.email, user.role),
  ]);

  // Step:6 Store new refresh token in cache with TTL
  await cacheService.set(
    CACHE_KEYS.AUTH.REFRESH_TOKEN(user.id),
    newRefreshToken,
    CACHE_KEYS.TTL.WEEK // 7 days in seconds
  );

  // Step:7 Return new tokens
  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

const forgotPassword = async (email: string): Promise<{ sessionId: string }> => {
  const normalizedEmail = normalizeEmail(email);
  const user = await UserService.getUserByEmail(normalizedEmail);
  const sessionId = generateOpaqueToken('fp_sess');

  if (!user) {
    // Don't reveal if email exists (security best practice)
    return { sessionId };
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
    CACHE_KEYS.AUTH.PASSWORD_RESET_SESSION(sessionId),
    resetChallenge,
    CACHE_KEYS.TTL.MEDIUM
  );

  try {
    await emailTemplates.sendResetPasswordEmail(user.email, otp);
  } catch (error) {
    await cacheService.del(CACHE_KEYS.AUTH.PASSWORD_RESET_SESSION(sessionId));
    throw error;
  }

  return { sessionId };
};

const verifyForgotPasswordOtp = async (
  sessionId: string,
  otp: string
): Promise<{ resetToken: string }> => {
  const challenge = await cacheService.get<IPasswordResetChallenge>(
    CACHE_KEYS.AUTH.PASSWORD_RESET_SESSION(sessionId)
  );

  if (!challenge) {
    throw new ApiError(StatusCodes.GONE, 'Verification code has expired. Please try again.');
  }

  const normalizedEmail = normalizeEmail(challenge.email);

  if (challenge.otpHash !== hashOtp('reset-password', normalizedEmail, otp)) {
    await handleOtpAttempt(
      CACHE_KEYS.AUTH.PASSWORD_RESET_SESSION(sessionId),
      CACHE_KEYS.AUTH.PASSWORD_RESET_ATTEMPTS(normalizedEmail),
      config.auth.otpMaxAttempts
    );
  }

  const resetToken = generateOpaqueToken('fp_rst');
  const grant: IPasswordResetGrant = {
    userId: challenge.userId,
    email: challenge.email,
    createdAt: new Date().toISOString(),
  };

  await cacheService.set(
    CACHE_KEYS.AUTH.PASSWORD_RESET_TOKEN(resetToken),
    grant,
    CACHE_KEYS.TTL.MEDIUM
  );

  await cacheService.del(CACHE_KEYS.AUTH.PASSWORD_RESET_SESSION(sessionId));
  await cacheService.del(CACHE_KEYS.AUTH.PASSWORD_RESET_ATTEMPTS(normalizedEmail));

  return { resetToken };
};

const resendForgotPasswordOtp = async (sessionId: string) => {
  const challenge = await cacheService.get<IPasswordResetChallenge>(
    CACHE_KEYS.AUTH.PASSWORD_RESET_SESSION(sessionId)
  );

  if (!challenge) {
    throw new ApiError(StatusCodes.GONE, 'Verification session expired. Please try again.');
  }

  const normalizedEmail = normalizeEmail(challenge.email);
  const otp = generateOtp();
  const updatedChallenge: IPasswordResetChallenge = {
    ...challenge,
    otpHash: hashOtp('reset-password', normalizedEmail, otp),
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  await cacheService.set(
    CACHE_KEYS.AUTH.PASSWORD_RESET_SESSION(sessionId),
    updatedChallenge,
    CACHE_KEYS.TTL.MEDIUM
  );

  await cacheService.del(CACHE_KEYS.AUTH.PASSWORD_RESET_ATTEMPTS(normalizedEmail));

  try {
    await emailTemplates.sendResetPasswordEmail(challenge.email, otp);
  } catch (error) {
    await cacheService.del(CACHE_KEYS.AUTH.PASSWORD_RESET_SESSION(sessionId));
    throw error;
  }
};

const resetPassword = async (resetToken: string, newPassword: string) => {
  if (!resetToken) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'resetToken is required.');
  }

  const grant = await cacheService.get<IPasswordResetGrant>(
    CACHE_KEYS.AUTH.PASSWORD_RESET_TOKEN(resetToken)
  );

  if (!grant) {
    throw new ApiError(StatusCodes.GONE, 'Reset token has expired. Please verify OTP again.');
  }

  const user = await UserService.getUserById(grant.userId);
  if (!user) {
    await cacheService.del(CACHE_KEYS.AUTH.PASSWORD_RESET_TOKEN(resetToken));
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  validateUserStatus(user.status);

  const hashedPassword = await getPasswordHash(newPassword);
  await UserService.updateUserPassword(user.id, hashedPassword);

  await cacheService.del(CACHE_KEYS.AUTH.PASSWORD_RESET_TOKEN(resetToken));

  await cacheService.del(CACHE_KEYS.AUTH.REFRESH_TOKEN(user.id));
  await cacheService.del(CACHE_KEYS.AUTH.PERMISSIONS(user.id));
};

const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await UserService.getUserByIdForAuth(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  validateUserStatus(user.status);

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
  verifyForgotPasswordOtp,
  resendForgotPasswordOtp,
  resetPassword,
  changePassword,
};
