import { UserStatus } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import {
  createPaginationQuery,
  createPaginationResult,
  PaginationOptions,
  PaginationResult,
  parsePaginationOptions,
} from '../../utils/paginate';
import { skillLabel } from './user.helpers';
import { ICreateUserPayload, IUpdateUserPayload, IUserFilters, IUserSkillInput } from './user.interface';

const userSkillSelect = {
  id: true,
  programId: true,
  programName: true,
  startYear: true,
} as const;

// User full select
export const userFullSelect = {
  id: true,
  accountId: true,
  firstName: true,
  lastName: true,
  username: true,
  displayName: true,
  email: true,
  phoneNumber: true,
  gender: true,
  birthDate: true,
  profilePicture: true,
  location: true,
  country: true,
  state: true,
  city: true,
  skills: true,
  role: true,
  status: true,
  hasSeparateAccount: true,
  createdByOwner: true,
  contributionScore: true,
  userSkills: {
    select: userSkillSelect,
    orderBy: { startYear: 'desc' as const },
  },
};

// User list select
export const userListSelect = {
  id: true,
  accountId: true,
  firstName: true,
  lastName: true,
  username: true,
  displayName: true,
  email: true,
  status: true,
  createdAt: true,
  createdByOwner: true,
  role: true,
};

// Create User
const createUser = async (userData: ICreateUserPayload) => {
  const { createdById, accountId, username, birthDate, ...rest } = userData;
  if (!accountId) {
    throw new Error('accountId is required while creating user.');
  }
  if (!username) {
    throw new Error('username is required while creating user.');
  }

  return database.user.create({
    data: {
      ...rest,
      accountId,
      username,
      birthDate: new Date(birthDate),
      createdByOwner: createdById,
    },
    select: userListSelect,
  });
};

// Get User by ID
const getUserById = async (id: string) => {
  return database.user.findFirst({
    where: { id, status: { not: UserStatus.DELETED } },
    select: {
      ...userFullSelect,
      password: true,
    },
  });
};

// Get User by ID Public
const getUserByIdPublic = async (id: string) => {
  return database.user.findFirst({
    where: { id, status: { not: UserStatus.DELETED } },
    select: userFullSelect,
  });
};

// Get User by Email
const getUserByEmail = async (email: string) => {
  return database.user.findFirst({
    where: { email, status: { not: UserStatus.DELETED } },
    select: {
      ...userFullSelect,
      password: true,
    },
  });
};

// Get All Users with Filters + Pagination
const getAllUsers = async (
  filters: IUserFilters,
  options: PaginationOptions
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where: any = {
    status: { not: UserStatus.DELETED },
  };

  if (filters.username) {
    where.username = { contains: filters.username, mode: 'insensitive' };
  }

  if (filters.date) {
    const parsedDate = new Date(filters.date);
    if (!Number.isNaN(parsedDate.getTime())) {
      const start = new Date(parsedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.createdAt = {
        gte: start,
        lt: end,
      };
    }
  }

  const [users, total] = await Promise.all([
    database.user.findMany({
      where,
      select: userListSelect,
      skip,
      take,
      orderBy,
    }),
    database.user.count({ where }),
  ]);

  return createPaginationResult(users, total, pagination);
};

// Update User by ID
const updateUserById = async (id: string, data: IUpdateUserPayload) => {
  const { birthDate, skills: _skills, ...rest } = data;

  const cleaned = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined)
  ) as Omit<IUpdateUserPayload, 'birthDate' | 'skills'>;

  return database.user.update({
    where: { id, status: { not: UserStatus.DELETED } },
    data: {
      ...cleaned,
      ...(birthDate !== undefined ? { birthDate: new Date(birthDate) } : {}),
    },
    select: userFullSelect,
  });
};

const findOrCreateProgramByName = async (name: string) => {
  const normalizedName = name.trim();
  const existing = await database.program.findFirst({
    where: {
      name: { equals: normalizedName, mode: 'insensitive' },
      isDeleted: false,
    },
    select: { id: true, name: true },
  });
  if (existing) {
    return existing;
  }

  return database.program.create({
    data: {
      name: normalizedName,
    },
    select: { id: true, name: true },
  });
};

const getProgramById = async (id: string) => {
  return database.program.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, name: true },
  });
};

const listActivePrograms = async () => {
  return database.program.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
};

const replaceUserSkills = async (userId: string, skills: Array<IUserSkillInput & { programName: string; programId: string | null }>) => {
  const labels = skills.map(s => skillLabel(s.programName, s.startYear));

  await database.$transaction(async tx => {
    await tx.userSkill.deleteMany({ where: { userId } });
    if (skills.length) {
      await tx.userSkill.createMany({
        data: skills.map(s => ({
          userId,
          programId: s.programId,
          programName: s.programName,
          startYear: s.startYear,
        })),
      });
    }
    await tx.user.update({
      where: { id: userId },
      data: { skills: labels },
    });
  });

  return database.userSkill.findMany({
    where: { userId },
    select: userSkillSelect,
    orderBy: { startYear: 'desc' },
  });
};

// Update User Status
const updateUserStatus = async (id: string, status: UserStatus) => {
  return database.user.update({
    where: { id, status: { not: UserStatus.DELETED } },
    data: { status },
    select: userListSelect,
  });
};

const updateUserIndependentStatus = async (id: string, hasSeparateAccount: boolean) => {
  return database.user.update({
    where: { id, status: { not: UserStatus.DELETED } },
    data: { hasSeparateAccount },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      hasSeparateAccount: true,
      status: true,
      role: true,
    },
  });
};

const updateUserPasswordById = async (id: string, hashedPassword: string) => {
  return database.user.update({
    where: { id, status: { not: UserStatus.DELETED } },
    data: { password: hashedPassword },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });
};

// Delete User (Hard Delete)
const deleteUserById = async (id: string) => {
  return database.user.update({
    where: { id },
    data: { status: 'DELETED' },
  });
};

// Email Exists Check
const isEmailExists = async (email: string, excludeUserId?: string): Promise<boolean> => {
  const user = await database.user.findFirst({
    where: {
      email,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      status: { not: UserStatus.DELETED },
    },
    select: { id: true },
  });
  return !!user;
};

const isUsernameExists = async (username: string, excludeUserId?: string): Promise<boolean> => {
  const user = await database.user.findFirst({
    where: {
      username,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      status: { not: UserStatus.DELETED },
    },
    select: { id: true },
  });

  return !!user;
};

const isAccountIdExists = async (accountId: string): Promise<boolean> => {
  const user = await database.user.findFirst({
    where: { accountId, status: { not: UserStatus.DELETED } },
    select: { id: true },
  });

  return !!user;
};

// User Exists Check
const isUserExists = async (id: string): Promise<boolean> => {
  const user = await database.user.findUnique({
    where: { id, status: { not: UserStatus.DELETED } },
    select: { id: true },
  });
  return !!user;
};

const incrementContributionScore = async (userId: string, delta: number) => {
  if (delta === 0) {
    return database.user.findFirst({
      where: { id: userId, status: { not: UserStatus.DELETED } },
      select: { id: true, contributionScore: true },
    });
  }
  return database.user.update({
    where: { id: userId, status: { not: UserStatus.DELETED } },
    data: { contributionScore: { increment: delta } },
    select: { id: true, contributionScore: true },
  });
};

export const UserRepository = {
  createUser,
  getUserById,
  getUserByIdPublic,
  getUserByEmail,
  getAllUsers,
  updateUserById,
  updateUserStatus,
  updateUserIndependentStatus,
  updateUserPasswordById,
  deleteUserById,
  isEmailExists,
  isUsernameExists,
  isAccountIdExists,
  isUserExists,
  incrementContributionScore,
  findOrCreateProgramByName,
  getProgramById,
  listActivePrograms,
  replaceUserSkills,
};
