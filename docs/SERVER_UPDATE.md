# Updating a server to the 2026-11-18 client-feedback release

This release changes the database schema, so pulling the code is not enough.
Each database — staging, production, any other — needs the migration run once.

No new dependencies and no new environment variables were added.

## Before you start

Take a database backup. Everything below is additive and has been run once
already on the development database without data loss, but a backup is the
only thing that makes a mistake cheap.

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%F-%H%M).sql
```

## Steps

```bash
cd /path/to/event-management-backend

# 1. Get the code
git pull origin main

# 2. Dependencies (nothing new, but the lockfile may have moved)
npm ci

# 3. See what the database needs — changes nothing
node scripts/migrate-server-db.js --dry-run

# 4. Apply it
node scripts/migrate-server-db.js

# 5. Regenerate the Prisma client against the new schema
npm run prisma:generate

# 6. Build and restart
npm run build
pm2 restart dawabuyi-backend     # or: docker compose up -d --build
```

Step 5 is required. The Prisma client is generated code; without it the app
still thinks `EventGroup.valueLabel` does not exist.

## What the migration does

The script checks the current state before each step and skips anything
already applied, so it is safe to run more than once.

**Client feedback, point 14 — group criteria presets**

- `GroupCriteria` gains `Default`, `UTR`, `Level`, `Class`
- `RoundCondition` gains `Default`, `Equal`
- `EventGroup.value` becomes nullable
- `EventGroup.valueLabel` is added

**Two older drifts**

These exist in databases created before the current schema and would make a
plain `prisma db push` destructive, so the script repairs them in place:

| Drift | Repair |
|---|---|
| `event_schedules.competitionLevel` is still an enum where the schema says TEXT | `ALTER COLUMN … TYPE TEXT USING …::text` — every value is kept |
| `subcategories` has a UNIQUE index on `(name)` where the schema says `(categoryId, name)` | Drop the old index, create the new one |

`prisma db push` would instead drop and recreate the `competitionLevel`
column, losing every row's value. Do not run `db push --force-reset` on a
database with data.

**Legacy competition levels**

Older rows hold round types (`Preliminary`, `SemiFinal`, `Final`) in
`competitionLevel`, where the app now expects a tier such as `Local-Easy`.
Those values carry no tier information — round types live on
`event_rounds.roundType` — so the script maps them all to `Local-Easy` rather
than guessing, and prints the rollback SQL first.

To leave them alone, pass `--keep-legacy-levels`. The event edit form will
then show an empty competition level for those events until someone picks
one.

## Checking it worked

```bash
npx prisma db push
```

It should say **"The database is already in sync with the Prisma schema."**
If it offers `--force-reset` instead, stop: a drift is still present. Run the
migration script again and read its output.

## If the Prisma CLI says it cannot reach the database

```
Error: P1001: Can't reach database server at `…`
```

On a Neon connection string this is usually not a connectivity problem. The
Prisma CLI engine does not support SCRAM channel binding, and reports
`channel_binding=require` in the URL as P1001.

`prisma.config.ts` already strips that parameter for the CLI only, so the
runtime keeps it. If you still see P1001, check real connectivity first:

```bash
# resolves and accepts connections?
node -e "const{Client}=require('pg');require('dotenv/config');const c=new Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.query('select 1')).then(()=>console.log('OK')).catch(e=>console.log('FAIL',e.message)).finally(()=>c.end())"
```

If that prints `OK`, the database is fine and the problem is in the CLI
layer, not the network.

## Rolling back

The schema changes are additive; the app's previous version keeps working
against the new schema, because `valueLabel` is nullable and the new enum
values are simply unused.

Only the legacy competition-level mapping changes existing data. The script
prints the rollback statements before applying it — save that output, or use
the one recorded for the development database at
`prisma/manual-migrations/2026-11-24-competition-level-rollback.sql`.
