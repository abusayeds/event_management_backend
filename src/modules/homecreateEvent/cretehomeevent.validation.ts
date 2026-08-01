import { z } from 'zod';
import { HomeEventRepeat } from '../../../prisma/generated/enums';

// Derive the zod enum from the local enum values
const repeatFunctionEnum = z.enum(
  Object.values(HomeEventRepeat) as [HomeEventRepeat, ...HomeEventRepeat[]]
);

const createHomeEventZodSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(1, 'Title is required'),
      location: z.string().trim().min(1, 'Location is required'),
      member: z.string().trim().min(1).optional(),
      startsAt: z.string().refine(val => !isNaN(Date.parse(val)), 'startsAt must be a valid date'),
      endsAt: z.string().refine(val => !isNaN(Date.parse(val)), 'endsAt must be a valid date'),
      repeatFunction: repeatFunctionEnum.default(HomeEventRepeat.Never),
      url: z.string().trim().url('Enter a valid URL').optional().or(z.literal('')),
      note: z.string().trim().optional(),
    })
    .refine(data => new Date(data.endsAt) > new Date(data.startsAt), {
      message: 'endsAt must be after startsAt',
      path: ['endsAt'],
    }),
});

const updateHomeEventZodSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(1).optional(),
      location: z.string().trim().min(1).optional(),
      member: z.string().trim().min(1).optional(),
      startsAt: z
        .string()
        .refine(val => !isNaN(Date.parse(val)), 'startsAt must be a valid date')
        .optional(),
      endsAt: z
        .string()
        .refine(val => !isNaN(Date.parse(val)), 'endsAt must be a valid date')
        .optional(),
      repeatFunction: repeatFunctionEnum.optional(),
      url: z.string().trim().url('Enter a valid URL').optional().or(z.literal('')),
      note: z.string().trim().optional(),
    })
    .refine(
      data => {
        if (data.startsAt && data.endsAt) {
          return new Date(data.endsAt) > new Date(data.startsAt);
        }
        return true;
      },
      { message: 'endsAt must be after startsAt', path: ['endsAt'] }
    ),
});

export const HomeEventValidation = {
  createHomeEventZodSchema,
  updateHomeEventZodSchema,
};
