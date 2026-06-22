import fs from 'fs';
import path from 'path';
import {
  checkFileExists,
  DEFAULT_PROFILE_PICTURE_KEY,
  getDefaultProfilePictureUrl,
  uploadBufferWithKey,
} from '../utils/s3Upload';
import { database } from '../config/database';
import logger from '../config/logger';

const LEGACY_DEFAULT_PROFILE_PICTURE_URL =
  'https://areawins.s3.us-east-2.amazonaws.com/common/user.jpg';

export const seedDefaultProfilePicture = async () => {
  const assetPath = path.join(process.cwd(), 'assets', 'default-user.svg');
  const exists = await checkFileExists(DEFAULT_PROFILE_PICTURE_KEY);

  if (!exists) {
    const buffer = fs.readFileSync(assetPath);
    await uploadBufferWithKey(buffer, DEFAULT_PROFILE_PICTURE_KEY, 'image/svg+xml', {
      category: 'default-profile',
      uploadedAt: new Date().toISOString(),
    });
    logger.info('Default profile picture uploaded to S3.');
  }

  const defaultUrl = getDefaultProfilePictureUrl();
  const updated = await database.user.updateMany({
    where: { profilePicture: LEGACY_DEFAULT_PROFILE_PICTURE_URL },
    data: { profilePicture: defaultUrl },
  });

  if (updated.count > 0) {
    logger.info(`Updated ${updated.count} user(s) to the new default profile picture URL.`);
  }
};
