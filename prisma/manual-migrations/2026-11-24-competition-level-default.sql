-- Legacy competitionLevel repair (applied 2026-11-24)
--
-- event_schedules.competitionLevel used to be the `CompetitionLevel` enum and
-- held round types: Preliminary (79), SemiFinal (30), Final (20).
--
-- The column is now TEXT and the app expects a schedule tier, one of
-- {Local|Regional|State|National|International}-{Easy|Medium|Difficult}.
-- Round types live on event_rounds.roundType, so the old values carried no
-- tier information at all. They are therefore all mapped to the default tier
-- rather than guessed at.
--
-- To undo:
--   psql "$DATABASE_URL" -f prisma/manual-migrations/2026-11-24-competition-level-rollback.sql
--
-- Safe to re-run: rows that already hold a valid tier are left alone.

BEGIN;

UPDATE "event_schedules"
   SET "competitionLevel" = 'Local-Easy'
 WHERE "competitionLevel" <> ALL (ARRAY[
   'Local-Easy',         'Local-Medium',         'Local-Difficult',
   'Regional-Easy',      'Regional-Medium',      'Regional-Difficult',
   'State-Easy',         'State-Medium',         'State-Difficult',
   'National-Easy',      'National-Medium',      'National-Difficult',
   'International-Easy', 'International-Medium', 'International-Difficult'
 ]::text[]);

COMMIT;
