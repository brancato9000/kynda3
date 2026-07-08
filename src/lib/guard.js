// Abuse guards (V3-22). Layered, cheapest-first:
//
//   Layer 1 — global daily caps (DB-backed circuit breaker): bound the
//   worst-case daily spend no matter what else fails. Fresh generations
//   count against `mixes` rows; searches against `query_log` rows.
//
//   Layer 2 — per-IP rate limits (in-memory token window). Per serverless
//   instance, so it's leaky across instances by design — it stops casual
//   abuse; the global cap is the real backstop.
//
// Cached serves bypass everything: they cost ~nothing and should never 429.

import { q, dbConfigured } from "./db.js";

const DAILY_GENERATION_CAP = parseInt(process.env.KYNDA_DAILY_GENERATION_CAP || "100", 10);
const DAILY_SEARCH_CAP = parseInt(process.env.KYNDA_DAILY_SEARCH_CAP || "2000", 10);

const buckets = new Map(); // key → [timestamps]

/** Sliding-window limiter. Returns true when the request is allowed. */
export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) buckets.delete(buckets.keys().next().value);
  return true;
}

export function clientIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** True when today's fresh-generation budget is exhausted. Fails open without a DB. */
export async function generationCapReached() {
  if (!dbConfigured()) return false;
  try {
    const r = await q(
      "SELECT count(*)::int AS n FROM mixes WHERE created_at > now() - interval '24 hours'"
    );
    return r.rows[0].n >= DAILY_GENERATION_CAP;
  } catch {
    return false;
  }
}

/** True when today's search budget is exhausted. Fails open without a DB. */
export async function searchCapReached() {
  if (!dbConfigured()) return false;
  try {
    const r = await q(
      "SELECT count(*)::int AS n FROM query_log WHERE created_at > now() - interval '24 hours'"
    );
    return r.rows[0].n >= DAILY_SEARCH_CAP;
  } catch {
    return false;
  }
}

export const CAPACITY_MESSAGE =
  "Kynda is at capacity for today — subjects already in the graph still work. Fresh maps resume tomorrow.";
