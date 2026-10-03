// "Ask Kynda to map this" (Tony, 2026-10-02): an unmapped stop on the map
// shows a note and this button instead of generating a mix. A request only
// lands in the research queue — nothing is built until Tony approves a batch.
// Zero model calls.

import { enqueueSubjectByName } from "../../../src/lib/store.js";
import { rateLimit, clientIp } from "../../../src/lib/guard.js";

export async function POST(req) {
  try {
    if (!rateLimit(`request-map:${clientIp(req)}`, { limit: 20, windowMs: 3_600_000 })) {
      return Response.json({ error: "Too many requests — try again in an hour." }, { status: 429 });
    }
    const { name } = await req.json();
    if (!name) return Response.json({ error: "name required" }, { status: 400 });
    const id = await enqueueSubjectByName(name);
    if (!id) return Response.json({ error: "Kynda doesn't know that subject yet." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message || "request failed" }, { status: 500 });
  }
}
