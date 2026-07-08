import { disambiguate } from "../../../src/lib/pipeline/disambiguate.js";
import { recordSearch } from "../../../src/lib/store.js";
import { rateLimit, clientIp, searchCapReached, CAPACITY_MESSAGE } from "../../../src/lib/guard.js";

export const maxDuration = 60;

export async function POST(req) {
  try {
    // V3-22 guards: per-IP limit, then the global daily circuit breaker.
    if (!rateLimit(`disambiguate:${clientIp(req)}`, { limit: 60, windowMs: 3_600_000 })) {
      return Response.json({ error: "Too many searches — try again in a bit." }, { status: 429 });
    }
    if (await searchCapReached()) {
      return Response.json({ error: CAPACITY_MESSAGE }, { status: 429 });
    }
    const { query } = await req.json();
    if (!query || typeof query !== "string" || !query.trim()) {
      return Response.json({ error: "query required" }, { status: 400 });
    }
    const result = await disambiguate(query.trim());
    // Best-effort persistence (V3-17): the query log feeds research-queue
    // prioritization; a failure here must never break the search.
    try {
      await recordSearch(query.trim(), result.subject || null, result.confidence);
    } catch (err) {
      console.error("recordSearch failed:", err.message);
    }
    return Response.json(result);
  } catch (err) {
    console.error("disambiguate error:", err);
    return Response.json({ error: err.message || "disambiguation failed" }, { status: 500 });
  }
}
