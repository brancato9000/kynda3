"use client";

import { FONTS, BASE } from "./tokens.js";

// The archive beneath (Tony, 2026-08-11): the mix curates ~a third of
// what the graph holds; the node view drowns in dots. This is the honest
// middle — a LEDGER of documented connections the cards didn't show,
// ranked by evidence, as quiet text rows. Depth expressed, no hairball.
const TIER_COLOR = { cited: "rgba(52,211,153,0.85)", documented: "rgba(250,204,21,0.75)", claimed: "rgba(148,163,184,0.45)" };
const ROLE_LABEL = { predecessors: "influence on them", peers: "alongside them", successors: "their influence on others" };

function ArchiveLedger({ slots, graph }) {
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
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: "10px", padding: "6px 2px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexWrap: "wrap" }}>
            <span title={n.tier === "cited" ? "quote-confirmed receipt" : n.tier === "documented" ? "documented in a database or cross-reference" : "claimed — no independent receipt yet"}
              style={{ width: "7px", height: "7px", borderRadius: "50%", background: TIER_COLOR[n.tier] || TIER_COLOR.claimed, flexShrink: 0, position: "relative", top: "-1px" }} />
            <span style={{ fontFamily: FONTS.display, fontSize: "14.5px", color: "rgba(226,232,240,0.88)" }}>{n.name}</span>
            {n.creator && <span style={{ fontFamily: FONTS.mono, fontSize: "10.5px", color: "rgba(148,163,184,0.6)" }}>{n.creator}</span>}
            <span style={{ fontFamily: FONTS.mono, fontSize: "10px", color: "rgba(148,163,184,0.45)", textTransform: "uppercase", letterSpacing: "0.05em", marginLeft: "auto" }}>
              {ROLE_LABEL[n.role]}{n.evidence?.length ? ` · ${n.evidence.length} receipt${n.evidence.length > 1 ? "s" : ""}` : ""}
            </span>
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
