import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
export const UPPERCASE_LETTER_REGEX = /[A-Z]/;
export const LOWERCASE_LETTER_REGEX = /[a-z]/;
export const DIGIT_REGEX = /[0-9]/;
export const SPECIAL_CHAR_REGEX = /[!@#$%^&*()\-_=+\[\]{};':",.<>/?\\|`~]/;

export const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .refine(
    password => UPPERCASE_LETTER_REGEX.test(password),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    password => LOWERCASE_LETTER_REGEX.test(password),
    'Password must contain at least one lowercase letter'
  )
  .refine(password => DIGIT_REGEX.test(password), 'Password must contain at least one digit')
  .refine(
    password => SPECIAL_CHAR_REGEX.test(password),
    'Password must contain at least one special character'
  );
