"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FONTS, BASE, MIX_SLOT_TYPES, SLOT_COLORS, CONFIDENCE_COLORS, REVEAL_TIMING } from "../src/design/tokens.js";

const SLOT_BY_ID = Object.fromEntries(MIX_SLOT_TYPES.map((s) => [s.id, s]));

// ─── Typewriter (kynda2 DD-02) ────────────────────────────────
function RevealText({ text, msPerWord = 45, delayMs = 400, style }) {
  const [count, setCount] = useState(0);
  const words = (text || "").split(" ");
  useEffect(() => {
    setCount(0);
    if (!text) return;
    let i = 0;
    let interval;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= words.length) clearInterval(interval);
      }, msPerWord);
    }, delayMs);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
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
    return (
      <a href={attribution.url} target="_blank" rel="noreferrer"
        title={`Title, creator & year confirmed in ${attribution.source}${attribution.detail ? ` — ${attribution.detail}` : ""}`}
        style={{ ...chipBase, color: CONFIDENCE_COLORS.verified, border: "1px solid rgba(52,211,153,0.35)" }}>
        ✓ facts checked
      </a>
    );
  }
  if (attribution.status === "not_found") {
    return (
      <span title={`Not found in ${attribution.source} — this work may be misattributed`}
        style={{ ...chipBase, color: "rgba(248,113,113,0.85)", border: "1px solid rgba(248,113,113,0.35)" }}>
        ✕ failed fact-check
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

// One slot = a provenance-ranked carousel of candidates (V3-19). The default
// shown is the best-evidenced candidate, not the model's first pick.
function SlotCard({ slot, index }) {
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
  const failed = attribution?.status === "not_found";
  return (
    <div style={{
      background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: "8px",
      padding: "22px 24px", opacity: failed ? 0.65 : 1, animation: "kyndaRise 0.5s ease both",
      animationDelay: `${index * 60}ms`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.text }}>
          {slotMeta.emoji} {slotMeta.label}
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
          This attribution was checked against {attribution.source} and could not be confirmed. It may be wrong.
        </div>
      )}
    </div>
  );
}

// ─── Subject / disambiguation UI ──────────────────────────────
// Bio is QUOTED from Wikipedia, never generated (V3-15). The metadata line
// only shows database fields (MusicBrainz life-span, catalog descriptions).
function SubjectCard({ subject }) {
  return (
    <div style={{ padding: "26px 28px", background: BASE.surface, border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", marginBottom: "24px" }}>
      <div style={{ fontFamily: FONTS.display, fontSize: "38px", lineHeight: 1.05, marginBottom: "6px" }}>{subject.name}</div>
      <div style={{ fontFamily: FONTS.mono, fontSize: "12px", color: BASE.gold, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "12px" }}>
        {[subject.domain !== "unknown" ? subject.domain : null, subject.yearsActive, subject.description].filter(Boolean).join(" · ")}
      </div>
      {subject.bio?.text ? (
        <>
          <RevealText text={subject.bio.text} msPerWord={REVEAL_TIMING.bio.msPerWord} delayMs={REVEAL_TIMING.bio.delayMs}
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

// ─── Page ─────────────────────────────────────────────────────
export default function Page() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | searching | choosing | mixing
  const [error, setError] = useState(null);
  const [subject, setSubject] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [tier, setTier] = useState(null);
  const [intro, setIntro] = useState(null);
  const [slots, setSlots] = useState([]);
  const [done, setDone] = useState(false);
  const runRef = useRef(0);

  // ?demo=1 seeds fixture data for offline design iteration — no API calls.
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo")) {
      setSubject(DEMO.subject); setTier("certain"); setIntro(DEMO.intro);
      setSlots(DEMO.slots);
      setPhase("mixing"); setDone(true);
    }
  }, []);

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
    setIntro(null); setSlots([]); setDone(false); setError(null);
    fireMix(subj, run);
  }, [fireMix]);

  async function onSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    const run = ++runRef.current;
    setPhase("searching");
    setError(null); setSubject(null); setAlternatives([]); setTier(null);
    setIntro(null); setSlots([]); setDone(false);
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
        <h1 style={{ fontFamily: FONTS.display, fontSize: "52px", fontWeight: 400, margin: 0, lineHeight: 1 }}>Kynda</h1>
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
          <SubjectCard subject={subject} />
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

          {intro && (
            <div style={{ marginBottom: "28px" }}>
              <RevealText text={intro} msPerWord={REVEAL_TIMING.intro.msPerWord} delayMs={100}
                style={{ fontFamily: FONTS.display, fontSize: "19px", fontStyle: "italic", lineHeight: 1.6, color: "rgba(226,232,240,0.9)" }} />
            </div>
          )}

          {!intro && !error && (
            <div style={{ fontFamily: FONTS.mono, fontSize: "12px", color: "rgba(148,163,184,0.6)", display: "flex", alignItems: "center", gap: "8px" }}>
              <Pulse /> composing the mix — Fable is thinking…
            </div>
          )}

          <div style={{ display: "grid", gap: "16px" }}>
            {slots.map((slot, i) => slot?.candidates?.length > 0 && (
              <SlotCard key={i} slot={slot} index={i} />
            ))}
          </div>

          {done && (
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
