"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FONTS, BASE, MIX_SLOT_TYPES, SLOT_COLORS, CONFIDENCE_COLORS, REVEAL_TIMING } from "../src/design/tokens.js";
import { experienceLinks, STREAM_SERVICES } from "../src/lib/experience.js";
import GraphView from "./graph-view.jsx";
import { slugify } from "../src/lib/slug.js";

const SLOT_BY_ID = Object.fromEntries(MIX_SLOT_TYPES.map((s) => [s.id, s]));

// ─── Typewriter (kynda2 DD-02) ────────────────────────────────
// `start` gates the reveal without unmounting — the transparent words keep
// their layout space, so sequenced text never shifts the page (V3-54).
// `onDone` fires when the last word is shown, letting reveals chain.
function RevealText({ text, msPerWord = 45, delayMs = 400, style, start = true, onDone }) {
  const [count, setCount] = useState(0);
  const words = (text || "").split(" ");
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    setCount(0);
    if (!text || !start) return;
    let i = 0;
    let interval;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= words.length) { clearInterval(interval); onDoneRef.current?.(); }
      }, msPerWord);
    }, delayMs);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [text, start]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span style={style}>
      {words.map((w, i) => (
        <span key={i} style={{ opacity: i < count ? 1 : 0, transition: "opacity 0.3s" }}>{w} </span>
      ))}
    </span>
  );
}

// ─── Provenance chips — machine-earned, never model-asserted ──
// Two layers, deliberately distinct (V3-14):
//   FactChip     — was the attribution (title/creator/year) confirmed in a database?
//   ConnectionChip — is the CONNECTION itself documented (Wikipedia cross-mention)?
// The databases fact-check the model; they are not the source of the recommendations.

const chipBase = {
  fontFamily: FONTS.mono, fontSize: "10px", letterSpacing: "0.06em",
  padding: "3px 8px", borderRadius: "3px", textTransform: "uppercase",
  display: "inline-flex", alignItems: "center", gap: "5px", textDecoration: "none",
};

function FactChip({ attribution }) {
  if (!attribution) {
    return (
      <span style={{ ...chipBase, color: "rgba(148,163,184,0.55)", border: "1px solid rgba(148,163,184,0.2)" }}>
        <Pulse /> checking facts
      </span>
    );
  }
  if (attribution.status === "verified") {
    // Just a checkmark — it sits beside the exact facts it verified
    // (title · creator · year) and links to the catalog record (V3-28).
    return (
      <a href={attribution.url} target="_blank" rel="noreferrer"
        title={`Title, creator & year confirmed in ${attribution.source}${attribution.detail ? ` — ${attribution.detail}` : ""}`}
        style={{ ...chipBase, color: CONFIDENCE_COLORS.verified, border: "1px solid rgba(52,211,153,0.35)", padding: "3px 7px" }}>
        ✓
      </a>
    );
  }
  if (attribution.status === "not_found") {
    // Two flavors (V3-50, Tony's call). A catalog that FOUND the work under
    // a different creator has convicted — red, with the actual creator named.
    // A plain miss is usually catalog coverage, not a lie — soft yellow ⚠.
    const convicted = /credits/i.test(attribution.detail || "");
    if (convicted) {
      return (
        <span title={`${attribution.detail} — this attribution appears to be wrong`}
          style={{ ...chipBase, color: "rgba(248,113,113,0.85)", border: "1px solid rgba(248,113,113,0.35)" }}>
          ✕ misattributed
        </span>
      );
    }
    return (
      <span title={`Kynda can't verify this work against the ${attribution.source} database and would appreciate confirmation`}
        style={{ ...chipBase, color: "rgba(250,204,21,0.8)", border: "1px solid rgba(250,204,21,0.3)", cursor: "help" }}>
        ⚠
      </span>
    );
  }
  return (
    <span title={attribution.reason || "No database check available for this medium yet"}
      style={{ ...chipBase, color: CONFIDENCE_COLORS.inferred, border: "1px solid rgba(148,163,184,0.2)" }}>
      unchecked
    </span>
  );
}

function ConnectionChip({ connection }) {
  if (!connection) {
    return (
      <span style={{ ...chipBase, color: "rgba(148,163,184,0.55)", border: "1px solid rgba(148,163,184,0.2)" }}>
        <Pulse /> tracing
      </span>
    );
  }
  if (connection.status === "not_applicable") return null;
  if (connection.status === "documented") {
    return (
      <a href={connection.url} target="_blank" rel="noreferrer"
        title={`This connection appears in Wikipedia: ${connection.articleTitle} — excerpt below`}
        style={{ ...chipBase, color: BASE.gold, border: "1px solid rgba(250,204,21,0.3)" }}>
        ◆ documented
      </a>
    );
  }
  if (connection.status === "documented_via") {
    return (
      <a href={connection.hop2.url} target="_blank" rel="noreferrer"
        title={`Indirect connection through ${connection.via} — both links machine-checked; evidence below`}
        style={{ ...chipBase, color: BASE.gold, border: "1px dashed rgba(250,204,21,0.35)" }}>
        ◆ documented via {connection.via}
      </a>
    );
  }
  return (
    <span title="This connection rests on the model's knowledge — no independent citation found yet. Interview-grade citations arrive with the research corpus."
      style={{ ...chipBase, color: "rgba(148,163,184,0.6)", border: "1px solid rgba(148,163,184,0.2)" }}>
      Kynda’s synthesis
    </span>
  );
}

function Pulse() {
  return (
    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgba(148,163,184,0.6)", animation: "kyndaPulse 1.2s ease-in-out infinite" }} />
  );
}

function Spinner({ size = 15 }) {
  return (
    <span style={{
      width: `${size}px`, height: `${size}px`, borderRadius: "50%", display: "inline-block",
      border: "2px solid rgba(250,204,21,0.25)", borderTopColor: BASE.gold,
      animation: "kyndaSpin 0.8s linear infinite",
    }} />
  );
}

// ─── Mix card ─────────────────────────────────────────────────
// T2 quote-confirmed citations from the research corpus. Degree attaches to
// the SPEAKER, not the publication (V3-21): "Sidney Lumet, via CinemaTyler".
const DEGREE_LABELS = { first: "artist’s own words", second: "critical source", third: "fan source" };

function CitationBlock({ citations }) {
  const strongest = citations.some((c) => c.degree === "first") ? "first"
    : citations.some((c) => c.degree === "second") ? "second"
    : citations.some((c) => c.degree === "third") ? "third" : null;
  return (
    <div style={{ marginTop: "12px", paddingLeft: "14px", borderLeft: "2px solid rgba(52,211,153,0.4)" }}>
      <div style={{ marginBottom: "6px" }}>
        <span style={{ ...chipBase, color: CONFIDENCE_COLORS.verified, border: "1px solid rgba(52,211,153,0.35)" }}>
          ◆ cited · {strongest ? DEGREE_LABELS[strongest] : "primary source"}
        </span>
      </div>
      {citations.map((c, i) => (
        <div key={i} style={{ marginBottom: i < citations.length - 1 ? "10px" : 0 }}>
          <div style={{ fontFamily: FONTS.display, fontStyle: "italic", fontSize: "13.5px", lineHeight: 1.6, color: "rgba(226,232,240,0.8)" }}>
            “{c.quote}”
          </div>
          <a href={c.url} target="_blank" rel="noreferrer"
            title={c.degree ? `${DEGREE_LABELS[c.degree]} — degree classified by the research agent` : undefined}
            style={{ fontFamily: FONTS.mono, fontSize: "10px", letterSpacing: "0.05em", color: "rgba(52,211,153,0.75)", textDecoration: "none" }}>
            — {c.speaker ? `${c.speaker}, via ` : ""}{c.publication}{c.date ? `, ${c.date}` : ""} ↗
          </a>
          {c.fan && (
            <span title="Submitted by a fan and machine-verified against the source; awaiting curator review"
              style={{ fontFamily: FONTS.mono, fontSize: "9px", letterSpacing: "0.05em", color: "rgba(250,204,21,0.6)", marginLeft: "8px", textTransform: "uppercase" }}>
              · fan-contributed
            </span>
          )}
          {c.archivedUrl && (
            <a href={c.archivedUrl} target="_blank" rel="noreferrer"
              style={{ fontFamily: FONTS.mono, fontSize: "10px", color: "rgba(148,163,184,0.5)", textDecoration: "none", marginLeft: "10px" }}>
              archive ↗
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// Contribution row (V3-26): flag a problem on any card; add a source to
// synthesis-labeled connections. Both hit the same deterministic gate the
// research agents use — nobody has to trust the contributor.
function ContributeRow({ subject, item, hasCitations }) {
  const [mode, setMode] = useState(null); // null | "flag" | "evidence" | "sending"
  const [result, setResult] = useState(null);
  const [fields, setFields] = useState({ url: "", quote: "", comment: "", contributor: "" });

  async function submit(kind) {
    setMode("sending");
    try {
      const res = await fetch("/api/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          subject: { name: subject?.name, mbid: subject?.mbid, wikidata_qid: subject?.wikidata_qid },
          item: { title: item.title, creator: item.creator, slotType: item.slotType },
          url: fields.url, quote: fields.quote, comment: fields.comment, contributor: fields.contributor,
        }),
      });
      const data = await res.json();
      setResult(data.message || data.error || "submitted");
      setMode(null);
    } catch (err) {
      setResult(err.message);
      setMode(null);
    }
  }

  const linkStyle = { background: "none", border: "none", cursor: "pointer", fontFamily: FONTS.mono, fontSize: "10px", letterSpacing: "0.05em", color: "rgba(148,163,184,0.45)", padding: 0, textTransform: "uppercase" };
  const inputStyle = { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "8px 10px", fontSize: "12px", color: "#e2e8f0", fontFamily: FONTS.body, outline: "none", marginBottom: "6px", boxSizing: "border-box" };

  if (result) return <div style={{ marginTop: "12px", fontFamily: FONTS.mono, fontSize: "10.5px", color: "rgba(148,163,184,0.7)", lineHeight: 1.5 }}>{result}</div>;

  return (
    <div style={{ marginTop: "14px" }}>
      {!mode && (
        <div style={{ display: "flex", gap: "16px" }}>
          <button style={linkStyle} onClick={() => setMode("flag")}>⚑ report an issue</button>
          {!hasCitations && <button style={linkStyle} onClick={() => setMode("evidence")}>+ know a source? add it</button>}
        </div>
      )}
      {mode === "flag" && (
        <div>
          <textarea placeholder="What's wrong with this card? (e.g. 'Gordon Williams did not work on Nirvana Unplugged')" rows={2}
            value={fields.comment} onChange={(e) => setFields({ ...fields, comment: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />
          <input placeholder="Your name (optional)" value={fields.contributor} onChange={(e) => setFields({ ...fields, contributor: e.target.value })} style={inputStyle} />
          <div style={{ display: "flex", gap: "12px" }}>
            <button style={{ ...linkStyle, color: "rgba(248,113,113,0.8)" }} onClick={() => submit("flag")}>submit flag</button>
            <button style={linkStyle} onClick={() => setMode(null)}>cancel</button>
          </div>
        </div>
      )}
      {mode === "evidence" && (
        <div>
          <input placeholder="Source URL (interview, review, liner notes…)" value={fields.url} onChange={(e) => setFields({ ...fields, url: e.target.value })} style={inputStyle} />
          <textarea placeholder="Exact quote from that page documenting the connection — copied verbatim; it will be machine-checked against the page" rows={3}
            value={fields.quote} onChange={(e) => setFields({ ...fields, quote: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />
          <input placeholder="Your name (optional)" value={fields.contributor} onChange={(e) => setFields({ ...fields, contributor: e.target.value })} style={inputStyle} />
          <div style={{ display: "flex", gap: "12px" }}>
            <button style={{ ...linkStyle, color: "rgba(52,211,153,0.8)" }} onClick={() => submit("evidence")}>verify & submit</button>
            <button style={linkStyle} onClick={() => setMode(null)}>cancel</button>
          </div>
        </div>
      )}
      {mode === "sending" && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: FONTS.mono, fontSize: "10.5px", color: "rgba(148,163,184,0.6)" }}>
          <Pulse /> checking against the source…
        </div>
      )}
    </div>
  );
}

// "Where to experience it" (V3-38): library-first links, then the user's own
// streaming service (preference in localStorage; deep links land in their
// logged-in player — no accounts on our side, ever).
function ExperienceRow({ item, subjectName }) {
  const [service, setService] = useState("youtube");
  useEffect(() => {
    setService(localStorage.getItem("kynda_stream_service") || "youtube");
    const sync = (e) => setService(e.detail);
    window.addEventListener("kynda-service-change", sync);
    return () => window.removeEventListener("kynda-service-change", sync);
  }, []);
  const { library, stream, pickService } = experienceLinks(item, { service, subjectName });
  if (!library.length && !stream) return null;

  function pick(id) {
    localStorage.setItem("kynda_stream_service", id);
    window.dispatchEvent(new CustomEvent("kynda-service-change", { detail: id }));
  }

  const linkStyle = { fontFamily: FONTS.mono, fontSize: "10px", letterSpacing: "0.05em", color: "rgba(52,211,153,0.75)", textDecoration: "none", textTransform: "uppercase" };
  return (
    <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
      <span style={{ fontFamily: FONTS.mono, fontSize: "9.5px", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(148,163,184,0.45)" }}>
        experience it
      </span>
      {library.map((l, i) => (
        <a key={i} href={l.url} target="_blank" rel="noreferrer" style={linkStyle}>{l.label} ↗</a>
      ))}
      {stream && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <a href={stream.url} target="_blank" rel="noreferrer" style={{ ...linkStyle, color: "rgba(148,163,184,0.65)" }}>
            stream: {stream.label} ↗
          </a>
          {pickService && (
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <span style={{ fontFamily: FONTS.mono, fontSize: "9.5px", letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(148,163,184,0.4)", borderBottom: "1px dotted rgba(148,163,184,0.35)" }}>
                more options ⌄
              </span>
              <select aria-label="Choose your streaming service" value={service} onChange={(e) => pick(e.target.value)}
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}>
                {STREAM_SERVICES.map((s) => <option key={s.id} value={s.id} style={{ background: "#1a1b22" }}>{s.label}</option>)}
              </select>
            </span>
          )}
        </span>
      )}
    </div>
  );
}

// Tappable category explainer (Brown alumni-board feedback): the slot
// taxonomy is the product's vocabulary — say what each word means, in place.
// Tap/click toggles (touch has no hover); outside-tap dismisses.
function InfoDot({ text, color }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button aria-label={`What does this category mean? ${text}`} aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        style={{
          background: "none", border: `1px solid ${color}`, opacity: open ? 1 : 0.55, color,
          borderRadius: "50%", width: "15px", height: "15px", lineHeight: 1, cursor: "pointer",
          fontSize: "9px", fontFamily: FONTS.body, fontStyle: "italic", padding: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>i</button>
      {open && (
        <span role="tooltip" onClick={(e) => e.stopPropagation()} style={{
          position: "absolute", top: "22px", left: "-8px", zIndex: 30, width: "min(230px, 60vw)",
          background: "#1a1b22", border: "1px solid rgba(148,163,184,0.3)", borderRadius: "8px",
          padding: "10px 12px", fontFamily: FONTS.body, fontSize: "12px", lineHeight: 1.5,
          color: "rgba(226,232,240,0.9)", letterSpacing: "normal", textTransform: "none",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>{text}</span>
      )}
    </span>
  );
}

// Covers tab (V3-42): covers read as a playlist, not prose — Tony's call.
// Two simple lists ("Covered them" / "Covered by"), each row a song with its
// play-count receipt, the verified video when we have one, and the source.
function CoversTab({ data, subject }) {
  const sections = [
    { slotType: "covers", label: "↻ Covered them", sub: SLOT_BY_ID.covers?.description },
    { slotType: "covered_by", label: "↺ Covered by", sub: SLOT_BY_ID.covered_by?.description },
  ];
  const bySlot = Object.fromEntries((data?.slots || []).map((s) => [s.slotType, s.candidates]));
  const any = sections.some((s) => (bySlot[s.slotType] || []).length > 0);
  if (!any) {
    return (
      <div style={{ fontFamily: FONTS.mono, fontSize: "12px", color: "rgba(148,163,184,0.7)", lineHeight: 1.7 }}>
        No documented covers for {subject?.name} yet — the setlist archive grows as the graph does.
      </div>
    );
  }
  return (
    <div>
      {sections.map(({ slotType, label, sub }) => {
        const rows = bySlot[slotType] || [];
        if (!rows.length) return null;
        return (
          <div key={slotType} style={{ marginBottom: "30px" }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: SLOT_COLORS[slotType]?.text || BASE.gold }}>
              {label}
            </div>
            {sub && <div style={{ fontFamily: FONTS.mono, fontSize: "10px", color: "rgba(148,163,184,0.5)", margin: "3px 0 12px" }}>{sub}</div>}
            <div>
              {rows.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: "12px", padding: "10px 2px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  {c.item.videoUrl ? (
                    <a href={c.item.videoUrl} target="_blank" rel="noreferrer" title="Watch the cover (title-verified video)"
                      style={{ fontFamily: FONTS.mono, fontSize: "13px", color: BASE.gold, textDecoration: "none", flexShrink: 0 }}>▶</a>
                  ) : (
                    <span style={{ fontFamily: FONTS.mono, fontSize: "13px", color: "rgba(148,163,184,0.3)", flexShrink: 0 }}>♪</span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: FONTS.display, fontSize: "17px" }}>
                      {c.item.videoUrl
                        ? <a href={c.item.videoUrl} target="_blank" rel="noreferrer" style={{ color: "#e2e8f0", textDecoration: "none" }}>{c.item.title}</a>
                        : c.item.title}
                    </span>
                    {c.item.creator && (
                      <span style={{ fontFamily: FONTS.mono, fontSize: "11px", color: "rgba(148,163,184,0.7)", marginLeft: "10px" }}>{c.item.creator}</span>
                    )}
                    {c.item.stat && (
                      <div style={{ fontFamily: FONTS.mono, fontSize: "10px", color: "rgba(148,163,184,0.45)", marginTop: "2px" }}>{c.item.stat}</div>
                    )}
                  </div>
                  {c.verification?.attribution?.url && (
                    <a href={c.verification.attribution.url} target="_blank" rel="noreferrer" title={c.verification.attribution.detail || "source record"}
                      style={{ fontFamily: FONTS.mono, fontSize: "9.5px", letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(52,211,153,0.6)", textDecoration: "none", flexShrink: 0 }}>
                      {c.verification.attribution.source || "source"} ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Lane 2 (V3-35): propose a whole new card. The fan names the influence and
// hands us a URL containing the evidence; Kynda fetches, extracts, and
// machine-verifies — then a curator publishes. The fan solves discovery,
// the machine does the trusting.
function AddConnectionCard({ subject }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [fields, setFields] = useState({ influence: "", url: "", contributor: "" });

  async function submit() {
    if (!fields.url.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "new_card",
          subject: { name: subject?.name, mbid: subject?.mbid, wikidata_qid: subject?.wikidata_qid },
          influence: fields.influence, url: fields.url, contributor: fields.contributor,
        }),
      });
      const data = await res.json();
      setResult(data.message || data.error || "submitted");
    } catch (err) {
      setResult(err.message);
    }
    setSending(false);
  }

  const inputStyle = { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "8px 10px", fontSize: "12px", color: "#e2e8f0", fontFamily: FONTS.body, outline: "none", marginBottom: "6px", boxSizing: "border-box" };
  const linkStyle = { background: "none", border: "none", cursor: "pointer", fontFamily: FONTS.mono, fontSize: "10px", letterSpacing: "0.05em", color: "rgba(148,163,184,0.45)", padding: 0, textTransform: "uppercase" };

  return (
    <div style={{ marginTop: "20px", padding: "16px 18px", borderRadius: "10px", background: "rgba(250,204,21,0.03)", border: "1px dashed rgba(250,204,21,0.18)" }}>
      {!open && !result && (
        <button style={{ ...linkStyle, color: "rgba(250,204,21,0.7)" }} onClick={() => setOpen(true)}>
          + know an influence we're missing? name it, link a source — Kynda builds the card
        </button>
      )}
      {open && !result && !sending && (
        <div>
          <div style={{ fontFamily: FONTS.mono, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,204,21,0.7)", marginBottom: "10px" }}>
            Propose a connection for {subject?.name}
          </div>
          <input placeholder="Who or what influenced them? (optional — leave blank and Kynda maps everything the page documents)" value={fields.influence}
            onChange={(e) => setFields({ ...fields, influence: e.target.value })} style={inputStyle} />
          <input placeholder="URL of a page documenting it (interview, feature, liner notes…)" value={fields.url}
            onChange={(e) => setFields({ ...fields, url: e.target.value })} style={inputStyle} />
          <input placeholder="Your name (optional)" value={fields.contributor}
            onChange={(e) => setFields({ ...fields, contributor: e.target.value })} style={inputStyle} />
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button style={{ ...linkStyle, color: "rgba(52,211,153,0.8)" }} onClick={submit}>verify & build</button>
            <button style={linkStyle} onClick={() => setOpen(false)}>cancel</button>
          </div>
          <div style={{ marginTop: "8px", fontFamily: FONTS.mono, fontSize: "9.5px", color: "rgba(148,163,184,0.4)", lineHeight: 1.5 }}>
            No typing evidence out — Kynda reads the page, extracts the claim, and machine-checks every quote. Verified cards go to curator review before publishing.
          </div>
        </div>
      )}
      {sending && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: FONTS.mono, fontSize: "10.5px", color: "rgba(148,163,184,0.6)" }}>
          <Pulse /> Kynda is reading the source — extraction and quote-checking can take a minute or two…
        </div>
      )}
      {result && (
        <div style={{ fontFamily: FONTS.mono, fontSize: "10.5px", color: "rgba(148,163,184,0.7)", lineHeight: 1.6 }}>{result}</div>
      )}
    </div>
  );
}

// One slot = a provenance-ranked carousel of candidates (V3-19). The default
// shown is the best-evidenced candidate, not the model's first pick.
function SlotCard({ slot, index, subject }) {
  const slotMeta = SLOT_BY_ID[slot.slotType] || { label: slot.slotType, emoji: "◆" };
  const colors = SLOT_COLORS[slot.slotType] || SLOT_COLORS.titan;
  const order = slot.order?.length === slot.candidates.length ? slot.order : slot.candidates.map((_, i) => i);
  const [pos, setPos] = useState(0);
  useEffect(() => { setPos(0); }, [slot.order?.join?.(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = slot.candidates[order[Math.min(pos, order.length - 1)]];
  if (!current?.item) return null;
  const { item, verification } = current;
  const attribution = verification?.attribution;
  const connection = verification?.connection;
  const citations = verification?.citations || [];
  // Only convictions (catalog names a different creator) dim the card and
  // warn below; a plain catalog miss is a soft ⚠ chip, nothing more (V3-50).
  const failed = attribution?.status === "not_found" && /credits/i.test(attribution?.detail || "");
  return (
    <div style={{
      background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: "8px",
      padding: "22px 24px", opacity: failed ? 0.65 : 1, animation: "kyndaRise 0.5s ease both",
      animationDelay: `${index * 60}ms`,
      // Layout armor: no content — however degenerate — may escape the card
      // (overflow-wrap inherits to all text inside).
      overflowWrap: "anywhere", overflow: "hidden",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontFamily: FONTS.mono, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.text }}>
          {slotMeta.emoji} {slotMeta.label}
          {slotMeta.description && <InfoDot text={slotMeta.description} color={colors.text} />}
        </span>
        {slot.candidates.length > 1 && (
          <span title="Multiple candidates for this slot, ordered by evidence strength"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontFamily: FONTS.mono, fontSize: "11px", color: "rgba(148,163,184,0.7)" }}>
            <button onClick={() => setPos((p) => (p - 1 + order.length) % order.length)} aria-label="previous candidate"
              style={{ background: "none", border: "1px solid rgba(148,163,184,0.25)", color: "inherit", borderRadius: "4px", cursor: "pointer", padding: "1px 7px" }}>‹</button>
            {Math.min(pos, order.length - 1) + 1} / {order.length}
            <button onClick={() => setPos((p) => (p + 1) % order.length)} aria-label="next candidate"
              style={{ background: "none", border: "1px solid rgba(148,163,184,0.25)", color: "inherit", borderRadius: "4px", cursor: "pointer", padding: "1px 7px" }}>›</button>
          </span>
        )}
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: "26px", lineHeight: 1.15, marginBottom: "2px" }}>
        {item.title}
      </div>
      {/* The fact chip sits with the facts it checks: title, creator, year */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: "12px", color: "rgba(148,163,184,0.75)" }}>
          {item.creator}{item.year ? ` · ${item.year}` : ""}{item.medium && item.medium !== "music" ? ` · ${item.medium}` : ""}
        </span>
        <FactChip attribution={attribution} />
        {item.contributed && (
          <span title="Proposed by the community; quote-verified by machine; published by a curator"
            style={{ fontFamily: FONTS.mono, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,204,21,0.65)", border: "1px solid rgba(250,204,21,0.25)", borderRadius: "4px", padding: "1px 6px" }}>
            community
          </span>
        )}
      </div>
      <RevealText text={item.reason} msPerWord={12} delayMs={200}
        style={{ fontSize: "13.5px", lineHeight: 1.65, color: "rgba(226,232,240,0.82)" }} />
      {/* T2 citations outrank everything below — show them first when present */}
      {citations.length > 0 && <CitationBlock citations={citations} />}
      {/* The connection chip sits with the claim it describes: the reason prose */}
      {citations.length === 0 && connection?.status !== "not_applicable" && (
        <div style={{ marginTop: "12px" }}>
          {connection?.status === "documented" && connection.excerpt ? (
            <div style={{ paddingLeft: "14px", borderLeft: "2px solid rgba(250,204,21,0.3)" }}>
              <div style={{ marginBottom: "6px" }}>
                <ConnectionChip connection={connection} />
              </div>
              <div style={{ fontFamily: FONTS.display, fontStyle: "italic", fontSize: "13.5px", lineHeight: 1.6, color: "rgba(226,232,240,0.75)" }}>
                “{connection.excerpt}”
              </div>
              <a href={connection.url} target="_blank" rel="noreferrer"
                style={{ fontFamily: FONTS.mono, fontSize: "10px", letterSpacing: "0.05em", color: "rgba(250,204,21,0.7)", textDecoration: "none" }}>
                Wikipedia: {connection.articleTitle} ↗
              </a>
            </div>
          ) : connection?.status === "documented_via" ? (
            <div style={{ paddingLeft: "14px", borderLeft: "2px dashed rgba(250,204,21,0.3)" }}>
              <div style={{ marginBottom: "6px" }}>
                <ConnectionChip connection={connection} />
              </div>
              {connection.hop1.kind === "membership" ? (
                <div style={{ fontFamily: FONTS.mono, fontSize: "11px", color: "rgba(226,232,240,0.65)", marginBottom: "6px" }}>
                  {connection.via} — {connection.hop1.label}{" "}
                  <a href={connection.hop1.url} target="_blank" rel="noreferrer"
                    style={{ color: "rgba(250,204,21,0.7)", textDecoration: "none" }}>
                    · {connection.hop1.source} ↗
                  </a>
                </div>
              ) : (
                <div style={{ fontFamily: FONTS.display, fontStyle: "italic", fontSize: "13px", lineHeight: 1.6, color: "rgba(226,232,240,0.7)", marginBottom: "6px" }}>
                  “{connection.hop1.excerpt}”{" "}
                  <a href={connection.hop1.url} target="_blank" rel="noreferrer"
                    style={{ fontFamily: FONTS.mono, fontStyle: "normal", fontSize: "10px", color: "rgba(250,204,21,0.7)", textDecoration: "none" }}>
                    — Wikipedia: {connection.hop1.articleTitle} ↗
                  </a>
                </div>
              )}
              <div style={{ fontFamily: FONTS.display, fontStyle: "italic", fontSize: "13.5px", lineHeight: 1.6, color: "rgba(226,232,240,0.75)" }}>
                “{connection.hop2.excerpt}”
              </div>
              <a href={connection.hop2.url} target="_blank" rel="noreferrer"
                style={{ fontFamily: FONTS.mono, fontSize: "10px", letterSpacing: "0.05em", color: "rgba(250,204,21,0.7)", textDecoration: "none" }}>
                Wikipedia: {connection.hop2.articleTitle} ↗
              </a>
            </div>
          ) : (
            <ConnectionChip connection={connection} />
          )}
        </div>
      )}
      {failed && (
        <div style={{ marginTop: "12px", fontFamily: FONTS.mono, fontSize: "11px", color: "rgba(248,113,113,0.7)", lineHeight: 1.5 }}>
          {attribution.detail} — this card's attribution appears to be wrong.
        </div>
      )}
      <ExperienceRow item={item} subjectName={subject?.name} />
      <ContributeRow subject={subject} item={item} hasCitations={citations.length > 0} />
    </div>
  );
}

// ─── Subject / disambiguation UI ──────────────────────────────
// Bio is QUOTED from Wikipedia, never generated (V3-15). The metadata line
// only shows database fields (MusicBrainz life-span, catalog descriptions).
function SubjectCard({ subject, onBioDone }) {
  const [copied, setCopied] = useState(false);
  // No bio to reveal → the sequence gate opens immediately.
  useEffect(() => {
    if (!subject.bio?.text) onBioDone?.();
  }, [subject.name]); // eslint-disable-line react-hooks/exhaustive-deps
  function share() {
    const url = `${window.location.origin}/s/${slugify(subject.name)}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div style={{ padding: "26px 28px", background: BASE.surface, border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px" }}>
        <div style={{ fontFamily: FONTS.display, fontSize: "38px", lineHeight: 1.05, marginBottom: "6px" }}>{subject.name}</div>
        <span style={{ display: "inline-flex", gap: "8px" }}>
          <button onClick={share} title="Copy a permanent link to this subject"
            style={{ background: "none", border: "1px solid rgba(148,163,184,0.25)", borderRadius: "6px", padding: "4px 12px", cursor: "pointer", fontFamily: FONTS.mono, fontSize: "10px", letterSpacing: "0.06em", color: copied ? BASE.gold : "rgba(148,163,184,0.6)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {copied ? "link copied ✓" : "share ↗"}
          </button>
          <a href={`/s/${slugify(subject.name)}/print`} target="_blank" rel="noreferrer"
            title="A printable document with the full influence list, receipts, and graph — save as PDF from the print dialog"
            style={{ background: "none", border: "1px solid rgba(148,163,184,0.25)", borderRadius: "6px", padding: "4px 12px", cursor: "pointer", fontFamily: FONTS.mono, fontSize: "10px", letterSpacing: "0.06em", color: "rgba(148,163,184,0.6)", textTransform: "uppercase", whiteSpace: "nowrap", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            pdf ⤓
          </a>
        </span>
      </div>
      <div style={{ fontFamily: FONTS.mono, fontSize: "12px", color: BASE.gold, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "12px" }}>
        {[subject.domain !== "unknown" ? subject.domain : null, subject.yearsActive, subject.description].filter(Boolean).join(" · ")}
      </div>
      {subject.bio?.text ? (
        <>
          <RevealText text={subject.bio.text} msPerWord={REVEAL_TIMING.bio.msPerWord} delayMs={REVEAL_TIMING.bio.delayMs}
            onDone={onBioDone}
            style={{ fontSize: "14px", lineHeight: 1.7, color: "rgba(226,232,240,0.8)" }} />
          <div style={{ marginTop: "10px" }}>
            <a href={subject.bio.url} target="_blank" rel="noreferrer"
              style={{ fontFamily: FONTS.mono, fontSize: "10px", letterSpacing: "0.05em", color: "rgba(148,163,184,0.6)", textDecoration: "none" }}>
              — Wikipedia: {subject.bio.articleTitle} ↗
            </a>
          </div>
        </>
      ) : (
        <div style={{ fontFamily: FONTS.mono, fontSize: "11px", color: "rgba(148,163,184,0.55)", lineHeight: 1.6 }}>
          No encyclopedia entry found — showing catalog metadata only. Kynda quotes bios rather than generating them.
        </div>
      )}
    </div>
  );
}

function CandidateButton({ candidate, onPick, compact }) {
  return (
    <button onClick={() => onPick(candidate)} style={{
      textAlign: "left", cursor: "pointer", background: BASE.surfaceRaised,
      border: "1px solid rgba(255,255,255,0.09)", borderRadius: "8px", color: "#e2e8f0",
      padding: compact ? "8px 14px" : "16px 18px", fontFamily: FONTS.body,
      display: "block", width: compact ? "auto" : "100%",
    }}>
      <span style={{ fontFamily: FONTS.display, fontSize: compact ? "15px" : "20px" }}>{candidate.name}</span>
      {candidate.description && (
        <span style={{ fontFamily: FONTS.mono, fontSize: "11px", color: "rgba(148,163,184,0.7)", marginLeft: "10px" }}>
          {candidate.description}
        </span>
      )}
    </button>
  );
}

// ─── Demo fixture (?demo=1) — offline design iteration, no API calls ──
const DEMO = {
  subject: {
    name: "Radiohead", domain: "music", yearsActive: "1985–Present", description: "GB", mbid: "demo",
    bio: { text: "Radiohead are an English rock band formed in Abingdon, Oxfordshire, in 1985. Their experimental approach is credited with advancing the sound of alternative rock.", articleTitle: "Radiohead", url: "https://en.wikipedia.org/wiki/Radiohead", source: "Wikipedia" },
  },
  intro: "Radiohead's story is one of absorbing the American underground, Bristol's electronics, and Warp Records' abstractions — then transmitting all of it forward.",
  slots: [
    {
      slotType: "titan",
      order: [0, 1],
      candidates: [
        { item: { slotType: "titan", title: "Surfer Rosa", creator: "Pixies", year: "1988", medium: "music", reason: "Thom Yorke has repeatedly pointed to the Pixies' quiet-loud dynamics as foundational to the band's early songwriting, an architecture audible from Pablo Honey through The Bends. Producer Paul Kolderie, who engineered for the Pixies, was enlisted for Radiohead's debut — a direct personnel link between the two catalogs that shaped how the band tracked guitars and staged dynamics for a decade." },
          verification: { attribution: { status: "verified", source: "MusicBrainz", url: "https://musicbrainz.org/release-group/74e36cbc-a747-3ebf-a60e-51e656c87741", detail: "first released 1988-03-21" }, connection: { status: "documented", articleTitle: "Radiohead", url: "https://en.wikipedia.org/wiki/Radiohead", excerpt: "Paul Kolderie and Sean Slade, who had worked with the US bands the Pixies and Dinosaur Jr., were enlisted to produce Radiohead's debut album, Pablo Honey." }, citations: [{ quote: "I was trying to write the ultimate pop song… I was basically trying to rip off the Pixies. I have to admit it.", speaker: "Kurt Cobain", degree: "first", url: "https://example.com/interview", publication: "Rolling Stone", date: "1994", archivedUrl: "https://web.archive.org/web/example" }] } },
        { item: { slotType: "titan", title: "Remain in Light", creator: "Talking Heads", year: "1980", medium: "music", reason: "Radiohead took their name from the Talking Heads song 'Radio Head', and Remain in Light's method — songs built from layered grooves, studio collage, and Brian Eno's production interventions rather than conventional band performance — became a template the band openly invoked around Kid A. Thom Yorke's fragmented, chanted vocal delivery and the shift toward rhythm-first composition echo David Byrne's approach here directly." },
          verification: { attribution: { status: "verified", source: "MusicBrainz", url: "https://musicbrainz.org", detail: "first released 1980" }, connection: { status: "documented", articleTitle: "Radiohead", url: "https://en.wikipedia.org/wiki/Radiohead", excerpt: "At EMI's request, they changed their name; \"Radiohead\" was taken from the song \"Radio Head\" on the Talking Heads album True Stories (1986)." } } },
      ],
    },
    {
      slotType: "ghost",
      order: [0],
      candidates: [
        { item: { slotType: "ghost", title: "Selected Ambient Works 85-92", creator: "Aphex Twin", year: "1992", medium: "music", reason: "The Warp Records catalog — Aphex Twin above all — is the documented hinge of the Kid A era. Yorke described retreating from guitar music entirely and listening to little else, and the imprint is structural: rhythm displacing riff, texture displacing chorus. This is the connection casual listeners miss most, because its fingerprints are on the band's least guitar-shaped records." },
          verification: { attribution: { status: "verified", source: "MusicBrainz", url: "https://musicbrainz.org", detail: "first released 1992" }, connection: { status: "undocumented" } } },
      ],
    },
    {
      slotType: "legacy",
      order: [0],
      candidates: [
        { item: { slotType: "legacy", title: "There Will Be Blood", creator: "Paul Thomas Anderson", year: "2007", medium: "film", via: "Jonny Greenwood", reason: "Radiohead's legacy extends into film scoring through Jonny Greenwood, whose dissonant string writing for Paul Thomas Anderson's oil-boom epic announced a rock musician operating at the level of contemporary classical composition. The partnership continued across Phantom Thread and The Power of the Dog, carrying the band's textural vocabulary into cinema." },
          verification: { attribution: { status: "verified", source: "Wikidata", url: "https://www.wikidata.org/wiki/Q261191", detail: "2007 film directed by Paul Thomas Anderson" }, connection: { status: "documented_via", via: "Jonny Greenwood", hop1: { kind: "membership", label: "member of Radiohead", source: "MusicBrainz", url: "https://musicbrainz.org" }, hop2: { articleTitle: "Jonny Greenwood", url: "https://en.wikipedia.org/wiki/Jonny_Greenwood", excerpt: "Greenwood composed the score for Paul Thomas Anderson's film There Will Be Blood (2007), which won him critical acclaim." } } } },
      ],
    },
  ],
};

// ─── App (V3-28: reusable — home renders it bare; /s/[slug] subject
// pages render it with an initialSubject that boots the mix) ──────────
export default function KyndaApp({ initialSubject = null, indexedSubjects = [] }) {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | searching | choosing | mixing
  const [error, setError] = useState(null);
  const [subject, setSubject] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [tier, setTier] = useState(null);
  const [intro, setIntro] = useState(null);
  // Sequenced load (V3-54): the Wikipedia bio reveals first; the mix intro
  // waits for it. One thing at a time — the eye needs a single track.
  const [bioDone, setBioDone] = useState(false);
  const [slots, setSlots] = useState([]);
  const [done, setDone] = useState(false);
  const [tab, setTab] = useState("mix");
  const [graph, setGraph] = useState({ status: "idle", data: null, error: null });
  const [covers, setCovers] = useState({ status: "idle", data: null, error: null });
  const runRef = useRef(0);

  // Graph is lazy (kynda2 AD-05) and free — a pure claims-store read.
  const openGraphTab = useCallback(async (subj) => {
    setTab("graph");
    if (graph.status === "loading" || graph.status === "ready") return;
    setGraph({ status: "loading", data: null, error: null });
    try {
      const res = await fetch("/api/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subj }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "graph failed");
      setGraph({ status: "ready", data, error: null });
    } catch (err) {
      setGraph({ status: "error", data: null, error: err.message });
    }
  }, [graph.status]);

  // Covers tab (V3-42): lazy and free, same pattern as the graph.
  const openCoversTab = useCallback(async (subj) => {
    setTab("covers");
    if (covers.status === "loading" || covers.status === "ready") return;
    setCovers({ status: "loading", data: null, error: null });
    try {
      const res = await fetch("/api/covers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subj }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "covers failed");
      setCovers({ status: "ready", data, error: null });
    } catch (err) {
      setCovers({ status: "error", data: null, error: err.message });
    }
  }, [covers.status]);

  // ?demo=1 seeds fixture data for offline design iteration — no API calls.
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo")) {
      setSubject(DEMO.subject); setTier("certain"); setIntro(DEMO.intro);
      setSlots(DEMO.slots);
      setPhase("mixing"); setDone(true);
    }
  }, []);

  // Subject pages boot straight into the mix (served from the DB → instant).
  useEffect(() => {
    if (initialSubject) {
      setQuery(initialSubject.name);
      selectSubject(initialSubject);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fireMix = useCallback(async (subj, run) => {
    try {
      const res = await fetch("/api/mix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subj }),
      });
      if (!res.ok || !res.body) throw new Error(`mix request failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done: rdone, value } = await reader.read();
        if (rdone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim() || runRef.current !== run) continue;
          const evt = JSON.parse(line);
          if (evt.type === "intro") setIntro(evt.intro);
          else if (evt.type === "item") setSlots((prev) => {
            const next = [...prev];
            next[evt.s] = next[evt.s] || { slotType: evt.slotType, candidates: [], order: null };
            const candidates = [...next[evt.s].candidates];
            candidates[evt.c] = { ...(candidates[evt.c] || {}), item: evt.item };
            next[evt.s] = { ...next[evt.s], candidates };
            return next;
          });
          else if (evt.type === "verification") setSlots((prev) => {
            const next = [...prev];
            if (!next[evt.s]) return prev;
            const candidates = [...next[evt.s].candidates];
            candidates[evt.c] = { ...(candidates[evt.c] || {}), verification: evt.verification };
            next[evt.s] = { ...next[evt.s], candidates };
            return next;
          });
          else if (evt.type === "rank") setSlots((prev) => {
            const next = [...prev];
            if (!next[evt.s]) return prev;
            next[evt.s] = { ...next[evt.s], order: evt.order };
            return next;
          });
          else if (evt.type === "done") setDone(true);
          else if (evt.type === "error") setError(evt.message);
        }
      }
    } catch (err) {
      if (runRef.current === run) setError(err.message);
    }
  }, []);

  const selectSubject = useCallback((subj) => {
    const run = ++runRef.current;
    setSubject(subj);
    setAlternatives([]);
    setTier("certain");
    setPhase("mixing");
    setIntro(null); setSlots([]); setDone(false); setError(null); setBioDone(false);
    setTab("mix"); setGraph({ status: "idle", data: null, error: null }); setCovers({ status: "idle", data: null, error: null });
    fireMix(subj, run);
  }, [fireMix]);

  async function onSearch(e) {
    e.preventDefault();
    runSearch(query);
  }

  // Graph double-click navigation (AD-07) routes through the full search flow.
  function navigateTo(name) {
    setQuery(name);
    runSearch(name);
  }

  async function runSearch(text) {
    if (!text?.trim()) return;
    const query = text;
    const run = ++runRef.current;
    setPhase("searching");
    setError(null); setSubject(null); setAlternatives([]); setTier(null);
    setIntro(null); setSlots([]); setDone(false); setBioDone(false);
    setTab("mix"); setGraph({ status: "idle", data: null, error: null }); setCovers({ status: "idle", data: null, error: null });
    try {
      const res = await fetch("/api/disambiguate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (runRef.current !== run) return;
      if (!res.ok) throw new Error(data.error || "search failed");
      if (data.confidence === "none") {
        setPhase("idle");
        setError(`No match found for "${query}" in MusicBrainz or Wikidata.`);
        return;
      }
      setTier(data.confidence);
      if (data.confidence === "ambiguous") {
        setSubject(data.subject);
        setAlternatives(data.alternatives || []);
        setPhase("choosing");
        return;
      }
      setSubject(data.subject);
      setAlternatives(data.confidence === "likely" ? data.alternatives || [] : []);
      setPhase("mixing");
      fireMix(data.subject, run);
    } catch (err) {
      if (runRef.current === run) { setPhase("idle"); setError(err.message); }
    }
  }

  const allVerifs = slots.flatMap((s) => (s?.candidates || []).map((c) => c?.verification)).filter(Boolean);
  const candidateCount = slots.reduce((n, s) => n + (s?.candidates?.length || 0), 0);
  const factCheckedCount = allVerifs.filter((v) => v?.attribution?.status === "verified").length;
  const documentedCount = allVerifs.filter((v) => v?.connection?.status === "documented" || v?.connection?.status === "documented_via").length;
  const citedCount = allVerifs.filter((v) => v?.citations?.length > 0).length;

  return (
    <main style={{ maxWidth: "880px", margin: "0 auto", padding: "56px 24px 120px" }}>
      <style>{`
        @keyframes kyndaPulse { 0%,100% { opacity: 0.3 } 50% { opacity: 1 } }
        @keyframes kyndaSpin { to { transform: rotate(360deg) } }
        @keyframes kyndaRise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        input::placeholder { color: rgba(148,163,184,0.45) }
      `}</style>

      <header style={{ marginBottom: "36px" }}>
        <h1 style={{ fontFamily: FONTS.display, fontSize: "52px", fontWeight: 400, margin: 0, lineHeight: 1 }}>
          {/* Full navigation (not client state reset) so the logo works
              identically from /s/[slug] pages and mid-search alike. */}
          <a href="/" style={{ color: "inherit", textDecoration: "none" }} title="Back to the start">Kynda</a>
        </h1>
        <div style={{ fontFamily: FONTS.display, fontStyle: "italic", color: BASE.gold, fontSize: "15px", margin: "6px 0 10px" }}>
          (KIN-duh): Old Norse for “to light up”
        </div>
        <p style={{ fontSize: "14px", color: "rgba(148,163,184,0.8)", margin: 0, maxWidth: "460px", lineHeight: 1.6 }}>
          Discover the connections between your favorite works of culture, and the creators behind them.
        </p>
      </header>

      <form onSubmit={onSearch} style={{ display: "flex", gap: "10px", marginBottom: "36px" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Map any creator or creation..."
          style={{
            flex: 1, background: BASE.surfaceRaised, border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "8px", padding: "14px 18px", fontSize: "16px", color: "#e2e8f0",
            fontFamily: FONTS.body, outline: "none",
          }}
        />
        <button type="submit" disabled={phase === "searching"} style={{
          background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.35)", color: BASE.gold,
          borderRadius: "8px", padding: "0 26px", fontFamily: FONTS.mono, fontSize: "13px",
          letterSpacing: "0.08em", cursor: "pointer", textTransform: "uppercase",
          display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "88px",
        }}>
          {phase === "searching" || (phase === "mixing" && !done) ? <Spinner /> : "Map"}
        </button>
      </form>

      {error && (
        <div style={{ fontFamily: FONTS.mono, fontSize: "13px", color: "rgba(248,113,113,0.85)", marginBottom: "24px" }}>{error}</div>
      )}

      {/* Browsable index (V3-33): everything already in the graph, one click
          away — no guessing what's been built. Hidden once a search starts. */}
      {phase === "idle" && indexedSubjects.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(148,163,184,0.55)", marginBottom: "14px" }}>
            In the graph so far — {indexedSubjects.length} subjects
          </div>
          {[...new Set(indexedSubjects.map((s) => s.domain))].map((domain) => (
            <div key={domain} style={{ marginBottom: "18px" }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: BASE.gold, marginBottom: "8px" }}>
                {/* Display label only — the stored domain stays 'other' */}
                {domain === "other" ? "ideas" : domain}
              </div>
              {/* Creators and creations browse separately (V3-51): a person
                  and their work carry different influence signatures. */}
              {[false, true].map((wantWork) => {
                const group = indexedSubjects.filter((s) => s.domain === domain && !!s.isWork === wantWork);
                if (!group.length) return null;
                return (
                  <div key={String(wantWork)} style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                    {wantWork && (
                      <span style={{ fontFamily: FONTS.mono, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(148,163,184,0.4)" }}>
                        works
                      </span>
                    )}
                    {group.map((s) => (
                      <a key={s.slug} href={`/s/${s.slug}`}
                        style={{
                          fontFamily: wantWork ? FONTS.display : FONTS.body,
                          fontStyle: wantWork ? "italic" : "normal",
                          fontSize: wantWork ? "13.5px" : "13px", color: "rgba(226,232,240,0.85)",
                          background: wantWork ? "rgba(255,255,255,0.015)" : BASE.surfaceRaised,
                          border: wantWork ? "1px dashed rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.09)",
                          borderRadius: "16px", padding: "5px 14px", textDecoration: "none",
                        }}>
                        {s.name}
                      </a>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Find the thread (V3-41): pathfinding entry — below the index by
          design (V3-42): browsing what's mapped comes first. */}
      {phase === "idle" && (
        <form method="GET" action="/path" style={{ margin: "26px 0 30px", padding: "16px 18px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(148,163,184,0.55)", marginBottom: "10px" }}>
            Find the shortest documented path between any two points in the graph
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input name="from" placeholder="From (e.g. Kraftwerk)" style={{ flex: "1 1 150px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "9px 12px", fontSize: "13px", color: "#e2e8f0", outline: "none" }} />
            <input name="to" placeholder="To (e.g. Doechii)" style={{ flex: "1 1 150px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "9px 12px", fontSize: "13px", color: "#e2e8f0", outline: "none" }} />
            <button type="submit" style={{ background: "none", border: "1px solid rgba(250,204,21,0.4)", borderRadius: "6px", padding: "9px 18px", color: BASE.gold, fontFamily: FONTS.mono, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}>
              trace
            </button>
          </div>
        </form>
      )}

      {phase === "choosing" && subject && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(148,163,184,0.7)", marginBottom: "14px" }}>
            Several real matches — which one did you mean?
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            {[subject, ...alternatives].map((c, i) => (
              <CandidateButton key={i} candidate={c} onPick={selectSubject} />
            ))}
          </div>
        </div>
      )}

      {phase === "mixing" && subject && (
        <>
          <SubjectCard subject={subject} onBioDone={() => setBioDone(true)} />
          {tier === "likely" && alternatives.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "28px" }}>
              <span style={{ fontFamily: FONTS.mono, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(148,163,184,0.6)" }}>
                Not this one?
              </span>
              {alternatives.map((c, i) => (
                <CandidateButton key={i} candidate={c} onPick={selectSubject} compact />
              ))}
            </div>
          )}

          {/* MIX | COVERS | GRAPH tabs (covers and graph are lazy and token-free) */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {[["mix", "Mix"], ["covers", "Covers"], ["graph", "Graph"]].map(([id, label]) => (
              <button key={id}
                onClick={() => (id === "graph" ? openGraphTab(subject) : id === "covers" ? openCoversTab(subject) : setTab("mix"))}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: FONTS.mono, fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase",
                  padding: "10px 18px", color: tab === id ? BASE.gold : "rgba(148,163,184,0.6)",
                  borderBottom: tab === id ? `2px solid ${BASE.gold}` : "2px solid transparent",
                  marginBottom: "-1px",
                }}>
                {label}
              </button>
            ))}
          </div>

          {tab === "covers" && (
            <div>
              {covers.status === "loading" && (
                <div style={{ fontFamily: FONTS.mono, fontSize: "12px", color: "rgba(148,163,184,0.6)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Pulse /> reading the setlists…
                </div>
              )}
              {covers.status === "error" && (
                <div style={{ fontFamily: FONTS.mono, fontSize: "12px", color: "rgba(148,163,184,0.7)" }}>{covers.error}</div>
              )}
              {covers.status === "ready" && <CoversTab data={covers.data} subject={subject} />}
            </div>
          )}

          {tab === "graph" && (
            <div>
              {graph.status === "loading" && (
                <div style={{ fontFamily: FONTS.mono, fontSize: "12px", color: "rgba(148,163,184,0.6)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Pulse /> reading the claims graph…
                </div>
              )}
              {graph.status === "error" && (
                <div style={{ fontFamily: FONTS.mono, fontSize: "12px", color: "rgba(148,163,184,0.7)" }}>{graph.error}</div>
              )}
              {graph.status === "ready" && (
                <GraphView data={graph.data} subjectName={subject.name} onNavigate={navigateTo} />
              )}
            </div>
          )}

          {tab === "mix" && intro && (
            <div style={{ marginBottom: "28px" }}>
              <RevealText text={intro} msPerWord={REVEAL_TIMING.intro.msPerWord} delayMs={REVEAL_TIMING.intro.delayMs}
                start={bioDone}
                style={{ fontFamily: FONTS.display, fontSize: "19px", fontStyle: "italic", lineHeight: 1.6, color: "rgba(226,232,240,0.9)" }} />
            </div>
          )}

          {tab === "mix" && !intro && !error && (
            <div style={{ fontFamily: FONTS.mono, fontSize: "12px", color: "rgba(148,163,184,0.6)", display: "flex", alignItems: "center", gap: "8px" }}>
              <Pulse /> composing the mix — Fable is thinking…
            </div>
          )}

          {tab === "mix" && (
          <div style={{ display: "grid", gap: "16px" }}>
            {slots.map((slot, i) => slot?.candidates?.length > 0 && (
              <SlotCard key={i} slot={slot} index={i} subject={subject} />
            ))}
          </div>
          )}

          {tab === "mix" && done && subject && <AddConnectionCard subject={subject} />}

          {tab === "mix" && done && (
            <div style={{ marginTop: "28px", fontFamily: FONTS.mono, fontSize: "11px", color: "rgba(148,163,184,0.55)", lineHeight: 1.7 }}>
              The connections are Kynda’s synthesis — no database can produce them.
              The databases fact-check the synthesis: across {candidateCount} candidates
              in {slots.length} slots, {factCheckedCount} attributions confirmed against open
              catalogs (MusicBrainz, Open Library, Wikidata), {documentedCount} connection{documentedCount === 1 ? "" : "s"} independently
              documented{citedCount > 0 ? `, and ${citedCount} backed by primary-source citations from the research corpus` : ""}.
              Each slot’s carousel is ordered by evidence strength, not by the model’s preference.
              All badges are machine-earned — the model cannot assign them to itself.
            </div>
          )}
        </>
      )}
    </main>
  );
}
