import { UserGender } from '../../../prisma/generated/enums';

// Registration payload with user profile details
export interface IRegisterPayload {
  username: string;
  firstName: string;
  lastName: string;
  gender: UserGender;
  birthDate: string;
  location: string;
  country: string;
  state: string;
  city: string;
  email: string;
  password: string;
}

// Email verification request with OTP
export interface IVerifyEmailPayload {
  otp: string;
  sessionId: string;
}

// Resend verification OTP request
export interface IResendVerificationOtpPayload {
  sessionId: string;
}

// Pending registration verification data cached in Redis
export interface IPendingEmailVerification {
  username?: string;
  firstName: string;
  lastName: string;
  gender: UserGender;
  birthDate: string;
  location: string;
  country: string;
  state: string;
  city: string;
  email: string;
  password: string;
  otpHash: string;
  attempts: number;
  createdAt: string;
}

// Password reset challenge data for OTP verification
export interface IPasswordResetChallenge {
  userId: string;
  email: string;
  otpHash: string;
  attempts: number;
  createdAt: string;
}

// Login request payload
export interface ILoginPayload {
  email: string;
  password: string;
}

// Logout request with user and token information
export interface ILogoutPayload {
  userId: string;
  accessToken: string;
}

// Forgot password request payload
export interface IForgotPasswordPayload {
  email: string;
}

// Forgot password OTP verification request
export interface IVerifyForgotPasswordOtpPayload {
  sessionId: string;
  otp: string;
}

// Resend forgot password OTP request
export interface IResendForgotPasswordOtpPayload {
  sessionId: string;
}

// Password reset grant after OTP verification
export interface IPasswordResetGrant {
  userId: string;
  email: string;
  createdAt: string;
}

// Reset password request payload
export interface IResetPasswordPayload {
  resetToken: string;
  newPassword: string;
}

// Change password request for authenticated user
export interface IChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}
