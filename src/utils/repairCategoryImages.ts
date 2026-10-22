import { promises as fs } from 'fs';
import path from 'path';
import config from '../config';
import { database } from '../config/database';
import logger from '../config/logger';
import { localPath, localStoredPath, uploadRoot, writeLocalFile } from './localStorage';
import {
  buildReferenceImageCatalog,
  normalizeReferenceName,
  referenceImageKey,
} from './referenceImageCatalog';

type CategoryRow = { id: string; name: string; imageUrl: string | null };
type CategoryImageStore = {
  list: () => Promise<CategoryRow[]>;
  updateIfUnchanged: (id: string, oldPath: string | null, newPath: string) => Promise<boolean>;
};
const databaseStore: CategoryImageStore = {
  list: () =>
    database.category.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, imageUrl: true },
    }),
  updateIfUnchanged: async (id, oldPath, newPath) => {
    const result = await database.category.updateMany({
      where: { id, imageUrl: oldPath, isDeleted: false },
      data: { imageUrl: newPath },
    });
    return result.count > 0;
  },
};

const normalizeCategory = (name: string) => {
  const normalized = normalizeReferenceName(name);
  return (
    ({ music: 'musical', sports: 'sport', arts: 'art' } as Record<string, string>)[normalized] ||
    normalized
  );
};
const fileExists = async (key: string) => {
  try {
    await fs.access(localPath(key));
    return true;
  } catch {
    return false;
  }
};
const localKey = (value: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value, config.backend.baseUrl);
    if (url.pathname.startsWith('/uploads/'))
      return decodeURIComponent(url.pathname.slice('/uploads/'.length));
  } catch {
    /* Invalid legacy URLs are repaired from reference photos. */
  }
  return null;
};
const legacyS3 = (value: string | null) => {
  if (!value) return true;
  try {
    const host = new URL(value).hostname;
    return host.includes('.s3.') || host.endsWith('.s3.amazonaws.com');
  } catch {
    return true;
  }
};

export const repairCategoryImages = async (store: CategoryImageStore = databaseStore) => {
  const result = { repaired: 0, unavailable: [] as string[] };
  if (config.storage.useAws) return result;
  const categories = await store.list();
  const references = new Map<string, string>();
  try {
    const manifest = JSON.parse(
      await fs.readFile(path.join(uploadRoot, 'reference-image-manifest.json'), 'utf8')
    ) as { model: string; name: string; key: string }[];
    for (const item of manifest) {
      if (item.model === 'category' && (await fileExists(item.key)))
        references.set(normalizeCategory(item.name), item.key);
    }
  } catch {
    /* Original reference data can be used when no prepared manifest exists. */
  }
  let originalsLoaded = false;
  const backup = path.join(uploadRoot, `category-image-migration-${Date.now()}.jsonl`);
  for (const category of categories) {
    const existingKey = localKey(category.imageUrl);
    let key: string | undefined;
    let useReference = false;
    if (existingKey && (await fileExists(existingKey))) key = existingKey;
    else {
      // Preserve working admin-managed local images and unrelated external URLs.
      if (!existingKey && !legacyS3(category.imageUrl)) continue;
      useReference = true;
      key = references.get(normalizeCategory(category.name));
      if (!key && !originalsLoaded) {
        originalsLoaded = true;
        try {
          for (const image of (await buildReferenceImageCatalog()).filter(
            item => item.model === 'category'
          )) {
            const referenceKey = referenceImageKey(image);
            await writeLocalFile(await fs.readFile(image.filePath), referenceKey);
            references.set(normalizeCategory(image.name), referenceKey);
          }
        } catch (error) {
          logger.warn('Original category reference photos are unavailable', { error });
        }
        key = references.get(normalizeCategory(category.name));
      }
    }
    if (!key) {
      result.unavailable.push(category.name);
      continue;
    }
    if (useReference) {
      // Each category owns its file; replacing it cannot remove another image
      // or the original reference source used for future repairs.
      const categoryKey = `categories/images/imported-${category.id}${path.extname(key)}`;
      await writeLocalFile(await fs.readFile(localPath(key)), categoryKey);
      key = categoryKey;
    }
    const storedPath = localStoredPath(key);
    if (category.imageUrl === storedPath) continue;
    await fs.appendFile(
      backup,
      `${JSON.stringify({ id: category.id, name: category.name, oldUrl: category.imageUrl, newPath: storedPath })}\n`
    );
    // Do not overwrite an image changed by an admin while migration is running.
    if (await store.updateIfUnchanged(category.id, category.imageUrl, storedPath))
      result.repaired++;
  }
  if (result.repaired)
    logger.info(`Saved local category image paths for ${result.repaired} categories.`);
  if (result.unavailable.length)
    logger.warn(`Category photos need manual upload: ${result.unavailable.join(', ')}`);
  return result;
};
