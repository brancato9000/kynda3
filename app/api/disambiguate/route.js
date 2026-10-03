import { disambiguate } from "../../../src/lib/pipeline/disambiguate.js";
import { recordSearch, findMappedSubjectByName } from "../../../src/lib/store.js";
import { privateSubjectBlocked } from "../../../src/lib/site.js";
import { getIntroExtract } from "../../../src/lib/entities/wikipedia.js";
import { rateLimit, clientIp, searchCapReached, CAPACITY_MESSAGE } from "../../../src/lib/guard.js";

export const maxDuration = 60;

export async function POST(req) {
  try {
    // V3-22 guards: per-IP limit, then the global daily circuit breaker.
    if (!rateLimit(`disambiguate:${clientIp(req)}`, { limit: 60, windowMs: 3_600_000 })) {
      return Response.json({ error: "Too many searches — try again in a bit." }, { status: 429 });
    }
    const { query } = await req.json();
    if (!query || typeof query !== "string" || !query.trim()) {
      return Response.json({ error: "query required" }, { status: 400 });
    }
    // Mapped first (Tony, 2026-10-03): a search that names a mapped subject
    // opens it straight from the graph — no model call, no search-cap hit.
    const mapped = await findMappedSubjectByName(query).catch(() => null);
    if (mapped && !privateSubjectBlocked(req, mapped.name)) {
      const bio = await getIntroExtract({ name: mapped.name, qid: mapped.wikidata_qid }).catch(() => null);
      const subject = {
        name: mapped.name, kind: mapped.kind, domain: mapped.domain, description: "", yearsActive: null,
        mbid: mapped.mbid, wikidata_qid: mapped.wikidata_qid, source: "kynda", mapped: true,
        bio: bio ? { text: bio.text, articleTitle: bio.title, url: bio.url, source: "Wikipedia" }
          : mapped.synthesis_bio ? { text: mapped.synthesis_bio, source: "Kynda" } : null,
      };
      recordSearch(query.trim(), { ...subject, entityId: mapped.id }, "mapped").catch((err) => console.error("recordSearch failed:", err.message));
      return Response.json({ confidence: "certain", subject, alternatives: [] });
    }
    if (await searchCapReached()) {
      return Response.json({ error: CAPACITY_MESSAGE }, { status: 429 });
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
