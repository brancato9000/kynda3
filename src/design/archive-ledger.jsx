"use client";

import { useState } from "react";
import { FONTS, BASE } from "./tokens.js";

// The archive beneath (Tony, 2026-08-11): the mix curates ~a third of
// what the graph holds; the node view drowns in dots. This is the honest
// middle — a LEDGER of documented connections the cards didn't show,
// ranked by evidence, as quiet text rows. Depth expressed, no hairball.
// Evidence dedupe (Tony QA, 2026-08-11, the double Brubeck): harvest runs
// re-read the same source with drifted quote boundaries and publication
// names — same-page fragments where one contains the other's core keep
// only the longest.
function dedupeEvidence(evidence) {
  const nrm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const rows = (evidence || []).filter((e) => e.quote);
  return rows.filter((e, i) => !rows.some((o, j) => {
    if (i === j) return false;
    const a = nrm(e.quote), b = nrm(o.quote);
    const shorter = a.length <= b.length ? a : b;
    const overlap = b.includes(a) || a.includes(b)
      || (shorter.length > 24 && (a.includes(shorter.slice(-24)) && b.includes(shorter.slice(-24))));
    return overlap && (b.length > a.length || (b.length === a.length && j < i));
  }));
}

const TIER_COLOR = { cited: "rgba(52,211,153,0.85)", documented: "rgba(250,204,21,0.75)", claimed: "rgba(148,163,184,0.45)" };
const ROLE_LABEL = { predecessors: "influence on them", peers: "alongside them", successors: "their influence on others" };

function ArchiveLedger({ slots, graph }) {
  const [open, setOpen] = useState(null);
  if (!graph) return null;
  const nrm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const onCards = new Set();
  for (const slot of slots || []) {
    for (const c of slot.candidates || []) {
      if (c?.item?.title) onCards.add(nrm(c.item.title));
      if (c?.item?.creator) onCards.add(nrm(c.item.creator));
    }
  }
  const hidden = [];
  for (const role of ["predecessors", "peers", "successors"]) {
    for (const n of graph[role] || []) {
      if (onCards.has(nrm(n.name)) || (n.creator && onCards.has(nrm(n.creator)))) continue;
      hidden.push({ ...n, role });
    }
  }
  const total = ["predecessors", "peers", "successors"].reduce((a, r) => a + (graph[r] || []).length, 0);
  const cardCount = (slots || []).reduce((a, s) => a + (s.candidates?.length || 0), 0);
  if (!hidden.length) return null;
  hidden.sort((a, b) => (b.weight || 0) - (a.weight || 0));
  const shown = hidden.slice(0, 36);

  return (
    <section style={{ marginTop: "44px" }}>
      <div style={{ fontFamily: FONTS.mono, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: BASE.gold, marginBottom: "8px" }}>
        The archive beneath this mix
      </div>
      <div style={{ fontSize: "13.5px", lineHeight: 1.7, color: "rgba(226,232,240,0.75)", marginBottom: "14px" }}>
        The mix above curates {cardCount} cards. The archive holds {total} documented connections for this
        subject — here is what the cards didn&apos;t show, ranked by evidence.
      </div>
      <div style={{ display: "grid", gap: "4px" }}>
        {shown.map((n, i) => (
          <div key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            {/* Peek (Tony, 2026-08-11): a row opens into its receipts —
                summary + verified quotes, straight from the graph payload
                already on the page. Context without cards. */}
            <div role="button" tabIndex={0}
              onClick={() => setOpen(open === i ? null : i)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(open === i ? null : i); } }}
              style={{ display: "flex", alignItems: "baseline", gap: "10px", padding: "6px 2px", flexWrap: "wrap", cursor: "pointer" }}>
              <span title={n.tier === "cited" ? "quote-confirmed receipt" : n.tier === "documented" ? "documented in a database or cross-reference" : "claimed — no independent receipt yet"}
                style={{ width: "7px", height: "7px", borderRadius: "50%", background: TIER_COLOR[n.tier] || TIER_COLOR.claimed, flexShrink: 0, position: "relative", top: "-1px" }} />
              <span style={{ fontFamily: FONTS.display, fontSize: "14.5px", color: "rgba(226,232,240,0.88)" }}>{n.name}</span>
              {n.creator && <span style={{ fontFamily: FONTS.mono, fontSize: "10.5px", color: "rgba(148,163,184,0.6)" }}>{n.creator}</span>}
              <span style={{ fontFamily: FONTS.mono, fontSize: "10px", color: "rgba(148,163,184,0.45)", textTransform: "uppercase", letterSpacing: "0.05em", marginLeft: "auto" }}>
                {ROLE_LABEL[n.role]}{n.evidence?.length ? ` · ${n.evidence.length} receipt${n.evidence.length > 1 ? "s" : ""}` : ""}
                <span style={{ marginLeft: "8px", color: "rgba(148,163,184,0.35)" }}>{open === i ? "▾" : "▸"}</span>
              </span>
            </div>
            {open === i && (
              <div style={{ padding: "2px 2px 12px 19px" }}>
                {n.summary && (
                  <div style={{ fontSize: "12.5px", lineHeight: 1.65, color: "rgba(148,163,184,0.8)", marginBottom: n.evidence?.length ? "8px" : 0 }}>
                    {n.summary}
                  </div>
                )}
                {dedupeEvidence(n.evidence).slice(0, 2).map((e, j) => (
                  <div key={j} style={{ marginBottom: "8px", paddingLeft: "12px", borderLeft: "2px solid rgba(52,211,153,0.3)" }}>
                    <div style={{ fontFamily: FONTS.display, fontStyle: "italic", fontSize: "12.5px", lineHeight: 1.6, color: "rgba(226,232,240,0.78)" }}>
                      {e.contextBefore && <span style={{ color: "rgba(148,163,184,0.5)" }}>…{e.contextBefore} </span>}
                      &ldquo;{e.quote.length > 260 ? `${e.quote.slice(0, 260)}…` : e.quote}&rdquo;
                      {e.contextAfter && <span style={{ color: "rgba(148,163,184,0.5)" }}> {e.contextAfter}…</span>}
                    </div>
                    <a href={e.url} target="_blank" rel="noreferrer"
                      style={{ fontFamily: FONTS.mono, fontSize: "9.5px", letterSpacing: "0.05em", color: "rgba(52,211,153,0.7)", textDecoration: "none" }}>
                      — {e.speaker ? `${e.speaker}, via ` : ""}{e.publication || new URL(e.url).hostname.replace(/^www\./, "")} ↗
                    </a>
                  </div>
                ))}
                {!(n.evidence || []).some((e) => e.quote) && !n.summary && (
                  <div style={{ fontFamily: FONTS.mono, fontSize: "10.5px", color: "rgba(148,163,184,0.5)" }}>
                    claimed in the graph — no receipt captured yet
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {hidden.length > shown.length && (
        <div style={{ marginTop: "10px", fontFamily: FONTS.mono, fontSize: "10.5px", color: "rgba(148,163,184,0.5)" }}>
          + {hidden.length - shown.length} more in the archive
        </div>
      )}
    </section>
  );
}

export default ArchiveLedger;
