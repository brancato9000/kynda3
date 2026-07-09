// Influence graph endpoint (V3-25): a pure claims-store read — zero model
// calls, so no guards beyond a light rate limit. Graphs exist for any
// subject whose mix has been persisted.

import { getGraphForSubject } from "../../../src/lib/store.js";
import { rateLimit, clientIp } from "../../../src/lib/guard.js";

export const maxDuration = 30;

export async function POST(req) {
  try {
    if (!rateLimit(`graph:${clientIp(req)}`, { limit: 120, windowMs: 3_600_000 })) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }
    const { subject } = await req.json();
    if (!subject?.name) return Response.json({ error: "subject required" }, { status: 400 });
    const graph = await getGraphForSubject(subject);
    if (!graph) return Response.json({ error: "no graph yet — the map grows as this subject is explored" }, { status: 404 });
    return Response.json(graph);
  } catch (err) {
    console.error("graph error:", err);
    return Response.json({ error: err.message || "graph failed" }, { status: 500 });
  }
}
