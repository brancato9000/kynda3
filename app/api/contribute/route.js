// Contributions endpoint (V3-26): Lane 1 evidence patching + hallucination
// flags. Zero model calls — evidence passes the same deterministic gate as
// agent findings (fetch → strip → quote-match → archive lookup).

import { verifyEvidence } from "../../../src/lib/verify/evidence.js";
import { findClaimForPair, recordContribution, attachFanEvidence } from "../../../src/lib/store.js";
import { rateLimit, clientIp, contributionHarvestCapReached } from "../../../src/lib/guard.js";
import { preGate, findConfirmedPair } from "../../../src/lib/pipeline/contribute-card.js";
import { harvestSource } from "../../../src/lib/pipeline/harvest.js";

export const maxDuration = 300;

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

    if (kind === "new_card") {
      // Lane 2 (V3-35): fan names an influence + a URL; Kynda builds the card.
      const influence = (body.influence || "").trim().slice(0, 120);
      if (!influence || !url) {
        return Response.json({ error: "An influence name and a source URL are required." }, { status: 400 });
      }
      // Model-backed, so guarded harder: 2/hour per IP + a global daily cap.
      if (!rateLimit(`contribute:new_card:${ip}`, { limit: 2, windowMs: 3_600_000 })) {
        return Response.json({ error: "Too many card submissions — try again in an hour." }, { status: 429 });
      }
      if (await contributionHarvestCapReached()) {
        return Response.json({ error: "Card submissions are at capacity for today — please come back tomorrow." }, { status: 429 });
      }

      // Free deterministic pre-gate: the page must mention both ends.
      const gate = await preGate(url, subject.name, influence);
      if (!gate.ok) {
        const why = {
          unreachable: "That URL couldn't be fetched (nor found on the Wayback Machine).",
          missing_subject: `That page never mentions ${subject.name} — the connection can't be documented there.`,
          missing_influence: `That page never mentions ${influence} — the connection can't be documented there.`,
        }[gate.reason];
        return Response.json({ ok: true, confirmed: false, message: why });
      }

      // Full harvest — the fan's page enriches the whole graph, and the named
      // pair is held to the same machine gate as everything else.
      const harvest = await harvestSource(gate.resolvedUrl, { log: () => {} });
      if (harvest.error) {
        return Response.json({ ok: true, confirmed: false, message: `The page couldn't be processed (${harvest.error}).` });
      }
      const pair = await findConfirmedPair(subject.name, influence, gate.resolvedUrl);
      await recordContribution({
        kind: "new_card", claimId: pair?.claim_id || null, url: gate.resolvedUrl,
        quote: pair?.quote || null, status: pair ? "confirmed" : "rejected",
        verification: { harvested: harvest.confirmed, rejected: harvest.rejected, pairFound: !!pair },
        ...base, itemTitle: influence,
      });
      return Response.json({
        ok: true, confirmed: !!pair,
        message: pair
          ? `Confirmed — the page documents ${subject.name} ↔ ${influence} in a machine-verified quote${pair.speaker ? ` from ${pair.speaker}` : ""}. The card is with our curators and will appear once approved. (Your page also yielded ${harvest.confirmed} verified citations across the graph — thank you.)`
          : `The page mentions both, but no verbatim statement connecting ${subject.name} and ${influence} passed the quote check${harvest.confirmed ? ` (${harvest.confirmed} other citations from your page did verify — thank you)` : ""}. A direct interview or feature usually works best.`,
      });
    }

    return Response.json({ error: "unknown kind" }, { status: 400 });
  } catch (err) {
    console.error("contribute error:", err);
    return Response.json({ error: err.message || "contribution failed" }, { status: 500 });
  }
}
