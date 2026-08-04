import fs from 'fs';
import path from 'path';
import colors from 'colors';
import XLSX from 'xlsx';
import { closeDB, connectDB, database } from '../config/database';
import logger from '../config/logger';
import { uploadBufferWithKey } from '../utils/s3Upload';

type CategoryNode = {
  subcategories: Record<string, string[]>;
  directPrograms: string[];
};

type CatalogTree = Record<string, CategoryNode>;

const REFERENCE_ROOT = path.resolve(process.cwd(), 'temp-reference-data', 'Reference Data');
const EXCEL_PATH = path.join(REFERENCE_ROOT, 'Reference Data.xlsx');
const IMAGE_DIR_16_9 = path.join(REFERENCE_ROOT, 'Program', '16-9');
const IMAGE_DIR_5_4 = path.join(REFERENCE_ROOT, 'Program', '5-4');

const REFERENCE_CATEGORY_NAMES = ['Musical', 'Sport', 'Art', 'Food & Drink'];

const mimeFromExt = (ext: string): string => {
  switch (ext.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
};

const findProgramImagePath = (programName: string): string | null => {
  const candidates = [IMAGE_DIR_16_9, IMAGE_DIR_5_4];
  const extensions = ['.jpg', '.jpeg', '.png', '.webp', '.JPG', '.JPEG', '.PNG'];

  for (const dir of candidates) {
    for (const ext of extensions) {
      const full = path.join(dir, `${programName}${ext}`);
      if (fs.existsSync(full)) {
        return full;
      }
    }
  }
  return null;
};

const parseProgramSheet = (): CatalogTree => {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel not found: ${EXCEL_PATH}`);
  }

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets.Program;
  if (!sheet) {
    throw new Error('Sheet "Program" not found in Reference Data.xlsx');
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
  });

  const tree: CatalogTree = {};
  let category: string | null = null;
  let subcategory: string | null = null;

  const ensureCategory = (name: string) => {
    if (!tree[name]) {
      tree[name] = { subcategories: {}, directPrograms: [] };
    }
  };

  for (const row of rows.slice(1)) {
    const first = row[0] != null ? String(row[0]).trim() : '';
    const second = row[1] != null ? String(row[1]).trim() : '';
    const third = row[2] != null ? String(row[2]).trim() : '';

    if (first === 'All' || first === 'First Level') {
      continue;
    }

    if (first) {
      category = first;
      // New category row resets subcategory unless provided on the same row.
      subcategory = second || null;
      ensureCategory(category);
    } else if (second) {
      subcategory = second;
    }

    if (!category || !third) {
      continue;
    }

    ensureCategory(category);

    if (subcategory) {
      if (!tree[category].subcategories[subcategory]) {
        tree[category].subcategories[subcategory] = [];
      }
      if (!tree[category].subcategories[subcategory].includes(third)) {
        tree[category].subcategories[subcategory].push(third);
      }
    } else if (!tree[category].directPrograms.includes(third)) {
      // No subcategory → attach program directly under category.
      tree[category].directPrograms.push(third);
    }
  }

  return tree;
};

const uploadProgramImage = async (programName: string): Promise<string | null> => {
  const imagePath = findProgramImagePath(programName);
  if (!imagePath) {
    logger.warn(`No image found for program: ${programName}`);
    return null;
  }

  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase() || '.jpg';
  const safeName = programName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const key = `programs/images/${safeName}${ext}`;

  try {
    return await uploadBufferWithKey(buffer, key, mimeFromExt(ext), {
      originalName: path.basename(imagePath),
      programName,
      source: 'reference-data-seed',
    });
  } catch (error) {
    logger.error(`S3 upload failed for ${programName}`, { error });
    return null;
  }
};

/** Remove old prefixed subcategory names like "Musical / Wind" before re-seed. */
const cleanupOldPrefixedSubcategories = async () => {
  const oldSubs = await database.subcategory.findMany({
    where: {
      OR: REFERENCE_CATEGORY_NAMES.map(categoryName => ({
        name: { startsWith: `${categoryName} / ` },
      })),
    },
    select: { id: true, name: true },
  });

  if (oldSubs.length === 0) {
    return;
  }

  const ids = oldSubs.map(s => s.id);
  await database.program.updateMany({
    where: { subcategoryId: { in: ids } },
    data: { subcategoryId: null },
  });
  await database.subcategory.deleteMany({
    where: { id: { in: ids } },
  });

  logger.info(colors.yellow(`Removed ${oldSubs.length} old prefixed subcategories.`));
};

const upsertProgram = async (params: {
  programName: string;
  categoryId: string;
  subcategoryId: string | null;
  description: string;
  reuseExistingImage?: boolean;
}): Promise<'created' | 'updated'> => {
  const existing = await database.program.findFirst({
    where: { name: params.programName },
  });

  let imageUrl: string | null | undefined;
  if (existing?.imageUrl) {
    imageUrl = undefined; // keep existing S3 URL
  } else {
    imageUrl = await uploadProgramImage(params.programName);
  }

  if (!existing) {
    await database.program.create({
      data: {
        name: params.programName,
        categoryId: params.categoryId,
        subcategoryId: params.subcategoryId,
        imageUrl: imageUrl ?? undefined,
        description: params.description,
      },
    });
    return 'created';
  }

  await database.program.update({
    where: { id: existing.id },
    data: {
      isDeleted: false,
      categoryId: params.categoryId,
      subcategoryId: params.subcategoryId,
      description: params.description,
      ...(imageUrl ? { imageUrl } : {}),
    },
  });
  return 'updated';
};

const seedReferenceCatalog = async () => {
  await cleanupOldPrefixedSubcategories();

  const tree = parseProgramSheet();
  const categoryNames = Object.keys(tree);
  let createdCategories = 0;
  let createdSubcategories = 0;
  let createdPrograms = 0;
  let updatedPrograms = 0;
  let directPrograms = 0;

  logger.info(
    colors.cyan(`Seeding reference catalog: ${categoryNames.length} categories from Excel...`)
  );

  for (const categoryName of categoryNames) {
    let category = await database.category.findFirst({
      where: { name: categoryName },
    });

    if (!category) {
      category = await database.category.create({
        data: {
          name: categoryName,
          description: `Reference category: ${categoryName}`,
        },
      });
      createdCategories += 1;
      logger.info(colors.green(`Category created: ${categoryName}`));
    } else if (category.isDeleted) {
      category = await database.category.update({
        where: { id: category.id },
        data: { isDeleted: false },
      });
    }

    // Programs with subcategory → name is just "Wind", "Indoor", etc.
    for (const [subName, programs] of Object.entries(tree[categoryName].subcategories)) {
      let subcategory = await database.subcategory.findFirst({
        where: {
          categoryId: category.id,
          name: subName,
        },
      });

      if (!subcategory) {
        subcategory = await database.subcategory.create({
          data: {
            name: subName,
            categoryId: category.id,
            description: `${subName} under ${categoryName}`,
          },
        });
        createdSubcategories += 1;
        logger.info(colors.green(`Subcategory created: ${subName} (${categoryName})`));
      } else if (subcategory.isDeleted) {
        subcategory = await database.subcategory.update({
          where: { id: subcategory.id },
          data: { isDeleted: false, categoryId: category.id },
        });
      }

      for (const programName of programs) {
        const result = await upsertProgram({
          programName,
          categoryId: category.id,
          subcategoryId: subcategory.id,
          description: `${programName} (${categoryName} > ${subName})`,
        });
        if (result === 'created') {
          createdPrograms += 1;
          logger.info(colors.green(`Program created: ${programName}`));
        } else {
          updatedPrograms += 1;
        }
      }
    }

    // No subcategory → program sits directly under category.
    for (const programName of tree[categoryName].directPrograms) {
      const result = await upsertProgram({
        programName,
        categoryId: category.id,
        subcategoryId: null,
        description: `${programName} (${categoryName})`,
      });
      directPrograms += 1;
      if (result === 'created') {
        createdPrograms += 1;
        logger.info(colors.green(`Direct program created: ${programName}`));
      } else {
        updatedPrograms += 1;
      }
    }
  }

  logger.info(colors.cyan('──────── Reference catalog seed summary ────────'));
  logger.info(`Categories created : ${createdCategories}`);
  logger.info(`Subcategories created : ${createdSubcategories}`);
  logger.info(`Programs created : ${createdPrograms}`);
  logger.info(`Programs updated : ${updatedPrograms}`);
  logger.info(`Direct programs (no subcategory) : ${directPrograms}`);
};

const run = async () => {
  try {
    await connectDB();
    await seedReferenceCatalog();
    logger.info(colors.green('Reference catalog seed completed.'));
    process.exit(0);
  } catch (error) {
    logger.error(colors.red('Reference catalog seed failed.'), error);
    process.exit(1);
  } finally {
    await closeDB();
  }
};

void run();
