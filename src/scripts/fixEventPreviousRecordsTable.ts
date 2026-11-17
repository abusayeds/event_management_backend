import { closeDB, connectDB, database } from '../config/database';

async function main() {
  await connectDB();

  await database.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "event_previous_records" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "previousEventId" TEXT NOT NULL,
  "recordName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_previous_records_pkey" PRIMARY KEY ("id")
);
`);

  await database.$executeRawUnsafe(`
CREATE UNIQUE INDEX IF NOT EXISTS "event_previous_records_eventId_previousEventId_key"
  ON "event_previous_records"("eventId", "previousEventId");
`);

  await database.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "event_previous_records_eventId_idx"
  ON "event_previous_records"("eventId");
`);

  await database.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "event_previous_records_previousEventId_idx"
  ON "event_previous_records"("previousEventId");
`);

  await database.$executeRawUnsafe(`
DO $$ BEGIN
  ALTER TABLE "event_previous_records"
    ADD CONSTRAINT "event_previous_records_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`);

  await database.$executeRawUnsafe(`
DO $$ BEGIN
  ALTER TABLE "event_previous_records"
    ADD CONSTRAINT "event_previous_records_previousEventId_fkey"
    FOREIGN KEY ("previousEventId") REFERENCES "events"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`);

  const rows = await database.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'event_previous_records'`
  );
  console.log('event_previous_records ready:', rows);
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDB();
  });
