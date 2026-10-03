// "Ask Kynda to map this" (Tony, 2026-10-02/03): a search or a map stop with
// no saved mix shows a note and this button instead of generating one. A
// request is one vote in the admin queue (/admin) — nothing is built until
// Tony approves a batch. Zero model calls.

import { createHash } from "node:crypto";
import { recordMapRequest } from "../../../src/lib/store.js";
import { rateLimit, clientIp } from "../../../src/lib/guard.js";

const QID = /^Q\d+$/;
const MBID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clip = (v, n) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

// Votes are counted per visitor without keeping the address itself.
function requesterOf(req) {
  const salt = process.env.KYNDA_REQUEST_SALT || process.env.KYNDA_ADMIN_TOKEN || "kynda";
  return createHash("sha256").update(`${salt}:${clientIp(req)}`).digest("hex").slice(0, 32);
}

export async function POST(req) {
  try {
    if (!rateLimit(`request-map:${clientIp(req)}`, { limit: 20, windowMs: 3_600_000 })) {
      return Response.json({ error: "Too many requests — try again in an hour." }, { status: 429 });
    }
    const body = await req.json().catch(() => ({}));
    const name = clip(body.name, 200);
    if (!name) return Response.json({ error: "name required" }, { status: 400 });
    const subject = {
      name,
      wikidata_qid: QID.test(body.wikidata_qid || "") ? body.wikidata_qid : null,
      mbid: MBID.test(body.mbid || "") ? body.mbid : null,
      description: clip(body.description, 300),
      domain: clip(body.domain, 40),
    };
    await recordMapRequest(subject, requesterOf(req));
    return Response.json({ ok: true });
  } catch (err) {
    console.error("request-map error:", err);
    return Response.json({ error: "request failed" }, { status: 500 });
  }
}
