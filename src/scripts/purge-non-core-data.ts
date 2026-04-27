import colors from 'colors';
import { closeDB, connectDB, database } from '../config/database';
import logger from '../config/logger';

type DeleteResult = { count: number };

const runPurge = async () => {
  try {
    logger.warn(
      colors.yellow('Purging non-core data: keeping User, Category, Subcategory, Program only.')
    );

    await connectDB();

    const results = await database.$transaction(async tx => {
      const deleted: Record<string, DeleteResult> = {};

      // Event module (children -> parents)
      deleted.editLog = await tx.editLog.deleteMany();
      deleted.eventResult = await tx.eventResult.deleteMany();
      deleted.eventRound = await tx.eventRound.deleteMany();
      deleted.eventGroup = await tx.eventGroup.deleteMany();
      deleted.eventSchedule = await tx.eventSchedule.deleteMany();
      deleted.repeatConfig = await tx.repeatConfig.deleteMany();
      deleted.event = await tx.event.deleteMany();
      deleted.session = await tx.session.deleteMany();

      // Other modules except preserved core entities
      deleted.familyInvitation = await tx.familyInvitation.deleteMany();
      deleted.familyJoinRequest = await tx.familyJoinRequest.deleteMany();
      deleted.familyMember = await tx.familyMember.deleteMany();
      deleted.family = await tx.family.deleteMany();
      deleted.connection = await tx.connection.deleteMany();
      deleted.eventApplied = await tx.eventApplied.deleteMany();

      return deleted;
    });

    const totalDeleted = Object.values(results).reduce((sum, r) => sum + r.count, 0);

    logger.info(colors.green(`Purge completed. Total deleted rows: ${totalDeleted}`));
    for (const [model, result] of Object.entries(results)) {
      logger.info(`${model}: ${result.count}`);
    }

    process.exit(0);
  } catch (error) {
    logger.error(colors.red('Purge failed.'), error);
    process.exit(1);
  } finally {
    await closeDB();
  }
};

void runPurge();
