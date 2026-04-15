import { UserGender } from '../../../prisma/generated/enums';

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

export interface IVerifyEmailPayload {
  otp: string;
  sessionId: string;
}

export interface IResendVerificationOtpPayload {
  sessionId: string;
}

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
  passwordHash: string;
  otpHash: string;
  attempts: number;
  createdAt: string;
}

export interface IPasswordResetChallenge {
  userId: string;
  email: string;
  otpHash: string;
  attempts: number;
  createdAt: string;
}

export interface ILoginPayload {
  email: string;
  password: string;
}

export interface ILogoutPayload {
  userId: string;
  accessToken: string;
}

export interface IForgotPasswordPayload {
  email: string;
}

export interface IResetPasswordPayload {
  email: string;
  otp: string;
  newPassword: string;
}

export interface IChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}
