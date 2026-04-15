import { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../utils/apiError';

// Types
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

// General rate limiter
export const createRateLimiter = (config: RateLimitConfig) => {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.maxRequests,
    message: {
      success: false,
      statusCode: StatusCodes.TOO_MANY_REQUESTS,
      message: config.message || 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: config.keyGenerator,
    handler: (req: Request, res: Response) => {
      throw new ApiError(
        StatusCodes.TOO_MANY_REQUESTS,
        config.message || 'Too many requests, please try again later.'
      );
    },
  });
};

const getIpKey = (req: Request): string => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return ipKeyGenerator(ip);
};

// Predefined rate limiters
export const rateLimiters = {
  // General API rate limiter
  generalRateLimiter: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  }),

  // Auth rate limiters
  loginRateLimiter: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many login attempts, please try again after 15 minutes.',
    keyGenerator: (req: Request) => {
      const ip = getIpKey(req);
      const email = req.body?.email || 'unknown';
      return `login:${ip}:${email}`;
    },
  }),

  emailLoginRateLimiter: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 500,
    message: 'Too many login attempts for this email, please try again after 1 hour.',
    keyGenerator: (req: Request) => `email:${req.body?.email || 'unknown'}`,
  }),

  registerRateLimiter: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    message: 'Too many registration attempts, please try again after 1 hour.',
    keyGenerator: (req: Request) => `register:${getIpKey(req)}`,
  }),

  // OTP rate limiters
  verifyOtpRateLimiter: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    message: 'Too many OTP verification attempts, please try again after 15 minutes.',
    keyGenerator: (req: Request) => `verify-otp:${req.body?.email || 'unknown'}`,
  }),

  resendOtpRateLimiter: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 3,
    message: 'Too many OTP resend requests, please try again after 15 minutes.',
    keyGenerator: (req: Request) => `resend-otp:${req.body?.email || 'unknown'}`,
  }),

  // Password reset rate limiters
  forgotPasswordRateLimiter: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 3,
    message: 'Too many password reset requests, please try again after 15 minutes.',
    keyGenerator: (req: Request) => `forgot-password:${req.body?.email || 'unknown'}`,
  }),

  resetPasswordRateLimiter: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many password reset attempts, please try again after 15 minutes.',
    keyGenerator: (req: Request) => `reset-password:${req.body?.email || 'unknown'}`,
  }),

  // Token refresh rate limiter
  refreshTokenRateLimiter: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    message: 'Too many token refresh attempts, please try again after 15 minutes.',
    keyGenerator: (req: Request) => `refresh-token:${getIpKey(req)}`,
  }),
};

export default rateLimiters;
