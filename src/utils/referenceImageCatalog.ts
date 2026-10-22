import { promises as fs } from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import crypto from 'crypto';

export type ReferenceImage = {
  model: 'category' | 'subcategory' | 'program';
  name: string;
  categoryName: string;
  programName: string;
  filePath: string;
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

export const buildReferenceImageCatalog = async (): Promise<ReferenceImage[]> => {
  const root = path.resolve('temp-reference-data/Reference Data');
  const workbook = XLSX.readFile(path.join(root, 'Reference Data.xlsx'));
  if (!workbook.Sheets.Program) throw new Error('Reference workbook has no Program sheet.');
  const files = new Map<string, string>();
  for (const ratio of ['16-9', '5-4']) {
    const dir = path.join(root, 'Program', ratio);
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.(jpe?g|png|webp)$/i.test(entry.name)) continue;
      const name = normalizeReferenceName(path.parse(entry.name).name);
      if (!files.has(name)) files.set(name, path.join(dir, entry.name));
    }
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
    const filePath = candidates.map(name => files.get(normalizeReferenceName(name))).find(Boolean);
    if (!filePath) throw new Error(`No original reference image for ${program}`);
    const add = (model: ReferenceImage['model'], name: string) => {
      const key = `${model}:${normalizeReferenceName(category)}:${normalizeReferenceName(name)}`;
      if (!images.has(key))
        images.set(key, { model, name, categoryName: category, programName: program, filePath });
    };
    add('category', category);
    if (subcategory) add('subcategory', subcategory);
    add('program', program);
  }
  return [...images.values()];
};
