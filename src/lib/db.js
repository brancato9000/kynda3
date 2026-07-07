// Postgres access (Supabase). Degrades gracefully: without DATABASE_URL the
// app runs exactly as before — persistence is additive, never load-bearing
// for serving a request (V3-17).

import pg from "pg";

let pool = null;

export function dbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!dbConfigured()) return null;
  if (!pool) {
    const url = process.env.DATABASE_URL;
    pool = new pg.Pool({
      connectionString: url,
      // Serverless-friendly: tiny pool per instance; Supabase's transaction
      // pooler (port 6543) does the real connection multiplexing.
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
      allowExitOnIdle: true,
    });
    // Idle pooled clients killed by the pooler (long model calls between
    // queries) emit pool-level errors; unhandled, they crash the process.
    // Benign — the pool replaces dead clients on the next query.
    pool.on("error", (err) => {
      console.error("pg pool idle-client error (recovering):", err.code || err.message);
    });
  }
  return pool;
}

/** Query helper; returns null when no database is configured. */
export async function q(text, params = []) {
  const p = getPool();
  if (!p) return null;
  return p.query(text, params);
}
