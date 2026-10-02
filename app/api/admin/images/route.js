// Map-image curation API (2026-10-02). Same shared-secret gate as /api/admin
// (x-kynda-admin = KYNDA_ADMIN_TOKEN). Serves the /admin/images queue and the
// in-page admin overlay on the influence map.
//   GET  ?entity_id=…         one entity: current picture, pending candidates, context
//   GET  ?view=queue|auto     entities awaiting review | recent automatic picks to spot-check
//   POST { action: find | approve | use_url | none | remove, entity_id, candidate_id?, url?, query? }

import { q } from "../../../../src/lib/db.js";
import { rateLimit, clientIp } from "../../../../src/lib/guard.js";
import {
  findEntityImage, applyEntityImage, clearEntityImage, saveCandidates, candidateFromCommonsUrl, entityContext,
} from "../../../../src/lib/pipeline/map-images.js";

export const maxDuration = 60;

function authorized(req) {
  const token = process.env.KYNDA_ADMIN_TOKEN;
  if (!token) return false;
  const provided = (req.headers.get("x-kynda-admin") || "").trim();
  return provided.length > 0 && provided === token.trim();
}

const current = (m) => (m?.image_url ? {
  url: m.image_url, page: m.image_page, license: m.image_license, credit: m.image_credit,
  source: m.image_source, identity: m.image_identity, status: m.image_status,
} : null);

async function entityView(id) {
  const e = (await q(`SELECT id, name, kind, domain, metadata FROM entities WHERE id = $1`, [id])).rows[0];
  if (!e) return null;
  const candidates = (await q(
    `SELECT id, source, url, page, license, credit, title, description, fair_use, score
     FROM image_candidates WHERE entity_id = $1 AND status = 'pending' ORDER BY score DESC, created_at LIMIT 12`, [id])).rows;
  const ctx = await entityContext(id);
  return {
    entity: { id: e.id, name: e.name, kind: e.kind, domain: e.domain, creator: e.metadata?.creator || null },
    current: current(e.metadata), settled: e.metadata?.image_status || null,
    candidates, context: ctx.summaries.slice(0, 3),
  };
}

export async function GET(req) {
  if (!rateLimit(`admin-images:${clientIp(req)}`, { limit: 1200, windowMs: 3_600_000 })) return Response.json({ error: "rate limited" }, { status: 429 });
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("entity_id");
    if (id) {
      const view = await entityView(id);
      return view ? Response.json(view) : Response.json({ error: "entity not found" }, { status: 404 });
    }
    const view = url.searchParams.get("view") || "queue";
    const limit = Math.min(60, parseInt(url.searchParams.get("limit") || "30", 10));
    if (view === "auto") {
      const rows = (await q(
        `SELECT id, name, kind, domain, metadata FROM entities
         WHERE metadata->>'image_status' = 'auto' ORDER BY metadata->>'image_checked_at' DESC NULLS LAST LIMIT $1`, [limit])).rows;
      return Response.json({ items: rows.map((e) => ({ entity: { id: e.id, name: e.name, kind: e.kind, domain: e.domain }, current: current(e.metadata) })) });
    }
    // Queue: entities with pending candidates and no settled picture, busiest first.
    const rows = (await q(
      `SELECT e.id,
              (SELECT count(*) FROM claims c WHERE c.subject_id = e.id OR c.object_id = e.id) AS degree,
              (SELECT count(*) FROM image_candidates ic2 WHERE ic2.entity_id = e.id AND ic2.status = 'pending') AS pending
       FROM entities e
       WHERE EXISTS (SELECT 1 FROM image_candidates ic WHERE ic.entity_id = e.id AND ic.status = 'pending')
         AND e.metadata->>'image_url' IS NULL
         AND COALESCE(e.metadata->>'image_status', '') NOT IN ('none', 'approved')
       ORDER BY degree DESC, e.name LIMIT $1`, [limit])).rows;
    const total = (await q(
      `SELECT count(DISTINCT ic.entity_id) AS n FROM image_candidates ic JOIN entities e ON e.id = ic.entity_id
       WHERE ic.status = 'pending' AND e.metadata->>'image_url' IS NULL AND COALESCE(e.metadata->>'image_status', '') NOT IN ('none', 'approved')`)).rows[0].n;
    const items = [];
    for (const r of rows) items.push({ ...(await entityView(r.id)), degree: Number(r.degree) });
    return Response.json({ items, total: Number(total) });
  } catch (err) {
    console.error("admin images error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { action, entity_id, candidate_id, url, query } = await req.json();
    if (!entity_id || !["find", "approve", "use_url", "none", "remove"].includes(action)) {
      return Response.json({ error: "entity_id and action (find|approve|use_url|none|remove) required" }, { status: 400 });
    }
    const e = (await q(`SELECT id, kind, domain, name, wikidata_qid, metadata FROM entities WHERE id = $1`, [entity_id])).rows[0];
    if (!e) return Response.json({ error: "entity not found" }, { status: 404 });

    if (action === "find") {
      // A live search never applies anything on its own — even a sure match is offered, not chosen.
      const r = await findEntityImage(e, { query: query?.trim() || null });
      await saveCandidates(e.id, [r.auto, ...r.candidates].filter(Boolean).map((c, i) => (i === 0 && r.auto ? { ...c, score: (c.score || 0) + 10 } : c)));
      return Response.json(await entityView(e.id));
    }
    if (action === "approve") {
      const c = (await q(`SELECT * FROM image_candidates WHERE id = $1 AND entity_id = $2`, [candidate_id, e.id])).rows[0];
      if (!c) return Response.json({ error: "candidate not found" }, { status: 404 });
      await applyEntityImage(e.id, { ...c, identity: "curator" }, "approved");
      await q(`UPDATE image_candidates SET status = CASE WHEN id = $2 THEN 'approved' ELSE 'rejected' END WHERE entity_id = $1 AND status = 'pending'`, [e.id, c.id]);
      return Response.json(await entityView(e.id));
    }
    if (action === "use_url") {
      const r = await candidateFromCommonsUrl(url || "");
      if (r.error) return Response.json({ error: r.error }, { status: 400 });
      await applyEntityImage(e.id, r.candidate, "approved");
      await q(`UPDATE image_candidates SET status = 'rejected' WHERE entity_id = $1 AND status = 'pending'`, [e.id]);
      return Response.json(await entityView(e.id));
    }
    // none: there is no good picture — keep the initials, stop suggesting.
    // remove: take the current picture off (e.g. a wrong automatic pick); candidates stay available.
    await clearEntityImage(e.id, { none: action === "none" });
    if (action === "none") await q(`UPDATE image_candidates SET status = 'rejected' WHERE entity_id = $1 AND status = 'pending'`, [e.id]);
    if (action === "remove" && e.metadata?.image_url) {
      await q(`INSERT INTO image_candidates (entity_id, source, url, page, license, credit, description, status)
               VALUES ($1, COALESCE($2, 'removed'), $3, $4, $5, $6, 'Removed by curator', 'rejected') ON CONFLICT (entity_id, url) DO UPDATE SET status = 'rejected'`,
        [e.id, e.metadata.image_source || null, e.metadata.image_url, e.metadata.image_page || null, e.metadata.image_license || null, e.metadata.image_credit || null]);
    }
    return Response.json(await entityView(e.id));
  } catch (err) {
    console.error("admin images action error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
