import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import colors from 'colors';
import { promises as fs } from 'fs';
import path from 'path';
import config from '../config';
import logger from '../config/logger';
import { checkFileExists, createS3Client, uploadBufferWithKey } from './s3Upload';

/**
 * `temp-reference-data/` is gitignored, so a deployed instance has no reference
 * bundle on disk. Mirroring the untouched workbook and program photos to S3 under
 * this prefix lets the catalog seed run anywhere the bucket is reachable.
 */
export const REFERENCE_PREFIX = 'reference-data';

export const REFERENCE_WORKBOOK = 'Reference Data.xlsx';
export const PROGRAM_RATIOS = ['16-9', '5-4'] as const;

/** Paths inside the bundle are POSIX and relative to this root, e.g. `Program/16-9/Chess.jpg`. */
export const localReferenceRoot = path.resolve('temp-reference-data', 'Reference Data');

const MANIFEST = '.bundle-manifest.json';
const IMAGE_PATTERN = /\.(jpe?g|png|webp)$/i;

export type ReferenceSource = 'local' | 's3';

export const referenceObjectKey = (relPath: string): string => `${REFERENCE_PREFIX}/${relPath}`;

const localFile = (relPath: string): string => path.join(localReferenceRoot, relPath);

export const mimeFromExt = (ext: string): string => {
  switch (ext.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'application/octet-stream';
  }
};

const readS3Object = async (key: string): Promise<Buffer> => {
  const s3 = createS3Client();
  const result = await s3.send(new GetObjectCommand({ Bucket: config.aws.bucketName, Key: key }));
  if (!result.Body) throw new Error(`Empty S3 body for ${key}`);

  return Buffer.from(await result.Body.transformToByteArray());
};

const listS3Keys = async (prefix: string): Promise<string[]> => {
  const s3 = createS3Client();
  const keys: string[] = [];
  let token: string | undefined;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: config.aws.bucketName,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    for (const object of page.Contents ?? []) if (object.Key) keys.push(object.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  return keys;
};

const localBundleExists = async (): Promise<boolean> => {
  try {
    await fs.access(localFile(REFERENCE_WORKBOOK));

    return true;
  } catch {
    return false;
  }
};

/**
 * Prefers the bundle on disk — it is the authored original — and falls back to the
 * S3 mirror so a deployed instance can still seed. `null` means neither is there.
 */
export const resolveReferenceSource = async (): Promise<ReferenceSource | null> => {
  if (await localBundleExists()) return 'local';
  if (!config.storage.useAws) return null;

  return (await checkFileExists(referenceObjectKey(REFERENCE_WORKBOOK))) ? 's3' : null;
};

export const readReferenceAsset = async (
  relPath: string,
  source: ReferenceSource
): Promise<Buffer> =>
  source === 'local' ? fs.readFile(localFile(relPath)) : readS3Object(referenceObjectKey(relPath));

/** Every program photo in the bundle, as bundle-relative POSIX paths. */
export const listProgramPhotos = async (source: ReferenceSource): Promise<string[]> => {
  if (source === 's3') {
    const prefix = `${REFERENCE_PREFIX}/Program/`;

    return (await listS3Keys(prefix))
      .map(key => key.slice(REFERENCE_PREFIX.length + 1))
      .filter(relPath => IMAGE_PATTERN.test(relPath));
  }

  const found: string[] = [];
  for (const ratio of PROGRAM_RATIOS) {
    const entries = await fs.readdir(path.join(localReferenceRoot, 'Program', ratio), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (entry.isFile() && IMAGE_PATTERN.test(entry.name)) {
        found.push(`Program/${ratio}/${entry.name}`);
      }
    }
  }

  return found;
};

type BundleManifest = { files: string[]; uploadedAt: string };

const readManifest = async (): Promise<BundleManifest | null> => {
  try {
    return JSON.parse(
      (await readS3Object(referenceObjectKey(MANIFEST))).toString()
    ) as BundleManifest;
  } catch {
    return null;
  }
};

/**
 * Copies the on-disk bundle to S3 so later deploys — which have neither
 * `temp-reference-data/` nor `uploads/` — can seed from the bucket. Idempotent: an
 * up-to-date manifest short-circuits the whole upload, so restarts stay quick.
 */
export const syncReferenceBundleToS3 = async (): Promise<{
  uploaded: number;
  skipped: boolean;
}> => {
  if (!config.storage.useAws) return { uploaded: 0, skipped: true };
  if (!(await localBundleExists())) return { uploaded: 0, skipped: true };

  const files = [REFERENCE_WORKBOOK, ...(await listProgramPhotos('local'))].sort();
  const manifest = await readManifest();

  if (manifest && manifest.files.length === files.length) {
    const mirrored = new Set(manifest.files);
    if (files.every(relPath => mirrored.has(relPath))) return { uploaded: 0, skipped: true };
  }

  logger.info(colors.cyan(`Mirroring reference bundle to S3: ${files.length} files...`));

  let uploaded = 0;
  for (const relPath of files) {
    const key = referenceObjectKey(relPath);
    // A re-run after a partial upload should only move the files still missing.
    if (await checkFileExists(key)) continue;
    await uploadBufferWithKey(
      await readReferenceAsset(relPath, 'local'),
      key,
      mimeFromExt(path.extname(relPath)),
      { source: 'reference-bundle-sync' }
    );
    uploaded += 1;
  }

  // The manifest is written last so a failed run never claims a complete mirror.
  await uploadBufferWithKey(
    Buffer.from(JSON.stringify({ files, uploadedAt: new Date().toISOString() }, null, 2)),
    referenceObjectKey(MANIFEST),
    'application/json',
    { source: 'reference-bundle-sync' }
  );

  logger.info(colors.green(`Reference bundle mirrored to S3 (${uploaded} new files).`));

  return { uploaded, skipped: false };
};
