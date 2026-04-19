import { z } from 'zod';
import { FamilyRole, UserGender } from '../../../prisma/generated/enums';

const familyIdParamSchema = z.object({
  familyId: z.string().min(1, 'familyId is required'),
});

const familyIdAndUserIdParamSchema = z.object({
  familyId: z.string().min(1, 'familyId is required'),
  userId: z.string().min(1, 'userId is required'),
});

const addFamilyMember = z.object({
  body: z.object({
    familyId: z.string().min(1, 'familyId is required'),
    username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30).optional(),
    firstName: z.string().trim().min(1, 'firstName is required').max(60, 'firstName is too long'),
    lastName: z.string().trim().min(1, 'lastName is required').max(60, 'lastName is too long'),
    gender: z.enum(Object.values(UserGender) as [string, ...string[]]),
    birthDate: z.string().min(1, 'birthDate is required'),
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
    role: z.enum(Object.values(FamilyRole) as [string, ...string[]]).optional(),
  }),
});

const getFamilyMembersByFamilyId = z.object({
  params: familyIdParamSchema,
  query: z.object({
    role: z.enum(Object.values(FamilyRole) as [string, ...string[]]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

const removeFamilyMember = z.object({
  params: familyIdAndUserIdParamSchema,
});

const changeFamilyOwner = z.object({
  body: z.object({
    familyId: z.string().min(1, 'familyId is required'),
    newOwnerUserId: z.string().min(1, 'newOwnerUserId is required'),
  }),
});

export const FamilyMemberValidation = {
  addFamilyMember,
  getFamilyMembersByFamilyId,
  removeFamilyMember,
  changeFamilyOwner,
};
