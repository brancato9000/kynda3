// Founder dashboard API (V3-27). Shared-secret auth: requests must carry
// x-kynda-admin matching KYNDA_ADMIN_TOKEN. No token configured → disabled.

import { getAdminOverview, actOnContribution } from "../../../src/lib/store.js";
import { appendContributedCard } from "../../../src/lib/pipeline/contribute-card.js";
import { q } from "../../../src/lib/db.js";
import { rateLimit, clientIp } from "../../../src/lib/guard.js";

export const maxDuration = 60;

function authorized(req) {
  const token = process.env.KYNDA_ADMIN_TOKEN;
  if (!token) return false;
  const provided = req.headers.get("x-kynda-admin") || "";
  return provided.length > 0 && provided === token;
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
    const { id, action } = await req.json();
    if (!id || !["approve", "reject"].includes(action)) {
      return Response.json({ error: "id and action (approve|reject) required" }, { status: 400 });
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
