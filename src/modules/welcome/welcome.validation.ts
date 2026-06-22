import { z } from 'zod';
import { WELCOME_MODULE_PARAM_KEYS } from './welcome.interface';

const welcomeKeyParam = z
  .string()
  .trim()
  .toLowerCase()
  .refine(
    v =>
      WELCOME_MODULE_PARAM_KEYS.includes(v as (typeof WELCOME_MODULE_PARAM_KEYS)[number]) ||
      v === 'eventcalendars',
    'Invalid key. Use event-calendars, activity-suggestions, resource-sharing, or customizable-profiles.'
  );

const upsertPageBody = z.object({
  title: z.string().trim().max(255).optional().nullable(),
  content: z.string().trim().min(1, 'content is required'),
  isActive: z.coerce.boolean().optional(),
});

const upsertPage = z.object({
  params: z.object({ key: welcomeKeyParam }),
  body: upsertPageBody,
});

const getPage = z.object({
  params: z.object({ key: welcomeKeyParam }),
});

export const WelcomeValidation = {
  upsertPage,
  getPage,
};
