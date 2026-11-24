#!/usr/bin/env node
/**
 * Brings a database up to date with the schema shipped in this release.
 *
 * Run it once per database (staging, production, …) after pulling, before
 * starting the app:
 *
 *     node scripts/migrate-server-db.js --dry-run   # report only, changes nothing
 *     node scripts/migrate-server-db.js             # apply
 *
 * It covers three things:
 *
 *   1. The group-criteria presets from the 2026-11-18 client feedback:
 *      new GroupCriteria / RoundCondition values, EventGroup.value becomes
 *      optional and EventGroup.valueLabel is added.
 *
 *   2. Two older drifts that make a plain `prisma db push` destructive:
 *      event_schedules.competitionLevel is still an enum in some databases
 *      while the schema says TEXT, and subcategories has a UNIQUE index on
 *      (name) instead of (categoryId, name). Both are repaired in place.
 *
 *   3. Optionally, legacy competitionLevel values (the round types
 *      Preliminary / SemiFinal / Final) are mapped to the default tier
 *      Local-Easy. Skip with --keep-legacy-levels.
 *
 * Every step checks the current state first and does nothing if it has
 * already been applied, so re-running is safe.
 */

'use strict';

require('dotenv/config');
const { Client } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');
const KEEP_LEGACY_LEVELS = process.argv.includes('--keep-legacy-levels');

const DEFAULT_TIER = 'Local-Easy';
const VALID_TIERS = ['Local', 'Regional', 'State', 'National', 'International'].flatMap(
  (place) => ['Easy', 'Medium', 'Difficult'].map((hardness) => `${place}-${hardness}`)
);

const NEW_GROUP_CRITERIA = ['Default', 'UTR', 'Level', 'Class'];
const NEW_ROUND_CONDITIONS = ['Default', 'Equal'];

const log = (...args) => console.log(...args);
const step = (name) => log(`\n── ${name}`);
const done = (msg) => log(`   ✓ ${msg}`);
const skip = (msg) => log(`   · ${msg}`);
const warn = (msg) => log(`   ! ${msg}`);

// ── helpers ──────────────────────────────────────────────────────────────────

const enumValues = async (c, typeName) => {
  const { rows } = await c.query(
    `select e.enumlabel
       from pg_enum e
       join pg_type t on t.oid = e.enumtypid
      where t.typname = $1
      order by e.enumsortorder`,
    [typeName]
  );
  return rows.map((r) => r.enumlabel);
};

const columnInfo = async (c, table, column) => {
  const { rows } = await c.query(
    `select data_type, udt_name, is_nullable
       from information_schema.columns
      where table_name = $1 and column_name = $2`,
    [table, column]
  );
  return rows[0] ?? null;
};

const indexExists = async (c, name) => {
  const { rows } = await c.query(`select 1 from pg_indexes where indexname = $1`, [name]);
  return rows.length > 0;
};

const run = async (c, sql, params) => {
  if (DRY_RUN) {
    log(`   [dry-run] ${sql.replace(/\s+/g, ' ').trim().slice(0, 100)}`);
    return { rowCount: 0 };
  }
  return c.query(sql, params);
};

// ── main ─────────────────────────────────────────────────────────────────────

(async () => {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Run this from the backend directory.');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows: who } = await client.query('select current_database() db');
  log(`Database: ${who[0].db}`);
  log(DRY_RUN ? 'Mode    : DRY RUN (nothing will be changed)' : 'Mode    : APPLY');

  let changed = 0;

  // ── 1. Enum values ─────────────────────────────────────────────────────────
  // ADD VALUE cannot run inside a transaction that then uses the new value,
  // so these are applied on their own, first.
  step('Enum values');
  for (const [typeName, wanted] of [
    ['GroupCriteria', NEW_GROUP_CRITERIA],
    ['RoundCondition', NEW_ROUND_CONDITIONS],
  ]) {
    const existing = await enumValues(client, typeName);
    if (existing.length === 0) {
      warn(`${typeName} does not exist — is this the right database?`);
      continue;
    }
    for (const value of wanted) {
      if (existing.includes(value)) {
        skip(`${typeName}.${value} already present`);
        continue;
      }
      await run(client, `ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS '${value}'`);
      done(`${typeName} += ${value}`);
      changed += 1;
    }
  }

  // ── 2. Preconditions for the rest ──────────────────────────────────────────
  step('Preconditions');
  const { rows: dupes } = await client.query(
    `select "categoryId", name, count(*)::int n
       from subcategories
      group by 1, 2
     having count(*) > 1`
  );
  if (dupes.length > 0) {
    warn(`${dupes.length} duplicate (categoryId, name) pairs in subcategories.`);
    warn('The unique index cannot be created until these are resolved:');
    console.table(dupes);
    warn('Nothing further was changed. Fix the duplicates, then re-run.');
    await client.end();
    process.exit(1);
  }
  done('No duplicate (categoryId, name) in subcategories');

  // ── 3. Schema changes, in one transaction ──────────────────────────────────
  step('Schema');
  if (!DRY_RUN) await client.query('BEGIN');
  try {
    // 3a. competitionLevel: enum -> text, values preserved.
    const level = await columnInfo(client, 'event_schedules', 'competitionLevel');
    if (!level) {
      warn('event_schedules.competitionLevel not found — skipping');
    } else if (level.data_type === 'USER-DEFINED') {
      await run(
        client,
        `ALTER TABLE "event_schedules"
           ALTER COLUMN "competitionLevel" TYPE TEXT
           USING "competitionLevel"::text`
      );
      done(`competitionLevel: ${level.udt_name} enum -> text (values kept)`);
      changed += 1;
    } else {
      skip(`competitionLevel is already ${level.data_type}`);
    }

    // 3b. subcategories: unique per category rather than globally.
    if (await indexExists(client, 'subcategories_name_key')) {
      await run(client, `DROP INDEX IF EXISTS "subcategories_name_key"`);
      done('Dropped unique index subcategories_name_key');
      changed += 1;
    } else {
      skip('subcategories_name_key already gone');
    }
    if (await indexExists(client, 'subcategories_categoryId_name_key')) {
      skip('subcategories_categoryId_name_key already exists');
    } else {
      await run(
        client,
        `CREATE UNIQUE INDEX IF NOT EXISTS "subcategories_categoryId_name_key"
           ON "subcategories" ("categoryId", "name")`
      );
      done('Created unique index on (categoryId, name)');
      changed += 1;
    }

    // 3c. event_groups: optional number + preset label.
    const value = await columnInfo(client, 'event_groups', 'value');
    if (value && value.is_nullable === 'NO') {
      await run(client, `ALTER TABLE "event_groups" ALTER COLUMN "value" DROP NOT NULL`);
      done('event_groups.value is now nullable');
      changed += 1;
    } else {
      skip('event_groups.value already nullable');
    }

    const valueLabel = await columnInfo(client, 'event_groups', 'valueLabel');
    if (valueLabel) {
      skip('event_groups.valueLabel already exists');
    } else {
      await run(client, `ALTER TABLE "event_groups" ADD COLUMN IF NOT EXISTS "valueLabel" TEXT`);
      done('Added event_groups.valueLabel');
      changed += 1;
    }

    if (!DRY_RUN) await client.query('COMMIT');
  } catch (e) {
    if (!DRY_RUN) await client.query('ROLLBACK');
    console.error(`\nFailed, rolled back: ${e.message}`);
    await client.end();
    process.exit(1);
  }

  // ── 4. Legacy competitionLevel values ──────────────────────────────────────
  step('Legacy competitionLevel values');
  const { rows: legacy } = await client.query(
    `select "competitionLevel" v, count(*)::int n
       from event_schedules
      where "competitionLevel" <> ALL($1::text[])
      group by 1
      order by 2 desc`,
    [VALID_TIERS]
  );

  if (legacy.length === 0) {
    skip('All rows already hold a valid tier');
  } else {
    const total = legacy.reduce((sum, r) => sum + r.n, 0);
    log(`   ${total} row(s) hold a value the app does not recognise:`);
    console.table(legacy);

    if (KEEP_LEGACY_LEVELS) {
      skip('--keep-legacy-levels given, leaving them as they are');
      warn('The event edit form will show an empty competition level for these.');
    } else {
      // Print the rollback before changing anything.
      const { rows: before } = await client.query(
        `select id, "competitionLevel"
           from event_schedules
          where "competitionLevel" <> ALL($1::text[])
          order by id`,
        [VALID_TIERS]
      );
      log('\n   Rollback (save this if you may want to undo):');
      log('   ---8<---');
      for (const r of before) {
        log(
          `   UPDATE "event_schedules" SET "competitionLevel" = '${r.competitionLevel}' WHERE "id" = '${r.id}';`
        );
      }
      log('   --->8---\n');

      const res = await run(
        client,
        `update event_schedules
            set "competitionLevel" = $1
          where "competitionLevel" <> ALL($2::text[])`,
        [DEFAULT_TIER, VALID_TIERS]
      );
      done(`Mapped ${DRY_RUN ? total : res.rowCount} row(s) to ${DEFAULT_TIER}`);
      changed += 1;
    }
  }

  // ── 5. Report ──────────────────────────────────────────────────────────────
  step('Result');
  if (DRY_RUN) {
    log(`   ${changed} change(s) would be applied. Re-run without --dry-run to apply.`);
  } else if (changed === 0) {
    log('   Database was already up to date. Nothing changed.');
  } else {
    log(`   ${changed} change(s) applied.`);
    log('   Next: npm run prisma:generate, then restart the app.');
  }

  await client.end();
})().catch((e) => {
  console.error(`\nERROR: ${e.message}`);
  process.exit(1);
});
