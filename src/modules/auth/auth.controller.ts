import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../utils/apiError';
import asyncHandler from '../../utils/asyncHandler';
import apiResponse from '../../utils/apiResponse';
import config from '../../config';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import {
  IChangePasswordPayload,
  IForgotPasswordPayload,
  ILoginPayload,
  IRegisterPayload,
  IResendVerificationOtpPayload,
  IResetPasswordPayload,
  IVerifyEmailPayload,
} from './auth.interface';
import { AuthService } from './auth.service';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const getCookieOptions = () => ({
  httpOnly: true,
  secure: config.env === 'production',
  sameSite: 'strict' as const,
  maxAge: REFRESH_COOKIE_MAX_AGE,
  path: '/',
});

// POST /api/v1/auth/register
const register = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as IRegisterPayload;
  await AuthService.register(payload);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Registration started. Please verify the OTP sent to your email.',
  });
});

// POST /api/v1/auth/verify-email
const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as IVerifyEmailPayload;
  await AuthService.verifyEmail(payload.email, payload.otp);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Email verified successfully. Your account is now active.',
  });
});

// POST /api/v1/auth/resend-verification-otp
const resendVerificationOtp = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as IResendVerificationOtpPayload;
  await AuthService.resendVerificationOtp(payload.email);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'A new verification OTP has been sent to your email.',
  });
});

// POST /api/v1/auth/login
const login = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as ILoginPayload;
  const result = await AuthService.login(payload);

  res.cookie(REFRESH_COOKIE_NAME, result.tokens.refreshToken, getCookieOptions());

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Login successful.',
    data: result,
  });
});

// POST /api/v1/auth/forgot-password
const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as IForgotPasswordPayload;
  await AuthService.forgotPassword(payload.email);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'If the email exists, a password reset OTP has been sent.',
  });
});

// POST /api/v1/auth/reset-password
const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as IResetPasswordPayload;
  await AuthService.resetPassword(payload.email, payload.otp, payload.newPassword);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Password has been reset successfully.',
  });
});
// POST /api/v1/auth/refresh
const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken =
    (req.cookies?.[REFRESH_COOKIE_NAME] as string) || (req.body?.refreshToken as string);

  if (!refreshToken) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Refresh token is missing.');
  }

  const result = await AuthService.refresh(refreshToken);

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getCookieOptions());

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Access token refreshed successfully.',
    data: result,
  });
});

// POST /api/v1/auth/change-password
const changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Unauthorized user context.');
  }

  const payload = req.body as IChangePasswordPayload;
  await AuthService.changePassword(req.user.userId, payload.currentPassword, payload.newPassword);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Password changed successfully.',
  });
});

// POST /api/v1/auth/logout
const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const authorization = req.headers.authorization;
  const accessToken = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : authorization || '';

  if (!req.user?.userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Unauthorized user context.');
  }

  if (!accessToken) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Access token is missing.');
  }

  await AuthService.logout({
    userId: req.user.userId,
    accessToken,
  });

  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'strict',
    path: '/',
  });

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Logout successful.',
  });
});

export const AuthController = {
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
