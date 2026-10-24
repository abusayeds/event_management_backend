import colors from 'colors';
import { promises as fs } from 'fs';
import path from 'path';
import config from '../config';
import { closeDB, connectDB, database } from '../config/database';
import logger from '../config/logger';
import { localPath } from '../utils/localStorage';
import { mimeFromExt } from '../utils/referenceAssetStore';
import { checkFileExists, publicObjectUrl, uploadBufferWithKey } from '../utils/s3Upload';

/**
 * Every column that stores an image reference. The local `uploads/` folder is
 * gitignored, so a row still pointing at `/uploads/...` breaks the moment the app
 * runs anywhere but this machine — these are the columns that have to move.
 */
const imageColumns = [
  { model: 'category', field: 'imageUrl' },
  { model: 'subcategory', field: 'imageUrl' },
  { model: 'program', field: 'imageUrl' },
  { model: 'event', field: 'coverImage' },
  { model: 'user', field: 'profilePicture' },
  { model: 'family', field: 'imageUrl' },
  { model: 'notification', field: 'image' },
] as const;

type Row = { id: string } & Record<string, unknown>;

interface ImageDelegate {
  findMany(args: object): Promise<Row[]>;
  updateMany(args: object): Promise<{ count: number }>;
}

const delegate = (model: string) => database[model as 'category'] as unknown as ImageDelegate;

/** `/uploads/programs/images/a.jpg` -> `programs/images/a.jpg`; null for anything else. */
const storageKeyFromValue = (value: string): string | null => {
  const relative = value.startsWith('/uploads/')
    ? value.slice('/uploads/'.length)
    : value.startsWith('uploads/')
      ? value.slice('uploads/'.length)
      : null;
  if (!relative) return null;

  try {
    const key = decodeURIComponent(relative);
    localPath(key);

    return key;
  } catch {
    return null;
  }
};

type Totals = { moved: number; alreadyOnS3: number; missingFile: number; failed: number };

const migrateColumn = async (model: string, field: string, totals: Totals): Promise<void> => {
  const rows = await delegate(model).findMany({
    where: {
      OR: [{ [field]: { startsWith: '/uploads/' } }, { [field]: { startsWith: 'uploads/' } }],
    },
    select: { id: true, [field]: true },
  });

  for (const row of rows) {
    const value = row[field];
    if (typeof value !== 'string') continue;

    const key = storageKeyFromValue(value);
    if (!key) {
      logger.warn(`Skipped ${model} ${row.id}: unusable storage path "${value}".`);
      totals.failed += 1;
      continue;
    }

    try {
      // A key already in the bucket only needs the column rewritten, not a re-upload.
      const publicUrl = (await checkFileExists(key))
        ? publicObjectUrl(key)
        : await uploadBufferWithKey(
            await fs.readFile(localPath(key)),
            key,
            mimeFromExt(path.extname(key)),
            { source: 'local-to-s3-migration' }
          );

      // Guard on the old value so a concurrent admin upload is never overwritten.
      const changed = await delegate(model).updateMany({
        where: { id: row.id, [field]: value },
        data: { [field]: publicUrl },
      });

      if (changed.count) totals.moved += 1;
      else totals.alreadyOnS3 += 1;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') {
        logger.warn(colors.yellow(`${model} ${row.id}: local file missing for "${key}".`));
        totals.missingFile += 1;
      } else {
        logger.error(`Failed to migrate ${model} ${row.id} (${key}).`, { error });
        totals.failed += 1;
      }
    }
  }
};

/**
 * Copies every image still held on local disk into S3 and repoints the database at
 * the bucket. Idempotent — once a column holds an absolute URL it is never matched
 * again, so a restart costs seven indexed queries that return nothing.
 */
export const migrateImagesToS3 = async (): Promise<Totals> => {
  const totals: Totals = { moved: 0, alreadyOnS3: 0, missingFile: 0, failed: 0 };

  if (!config.storage.useAws) {
    logger.info(colors.gray('USE_AWS is off; images stay on local disk.'));

    return totals;
  }

  for (const { model, field } of imageColumns) {
    await migrateColumn(model, field, totals);
  }

  if (totals.moved || totals.missingFile || totals.failed) {
    logger.info(colors.cyan('──────── Local image migration summary ────────'));
    logger.info(`Moved to S3        : ${totals.moved}`);
    logger.info(`Local file missing : ${totals.missingFile}`);
    logger.info(`Failed             : ${totals.failed}`);
  } else {
    logger.info(colors.gray('No local image references left; all images are on S3.'));
  }

  return totals;
};

const run = async () => {
  try {
    await connectDB();
    await migrateImagesToS3();
    logger.info(colors.green('Image migration completed.'));
    process.exit(0);
  } catch (error) {
    logger.error(colors.red('Image migration failed.'), error);
    process.exit(1);
  } finally {
    await closeDB();
  }
};

// Keeps `tsx src/scripts/migrateImagesToS3.ts` working without running on import.
if (require.main === module) {
  void run();
}
