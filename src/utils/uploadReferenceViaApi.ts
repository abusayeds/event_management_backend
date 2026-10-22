import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { uploadRoot } from './localStorage';
import { normalizeReferenceName, ReferenceImage } from './referenceImageCatalog';

type CatalogRow = {
  id: string;
  name: string;
  imageUrl?: string;
  categoryId?: string;
  category?: { name: string };
};
type ApiResponse = { message?: string; data?: unknown; meta?: { totalPages?: number } };

export const uploadReferenceViaApi = async (apiBase: string, images: ReferenceImage[]) => {
  const base = apiBase.replace(/\/$/, '');
  let dashboardEnv: Record<string, string> = {};
  try {
    dashboardEnv = dotenv.parse(await fs.readFile(path.resolve('../Sharing-Event-Dashboard/.env')));
  } catch {
    /* Credentials may instead be supplied through the backend environment. */
  }
  const email = process.env.ADMIN_EMAIL || dashboardEnv.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD || dashboardEnv.ADMIN_PASSWORD;
  if (!email || !password)
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before using API uploads.');
  const login = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15000),
  });
  const session = (await login.json()) as {
    message?: string;
    data?: { tokens?: { accessToken?: string } };
  };
  const token = session.data?.tokens?.accessToken;
  if (!login.ok || !token) throw new Error(session.message || 'Admin login failed.');
  const auth = { Authorization: `Bearer ${token}` };
  const list = async (endpoint: string): Promise<CatalogRow[]> => {
    const rows: CatalogRow[] = [];
    for (let page = 1; page <= 1000; page++) {
      const response = await fetch(`${base}/api/v1/${endpoint}?limit=100&page=${page}`, {
        headers: auth,
        signal: AbortSignal.timeout(15000),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !Array.isArray(result.data))
        throw new Error(result.message || `Could not list ${endpoint}`);
      rows.push(...(result.data as CatalogRow[]));
      if (result.meta?.totalPages ? page >= result.meta.totalPages : result.data.length < 100)
        return rows;
    }
    throw new Error('Catalog pagination exceeded the supported limit.');
  };
  const categories = await list('categories');
  const subcategories = await list('subcategories');
  const programs = await list('programs');
  const normalizeCategory = (name: string) => {
    const normalized = normalizeReferenceName(name);
    return (
      ({ music: 'musical', sports: 'sport', arts: 'art' } as Record<string, string>)[normalized] ||
      normalized
    );
  };
  const backup = path.join(uploadRoot, `reference-api-updates-${Date.now()}.jsonl`);
  let count = 0;
  for (const [model, endpoint, rows] of [
    ['category', 'categories', categories],
    ['subcategory', 'subcategories', subcategories],
    ['program', 'programs', programs],
  ] as const) {
    for (const row of rows) {
      const parent =
        model === 'category'
          ? row.name
          : row.category?.name ||
            categories.find(category => category.id === row.categoryId)?.name ||
            '';
      const name = model === 'subcategory' ? row.name.split(' / ').pop()! : row.name;
      const image = images.find(
        item =>
          item.model === model &&
          normalizeCategory(item.categoryName) === normalizeCategory(parent) &&
          (model === 'category' ||
            normalizeReferenceName(item.name) === normalizeReferenceName(name))
      );
      if (!image) {
        console.log(`No reference match: ${model} ${row.name}`);
        continue;
      }
      const buffer = await fs.readFile(image.filePath);
      const ext = path.extname(image.filePath).toLowerCase();
      const form = new FormData();
      form.append(
        'imageUrl',
        new Blob([new Uint8Array(buffer)], {
          type: ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg',
        }),
        path.basename(image.filePath)
      );
      await fs.appendFile(
        backup,
        `${JSON.stringify({ model, id: row.id, oldUrl: row.imageUrl, source: image.filePath })}\n`
      );
      const response = await fetch(`${base}/api/v1/${endpoint}/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: auth,
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      const result = (await response.json()) as { message?: string; data?: { imageUrl?: string } };
      if (!response.ok || !result.data?.imageUrl)
        throw new Error(result.message || `Upload failed for ${row.name}`);
      await fs.appendFile(
        backup,
        `${JSON.stringify({ model, id: row.id, newUrl: result.data.imageUrl })}\n`
      );
      const url = new URL(result.data.imageUrl);
      const verifyUrl = url.pathname.startsWith('/uploads/') ? `${base}${url.pathname}` : url.href;
      const check = await fetch(verifyUrl, { signal: AbortSignal.timeout(15000) });
      if (!check.ok) throw new Error(`Saved image for ${row.name} returned HTTP ${check.status}`);
      await check.body?.cancel();
      count++;
      console.log(`Uploaded through API: ${model} ${row.name}`);
    }
  }
  console.log(
    `Uploaded and assigned ${count} real images through the admin API. Backup: ${backup}`
  );
};
