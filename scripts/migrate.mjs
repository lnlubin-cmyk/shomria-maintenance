/**
 * Applies SQL migrations to the database.
 *
 *   PGURI="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres" \
 *     node scripts/migrate.mjs supabase/migrations/0001_schema.sql ...
 *
 * The connection string is read from the environment, never a file, so the
 * database password stays out of the repo. Get it from the Supabase dashboard:
 * Settings -> Database -> Connection string -> URI.
 *
 * Each file runs in its own transaction: a failure rolls that file back and
 * stops, leaving the database on the last known-good migration rather than
 * half-applied.
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";

const files = process.argv.slice(2);
const conn = process.env.PGURI;

if (!conn) {
  console.error("PGURI is not set");
  process.exit(1);
}
if (files.length === 0) {
  console.error("usage: node scripts/migrate.mjs <file.sql> [file.sql ...]");
  process.exit(1);
}

const client = new Client({
  connectionString: conn,
  // Supabase terminates TLS with a cert this client has no root for.
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("connected");
} catch (e) {
  console.error("CONNECT FAILED:", e.message);
  process.exit(1);
}

for (const file of files) {
  const sql = readFileSync(file, "utf8");
  const name = file.split(/[\\/]/).pop();
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log(`OK   ${name}`);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    console.error(`FAIL ${name}`);
    console.error(`     ${e.message}`);
    if (e.position) {
      const upto = sql.slice(0, Number(e.position));
      console.error(`     at line ${upto.split("\n").length}`);
    }
    if (e.hint) console.error(`     hint: ${e.hint}`);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log("all migrations applied");
