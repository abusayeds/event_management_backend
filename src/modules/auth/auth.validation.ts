import { z } from 'zod';

// Constants
const PASSWORD_MIN_LENGTH = 8;
const USER_FULL_NAME_MAX_LENGTH = 120;
const OTP_LENGTH = 6;

const login = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  cookies: z.object({}).optional(),
});

const register = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Full name is required').max(USER_FULL_NAME_MAX_LENGTH, 'Full name is too long'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(PASSWORD_MIN_LENGTH, 'Password must be at least 8 characters'),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  cookies: z.object({}).optional(),
});

const verifyEmail = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    otp: z.string().length(6, 'OTP must be 6 digits'),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  cookies: z.object({}).optional(),
});

const resendVerificationOtp = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  cookies: z.object({}).optional(),
});

const refresh = z
  .object({
    body: z
      .object({
        refreshToken: z.string().min(1, 'Refresh token is required').optional(),
      })
      .optional(),
    params: z.object({}).optional(),
    query: z.object({}).optional(),
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

const logout = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  cookies: z.object({}).optional(),
});

const forgotPassword = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  cookies: z.object({}).optional(),
});

const resetPassword = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    otp: z.string().length(6, 'OTP must be 6 digits'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  cookies: z.object({}).optional(),
});

const changePassword = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  cookies: z.object({}).optional(),
});

export const AuthValidation = {
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
