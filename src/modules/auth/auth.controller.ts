import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import config from '../../config';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import ApiError from '../../utils/apiError';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import {
  IChangePasswordPayload,
  IForgotPasswordPayload,
  ILoginPayload,
  IRegisterPayload,
  IResendForgotPasswordOtpPayload,
  IResendVerificationOtpPayload,
  IResetPasswordPayload,
  IVerifyEmailPayload,
  IVerifyForgotPasswordOtpPayload,
} from './auth.interface';
import { AuthService } from './auth.service';

// Get secure HTTP-only cookie options for tokens
const getCookieOptions = () => ({
  httpOnly: true,
  secure: config.env === 'production',
  sameSite: 'strict' as const,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  path: '/',
});

// Register user with email verification OTP
const register = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as IRegisterPayload;
  const { sessionId } = await AuthService.register(payload);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Registration started. Please verify the OTP sent to your email.',
    data: { sessionId },
  });
});

// Verify email with OTP and activate account
const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as IVerifyEmailPayload;
  const result = await AuthService.verifyEmail(payload.sessionId, payload.otp);

  // Set refresh token cookie
  res.cookie('refreshToken', result.tokens.refreshToken, getCookieOptions());

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Email verified successfully. Your account is now active.',
    data: result,
  });
});

// Resend OTP for email verification
const resendVerificationOtp = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as IResendVerificationOtpPayload;
  await AuthService.resendVerificationOtp(payload.sessionId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'A new verification OTP has been sent to your email.',
  });
});

// Login with email and password
const login = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as ILoginPayload;
  const result = await AuthService.login(payload);

  res.cookie('refreshToken', result.tokens.refreshToken, getCookieOptions());

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Login successful.',
    data: result,
  });
});

// Initiate password reset with OTP
const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as IForgotPasswordPayload;
  const { sessionId } = await AuthService.forgotPassword(payload.email);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'If the email exists, a password reset OTP has been sent.',
    data: { sessionId },
  });
});

// Verify OTP for password reset
const verifyForgotPasswordOtp = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as IVerifyForgotPasswordOtpPayload;
  const { resetToken } = await AuthService.verifyForgotPasswordOtp(payload.sessionId, payload.otp);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'OTP verified successfully.',
    data: { resetToken },
  });
});

// Resend OTP for password reset
const resendForgotPasswordOtp = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as IResendForgotPasswordOtpPayload;
  await AuthService.resendForgotPasswordOtp(payload.sessionId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'A new password reset OTP has been sent to your email.',
  });
});

// Reset password with reset token
const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as IResetPasswordPayload;
  await AuthService.resetPassword(payload.resetToken, payload.newPassword);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Password has been reset successfully.',
  });
});

// Refresh access token using refresh token
const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken =
    (req.cookies?.['refreshToken'] as string) || (req.body?.refreshToken as string);

  if (!refreshToken) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Refresh token is missing.');
  }

  const result = await AuthService.refresh(refreshToken);

  res.cookie('refreshToken', result.refreshToken, getCookieOptions());

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Access token refreshed successfully.',
    data: result,
  });
});

// Change password for authenticated user
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

// Logout user and revoke tokens
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

  res.clearCookie('refreshToken', {
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
  verifyForgotPasswordOtp,
  resendForgotPasswordOtp,
  resetPassword,
  changePassword,
};
