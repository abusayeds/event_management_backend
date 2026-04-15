import { z } from 'zod';
import { UserGender } from '../../../prisma/generated/enums';

// Password Validation Schema
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine(
    password => /[A-Z]/.test(password),
    'Password must contain at least one uppercase letter'
  );

const login = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

const register = z.object({
  body: z.object({
    username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30).optional(),
    firstName: z.string().trim().min(1, 'firstName is required').max(60, 'firstName is too long'),
    lastName: z.string().trim().min(1, 'lastName is required').max(60, 'lastName is too long'),
    gender: z.enum(Object.values(UserGender) as [string, ...string[]]),
    birthdate: z.string().min(1, 'birthdate is required'),
    location: z.string().trim().min(1, 'location is required'),
    country: z.string().trim().min(1, 'country is required'),
    state: z.string().trim().min(1, 'state is required'),
    city: z.string().trim().min(1, 'city is required'),
    email: z.string().email('Invalid email address'),
    password: passwordSchema,
  }),
});

const verifyEmail = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    otp: z.string().length(6, 'OTP must be 6 digits'),
  }),
});

const resendVerificationOtp = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

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
});

const resetPassword = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    otp: z.string().length(6, 'OTP must be 6 digits'),
    newPassword: passwordSchema,
  }),
});

const changePassword = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
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
  resetPassword,
  changePassword,
};
