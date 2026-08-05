-- Migrate event_schedules.competitionLevel from enum to text (schedule tier labels).
ALTER TABLE event_schedules
  ALTER COLUMN "competitionLevel" TYPE TEXT
  USING "competitionLevel"::TEXT;

-- Legacy round-style enum values -> default schedule tier (dev data cleanup).
UPDATE event_schedules
SET "competitionLevel" = 'Local-Easy'
WHERE "competitionLevel" IN ('Preliminary', 'SemiFinal', 'Final');
