// Contributions endpoint (V3-26): Lane 1 evidence patching + hallucination
// flags. Zero model calls — evidence passes the same deterministic gate as
// agent findings (fetch → strip → quote-match → archive lookup).

import { verifyEvidence } from "../../../src/lib/verify/evidence.js";
import { findClaimForPair, recordContribution, attachFanEvidence } from "../../../src/lib/store.js";
import { rateLimit, clientIp } from "../../../src/lib/guard.js";

export const maxDuration = 60;

export async function POST(req) {
  try {
    const body = await req.json();
    const { kind, subject, item, url, quote, comment, contributor } = body || {};
    if (!kind || !subject?.name) return Response.json({ error: "kind and subject required" }, { status: 400 });

    const ip = clientIp(req);
    if (!rateLimit(`contribute:${kind}:${ip}`, { limit: kind === "evidence" ? 5 : 20, windowMs: 3_600_000 })) {
      return Response.json({ error: "Too many submissions — try again in an hour." }, { status: 429 });
    }

    const base = {
      subjectName: subject.name,
      itemTitle: item?.title || null,
      itemCreator: item?.creator || null,
      slotType: item?.slotType || null,
      comment: (comment || "").slice(0, 1000) || null,
      contributor: (contributor || "").slice(0, 80) || null,
    };

    if (kind === "flag") {
      const claimId = item?.title ? await findClaimForPair(subject, item.title).catch(() => null) : null;
      await recordContribution({ kind: "flag", claimId, ...base });
      return Response.json({ ok: true, message: "Flagged for review — thank you. Reports directly shape what gets fixed and re-researched." });
    }

    if (kind === "evidence") {
      if (!url || !quote || quote.trim().length < 20) {
        return Response.json({ error: "A source URL and an exact quote (20+ characters) are required." }, { status: 400 });
      }
      const verification = await verifyEvidence({ url, quote });
      const confirmed = verification.status === "quote_confirmed";
      let claimId = null;
      if (confirmed && item?.title) {
        claimId = await findClaimForPair(subject, item.title).catch(() => null);
        if (claimId) {
          await attachFanEvidence(claimId, { url, quote, archivedUrl: verification.archivedUrl, contributor: base.contributor });
        }
      }
      await recordContribution({
        kind: "evidence", claimId, url, quote,
        status: confirmed ? (claimId ? "confirmed" : "pending") : "rejected",
        verification, ...base,
      });
      if (!confirmed) {
        return Response.json({
          ok: true, confirmed: false,
          message: verification.status === "dead_link"
            ? "That URL couldn't be fetched — the quote can't be verified."
            : "The exact quote wasn't found on that page. Copy it verbatim from the source — paraphrases can't pass the check.",
        });
      }
      return Response.json({
        ok: true, confirmed: true,
        message: claimId
          ? "Quote confirmed against the page — your source is live on this card (pending curator review)."
          : "Quote confirmed — held for curator review (no existing connection matched exactly).",
      });
    }

    return Response.json({ error: "unknown kind" }, { status: 400 });
  } catch (err) {
    console.error("contribute error:", err);
    return Response.json({ error: err.message || "contribution failed" }, { status: 500 });
  }
}
