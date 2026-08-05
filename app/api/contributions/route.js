// Approved contributions for a subject (V3-67): pure read, feeds the
// collapsed "proposed by readers" section on mix pages.

import { listApprovedContributions } from "../../../src/lib/store.js";
import { rateLimit, clientIp } from "../../../src/lib/guard.js";

export const maxDuration = 15;

export async function POST(req) {
  try {
    if (!rateLimit(`contriblist:${clientIp(req)}`, { limit: 120, windowMs: 3_600_000 })) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }
    const { subject } = await req.json();
    if (!subject?.name) return Response.json({ error: "subject required" }, { status: 400 });
    return Response.json({ contributions: await listApprovedContributions(subject.name) });
  } catch (err) {
    console.error("contributions error:", err);
    return Response.json({ error: err.message || "failed" }, { status: 500 });
  }
}
