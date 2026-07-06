// Minimal migration runner. Applies db/migrations/*.sql in filename order,
// tracking applied migrations in schema_migrations. Requires DATABASE_URL.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Point it at a Postgres instance (Neon/Supabase/local).");
    process.exit(1);
  }
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const applied = new Set(
      (await client.query("SELECT filename FROM schema_migrations")).rows.map((r) => r.filename)
    );
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (applied.has(file)) { console.log(`skip  ${file}`); continue; }
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`apply ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
    console.log("migrations up to date");
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
