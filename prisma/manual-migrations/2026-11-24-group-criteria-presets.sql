-- Group criteria presets + schema drift repair
-- Client feedback 2026-11-18, point 14.
--
-- This project uses `prisma db push` rather than migration files, but two
-- pre-existing drifts make a plain push destructive:
--
--   1. event_schedules.competitionLevel is still the `CompetitionLevel` enum
--      in the database while the schema declares TEXT. Prisma would DROP and
--      re-add the column, losing all 129 rows' values.
--   2. subcategories has a UNIQUE index on (name) where the schema declares
--      UNIQUE (categoryId, name).
--
-- This script performs both in place, keeping every row, and then applies the
-- point-14 changes. Run it BEFORE `npm run prisma:push`; after it, push
-- reports no changes.
--
--   psql "$DATABASE_URL" -f prisma/manual-migrations/2026-11-24-group-criteria-presets.sql
--
-- Every statement is non-destructive and safe to re-run.

-- ── 1. Enum values ───────────────────────────────────────────────────────────
-- PostgreSQL does not allow ADD VALUE inside a transaction that later uses the
-- new value, so these run first, on their own.
ALTER TYPE "GroupCriteria" ADD VALUE IF NOT EXISTS 'Default';
ALTER TYPE "GroupCriteria" ADD VALUE IF NOT EXISTS 'UTR';
ALTER TYPE "GroupCriteria" ADD VALUE IF NOT EXISTS 'Level';
ALTER TYPE "GroupCriteria" ADD VALUE IF NOT EXISTS 'Class';

ALTER TYPE "RoundCondition" ADD VALUE IF NOT EXISTS 'Default';
ALTER TYPE "RoundCondition" ADD VALUE IF NOT EXISTS 'Equal';

BEGIN;

-- ── 2. competitionLevel: enum -> text, values preserved ──────────────────────
-- The USING cast keeps the existing text ("Preliminary", "SemiFinal",
-- "Final"). Those are legacy round types rather than the Local-Easy style
-- tiers the app now uses; the event edit form already treats an unrecognised
-- value as "not set" and asks the user to pick a valid level.
--
-- The `CompetitionLevel` enum type itself is kept: event_rounds.roundType
-- still uses it.
ALTER TABLE "event_schedules"
  ALTER COLUMN "competitionLevel" TYPE TEXT
  USING "competitionLevel"::text;

-- ── 3. subcategories: unique per category rather than globally ───────────────
-- Verified: no duplicate (categoryId, name) pairs exist.
DROP INDEX IF EXISTS "subcategories_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "subcategories_categoryId_name_key"
  ON "subcategories" ("categoryId", "name");

-- ── 4. EventGroup: optional number + preset label (point 14) ─────────────────
-- Existing Age / Score rows keep their number; nothing is lost.
ALTER TABLE "event_groups" ALTER COLUMN "value" DROP NOT NULL;
ALTER TABLE "event_groups" ADD COLUMN IF NOT EXISTS "valueLabel" TEXT;

COMMIT;
