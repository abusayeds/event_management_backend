import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import { CACHE_KEYS } from '../../cache/cache.keys';
import { cacheService } from '../../cache/cache.service';
import logger from '../../config/logger';
import ApiError from '../../utils/apiError';

// Normalize email to lowercase and trim whitespace
export const normalizeEmail = (email: string): string => email.toLowerCase().trim();

// Mask email for security logging (show first and last character)
export const maskEmail = (email: string): string => {
  const [name, domain] = email.split('@');
  const maskedName =
    name.charAt(0) +
    '*'.repeat(Math.max(1, name.length - 2)) +
    (name.length > 1 ? name.charAt(name.length - 1) : '');
  return `${maskedName}@${domain}`;
};

// Generate opaque token with random crypto bytes and prefix
export const generateOpaqueToken = (prefix: string): string => {
  return `${prefix}_${crypto.randomBytes(24).toString('base64url')}`;
};

// Generate 6-digit random OTP for email verification
export const generateOtp = (): string => Math.floor(100000 + Math.random() * 900000).toString();

// Hash OTP with SHA256 using purpose, email, and OTP
export const hashOtp = (purpose: string, email: string, otp: string): string =>
  crypto.createHash('sha256').update(`${purpose}:${email}:${otp}`).digest('hex');

// Hash password with bcrypt (12 rounds)
export const getPasswordHash = async (password: string): Promise<string> =>
  await bcrypt.hash(password, 12);

// Security logging utilities for authentication events
export const securityLogger = {
  loginAttempt: (email: string, ip: string, success: boolean): void => {
    logger.warn('Login attempt', {
      type: 'AUTHENTICATION',
      email: maskEmail(email), // ✅ Masked for security
      ip: ip || 'unknown',
      success,
      timestamp: new Date().toISOString(),
    });
  },
} as const;

// Handle OTP verification with rate limiting and attempt tracking
export const handleOtpAttempt = async (
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
      'Too many invalid OTP attempts. Request a new code.'
    );
  }

  throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid or expired OTP.');
};

// Validate user status
export const validateUserStatus = (status: string): void => {
  if (status === 'DELETED') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Your account has been deleted.');
  }
  if (status === 'BANNED') {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Your account has been banned.');
  }
};
