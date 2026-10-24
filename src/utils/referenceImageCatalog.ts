import path from 'path';
import * as XLSX from 'xlsx';
import crypto from 'crypto';
import {
  listProgramPhotos,
  localReferenceRoot,
  readReferenceAsset,
  REFERENCE_WORKBOOK,
  referenceObjectKey,
  ReferenceSource,
  resolveReferenceSource,
} from './referenceAssetStore';

export type ReferenceImage = {
  model: 'category' | 'subcategory' | 'program';
  name: string;
  categoryName: string;
  programName: string;
  /** Absolute path on disk for a local bundle; the S3 object key for the mirror. */
  filePath: string;
  /** Path inside the bundle, e.g. `Program/16-9/Chess.jpg`. */
  relPath: string;
  source: ReferenceSource;
};

export const normalizeReferenceName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ');

export const referenceImageKey = (item: ReferenceImage): string => {
  const slug = item.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const hash = crypto
    .createHash('sha256')
    .update(`${item.categoryName}:${item.name}`)
    .digest('hex')
    .slice(0, 8);
  const folder =
    item.model === 'category'
      ? 'categories'
      : item.model === 'subcategory'
        ? 'subcategories'
        : 'programs';
  return `${folder}/images/reference-${slug}-${hash}${path.extname(item.filePath).toLowerCase()}`;
};

export const buildReferenceImageCatalog = async (
  preferredSource?: ReferenceSource
): Promise<ReferenceImage[]> => {
  const source = preferredSource ?? (await resolveReferenceSource());
  if (!source) throw new Error('Reference bundle is available neither on disk nor on S3.');

  const workbook = XLSX.read(await readReferenceAsset(REFERENCE_WORKBOOK, source));
  if (!workbook.Sheets.Program) throw new Error('Reference workbook has no Program sheet.');
  const files = new Map<string, string>();
  // 16-9 comes first, so it wins whenever both ratios carry the same program.
  for (const relPath of (await listProgramPhotos(source)).sort()) {
    const name = normalizeReferenceName(path.parse(relPath).name);
    if (!files.has(name)) files.set(name, relPath);
  }
  const images = new Map<string, ReferenceImage>();
  let category = '';
  let subcategory = '';
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(workbook.Sheets.Program, {
    header: 1,
  });
  for (const row of rows.slice(1)) {
    if (row[0] === 'All' || row[0] === 'First Level') continue;
    if (row[0]) {
      category = String(row[0]).trim();
      subcategory = '';
    }
    if (row[1]) subcategory = String(row[1]).trim();
    if (!category || !row[2]) continue;
    const program = String(row[2]).trim();
    // The workbook's Football/Rugby entry is represented by Football.jpg.
    const candidates = program === 'Football/Rugby' ? [program, 'Football'] : [program];
    const relPath = candidates.map(name => files.get(normalizeReferenceName(name))).find(Boolean);
    if (!relPath) throw new Error(`No original reference image for ${program}`);
    const filePath =
      source === 'local' ? path.join(localReferenceRoot, relPath) : referenceObjectKey(relPath);
    const add = (model: ReferenceImage['model'], name: string) => {
      const key = `${model}:${normalizeReferenceName(category)}:${normalizeReferenceName(name)}`;
      if (!images.has(key))
        images.set(key, {
          model,
          name,
          categoryName: category,
          programName: program,
          filePath,
          relPath,
          source,
        });
    };
    add('category', category);
    if (subcategory) add('subcategory', subcategory);
    add('program', program);
  }
  return [...images.values()];
};
