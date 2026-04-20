import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
export const UPPERCASE_LETTER_REGEX = /[A-Z]/;

export const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .refine(
    password => UPPERCASE_LETTER_REGEX.test(password),
    'Password must contain at least one uppercase letter'
  );
