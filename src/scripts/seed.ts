import colors from 'colors';
import { closeDB, connectDB } from '../config/database';
import logger from '../config/logger';
import { seedDefaultProfilePicture } from './seedDefaultProfilePicture';
import { seedDefaultUsers } from './userSeeder';

const runSeed = async () => {
  try {
    logger.info(colors.cyan('Starting seed process...'));
    await connectDB();
    await seedDefaultProfilePicture();
    await seedDefaultUsers();
    logger.info(colors.green('Seed process completed successfully.'));
    process.exit(0);
  } catch (error) {
    logger.error(colors.red('Seed process failed.'), error);
    process.exit(1);
  } finally {
    await closeDB();
  }
};

void runSeed();
