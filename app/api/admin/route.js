// Founder dashboard API (V3-27). Shared-secret auth: requests must carry
// x-kynda-admin matching KYNDA_ADMIN_TOKEN. No token configured → disabled.

import { getAdminOverview, actOnContribution } from "../../../src/lib/store.js";
import { proposeFlagFix, applyFlagFix } from "../../../src/lib/pipeline/fix.js";
import { appendContributedCard } from "../../../src/lib/pipeline/contribute-card.js";
import { q } from "../../../src/lib/db.js";
import { rateLimit, clientIp } from "../../../src/lib/guard.js";

export const maxDuration = 60;

function authorized(req) {
  const token = process.env.KYNDA_ADMIN_TOKEN;
  if (!token) return false;
  // Trim both sides: pasted tokens arrive with invisible trailing
  // whitespace often enough that exact comparison reads as "broken login".
  const provided = (req.headers.get("x-kynda-admin") || "").trim();
  return provided.length > 0 && provided === token.trim();
}

export async function GET(req) {
  if (!rateLimit(`admin:${clientIp(req)}`, { limit: 120, windowMs: 3_600_000 })) {
    return Response.json({ error: "rate limited" }, { status: 429 });
  }
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const overview = await getAdminOverview();
    if (!overview) return Response.json({ error: "no database configured" }, { status: 503 });
    return Response.json(overview);
  } catch (err) {
    console.error("admin overview error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { id, action, fixed_reason } = await req.json();
    if (!id || !["approve", "reject", "fix", "apply_fix"].includes(action)) {
      return Response.json({ error: "id and action (approve|reject|fix|apply_fix) required" }, { status: 400 });
    }
    // Flag repair (V3-68): "fix" proposes (model, ~3¢, nothing written);
    // "apply_fix" writes the curator-approved repair and resolves the flag.
    if (action === "fix" || action === "apply_fix") {
      const row = await q("SELECT * FROM contributions WHERE id = $1", [id]);
      const contribution = row.rows[0];
      if (!contribution) return Response.json({ error: "contribution not found" }, { status: 404 });
      if (contribution.kind !== "flag") return Response.json({ error: "only flags can be fixed" }, { status: 400 });
      if (action === "fix") return Response.json(await proposeFlagFix(contribution));
      return Response.json(await applyFlagFix(contribution, fixed_reason));
    }
    // Approving a Lane 2 card publishes it: one grounded Fable call for the
    // reason prose, then an append into the subject's stored mix payload.
    if (action === "approve") {
      const row = await q("SELECT * FROM contributions WHERE id = $1", [id]);
      if (row.rows[0]?.kind === "new_card") {
        const published = await appendContributedCard(row.rows[0]);
        const result = await actOnContribution(id, "approve");
        return Response.json({ ...result, published });
      }
    }
    return Response.json(await actOnContribution(id, action));
  } catch (err) {
    console.error("admin action error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
