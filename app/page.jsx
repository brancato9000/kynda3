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

// ─── Provenance badge — machine-earned, never model-asserted ──
function Badge({ verification }) {
  const base = {
    fontFamily: FONTS.mono, fontSize: "10px", letterSpacing: "0.06em",
    padding: "3px 8px", borderRadius: "3px", textTransform: "uppercase",
    display: "inline-flex", alignItems: "center", gap: "5px", textDecoration: "none",
  };
  if (!verification) {
    return (
      <span style={{ ...base, color: "rgba(148,163,184,0.55)", border: "1px solid rgba(148,163,184,0.2)" }}>
        <Pulse /> verifying
      </span>
    );
  }
  if (verification.status === "verified") {
    return (
      <a href={verification.url} target="_blank" rel="noreferrer"
        title={`Confirmed in MusicBrainz${verification.firstReleaseDate ? ` — first released ${verification.firstReleaseDate}` : ""}`}
        style={{ ...base, color: CONFIDENCE_COLORS.verified, border: "1px solid rgba(52,211,153,0.35)" }}>
        ✓ verified · MusicBrainz ↗
      </a>
    );
  }
  if (verification.status === "not_found") {
    return (
      <span title="This attribution could not be confirmed in MusicBrainz — treat with skepticism"
        style={{ ...base, color: "rgba(248,113,113,0.85)", border: "1px solid rgba(248,113,113,0.35)" }}>
        ✕ unverified
      </span>
    );
  }
  return (
    <span title={verification.reason || "No database verifier for this medium yet"}
      style={{ ...base, color: CONFIDENCE_COLORS.inferred, border: "1px solid rgba(148,163,184,0.2)" }}>
      inferred
    </span>
  );
}

function Pulse() {
  return (
    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgba(148,163,184,0.6)", animation: "kyndaPulse 1.2s ease-in-out infinite" }} />
  );
}

// ─── Mix card ─────────────────────────────────────────────────
function MixCard({ item, verification, index }) {
  const slot = SLOT_BY_ID[item.slotType] || { label: item.slotType, emoji: "◆" };
  const colors = SLOT_COLORS[item.slotType] || SLOT_COLORS.titan;
  const failed = verification?.status === "not_found";
  return (
    <div style={{
      background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: "8px",
      padding: "22px 24px", opacity: failed ? 0.65 : 1, animation: "kyndaRise 0.5s ease both",
      animationDelay: `${index * 60}ms`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: colors.text }}>
          {slot.emoji} {slot.label}
        </span>
        <Badge verification={verification} />
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: "26px", lineHeight: 1.15, marginBottom: "2px" }}>
        {item.title}
      </div>
      <div style={{ fontFamily: FONTS.mono, fontSize: "12px", color: "rgba(148,163,184,0.75)", marginBottom: "14px" }}>
        {item.creator}{item.year ? ` · ${item.year}` : ""}{item.medium && item.medium !== "music" ? ` · ${item.medium}` : ""}
      </div>
      <RevealText text={item.reason} msPerWord={12} delayMs={200}
        style={{ fontSize: "13.5px", lineHeight: 1.65, color: "rgba(226,232,240,0.82)" }} />
      {failed && (
        <div style={{ marginTop: "12px", fontFamily: FONTS.mono, fontSize: "11px", color: "rgba(248,113,113,0.7)", lineHeight: 1.5 }}>
          This attribution was checked against MusicBrainz and could not be confirmed. It may be wrong.
        </div>
      )}
    </div>
  );
}

// ─── Subject / disambiguation UI ──────────────────────────────
function SubjectCard({ subject }) {
  return (
    <div style={{ padding: "26px 28px", background: BASE.surface, border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", marginBottom: "24px" }}>
      <div style={{ fontFamily: FONTS.display, fontSize: "38px", lineHeight: 1.05, marginBottom: "6px" }}>{subject.name}</div>
      <div style={{ fontFamily: FONTS.mono, fontSize: "12px", color: BASE.gold, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "12px" }}>
        {[subject.domain !== "unknown" ? subject.domain : null, subject.yearsActive, ...(subject.genres || []).slice(0, 3)].filter(Boolean).join(" · ")}
      </div>
      {subject.bio && (
        <RevealText text={subject.bio} msPerWord={REVEAL_TIMING.bio.msPerWord} delayMs={REVEAL_TIMING.bio.delayMs}
          style={{ fontSize: "14px", lineHeight: 1.7, color: "rgba(226,232,240,0.8)" }} />
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

// ─── Page ─────────────────────────────────────────────────────
export default function Page() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | searching | choosing | mixing
  const [error, setError] = useState(null);
  const [subject, setSubject] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [tier, setTier] = useState(null);
  const [intro, setIntro] = useState(null);
  const [items, setItems] = useState([]);
  const [verifications, setVerifications] = useState({});
  const [done, setDone] = useState(false);
  const runRef = useRef(0);

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
          else if (evt.type === "item") setItems((prev) => { const next = [...prev]; next[evt.index] = evt.item; return next; });
          else if (evt.type === "verification") setVerifications((prev) => ({ ...prev, [evt.index]: evt.verification }));
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
    setIntro(null); setItems([]); setVerifications({}); setDone(false); setError(null);
    fireMix(subj, run);
  }, [fireMix]);

  async function onSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    const run = ++runRef.current;
    setPhase("searching");
    setError(null); setSubject(null); setAlternatives([]); setTier(null);
    setIntro(null); setItems([]); setVerifications({}); setDone(false);
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

  const verifiedCount = Object.values(verifications).filter((v) => v?.status === "verified").length;

  return (
    <main style={{ maxWidth: "880px", margin: "0 auto", padding: "56px 24px 120px" }}>
      <style>{`
        @keyframes kyndaPulse { 0%,100% { opacity: 0.3 } 50% { opacity: 1 } }
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
        }}>
          {phase === "searching" ? "…" : "Map"}
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
            {items.map((item, i) => item && (
              <MixCard key={i} item={item} verification={verifications[i]} index={i} />
            ))}
          </div>

          {done && (
            <div style={{ marginTop: "28px", fontFamily: FONTS.mono, fontSize: "11px", color: "rgba(148,163,184,0.55)", lineHeight: 1.7 }}>
              {verifiedCount} of {items.length} attributions machine-verified against MusicBrainz.
              Badges are earned by database checks, never self-assigned by the model.
              Items marked “inferred” are in mediums without a verifier yet.
            </div>
          )}
        </>
      )}
    </main>
  );
}
