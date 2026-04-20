import { z } from 'zod';
import { UserGender } from '../../../prisma/generated/enums';
import { strongPasswordSchema } from '../../utils/passwordPolicy';

// Login request validation
const login = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

// Registration with user profile information
const register = z.object({
  body: z.object({
    username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30),
    firstName: z.string().trim().min(1, 'firstName is required').max(60, 'firstName is too long'),
    lastName: z.string().trim().min(1, 'lastName is required').max(60, 'lastName is too long'),
    gender: z.enum(Object.values(UserGender) as [string, ...string[]]),
    birthDate: z.string().min(1, 'birthDate is required'),
    location: z.string().trim().min(1, 'location is required'),
    country: z.string().trim().min(1, 'country is required'),
    state: z.string().trim().min(1, 'state is required'),
    city: z.string().trim().min(1, 'city is required'),
    email: z.string().email('Invalid email address'),
    password: strongPasswordSchema,
  }),
});

// Email verification with OTP validation
const verifyEmail = z.object({
  body: z.object({
    otp: z.string().length(6, 'OTP must be 6 digits'),
    sessionId: z.string().min(1, 'sessionId is required'),
  }),
});

// Resend verification OTP request
const resendVerificationOtp = z.object({
  body: z.object({
    sessionId: z.string().min(1, 'sessionId is required'),
  }),
});

// Token refresh validation - supports cookie or body
const refresh = z
  .object({
    body: z
      .object({
        refreshToken: z.string().min(1, 'Refresh token is required').optional(),
      })
      .optional(),
    cookies: z
      .object({
        refreshToken: z.string().min(1, 'Refresh token is required').optional(),
      })
      .optional(),
  })
  .refine(
    data => Boolean(data.body?.refreshToken || data.cookies?.refreshToken),
    'Refresh token is required in cookie or request body'
  );

// Logout endpoint validation
const logout = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  cookies: z.object({}).optional(),
});

// Forgot password request validation
const forgotPassword = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

// Verify OTP from forgot password email
const verifyForgotPasswordOtp = z.object({
  body: z.object({
    sessionId: z.string().min(1, 'sessionId is required'),
    otp: z.string().length(6, 'OTP must be 6 digits'),
  }),
});

// Resend forgot password OTP request
const resendForgotPasswordOtp = z.object({
  body: z.object({
    sessionId: z.string().min(1, 'sessionId is required'),
  }),
});

// Reset password with reset token validation
const resetPassword = z.object({
  body: z.object({
    resetToken: z.string().min(1, 'resetToken is required'),
    newPassword: strongPasswordSchema,
  }),
});

// Change password for authenticated user
const changePassword = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: strongPasswordSchema,
  }),
});

export const AuthValidation = {
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
