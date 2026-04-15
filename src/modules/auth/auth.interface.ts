export interface IRegisterPayload {
  fullName: string;
  email: string;
  password: string;
}

export interface IVerifyEmailPayload {
  email: string;
  otp: string;
}

export interface IResendVerificationOtpPayload {
  email: string;
}

export interface IPendingEmailVerification {
  fullName: string;
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
