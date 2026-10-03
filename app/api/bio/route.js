// Bio for a map center (2026-10-02): the page header follows the map's
// center, and its bio comes the same way the subject page builds one —
// the Wikipedia intro by QID (never a namesake), else Kynda's synthesis.
// Zero model calls.

import { q } from "../../../src/lib/db.js";
import { getIntroExtract } from "../../../src/lib/entities/wikipedia.js";
import { rateLimit, clientIp } from "../../../src/lib/guard.js";

export async function POST(req) {
  try {
    if (!rateLimit(`bio:${clientIp(req)}`, { limit: 600, windowMs: 3_600_000 })) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }
    const { name, qid } = await req.json();
    if (!name) return Response.json({ error: "name required" }, { status: 400 });
    const r = await q(
      `SELECT e.wikidata_qid, e.metadata->>'synthesis_bio' AS synthesis_bio FROM entities e
       WHERE lower(e.name) = lower($1)
       ORDER BY EXISTS (SELECT 1 FROM mixes m WHERE m.subject_entity_id = e.id) DESC,
                (SELECT count(*) FROM claims c WHERE c.subject_id = e.id OR c.object_id = e.id) DESC, e.created_at
       LIMIT 1`,
      [name]
    );
    const row = r?.rows[0] || {};
    const bio = await getIntroExtract({ name, qid: qid || row.wikidata_qid || null }).catch(() => null);
    if (bio) return Response.json({ bio: { text: bio.text, articleTitle: bio.title, url: bio.url, source: "Wikipedia" } });
    if (row.synthesis_bio) return Response.json({ bio: { text: row.synthesis_bio, source: "Kynda" } });
    return Response.json({ bio: null });
  } catch (err) {
    return Response.json({ error: err.message || "bio failed" }, { status: 500 });
  }
}
