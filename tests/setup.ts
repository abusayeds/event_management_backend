import { beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { database } from '../src/config/database';

const prisma = new PrismaClient();

beforeAll(async () => {
  await database.$connect();
});

afterAll(async () => {
  await database.$disconnect();
});

export { prisma };
