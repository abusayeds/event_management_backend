import { z } from 'zod';
import { UserStatus } from '../../../prisma/generated/enums';

const idParamSchema = z.object({
  id: z.string().min(1, 'User id is required'),
});

const createUser = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Full name is required').max(120, 'Full name is too long'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    roleId: z.string().min(1, 'Role id is required'),
  }),
});

const getAllUsers = z.object({
  query: z.object({
    fullName: z.string().optional(),
    email: z.string().optional(),
    status: z.enum(Object.values(UserStatus) as [string, ...string[]]).optional(),
    roleId: z.string().optional(),
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
      fullName: z.string().min(1, 'Full name cannot be empty').max(120).optional(),
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
