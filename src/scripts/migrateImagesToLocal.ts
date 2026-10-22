import { GetObjectCommand } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import path from 'path';
import config from '../config';
import { database } from '../config/database';
import { localPath, localStoredPath, uploadRoot, writeLocalFile } from '../utils/localStorage';
import { createS3Client } from '../utils/s3Upload';

type Row = { id: string; name?: string; eventName?: string; [key: string]: unknown };
type Delegate = {
  findMany: () => Promise<Row[]>;
  update: (args: { where: { id: string }; data: Record<string, string> }) => Promise<unknown>;
};
const categoryAssets = path.resolve('../Sharing-Event-Dashboard/public/images/categories');
const referenceRoot = path.resolve('temp-reference-data/Reference Data/Program');
const fallbackFor = (name: string) => {
  const keywords: [RegExp, string][] = [
    [/food|drink/i, 'food-drink'],
    [/sport/i, 'sports'],
    [/music|concert/i, 'music'],
    [/art|culture/i, 'arts'],
    [/education|school|learn/i, 'education'],
    [/health|wellness|medical/i, 'health'],
    [/tech|digital/i, 'technology'],
    [/community|social|volunteer/i, 'community'],
    [/nature|outdoor|environment/i, 'nature'],
  ];
  return `${keywords.find(([pattern]) => pattern.test(name))?.[1] || 'default-category'}.png`;
};

const readIfExists = async (file: string) => {
  try {
    return await fs.readFile(file);
  } catch {
    return null;
  }
};
const referenceImage = async (name: string) => {
  // Names come from the database, and must remain inside the reference directory.
  if (name.includes('/') || name.includes('\\') || name === '..') return null;
  for (const ratio of ['16-9', '5-4']) {
    for (const ext of ['.jpg', '.png', '.jpeg', '.webp', '.JPG']) {
      const buffer =
        (await readIfExists(
          path.join(uploadRoot, 'catalog-assets/programs', ratio, `${name}${ext}`)
        )) || (await readIfExists(path.join(referenceRoot, ratio, `${name}${ext}`)));
      if (buffer) return { buffer, ext: ext.toLowerCase(), source: 'original reference image' };
    }
  }
  return null;
};

const recoverRemote = async (url: string) => {
  if (!/^https?:\/\//.test(url)) return null;
  try {
    const parsed = new URL(url);
    // Private S3 objects may still be recoverable with configured credentials.
    if (parsed.hostname.includes('.s3.') || parsed.hostname.endsWith('.s3.amazonaws.com')) {
      const bucket = parsed.hostname.split('.s3')[0];
      const result = await createS3Client().send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: decodeURIComponent(parsed.pathname.slice(1)),
        }),
        { abortSignal: AbortSignal.timeout(5000) }
      );
      if (result.Body) return Buffer.from(await result.Body.transformToByteArray());
    }
    const result = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (result.ok && result.headers.get('content-type')?.startsWith('image/')) {
      return Buffer.from(await result.arrayBuffer());
    }
  } catch {
    /* Report unavailable originals without replacing personal images. */
  }
  return null;
};

async function main() {
  if (config.storage.useAws) throw new Error('Set USE_AWS=false before migrating images.');
  const report: Record<string, unknown>[] = [];
  const reportPath = path.join(uploadRoot, `image-migration-${Date.now()}.jsonl`);
  const tables = [
    ['category', 'imageUrl'],
    ['subcategory', 'imageUrl'],
    ['program', 'imageUrl'],
    ['event', 'coverImage'],
    ['user', 'profilePicture'],
    ['family', 'imageUrl'],
    ['notification', 'image'],
  ];
  for (const [model, field] of tables) {
    const delegate = database[model as keyof typeof database] as unknown as Delegate;
    const rows = await delegate.findMany();
    for (const row of rows) {
      const oldUrl = typeof row[field] === 'string' ? (row[field] as string) : '';
      const name = row.name || row.eventName || '';
      const entry: Record<string, unknown> = { model, id: row.id, field, oldUrl };
      let recovered: { buffer: Buffer; ext: string; source: string } | null = null;
      let newUrl = '';
      const localMatch = oldUrl.match(/(?:^|https?:\/\/[^/]+)\/uploads\/(.+)$/);
      if (localMatch) {
        const key = decodeURIComponent(localMatch[1]);
        if (await readIfExists(localPath(key))) newUrl = localStoredPath(key);
      }
      if (model === 'user' && (!oldUrl || /default-user\.svg$|\/common\/user\.jpg$/.test(oldUrl))) {
        newUrl = localStoredPath('profiles/images/default-user.svg');
      }
      if (!newUrl && model === 'program') recovered = await referenceImage(name);
      if (!newUrl && !recovered && oldUrl) {
        const buffer = await recoverRemote(oldUrl);
        if (buffer)
          recovered = {
            buffer,
            ext: path.extname(new URL(oldUrl).pathname) || '.jpg',
            source: 'existing remote image',
          };
      }
      if (!newUrl && !recovered && ['category', 'subcategory', 'program'].includes(model)) {
        const buffer =
          (await readIfExists(
            path.join(uploadRoot, 'catalog-assets/categories', fallbackFor(name))
          )) || (await readIfExists(path.join(categoryAssets, fallbackFor(name))));
        if (buffer) recovered = { buffer, ext: '.png', source: 'category fallback asset' };
      }
      if (recovered) {
        const key = `${model}/images/restored-${row.id}${recovered.ext}`;
        newUrl = await writeLocalFile(recovered.buffer, key);
        entry.source = recovered.source;
      }
      if (newUrl && newUrl !== oldUrl) {
        entry.newUrl = newUrl;
        // Record the original URL before updating, so every change is reviewable.
        await fs.appendFile(reportPath, `${JSON.stringify(entry)}\n`);
        await delegate.update({ where: { id: row.id }, data: { [field]: newUrl } });
        entry.status = 'repaired';
      } else {
        entry.status = newUrl ? 'already local' : oldUrl ? 'unrecoverable original' : 'no image';
      }
      report.push(entry);
      console.log(
        `${model}: ${row.id}: ${entry.status}${entry.source ? ` (${entry.source})` : ''}`
      );
    }
  }
  await fs.writeFile(`${reportPath}.summary.json`, JSON.stringify(report, null, 2));
  console.log(
    `Repaired ${report.filter(row => row.status === 'repaired').length}; unrecoverable ${report.filter(row => row.status === 'unrecoverable original').length}. Report: ${reportPath}`
  );
}
main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => database.$disconnect());
