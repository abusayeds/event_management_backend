import { Router } from 'express';
import { auth } from '../../middleware/auth.middleware';
import { rateLimiters } from '../../middleware/rateLimiter.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { AuthController } from './auth.controller';
import { AuthValidation } from './auth.validation';

const router = Router();

router.post(
  '/register',
  rateLimiters.registerRateLimiter,
  validateRequest(AuthValidation.register),
  AuthController.register
);
router.post(
  '/verify-email',
  rateLimiters.verifyOtpRateLimiter,
  validateRequest(AuthValidation.verifyEmail),
  AuthController.verifyEmail
);
router.post(
  '/resend-verification-otp',
  rateLimiters.resendOtpRateLimiter,
  validateRequest(AuthValidation.resendVerificationOtp),
  AuthController.resendVerificationOtp
);

router.post(
  '/login',
  rateLimiters.loginRateLimiter,
  rateLimiters.emailLoginRateLimiter,
  validateRequest(AuthValidation.login),
  AuthController.login
);
router.post(
  '/refresh',
  rateLimiters.refreshTokenRateLimiter,
  validateRequest(AuthValidation.refresh),
  AuthController.refresh
);
router.post('/logout', auth(), validateRequest(AuthValidation.logout), AuthController.logout);
router.post(
  '/forgot-password',
  rateLimiters.forgotPasswordRateLimiter,
  validateRequest(AuthValidation.forgotPassword),
  AuthController.forgotPassword
);
router.post(
  '/reset-password',
  rateLimiters.resetPasswordRateLimiter,
  validateRequest(AuthValidation.resetPassword),
  AuthController.resetPassword
);
router.post(
  '/change-password',
  auth(),
  validateRequest(AuthValidation.changePassword),
  AuthController.changePassword
);

export const AuthRoutes: Router = router;
