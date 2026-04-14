import colors from 'colors';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { PrismaClient } from '../../prisma/generated/client';
import config from './index';
import logger from './logger';

const connectionString = `${config.database.url}`;

const adapter = new PrismaPg({ connectionString });
const database = new PrismaClient({ adapter });

// Connect to Prisma
const connectDB = async (): Promise<void> => {
  try {
    await database.$connect();
    logger.info(colors.green('   ✅ Database connected successfully'));
  } catch (error) {
    logger.error(colors.red('Database connection failed:'), error);
    process.exit(1);
  }
};

// Close Prisma connection
const closeDB = async (): Promise<void> => {
  await database.$disconnect();
};

export { closeDB, connectDB, database };
