import { z } from 'zod';
import { UserGender, UserStatus } from '../../../prisma/generated/enums';

const idParamSchema = z.object({
  id: z.string().min(1, 'User id is required'),
});

const createUser = z.object({
  body: z.object({
    username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30).optional(),
    accountId: z
      .string()
      .regex(/^\d{8,12}$/, 'accountId must be 8 to 12 digits')
      .optional(),
    firstName: z.string().trim().min(1, 'firstName is required').max(60, 'firstName is too long'),
    lastName: z.string().trim().min(1, 'lastName is required').max(60, 'lastName is too long'),
    gender: z.enum(Object.values(UserGender) as [string, ...string[]]),
    birthdate: z.string().min(1, 'birthdate is required'),
    location: z.string().trim().min(1, 'location is required'),
    country: z.string().trim().min(1, 'country is required'),
    state: z.string().trim().min(1, 'state is required'),
    city: z.string().trim().min(1, 'city is required'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    relationShip: z.string().optional(),
    skills: z.array(z.string()).optional(),
    isIndependent: z.boolean().optional(),
    createdById: z.string().optional(),
  }),
});

const getAllUsers = z.object({
  query: z.object({
    fullName: z.string().optional(),
    username: z.string().optional(),
    email: z.string().optional(),
    status: z.enum(Object.values(UserStatus) as [string, ...string[]]).optional(),
    role: z.string().optional(),
    roleId: z.string().optional(),
    createdByOwner: z.string().optional(),
    createdById: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

const getUserById = z.object({
  params: idParamSchema,
});

const updateUser = z.object({
  body: z
    .object({
      username: z
        .string()
        .trim()
        .min(3, 'Username must be at least 3 characters')
        .max(30)
        .optional(),
      firstName: z.string().min(1, 'firstName cannot be empty').max(60).optional(),
      lastName: z.string().min(1, 'lastName cannot be empty').max(60).optional(),
      gender: z.enum(Object.values(UserGender) as [string, ...string[]]).optional(),
      email: z.string().email('Invalid email address').optional(),
    })
    .refine((value: any) => Object.keys(value).length > 0, {
      message: 'At least one field is required to update user',
    }),
  params: idParamSchema,
});

const updateUserStatus = z.object({
  body: z.object({
    status: z.enum(Object.values(UserStatus) as [string, ...string[]]),
  }),
  params: idParamSchema,
});

const deleteUser = z.object({
  params: idParamSchema,
});

export const UserValidation = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  deleteUser,
};
