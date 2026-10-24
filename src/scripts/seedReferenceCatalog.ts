import path from 'path';
import colors from 'colors';
import XLSX from 'xlsx';
import config from '../config';
import { closeDB, connectDB, database } from '../config/database';
import logger from '../config/logger';
import { writeLocalFile } from '../utils/localStorage';
import {
  mimeFromExt,
  readReferenceAsset,
  REFERENCE_WORKBOOK,
  ReferenceSource,
  resolveReferenceSource,
  syncReferenceBundleToS3,
} from '../utils/referenceAssetStore';
import {
  buildReferenceImageCatalog,
  normalizeReferenceName,
  ReferenceImage,
  referenceImageKey,
} from '../utils/referenceImageCatalog';
import { uploadBufferWithKey } from '../utils/s3Upload';

type CategoryNode = {
  /** Subcategory name -> program names, in workbook order. */
  subcategories: Record<string, string[]>;
  /** Programs that sit directly under the category (Art, Food & Drink). */
  directPrograms: string[];
};

type CatalogTree = Record<string, CategoryNode>;

/**
 * The workbook's first data row is `All | | | Default`, a UI filter marker rather
 * than a real category, so it never becomes a Category row.
 */
const SKIPPED_FIRST_LEVEL = new Set(['All', 'First Level']);

/** Read the Program sheet into category > subcategory > program exactly as authored. */
export const parseReferenceCatalog = async (source: ReferenceSource): Promise<CatalogTree> => {
  const workbook = XLSX.read(await readReferenceAsset(REFERENCE_WORKBOOK, source));
  const sheet = workbook.Sheets.Program;
  if (!sheet) {
    throw new Error('Sheet "Program" not found in Reference Data.xlsx');
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
  });

  const tree: CatalogTree = {};
  let category = '';
  let subcategory = '';

  for (const row of rows.slice(1)) {
    const first = row[0] != null ? String(row[0]).trim() : '';
    const second = row[1] != null ? String(row[1]).trim() : '';
    const program = row[2] != null ? String(row[2]).trim() : '';

    if (SKIPPED_FIRST_LEVEL.has(first)) {
      continue;
    }

    if (first) {
      category = first;
      // A new category starts a fresh subcategory scope; Art and Food & Drink
      // leave the second column empty and keep their programs at category level.
      subcategory = '';
      if (!tree[category]) {
        tree[category] = { subcategories: {}, directPrograms: [] };
      }
    }

    if (second) {
      subcategory = second;
    }

    if (!category || !program) {
      continue;
    }

    const node = tree[category];

    if (subcategory) {
      if (!node.subcategories[subcategory]) {
        node.subcategories[subcategory] = [];
      }
      if (!node.subcategories[subcategory].includes(program)) {
        node.subcategories[subcategory].push(program);
      }
    } else if (!node.directPrograms.includes(program)) {
      node.directPrograms.push(program);
    }
  }

  return tree;
};

/**
 * Stores each reference photo once under its stable key and hands back the value
 * to persist — an S3 URL when AWS is on, otherwise the local `/uploads/...` path.
 */
const createImageResolver = async (source: ReferenceSource) => {
  let catalog: ReferenceImage[];
  try {
    catalog = await buildReferenceImageCatalog(source);
  } catch (error) {
    logger.warn(
      colors.yellow('Reference photos are unavailable; seeding catalog without images.'),
      {
        error,
      }
    );
    return () => Promise.resolve<string | null>(null);
  }

  const byEntity = new Map<string, ReferenceImage>();
  for (const image of catalog) {
    byEntity.set(
      `${image.model}:${normalizeReferenceName(image.categoryName)}:${normalizeReferenceName(image.name)}`,
      image
    );
  }

  const stored = new Map<string, string | null>();

  return async (
    model: ReferenceImage['model'],
    categoryName: string,
    name: string
  ): Promise<string | null> => {
    const image = byEntity.get(
      `${model}:${normalizeReferenceName(categoryName)}:${normalizeReferenceName(name)}`
    );
    if (!image) {
      logger.warn(`No reference photo for ${model} "${name}" (${categoryName}).`);
      return null;
    }

    const key = referenceImageKey(image);
    const cached = stored.get(key);
    if (cached !== undefined) {
      return cached;
    }

    let value: string | null = null;
    try {
      const buffer = await readReferenceAsset(image.relPath, image.source);
      value = config.storage.useAws
        ? await uploadBufferWithKey(buffer, key, mimeFromExt(path.extname(image.relPath)), {
            originalName: path.basename(image.relPath),
            source: 'reference-data-seed',
          })
        : await writeLocalFile(buffer, key);
    } catch (error) {
      logger.error(`Failed to store reference photo for ${model} "${name}".`, { error });
    }

    stored.set(key, value);
    return value;
  };
};

type Counters = {
  categoriesCreated: number;
  subcategoriesCreated: number;
  programsCreated: number;
  programsUpdated: number;
  imagesBackfilled: number;
  softDeleted: number;
};

const upsertProgram = async (
  params: {
    name: string;
    categoryId: string;
    subcategoryId: string | null;
    description: string;
    imageUrl: string | null;
  },
  counters: Counters
) => {
  const existing = await database.program.findFirst({ where: { name: params.name } });

  // An admin-supplied photo outranks the reference one; only fill a blank.
  const backfillImage = !existing?.imageUrl && params.imageUrl ? params.imageUrl : null;

  if (existing) {
    if (backfillImage) {
      counters.imagesBackfilled += 1;
    }

    const unchanged =
      !existing.isDeleted &&
      existing.categoryId === params.categoryId &&
      existing.subcategoryId === params.subcategoryId &&
      !backfillImage;

    if (unchanged) {
      return;
    }

    counters.programsUpdated += 1;
  } else {
    counters.programsCreated += 1;
  }

  // `upsert` on the unique name keeps a second seed (dev watch restart, extra
  // server replica) from colliding with this one mid-run.
  await database.program.upsert({
    where: { name: params.name },
    create: {
      name: params.name,
      categoryId: params.categoryId,
      subcategoryId: params.subcategoryId,
      description: params.description,
      imageUrl: params.imageUrl ?? undefined,
    },
    update: {
      isDeleted: false,
      categoryId: params.categoryId,
      subcategoryId: params.subcategoryId,
      ...(backfillImage ? { imageUrl: backfillImage } : {}),
    },
  });
};

/**
 * Hides catalog rows the workbook does not define so the API serves exactly the
 * reference tree. Soft delete keeps rows that events or user skills still point at.
 */
const softDeleteNonReference = async (tree: CatalogTree, counters: Counters) => {
  const categoryNames = Object.keys(tree);
  const programNames = categoryNames.flatMap(name => [
    ...Object.values(tree[name].subcategories).flat(),
    ...tree[name].directPrograms,
  ]);

  const categories = await database.category.updateMany({
    where: { name: { notIn: categoryNames }, isDeleted: false },
    data: { isDeleted: true },
  });

  const programs = await database.program.updateMany({
    where: { name: { notIn: programNames }, isDeleted: false },
    data: { isDeleted: true },
  });

  // Subcategories are unique per category, so each category is filtered on its own.
  const referenceCategories = await database.category.findMany({
    where: { name: { in: categoryNames } },
    select: { id: true, name: true },
  });
  const keptSubcategoryIds: string[] = [];
  for (const category of referenceCategories) {
    const names = Object.keys(tree[category.name].subcategories);
    const kept = await database.subcategory.findMany({
      where: { categoryId: category.id, name: { in: names } },
      select: { id: true },
    });
    keptSubcategoryIds.push(...kept.map(item => item.id));
  }

  const subcategories = await database.subcategory.updateMany({
    where: { id: { notIn: keptSubcategoryIds }, isDeleted: false },
    data: { isDeleted: true },
  });

  counters.softDeleted = categories.count + subcategories.count + programs.count;

  if (counters.softDeleted > 0) {
    logger.info(
      colors.yellow(
        `Hid non-reference catalog rows — categories: ${categories.count}, ` +
          `subcategories: ${subcategories.count}, programs: ${programs.count}.`
      )
    );
  }
};

/**
 * True when the live catalog already matches the workbook, so a server restart
 * skips the workbook parse and image writes entirely.
 */
const isAlreadySeeded = async (tree: CatalogTree): Promise<boolean> => {
  const categoryNames = Object.keys(tree);
  const subcategoryCount = categoryNames.reduce(
    (total, name) => total + Object.keys(tree[name].subcategories).length,
    0
  );
  const programNames = categoryNames.flatMap(name => [
    ...Object.values(tree[name].subcategories).flat(),
    ...tree[name].directPrograms,
  ]);

  const [activeCategories, activeSubcategories, activePrograms, blankImages] = await Promise.all([
    database.category.count({ where: { isDeleted: false } }),
    database.subcategory.count({ where: { isDeleted: false } }),
    database.program.count({ where: { isDeleted: false } }),
    database.program.count({ where: { isDeleted: false, imageUrl: null } }),
  ]);

  if (
    activeCategories !== categoryNames.length ||
    activeSubcategories !== subcategoryCount ||
    activePrograms !== programNames.length ||
    blankImages > 0
  ) {
    return false;
  }

  // Counts can line up while the names differ, so confirm the reference names are the live ones.
  const [matchingCategories, matchingPrograms] = await Promise.all([
    database.category.count({ where: { isDeleted: false, name: { in: categoryNames } } }),
    database.program.count({ where: { isDeleted: false, name: { in: programNames } } }),
  ]);

  return matchingCategories === categoryNames.length && matchingPrograms === programNames.length;
};

export const seedReferenceCatalog = async (): Promise<void> => {
  // Mirror the bundle first so this instance — and every later deploy, which has no
  // `temp-reference-data/` on disk — can seed straight from the bucket.
  await syncReferenceBundleToS3();

  const source = await resolveReferenceSource();
  if (!source) {
    logger.warn(
      colors.yellow('Reference bundle found neither on disk nor on S3; skipping catalog seed.')
    );

    return;
  }

  const tree = await parseReferenceCatalog(source);

  if (await isAlreadySeeded(tree)) {
    logger.info(colors.gray('Reference catalog already matches the workbook; nothing to seed.'));

    return;
  }

  logger.info(colors.cyan(`Reference bundle source: ${source}.`));

  const counters: Counters = {
    categoriesCreated: 0,
    subcategoriesCreated: 0,
    programsCreated: 0,
    programsUpdated: 0,
    imagesBackfilled: 0,
    softDeleted: 0,
  };

  const resolveImage = await createImageResolver(source);
  const categoryNames = Object.keys(tree);

  logger.info(colors.cyan(`Seeding reference catalog: ${categoryNames.length} categories...`));

  for (const categoryName of categoryNames) {
    const node = tree[categoryName];
    const categoryImage = await resolveImage('category', categoryName, categoryName);

    const existingCategory = await database.category.findFirst({ where: { name: categoryName } });
    const backfillCategoryImage =
      !existingCategory?.imageUrl && categoryImage ? categoryImage : null;

    if (!existingCategory) {
      counters.categoriesCreated += 1;
      logger.info(colors.green(`Category created: ${categoryName}`));
    } else if (backfillCategoryImage) {
      counters.imagesBackfilled += 1;
    }

    const category = await database.category.upsert({
      where: { name: categoryName },
      create: {
        name: categoryName,
        description: `Reference category: ${categoryName}`,
        imageUrl: categoryImage ?? undefined,
      },
      update: {
        isDeleted: false,
        ...(backfillCategoryImage ? { imageUrl: backfillCategoryImage } : {}),
      },
    });

    for (const [subcategoryName, programs] of Object.entries(node.subcategories)) {
      const subcategoryImage = await resolveImage('subcategory', categoryName, subcategoryName);

      const existingSubcategory = await database.subcategory.findFirst({
        where: { categoryId: category.id, name: subcategoryName },
      });
      const backfillSubcategoryImage =
        !existingSubcategory?.imageUrl && subcategoryImage ? subcategoryImage : null;

      if (!existingSubcategory) {
        counters.subcategoriesCreated += 1;
        logger.info(colors.green(`Subcategory created: ${categoryName} > ${subcategoryName}`));
      } else if (backfillSubcategoryImage) {
        counters.imagesBackfilled += 1;
      }

      const subcategory = await database.subcategory.upsert({
        where: { categoryId_name: { categoryId: category.id, name: subcategoryName } },
        create: {
          name: subcategoryName,
          categoryId: category.id,
          description: `${subcategoryName} under ${categoryName}`,
          imageUrl: subcategoryImage ?? undefined,
        },
        update: {
          isDeleted: false,
          ...(backfillSubcategoryImage ? { imageUrl: backfillSubcategoryImage } : {}),
        },
      });

      for (const programName of programs) {
        await upsertProgram(
          {
            name: programName,
            categoryId: category.id,
            subcategoryId: subcategory.id,
            description: `${programName} (${categoryName} > ${subcategoryName})`,
            imageUrl: await resolveImage('program', categoryName, programName),
          },
          counters
        );
      }
    }

    for (const programName of node.directPrograms) {
      await upsertProgram(
        {
          name: programName,
          categoryId: category.id,
          subcategoryId: null,
          description: `${programName} (${categoryName})`,
          imageUrl: await resolveImage('program', categoryName, programName),
        },
        counters
      );
    }
  }

  await softDeleteNonReference(tree, counters);

  logger.info(colors.cyan('──────── Reference catalog seed summary ────────'));
  logger.info(`Categories created    : ${counters.categoriesCreated}`);
  logger.info(`Subcategories created : ${counters.subcategoriesCreated}`);
  logger.info(`Programs created      : ${counters.programsCreated}`);
  logger.info(`Programs updated      : ${counters.programsUpdated}`);
  logger.info(`Images backfilled     : ${counters.imagesBackfilled}`);
  logger.info(`Non-reference hidden  : ${counters.softDeleted}`);
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

// Keeps `tsx src/scripts/seedReferenceCatalog.ts` working without running on import.
if (require.main === module) {
  void run();
}
