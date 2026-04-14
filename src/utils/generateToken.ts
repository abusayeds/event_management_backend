import jwt from 'jsonwebtoken';
import config from '../config';
import { IDecodedToken } from '../interfaces/token.interface';

export const generateAccessToken = (userId: string, email: string, role: string): string => {
  const payload = { userId, email, role };
  return jwt.sign(payload, config.jwt.accessSecret as string, {
    expiresIn: '15m', // 15 minutes
  });
};

export const generateRefreshToken = (userId: string, email: string, role: string): string => {
  const payload = { userId, email, role };
  return jwt.sign(payload, config.jwt.refreshSecret as string, {
    expiresIn: '7d', // 7 days
  });
};

export const generateResetToken = (userId: string, email: string, role: string): string => {
  const payload = { userId, email, role };
  return jwt.sign(payload, config.jwt.resetPasswordSecret as string, {
    expiresIn: '30m', // 30 minutes
  });
};

export const verifyAccessToken = (token: string): IDecodedToken => {
  return jwt.verify(token, config.jwt.accessSecret as string) as IDecodedToken;
};

export const verifyRefreshToken = (token: string): IDecodedToken => {
  return jwt.verify(token, config.jwt.refreshSecret as string) as IDecodedToken;
};

export const verifyResetToken = (token: string): IDecodedToken => {
  return jwt.verify(token, config.jwt.resetPasswordSecret as string) as IDecodedToken;
};

export const decodeToken = (token: string): IDecodedToken => {
  return jwt.decode(token) as IDecodedToken;
};
