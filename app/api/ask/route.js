// Ask Kynda endpoint (V3-67): one hunch in, one honest verdict out.
// Costs one small model call (~3-5¢) plus free deterministic checks, so
// the rate limit is tighter than the read-only endpoints.

import { askInfluence } from "../../../src/lib/pipeline/ask.js";
import { rateLimit, clientIp } from "../../../src/lib/guard.js";

export const maxDuration = 60;

export async function POST(req) {
  try {
    if (!rateLimit(`ask:${clientIp(req)}`, { limit: 30, windowMs: 3_600_000 })) {
      return Response.json({ error: "Too many questions this hour — the curiosity is appreciated, come back soon" }, { status: 429 });
    }
    const { subject, candidate } = await req.json();
    if (!subject?.name || !candidate?.trim()) {
      return Response.json({ error: "subject and candidate required" }, { status: 400 });
    }
    const result = await askInfluence(subject, candidate.trim().slice(0, 200));
    return Response.json(result);
  } catch (err) {
    console.error("ask error:", err);
    return Response.json({ error: err.message || "ask failed" }, { status: 500 });
  }
}
