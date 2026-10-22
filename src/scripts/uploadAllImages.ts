import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import config from '../config';
import { localPath, uploadRoot } from '../utils/localStorage';
import { buildReferenceImageCatalog, normalizeReferenceName } from '../utils/referenceImageCatalog';
import { dashboardAssetFiles, DashboardAssetKey } from '../utils/dashboardAssets';
import { readImageApiResponse } from '../utils/imageApiResponse';

const models = [
  'category',
  'subcategory',
  'program',
  'event',
  'user',
  'family',
  'notification',
] as const;
type Row = { id: string; name: string; imageUrl?: string; category?: { name: string } };
type Source = { buffer: Buffer; filename: string; mime: string };
const mime = (filename: string) =>
  ({
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  })[path.extname(filename).toLowerCase()] || '';
const normalizeCategory = (name: string) => {
  const key = normalizeReferenceName(name);
  return ({ music: 'musical', sports: 'sport', arts: 'art' } as Record<string, string>)[key] || key;
};
async function main() {
  const base = (
    process.argv.find(arg => arg.startsWith('--api-base='))?.slice(11) || config.backend.baseUrl
  ).replace(/\/$/, '');
  let dashboardEnv: Record<string, string> = {};
  try {
    dashboardEnv = dotenv.parse(await fs.readFile(path.resolve('../Sharing-Event-Dashboard/.env')));
  } catch {
    /* Environment credentials supported. */
  }
  const email = process.env.ADMIN_EMAIL || dashboardEnv.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD || dashboardEnv.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD.');
  const request = async (url: string, options: RequestInit = {}) =>
    fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  const login = await request(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = (await login.json()) as {
    data?: { tokens?: { accessToken?: string } };
    message?: string;
  };
  const token = session.data?.tokens?.accessToken;
  if (!login.ok || !token) throw new Error(session.message || 'Admin login failed.');
  const headers = { Authorization: `Bearer ${token}` };
  // Check every required route before changing any record. An older deployment
  // must not produce a partial repair or hide the error behind generic output.
  for (const model of models) {
    const response = await request(`${base}/api/v1/media/images/${model}?page=1&limit=1`, {
      headers,
    });
    const result = await readImageApiResponse<{ data?: Row[] }>(
      response,
      `Image API check (${model})`
    );
    if (!Array.isArray(result.data))
      throw new Error(`Image API check (${model}): inventory data is not an array.`);
  }
  const assetsResponse = await request(`${base}/api/v1/media/assets`);
  const assets = await readImageApiResponse<{ data?: Row[] }>(
    assetsResponse,
    'Dashboard branding API check'
  );
  if (!Array.isArray(assets.data))
    throw new Error('Dashboard branding API check: inventory data is not an array.');
  const originals = await buildReferenceImageCatalog();
  const report: Record<string, unknown>[] = [];
  await fs.mkdir(uploadRoot, { recursive: true });
  const reportPath = path.join(uploadRoot, `all-image-api-repair-${Date.now()}.jsonl`);
  const record = async (value: Record<string, unknown>) => {
    report.push(value);
    await fs.appendFile(reportPath, `${JSON.stringify(value)}\n`);
    console.log(`${value.model}: ${value.name} — ${value.status}`);
    if (value.error) console.error(`  ${value.error}`);
  };
  const checkImage = async (url: string) => {
    try {
      const response = await request(new URL(url, `${base}/`).href);
      const ok = response.ok && (response.headers.get('content-type') || '').startsWith('image/');
      await response.body?.cancel();
      return ok;
    } catch {
      return false;
    }
  };
  for (const model of models) {
    for (let page = 1; ; page++) {
      const response = await request(
        `${base}/api/v1/media/images/${model}?page=${page}&limit=100`,
        { headers }
      );
      const result = (await response.json()) as {
        data?: Row[];
        meta?: { hasNext: boolean };
        message?: string;
      };
      if (!response.ok || !Array.isArray(result.data)) {
        await record({
          model,
          name: 'Section inventory',
          status: 'failed',
          error: result.message || 'Deploy the media API first.',
        });
        break;
      }
      for (const row of result.data) {
        const oldUrl = row.imageUrl;
        try {
          const parsedUrl = oldUrl ? new URL(oldUrl, `${base}/`) : undefined;
          const isLocal =
            !!parsedUrl &&
            parsedUrl.pathname.startsWith('/uploads/') &&
            [new URL(base).origin, new URL(config.backend.baseUrl).origin].includes(
              parsedUrl.origin
            );
          if (oldUrl && (config.storage.useAws || isLocal) && (await checkImage(oldUrl))) {
            await record({ model, id: row.id, name: row.name, oldUrl, status: 'verified' });
            continue;
          }
          if (model === 'user' && (!oldUrl || /\/default-user\.svg(?:\?|$)/.test(oldUrl))) {
            await fs.appendFile(
              reportPath,
              `${JSON.stringify({ model, id: row.id, oldUrl, status: 'backup' })}\n`
            );
            const saved = await request(
              `${base}/api/v1/media/images/user/${encodeURIComponent(row.id)}`,
              {
                method: 'PATCH',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ useDefault: true }),
              }
            );
            const updated = (await saved.json()) as {
              data?: { imageUrl?: string };
              message?: string;
            };
            if (!saved.ok || !updated.data?.imageUrl || !(await checkImage(updated.data.imageUrl)))
              throw new Error(updated.message || 'Default profile image could not be verified.');
            await record({
              model,
              id: row.id,
              name: row.name,
              oldUrl,
              imageUrl: updated.data.imageUrl,
              status: 'uploaded-and-verified',
            });
            continue;
          }
          let source: Source | undefined;
          if (oldUrl && parsedUrl?.pathname.startsWith('/uploads/')) {
            try {
              const key = decodeURIComponent(
                new URL(oldUrl, `${base}/`).pathname.slice('/uploads/'.length)
              );
              const filename = path.basename(key);
              if (mime(filename))
                source = {
                  buffer: await fs.readFile(localPath(key)),
                  filename,
                  mime: mime(filename),
                };
            } catch {
              /* Recover from reference originals or the remote URL next. */
            }
          }
          const reference = originals.find(
            item =>
              item.model === model &&
              normalizeCategory(item.categoryName) ===
                normalizeCategory(model === 'category' ? row.name : row.category?.name || '') &&
              (model === 'category' ||
                normalizeReferenceName(item.name) ===
                  normalizeReferenceName(
                    model === 'subcategory' ? row.name.split(' / ').pop()! : row.name
                  ))
          );
          if (!source && reference)
            source = {
              buffer: await fs.readFile(reference.filePath),
              filename: path.basename(reference.filePath),
              mime: mime(reference.filePath),
            };
          if (!source && oldUrl) {
            const remote = await request(new URL(oldUrl, `${base}/`).href);
            const type = (remote.headers.get('content-type') || '').split(';')[0];
            const ext = (
              {
                'image/png': '.png',
                'image/webp': '.webp',
                'image/jpeg': '.jpg',
                'image/heic': '.heic',
              } as Record<string, string>
            )[type];
            if (remote.ok && ext) {
              const size = Number(remote.headers.get('content-length') || 0);
              if (size > 5 * 1024 * 1024) throw new Error('Original exceeds the 5MB upload limit.');
              const buffer = Buffer.from(await remote.arrayBuffer());
              if (buffer.length > 5 * 1024 * 1024)
                throw new Error('Original exceeds the 5MB upload limit.');
              source = { buffer, filename: `${model}-${row.id}${ext}`, mime: type };
            } else await remote.body?.cancel();
          }
          if (!source) {
            await record({
              model,
              id: row.id,
              name: row.name,
              oldUrl,
              status:
                oldUrl || ['category', 'subcategory', 'program', 'event'].includes(model)
                  ? 'missing-original'
                  : 'empty-optional-field',
            });
            continue;
          }
          const form = new FormData();
          form.append(
            'image',
            new Blob([new Uint8Array(source.buffer)], { type: source.mime }),
            source.filename
          );
          // Write the previous path before changing the record.
          await fs.appendFile(
            reportPath,
            `${JSON.stringify({ model, id: row.id, oldUrl, status: 'backup' })}\n`
          );
          const saved = await request(
            `${base}/api/v1/media/images/${model}/${encodeURIComponent(row.id)}`,
            { method: 'PATCH', headers, body: form }
          );
          const updated = (await saved.json()) as {
            data?: { imageUrl?: string };
            message?: string;
          };
          if (!saved.ok || !updated.data?.imageUrl)
            throw new Error(updated.message || 'Upload did not return an image URL.');
          if (!(await checkImage(updated.data.imageUrl)))
            throw new Error(
              `Saved URL is not a publicly reachable image: ${updated.data.imageUrl}`
            );
          await record({
            model,
            id: row.id,
            name: row.name,
            oldUrl,
            imageUrl: updated.data.imageUrl,
            status: 'uploaded-and-verified',
          });
        } catch (error) {
          await record({
            model,
            id: row.id,
            name: row.name,
            oldUrl,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (!result.meta?.hasNext) break;
    }
  }
  for (const row of assets.data) {
    try {
      if (row.imageUrl && (await checkImage(row.imageUrl))) {
        await record({
          model: 'assets',
          id: row.id,
          name: row.name,
          imageUrl: row.imageUrl,
          status: 'verified',
        });
        continue;
      }
      if (!Object.hasOwn(dashboardAssetFiles, row.id))
        throw new Error('Unknown dashboard branding asset.');
      const source = path.resolve(
        'assets/dashboard',
        dashboardAssetFiles[row.id as DashboardAssetKey]
      );
      const form = new FormData();
      form.append(
        'image',
        new Blob([new Uint8Array(await fs.readFile(source))], { type: 'image/png' }),
        path.basename(source)
      );
      await fs.appendFile(
        reportPath,
        `${JSON.stringify({ model: 'assets', id: row.id, oldUrl: row.imageUrl, status: 'backup' })}\n`
      );
      const saved = await request(`${base}/api/v1/media/assets/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers,
        body: form,
      });
      const updated = (await saved.json()) as { data?: { imageUrl?: string }; message?: string };
      if (!saved.ok || !updated.data?.imageUrl || !(await checkImage(updated.data.imageUrl)))
        throw new Error(updated.message || 'Branding image could not be verified.');
      await record({
        model: 'assets',
        id: row.id,
        name: row.name,
        imageUrl: updated.data.imageUrl,
        status: 'uploaded-and-verified',
      });
    } catch (error) {
      await record({
        model: 'assets',
        id: row.id,
        name: row.name,
        status: 'failed',
        error: String(error),
      });
    }
  }
  const failures = report.filter(row =>
    ['failed', 'missing-original'].includes(String(row.status))
  );
  console.log(
    `Checked ${report.length} records across all seven image models. ${failures.length} unresolved. Report: ${reportPath}`
  );
  if (failures.length) process.exitCode = 1;
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
