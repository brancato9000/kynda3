// Covers endpoint (V3-42): pure claims-store read, zero model calls — the
// COVERS tab's playlist. Same shape as the graph endpoint.

import { getCoversSlots } from "../../../src/lib/store.js";
import { rateLimit, clientIp } from "../../../src/lib/guard.js";

export const maxDuration = 30;

export async function POST(req) {
  try {
    if (!rateLimit(`covers:${clientIp(req)}`, { limit: 120, windowMs: 3_600_000 })) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }
    const { subject } = await req.json();
    if (!subject?.name) return Response.json({ error: "subject required" }, { status: 400 });
    const slots = await getCoversSlots(subject);
    return Response.json({ slots });
  } catch (err) {
    console.error("covers error:", err);
    return Response.json({ error: err.message || "covers failed" }, { status: 500 });
  }
}
