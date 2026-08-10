// Contributions endpoint (V3-26): Lane 1 evidence patching + hallucination
// flags. Zero model calls — evidence passes the same deterministic gate as
// agent findings (fetch → strip → quote-match → archive lookup).

import { verifyEvidence } from "../../../src/lib/verify/evidence.js";
import { q } from "../../../src/lib/db.js";
import { findClaimForPair, recordContribution, attachFanEvidence, getStoredMix } from "../../../src/lib/store.js";
import { rateLimit, clientIp, contributionHarvestCapReached } from "../../../src/lib/guard.js";
import { preGate, findConfirmedPair, findConfirmedSubjectClaims } from "../../../src/lib/pipeline/contribute-card.js";
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

    // Hunches (V3-69): an Ask Kynda verdict graduating into a submission —
    // a proposed influence WITHOUT a source yet. The verdict text rides
    // along in comment as the curator's research trail. Free, no model.
    if (kind === "hunch") {
      if (!item?.title) return Response.json({ error: "the proposed influence is required" }, { status: 400 });
      await recordContribution({ kind: "hunch", ...base });
      return Response.json({ ok: true, message: "Proposed — the curator will see your hunch and the trail Kynda suggested." });
    }

    // Media-correction lane (2026-08-10): flagging media ≠ flagging prose.
    // Structured specificity + optional link to the CORRECT media (url).
    if (kind === "media_flag") {
      const SPECIFICITY = {
        wrong_artist: "wrong artist, right work",
        wrong_work: "wrong work, right artist",
        both_wrong: "both wrong",
        missing: "suggested media for a card that has none",
        timestamp: "timestamp report",
      };
      const { mediaKind, specificity } = body;
      if (!item?.title || !SPECIFICITY[specificity] || !["preview", "image", "embed"].includes(mediaKind || "")) {
        return Response.json({ error: "media kind and specificity required" }, { status: 400 });
      }
      const suggested = /^https?:\/\//.test(url || "") ? url.slice(0, 500) : null;
      if (specificity === "missing" && !suggested) {
        return Response.json({ error: "suggesting media needs a link to the media" }, { status: 400 });
      }
      if (specificity === "timestamp" && (!suggested || !/\d{1,2}:\d{2}/.test(comment || ""))) {
        return Response.json({ error: "a timestamp report needs the source link and a mm:ss time" }, { status: 400 });
      }
      await recordContribution({
        kind: "media_flag",
        ...base,
        url: suggested,
        comment: `[${mediaKind} · ${SPECIFICITY[specificity]}]${base.comment ? ` ${base.comment}` : ""}`,
      });
      return Response.json({ ok: true, message: "Media flagged — the curator will re-verify the asset." + (suggested ? " Your suggested link rides along." : "") });
    }

    if (kind === "new_card") {
      // Lane 2 (V3-35): fan names an influence + a URL; Kynda builds the card.
      // Influence optional (V3-43): a bare URL is a MAP SUBMISSION — every
      // confirmed claim about the subject becomes its own card proposal.
      const influence = (body.influence || "").trim().slice(0, 120);
      if (!url) {
        return Response.json({ error: "A source URL is required." }, { status: 400 });
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

      if (!influence) {
        // Map submission (V3-43): propose a card for every confirmed claim
        // about the subject, skipping what's already mapped or already queued.
        const found = await findConfirmedSubjectClaims(subject.name, gate.resolvedUrl);
        const stored = await getStoredMix(subject).catch(() => null);
        const inMix = new Set(
          (stored?.slots || []).flatMap((s) => (s.candidates || []).map((c) => c.item?.title?.toLowerCase())).filter(Boolean)
        );
        const queued = await q(
          "SELECT lower(item_title) AS t FROM contributions WHERE kind = 'new_card' AND lower(subject_name) = lower($1) AND status IN ('pending', 'confirmed')",
          [subject.name]
        );
        const alreadyQueued = new Set(queued.rows.map((r) => r.t));
        let proposed = 0, existing = 0;
        for (const f of found) {
          const key = f.target_name.toLowerCase();
          if (inMix.has(key) || alreadyQueued.has(key)) { existing += 1; continue; }
          await recordContribution({
            kind: "new_card", claimId: f.claim_id, url: gate.resolvedUrl,
            quote: f.quote, status: "confirmed",
            verification: { mapSubmission: true, claimType: f.claim_type, speaker: f.speaker || null },
            ...base, itemTitle: f.target_name,
          });
          proposed += 1;
        }
        return Response.json({
          ok: true, confirmed: proposed > 0,
          message: found.length === 0
            ? `The page yielded ${harvest.confirmed} verified citations across the graph, but no confirmed connections naming ${subject.name} directly — thank you regardless.`
            : `${found.length} verified connection${found.length === 1 ? "" : "s"} about ${subject.name} found on that page: ${proposed} proposed as new cards (with our curators now)${existing ? `, ${existing} already on the map — their citations just got stronger` : ""}. Your page also yielded ${harvest.confirmed} verified citations across the graph.`,
        });
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
