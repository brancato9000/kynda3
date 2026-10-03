// Influence graph endpoint (V3-25): a pure claims-store read — zero model
// calls, so no guards beyond a light rate limit. Graphs exist for any
// subject whose mix has been persisted. The influence map (2026-10-01)
// also gets the subject's stored mix cards — still a pure read — so the
// KyndaMix picks can headline the map for every subject travelled to.
// The limit is generous because travelling the map is a graph read per hop.

import { getGraphForSubject, getStoredMix, mixCardsForMap } from "../../../src/lib/store.js";
import { rateLimit, clientIp } from "../../../src/lib/guard.js";

export const maxDuration = 30;

export async function POST(req) {
  try {
    if (!rateLimit(`graph:${clientIp(req)}`, { limit: 600, windowMs: 3_600_000 })) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }
    const { subject } = await req.json();
    if (!subject?.name) return Response.json({ error: "subject required" }, { status: 400 });
    const graph = await getGraphForSubject(subject);
    if (!graph) return Response.json({ error: "no graph yet — the map grows as this subject is explored" }, { status: 404 });
    const stored = await getStoredMix(subject).catch(() => null);
    // Whether this center has a saved mix: the page shows it, or (unmapped) a note — never a fresh generation.
    graph.hasMix = !!stored;
    graph.mix = mixCardsForMap(stored);
    return Response.json(graph);
  } catch (err) {
    console.error("graph error:", err);
    return Response.json({ error: err.message || "graph failed" }, { status: 500 });
  }
}
