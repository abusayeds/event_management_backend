import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma's CLI engine does not support SCRAM channel binding, so a Neon URL
 * with `channel_binding=require` fails with P1001 ("Can't reach database
 * server") even though the server is reachable.
 *
 * The runtime connects through `@prisma/adapter-pg` (node-postgres), which
 * does support it, so the parameter is stripped here for the CLI only and
 * `DATABASE_URL` keeps it for the application.
 *
 * TLS is unaffected: `sslmode=require` stays in place.
 */
const cliDatabaseUrl = (process.env.DATABASE_URL ?? '')
  .replace(/([?&])channel_binding=[^&]*&?/i, '$1')
  .replace(/[?&]$/, '');

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: cliDatabaseUrl || process.env.DATABASE_URL,
  },
});
