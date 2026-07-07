import { disambiguate } from "../../../src/lib/pipeline/disambiguate.js";
import { recordSearch } from "../../../src/lib/store.js";

export const maxDuration = 60;

export async function POST(req) {
  try {
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
