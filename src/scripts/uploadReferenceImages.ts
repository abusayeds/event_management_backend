import { promises as fs } from 'fs';
import path from 'path';
import config from '../config';
import { uploadRoot } from '../utils/localStorage';
import {
  buildReferenceImageCatalog,
  normalizeReferenceName,
  referenceImageKey,
} from '../utils/referenceImageCatalog';
import { uploadBufferWithKey } from '../utils/s3Upload';

async function main() {
  const originals = await buildReferenceImageCatalog();
  const manifest = [];
  for (const item of originals) {
    const key = referenceImageKey(item);
    const ext = path.extname(item.filePath).toLowerCase();
    const buffer = await fs.readFile(item.filePath);
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const url = await uploadBufferWithKey(buffer, key, mimeType, {
      source: 'original-reference-data',
      programName: item.programName,
    });
    manifest.push({ ...item, key, url });
  }
  await fs.mkdir(uploadRoot, { recursive: true });
  const manifestPath = path.join(uploadRoot, 'reference-image-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(
    `Stored real images: ${manifest.filter(item => item.model === 'category').length} categories, ${manifest.filter(item => item.model === 'subcategory').length} subcategories, ${manifest.filter(item => item.model === 'program').length} programs (${config.storage.useAws ? 'AWS' : 'backend disk'}).`
  );
  for (const item of manifest.filter(item => item.model === 'category'))
    console.log(`${item.name}: ${path.basename(item.filePath)}`);
  console.log(`Manifest: ${manifestPath}`);
  if (process.argv.includes('--prepare-only')) return;
  const apiBase = process.argv
    .find(arg => arg.startsWith('--api-base='))
    ?.slice('--api-base='.length);
  if (apiBase) {
    const { uploadReferenceViaApi } = await import('../utils/uploadReferenceViaApi.js');
    await uploadReferenceViaApi(apiBase, originals);
    return;
  }

  const { database } = await import('../config/database.js');
  const backupPath = path.join(uploadRoot, `reference-image-updates-${Date.now()}.jsonl`);
  let updated = 0;
  const categoryName = (name: string) => {
    const normalized = normalizeReferenceName(name);
    return (
      ({ music: 'musical', sports: 'sport', arts: 'art' } as Record<string, string>)[normalized] ||
      normalized
    );
  };
  try {
    const categories = await database.category.findMany({
      select: { id: true, name: true, imageUrl: true },
    });
    const subcategories = await database.subcategory.findMany({
      select: { id: true, name: true, imageUrl: true, category: { select: { name: true } } },
    });
    const programs = await database.program.findMany({
      select: { id: true, name: true, imageUrl: true, category: { select: { name: true } } },
    });
    for (const [model, rows] of [
      ['category', categories],
      ['subcategory', subcategories],
      ['program', programs],
    ] as const) {
      for (const row of rows) {
        const parent = 'category' in row ? row.category?.name || '' : row.name;
        const name = model === 'subcategory' ? row.name.split(' / ').pop()! : row.name;
        const image = manifest.find(
          item =>
            item.model === model &&
            categoryName(item.categoryName) === categoryName(parent) &&
            (model === 'category' ||
              normalizeReferenceName(item.name) === normalizeReferenceName(name))
        );
        if (!image) {
          console.log(`No reference match: ${model} ${row.name}`);
          continue;
        }
        if (row.imageUrl === image.url) continue;
        await fs.appendFile(
          backupPath,
          `${JSON.stringify({ model, id: row.id, name: row.name, oldUrl: row.imageUrl, newUrl: image.url, source: image.filePath })}\n`
        );
        const args = { where: { id: row.id }, data: { imageUrl: image.url } };
        if (model === 'category') await database.category.update(args);
        else if (model === 'subcategory') await database.subcategory.update(args);
        else await database.program.update(args);
        updated++;
        console.log(`Updated ${model}: ${row.name}`);
      }
    }
    console.log(`Assigned original reference images to ${updated} records. Backup: ${backupPath}`);
  } catch {
    throw new Error(
      'Real image files are stored, but database records could not be updated. Ensure PostgreSQL is reachable, then rerun npm run images:upload-reference.'
    );
  } finally {
    await database.$disconnect();
  }
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
