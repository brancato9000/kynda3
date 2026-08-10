"use client";

// Inline media (v0/v1, 2026-08-08): official embed players for curated
// Experience-it doors and for citations whose source IS media ("watchable
// receipts"). Shared by the main app and the demo pages.
//
// Principles (backlog: inline media contemplation):
//   - embed ≠ host ≠ steal: only platform/archive-official embed endpoints;
//     plays and views accrue to the source. Outbound credit stays visible.
//   - click-to-load: no third-party scripts until the reader opts in.
//   - one player at a time: starting any embed collapses the others
//     (in-page event bus; unmounting the iframe stops its audio).

import { useState, useRef, useEffect } from "react";
import { FONTS } from "./tokens.js";

export function parseEmbed(url) {
  if (!url) return null;
  let m = url.match(/(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/)|youtu\.be\/)([\w-]{6,20})/);
  if (m) {
    const t = url.match(/[?&](?:t|start)=(\d+)/)?.[1];
    return { provider: "YouTube", src: `https://www.youtube-nocookie.com/embed/${m[1]}?${t ? `start=${t}&` : ""}autoplay=1`, credit: "watch on YouTube" };
  }
  m = url.match(/vimeo\.com\/(\d+)\b/);
  if (m) return { provider: "Vimeo", src: `https://player.vimeo.com/video/${m[1]}?autoplay=1`, credit: "watch on Vimeo" };
  // AAPB (LoC + GBH) publishes its own embed endpoint — archive-official
  // media, the cleanest rung of the media-provenance ladder. Catalog URLs
  // are what harvest-aapb stores as provenance, so RECEIPTS become playable.
  m = url.match(/americanarchive\.org\/(?:catalog|embed)\/([\w-]+)/);
  if (m) return { provider: "AAPB", src: `https://americanarchive.org/embed/${m[1]}`, credit: "watch at AAPB" };
  return null;
}

// Curated Commons image (inline media v0.5): the image renders directly —
// the license was gated at curation time (override-image.mjs allowlist),
// and attribution + license + source link always render with the pixels.
export function CardImage({ item }) {
  if (!item?.imageUrl) return null;
  return (
    <figure style={{ margin: "14px 0 0 0" }}>
      <img src={item.imageUrl} alt={item.title}
        style={{ width: "100%", maxHeight: "380px", objectFit: "contain", borderRadius: "8px", display: "block", background: "rgba(0,0,0,0.25)" }} />
      <figcaption style={{ marginTop: "5px", fontFamily: FONTS.mono, fontSize: "9.5px", letterSpacing: "0.04em", color: "rgba(148,163,184,0.5)" }}>
        image: {item.imageCredit} · {item.imageLicense} ·{" "}
        <a href={item.imagePage} target="_blank" rel="noreferrer" style={{ color: "rgba(148,163,184,0.6)", textDecoration: "none" }}>
          commons ↗
        </a>
      </figcaption>
    </figure>
  );
}

// iTunes 30-second preview (inline media v0.6): Apple provides preview
// URLs explicitly for this purpose — official snippet, outbound credit to
// the store page. Joins the one-player-at-a-time bus: starting any other
// media pauses it.
export function PreviewAudio({ item }) {
  const audioRef = useRef(null);
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = `media_${Math.random().toString(36).slice(2)}`;
  useEffect(() => {
    const onOtherPlay = (e) => { if (e.detail !== idRef.current) audioRef.current?.pause(); };
    window.addEventListener("kynda-media-play", onOtherPlay);
    return () => window.removeEventListener("kynda-media-play", onOtherPlay);
  }, []);
  if (!item?.previewUrl) return null;
  return (
    <div style={{ marginTop: "12px" }}>
      <audio ref={audioRef} controls preload="none" src={item.previewUrl}
        onPlay={() => window.dispatchEvent(new CustomEvent("kynda-media-play", { detail: idRef.current }))}
        style={{ width: "100%", height: "34px" }} />
      <div style={{ marginTop: "4px", fontFamily: FONTS.mono, fontSize: "9.5px", letterSpacing: "0.04em", color: "rgba(148,163,184,0.5)" }}>
        30-second preview · plays via Apple ·{" "}
        <a href={item.previewPage} target="_blank" rel="noreferrer" style={{ color: "rgba(148,163,184,0.6)", textDecoration: "none" }}>
          apple music ↗
        </a>
      </div>
    </div>
  );
}

// Media-correction lane (Tony's spec, 2026-08-10): an explicit "wrong
// media?" link under the asset — a DIFFERENT lane than "Know a source?
// Add it" (that's citations). The modal asks for specificity: wrong
// artist/right work, wrong work/right artist, or both wrong, plus an
// optional link to the correct media. Lands in the curator queue as
// kind=media_flag; assets get re-verified, never prose-patched.
const SPECIFICITY_OPTIONS = [
  ["wrong_artist", "wrong artist, right work"],
  ["wrong_work", "wrong work, right artist"],
  ["both_wrong", "both are wrong"],
];

export function MediaFlag({ subjectName, item, mediaKind }) {
  const [open, setOpen] = useState(false);
  const [specificity, setSpecificity] = useState(null);
  const [link, setLink] = useState("");
  const [state, setState] = useState(null); // null | "sending" | "done" | "error"
  if (!subjectName) return null;

  async function submit() {
    if (!specificity) return;
    setState("sending");
    try {
      const res = await fetch("/api/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "media_flag",
          subject: { name: subjectName },
          item: { title: item.title, creator: item.creator, slotType: item.slotType },
          mediaKind,
          specificity,
          url: link.trim() || undefined,
        }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  const mono = { fontFamily: FONTS.mono, fontSize: "9.5px", letterSpacing: "0.05em", textTransform: "uppercase" };
  if (state === "done") {
    return <div style={{ ...mono, marginTop: "4px", color: "rgba(52,211,153,0.7)" }}>✓ media flagged — the curator will re-verify</div>;
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ ...mono, background: "none", border: "none", cursor: "pointer", padding: "2px 0", color: "rgba(148,163,184,0.45)", marginTop: "2px" }}>
        ⚑ wrong media?
      </button>
    );
  }
  return (
    <div style={{ marginTop: "8px", padding: "12px", borderRadius: "8px", border: "1px solid rgba(148,163,184,0.25)", background: "rgba(0,0,0,0.35)" }}>
      <div style={{ ...mono, color: "rgba(226,232,240,0.75)", marginBottom: "8px" }}>what's wrong with this {mediaKind}?</div>
      {SPECIFICITY_OPTIONS.map(([id, label]) => (
        <label key={id} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", cursor: "pointer", fontFamily: FONTS.mono, fontSize: "11px", color: specificity === id ? "rgba(52,211,153,0.9)" : "rgba(148,163,184,0.75)" }}>
          <input type="radio" name={`media-flag-${item.title}`} checked={specificity === id} onChange={() => setSpecificity(id)} />
          {label}
        </label>
      ))}
      <input type="url" placeholder="link to the correct media (optional)" value={link} onChange={(e) => setLink(e.target.value)}
        style={{ width: "100%", marginTop: "6px", padding: "6px 8px", borderRadius: "5px", border: "1px solid rgba(148,163,184,0.25)", background: "rgba(0,0,0,0.4)", color: "rgba(226,232,240,0.85)", fontFamily: FONTS.mono, fontSize: "11px" }} />
      <div style={{ display: "flex", gap: "10px", marginTop: "10px", alignItems: "center" }}>
        <button onClick={submit} disabled={!specificity || state === "sending"}
          style={{ ...mono, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.35)", borderRadius: "5px", padding: "5px 12px", cursor: specificity ? "pointer" : "default", color: specificity ? "rgba(52,211,153,0.9)" : "rgba(148,163,184,0.4)" }}>
          {state === "sending" ? "sending..." : "flag it"}
        </button>
        <button onClick={() => setOpen(false)} style={{ ...mono, background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.5)" }}>cancel</button>
        {state === "error" && <span style={{ ...mono, color: "rgba(248,113,113,0.8)" }}>failed — try again</span>}
      </div>
    </div>
  );
}

export function InlineMedia({ url, title, cta = "watch here" }) {
  const [playing, setPlaying] = useState(false);
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = `media_${Math.random().toString(36).slice(2)}`;
  useEffect(() => {
    if (!playing) return;
    const onOtherPlay = (e) => { if (e.detail !== idRef.current) setPlaying(false); };
    window.addEventListener("kynda-media-play", onOtherPlay);
    return () => window.removeEventListener("kynda-media-play", onOtherPlay);
  }, [playing]);
  const embed = parseEmbed(url);
  if (!embed) return null;
  function start() {
    window.dispatchEvent(new CustomEvent("kynda-media-play", { detail: idRef.current }));
    setPlaying(true);
  }
  if (!playing) {
    return (
      <button onClick={start}
        aria-label={`Play ${title} inline via ${embed.provider}`}
        style={{
          marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "8px",
          background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.3)",
          borderRadius: "6px", padding: "7px 14px", cursor: "pointer",
          fontFamily: FONTS.mono, fontSize: "10.5px", letterSpacing: "0.06em",
          textTransform: "uppercase", color: "rgba(52,211,153,0.9)",
        }}>
        ▶ {cta} <span style={{ color: "rgba(148,163,184,0.5)", textTransform: "none" }}>· plays via {embed.provider}, views credit the source</span>
      </button>
    );
  }
  return (
    <div style={{ marginTop: "12px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "6px" }}>
        <button onClick={() => setPlaying(false)}
          aria-label={`Collapse the ${embed.provider} player`}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
            fontFamily: FONTS.mono, fontSize: "9.5px", letterSpacing: "0.06em",
            textTransform: "uppercase", color: "rgba(148,163,184,0.55)",
          }}>
          ✕ collapse
        </button>
      </div>
      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(148,163,184,0.18)", background: "#000" }}>
        <iframe src={embed.src} title={title} loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
      </div>
    </div>
  );
}
