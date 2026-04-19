import jwt, { SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import config from '../config';
import { IDecodedToken } from '../interfaces/token.interface';

const toJwtExpiresIn = (value: unknown, fallback: StringValue): SignOptions['expiresIn'] => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value as StringValue;
  }

  return fallback;
};

export const generateAccessToken = (userId: string, email: string, role: string): string => {
  const payload = { userId, email, role };
  const secret = config.jwt.accessSecret as string;
  const options: SignOptions = {
    expiresIn: toJwtExpiresIn(config.jwt.accessExpiration, '15m'),
  };
  return jwt.sign(payload, secret, options);
};

export const generateRefreshToken = (userId: string, email: string, role: string): string => {
  const payload = { userId, email, role };
  const secret = config.jwt.refreshSecret as string;
  const options: SignOptions = {
    expiresIn: toJwtExpiresIn(config.jwt.refreshExpiration, '7d'),
  };
  return jwt.sign(payload, secret, options);
};

export const generateResetToken = (userId: string, email: string, role: string): string => {
  const payload = { userId, email, role };
  const secret = config.jwt.resetPasswordSecret as string;
  const options: SignOptions = {
    expiresIn: toJwtExpiresIn(config.jwt.resetPasswordExpiration, '30m'),
};
  return jwt.sign(payload, secret, options);
};

export const verifyAccessToken = (token: string): IDecodedToken => {
  const secret = config.jwt.accessSecret as string;
  return jwt.verify(token, secret) as IDecodedToken;
};

export const verifyRefreshToken = (token: string): IDecodedToken => {
  const secret = config.jwt.refreshSecret as string;
  return jwt.verify(token, secret) as IDecodedToken;
};

export const verifyResetToken = (token: string): IDecodedToken => {
  const secret = config.jwt.resetPasswordSecret as string;
  return jwt.verify(token, secret) as IDecodedToken;
};

export const decodeToken = (token: string): IDecodedToken => {
  return jwt.decode(token) as IDecodedToken;
};
