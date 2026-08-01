"use client";

// The printable influence map (V3-37). Light document styling — this page is
// destined for paper/PDF, not the app's dark theme. The graph keeps its dark
// figure box so the evidence-weighted node colors stay legible.

import { useEffect, useState } from "react";
import GraphView from "../../../graph-view.jsx";
import { MIX_SLOT_TYPES } from "../../../../src/design/tokens.js";
import Wordmark from "../../../../src/design/wordmark.jsx";

const SLOT_BY_ID = Object.fromEntries(MIX_SLOT_TYPES.map((s) => [s.id, s]));
const SERIF = "'Instrument Serif', serif";
const MONO = "'DM Mono', monospace";

function Badges({ verification }) {
  const out = [];
  if (verification?.attribution?.status === "verified") out.push("✓ facts verified");
  const conn = verification?.connection?.status;
  if (conn === "documented" || conn === "documented_via") out.push("◆ documented");
  if ((verification?.citations || []).length) out.push(`❝ ${verification.citations.length} primary-source citation${verification.citations.length === 1 ? "" : "s"}`);
  if (!out.length) out.push("Kynda's synthesis");
  return <span style={{ fontFamily: MONO, fontSize: "9.5px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{out.join("   ·   ")}</span>;
}

export default function PrintView({ subject, intro, bio, slots, graph, slug }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const url = `${origin}/s/${slug}`;

  return (
    <div style={{ background: "#ffffff", color: "#111318", minHeight: "100vh" }}>
      <style>{`
        @media print {
          .kynda-noprint { display: none !important; }
          .kynda-slot { break-inside: avoid; }
          .kynda-graphbox { break-inside: avoid; }
        }
        @page { margin: 18mm; }
      `}</style>

      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "40px 28px 60px" }}>
        <button className="kynda-noprint" onClick={() => window.print()}
          style={{ float: "right", background: "#111318", color: "#facc15", border: "none", borderRadius: "6px", padding: "8px 16px", fontFamily: MONO, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}>
          save as PDF ⤓
        </button>

        <div style={{ fontFamily: SERIF, fontSize: "26px" }}><Wordmark /></div>
        <div style={{ fontFamily: MONO, fontSize: "10px", color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "26px" }}>
          Influence map · every connection with its receipt
        </div>

        <h1 style={{ fontFamily: SERIF, fontSize: "44px", lineHeight: 1.05, margin: "0 0 4px" }}>{subject.name}</h1>
        <div style={{ fontFamily: MONO, fontSize: "11px", color: "#8a6d00", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "14px" }}>{subject.domain}</div>
        {bio?.text && (
          <p style={{ fontSize: "13.5px", lineHeight: 1.65, color: "#374151", margin: "0 0 6px" }}>
            {bio.text}
            <span style={{ fontFamily: MONO, fontSize: "10px", color: "#9ca3af" }}> — Wikipedia</span>
          </p>
        )}
        {intro && <p style={{ fontFamily: SERIF, fontSize: "16.5px", lineHeight: 1.5, color: "#111318", fontStyle: "italic", margin: "14px 0 0" }}>{intro}</p>}

        <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "28px 0" }} />

        {slots.map((slot, i) => {
          const meta = SLOT_BY_ID[slot.slotType] || { label: slot.slotType, emoji: "◆", description: "" };
          return (
            <div key={i} className="kynda-slot" style={{ marginBottom: "26px" }}>
              <div style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#111318", marginBottom: "2px" }}>
                {meta.emoji} {meta.label}
              </div>
              {meta.description && (
                <div style={{ fontFamily: MONO, fontSize: "10px", color: "#9ca3af", marginBottom: "10px" }}>{meta.description}</div>
              )}
              {slot.candidates.map((c, j) => (
                <div key={j} style={{ padding: "12px 0 12px 16px", borderLeft: "2px solid #e5e7eb", marginBottom: "8px" }}>
                  <div style={{ fontFamily: SERIF, fontSize: "20px", lineHeight: 1.2 }}>
                    {c.item.title}
                    {c.item.contributed && <span style={{ fontFamily: MONO, fontSize: "9px", color: "#8a6d00", textTransform: "uppercase", marginLeft: "8px" }}>community</span>}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: "11px", color: "#6b7280", marginBottom: "6px" }}>
                    {[c.item.creator, c.item.year, c.item.medium !== "music" ? c.item.medium : null].filter(Boolean).join(" · ")}
                  </div>
                  <p style={{ fontSize: "12.5px", lineHeight: 1.6, color: "#374151", margin: "0 0 7px" }}>{c.item.reason}</p>
                  {(c.verification?.citations || []).slice(0, 2).map((cit, k) => (
                    <p key={k} style={{ fontSize: "11.5px", lineHeight: 1.55, color: "#4b5563", fontStyle: "italic", margin: "0 0 5px", paddingLeft: "10px", borderLeft: "2px solid #facc15" }}>
                      “{cit.quote}”
                      <span style={{ fontFamily: MONO, fontSize: "9.5px", fontStyle: "normal", color: "#9ca3af" }}>
                        {" "}— {cit.speaker ? `${cit.speaker}, ` : ""}{cit.publication}{cit.date ? ` (${cit.date})` : ""}
                      </span>
                    </p>
                  ))}
                  <Badges verification={c.verification} />
                </div>
              ))}
            </div>
          );
        })}

        {graph && (
          <div className="kynda-graphbox">
            <div style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", margin: "8px 0 12px" }}>
              The influence graph
            </div>
            <div style={{ background: "#0f1016", borderRadius: "12px", padding: "8px", color: "#e2e8f0" }}>
              <GraphView data={graph} subjectName={subject.name} onNavigate={() => {}} />
            </div>
          </div>
        )}

        <div style={{ marginTop: "30px", fontFamily: MONO, fontSize: "10px", color: "#9ca3af", lineHeight: 1.7 }}>
          Live version, sources, and the growing graph: {url || `/s/${slug}`}<br />
          Every badge is machine-earned: attributions are checked against open catalogs (MusicBrainz, Open Library, Wikidata),
          connections against encyclopedic cross-mentions, and citations are verbatim quotes verified character-for-character
          against their source pages.
        </div>
      </div>
    </div>
  );
}
