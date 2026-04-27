import { z } from 'zod';

const upsertPageBody = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      v => ['about', 'privacy', 'terms'].includes(v),
      'Invalid key. Use about, privacy, or terms.'
    ),
  title: z.string().trim().max(255).optional().nullable(),
  content: z.string().trim().min(1, 'content is required'),
  isActive: z.coerce.boolean().optional(),
});

const addOrEditPage = z.object({ body: upsertPageBody });

const getPage = z.object({
  params: z.object({
    key: z
      .string()
      .trim()
      .toLowerCase()
      .refine(
        v => ['about', 'privacy', 'terms'].includes(v),
        'Invalid key. Use about, privacy, or terms.'
      ),
  }),
});

export const SettingsValidation = {
  addOrEditPage,
  getPage,
};
