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
  // Spotify's official embed: anonymous listeners get a 30s preview,
  // logged-in users the full track; plays credit the artist on-platform.
  m = url.match(/open\.spotify\.com\/(track|album|episode)\/([A-Za-z0-9]+)/);
  if (m) return { provider: "Spotify", src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, credit: "listen on Spotify", height: m[1] === "track" ? 152 : 352, verb: "listen" };
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
        {/fair use/i.test(item.imageLicense || "") ? (
          <>image via {item.imageCredit} — displayed under a good-faith fair-use assessment; rights owner? flag it below and we respond promptly ·{" "}
          <a href={item.imagePage} target="_blank" rel="noreferrer" style={{ color: "rgba(148,163,184,0.6)", textDecoration: "none" }}>source ↗</a></>
        ) : (
          <>image: {item.imageCredit} · {item.imageLicense} ·{" "}
          <a href={item.imagePage} target="_blank" rel="noreferrer" style={{ color: "rgba(148,163,184,0.6)", textDecoration: "none" }}>commons ↗</a></>
        )}
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
  ["better", "both are right — I have better media to offer"],
];

export function MediaFlag({ subjectName, item, mediaKind }) {
  const [open, setOpen] = useState(false);
  const [specificity, setSpecificity] = useState(null);
  const [link, setLink] = useState("");
  const [state, setState] = useState(null); // null | "sending" | "done" | "error"
  if (!subjectName) return null;

  const linkRequired = specificity === "better";
  async function submit() {
    if (!specificity) return;
    if (linkRequired && !/^https?:\/\//.test(link.trim())) return;
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
      <input type="url" placeholder={linkRequired ? "link to the better media (required)" : "link to the correct media (optional)"} value={link} onChange={(e) => setLink(e.target.value)}
        style={{ width: "100%", marginTop: "6px", padding: "6px 8px", borderRadius: "5px", border: "1px solid rgba(148,163,184,0.25)", background: "rgba(0,0,0,0.4)", color: "rgba(226,232,240,0.85)", fontFamily: FONTS.mono, fontSize: "11px" }} />
      <div style={{ display: "flex", gap: "10px", marginTop: "10px", alignItems: "center" }}>
        <button onClick={submit} disabled={!specificity || state === "sending" || (linkRequired && !/^https?:\/\//.test(link.trim()))}
          style={{ ...mono, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.35)", borderRadius: "5px", padding: "5px 12px", cursor: specificity && (!linkRequired || /^https?:\/\//.test(link.trim())) ? "pointer" : "default", color: specificity && (!linkRequired || /^https?:\/\//.test(link.trim())) ? "rgba(52,211,153,0.9)" : "rgba(148,163,184,0.4)" }}>
          {state === "sending" ? "sending..." : specificity === "better" ? "offer it" : "flag it"}
        </button>
        <button onClick={() => setOpen(false)} style={{ ...mono, background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.5)" }}>cancel</button>
        {state === "error" && <span style={{ ...mono, color: "rgba(248,113,113,0.8)" }}>failed — try again</span>}
      </div>
    </div>
  );
}

// Suggest-media lane (Tony QA, 2026-08-10, Ronchamp): cards with NO media
// need an affordance too — "+ suggest media" takes a link (required) and
// lands in the same curator queue; the admin apply button makes it a door.
export function SuggestMedia({ subjectName, item }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [state, setState] = useState(null);
  if (!subjectName) return null;

  async function submit() {
    if (!/^https?:\/\//.test(link.trim())) return;
    setState("sending");
    try {
      const res = await fetch("/api/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "media_flag",
          subject: { name: subjectName },
          item: { title: item.title, creator: item.creator, slotType: item.slotType },
          mediaKind: "embed",
          specificity: "missing",
          url: link.trim(),
        }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  const mono = { fontFamily: FONTS.mono, fontSize: "9.5px", letterSpacing: "0.05em", textTransform: "uppercase" };
  if (state === "done") {
    return <div style={{ ...mono, marginTop: "4px", color: "rgba(52,211,153,0.7)" }}>✓ suggestion sent — the curator will review</div>;
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ ...mono, background: "none", border: "none", cursor: "pointer", padding: "2px 0", color: "rgba(148,163,184,0.45)", marginTop: "2px" }}>
        + suggest media for this card
      </button>
    );
  }
  const valid = /^https?:\/\//.test(link.trim());
  return (
    <div style={{ marginTop: "8px", padding: "12px", borderRadius: "8px", border: "1px solid rgba(148,163,184,0.25)", background: "rgba(0,0,0,0.35)" }}>
      <div style={{ ...mono, color: "rgba(226,232,240,0.75)", marginBottom: "8px" }}>link to media for this card (image, video, or track)</div>
      <input type="url" placeholder="https://..." value={link} onChange={(e) => setLink(e.target.value)}
        style={{ width: "100%", padding: "6px 8px", borderRadius: "5px", border: "1px solid rgba(148,163,184,0.25)", background: "rgba(0,0,0,0.4)", color: "rgba(226,232,240,0.85)", fontFamily: FONTS.mono, fontSize: "11px" }} />
      <div style={{ display: "flex", gap: "10px", marginTop: "10px", alignItems: "center" }}>
        <button onClick={submit} disabled={!valid || state === "sending"}
          style={{ ...mono, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.35)", borderRadius: "5px", padding: "5px 12px", cursor: valid ? "pointer" : "default", color: valid ? "rgba(52,211,153,0.9)" : "rgba(148,163,184,0.4)" }}>
          {state === "sending" ? "sending..." : "suggest it"}
        </button>
        <button onClick={() => setOpen(false)} style={{ ...mono, background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.5)" }}>cancel</button>
        {state === "error" && <span style={{ ...mono, color: "rgba(248,113,113,0.8)" }}>failed — try again</span>}
      </div>
    </div>
  );
}

// Timestamp report (Tony QA, 2026-08-10): estimates were falsified, so
// timecodes come only from humans who watched the tape. A tiny affordance
// on playable receipts: "know the timestamp?" → mm:ss → curator queue.
export function TimestampReport({ subjectName, item, citation }) {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("");
  const [state, setState] = useState(null);
  if (!subjectName || citation.timestamp || !parseEmbed(citation.url)) return null;
  const valid = /^\d{1,2}:\d{2}(:\d{2})?$/.test(time.trim());

  async function submit() {
    if (!valid) return;
    setState("sending");
    try {
      const res = await fetch("/api/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "media_flag",
          subject: { name: subjectName },
          item: { title: item.title, creator: item.creator, slotType: item.slotType },
          mediaKind: "embed",
          specificity: "timestamp",
          url: citation.url,
          comment: `quote at ${time.trim()}`,
        }),
      });
      setState(res.ok ? "done" : "error");
    } catch { setState("error"); }
  }

  const mono = { fontFamily: FONTS.mono, fontSize: "9px", letterSpacing: "0.05em", textTransform: "uppercase" };
  if (state === "done") return <span style={{ ...mono, marginLeft: "8px", color: "rgba(52,211,153,0.7)" }}>✓ noted — thank you</span>;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ ...mono, background: "none", border: "none", cursor: "pointer", padding: 0, marginLeft: "8px", color: "rgba(148,163,184,0.4)" }}>
        ⏱ know the timestamp?
      </button>
    );
  }
  return (
    <span style={{ marginLeft: "8px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="mm:ss" size={6}
        style={{ padding: "2px 6px", borderRadius: "4px", border: "1px solid rgba(148,163,184,0.3)", background: "rgba(0,0,0,0.4)", color: "rgba(226,232,240,0.85)", fontFamily: FONTS.mono, fontSize: "10px", width: "56px" }} />
      <button onClick={submit} disabled={!valid || state === "sending"}
        style={{ ...mono, background: "none", border: "1px solid rgba(52,211,153,0.35)", borderRadius: "4px", padding: "2px 8px", cursor: valid ? "pointer" : "default", color: valid ? "rgba(52,211,153,0.9)" : "rgba(148,163,184,0.4)" }}>
        {state === "sending" ? "…" : "send"}
      </button>
      <button onClick={() => setOpen(false)} style={{ ...mono, background: "none", border: "none", cursor: "pointer", color: "rgba(148,163,184,0.45)" }}>✕</button>
    </span>
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
        ▶ {cta === "watch here" && embed.verb === "listen" ? "listen here" : cta} <span style={{ color: "rgba(148,163,184,0.5)", textTransform: "none" }}>· plays via {embed.provider}, views credit the source</span>
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
      <div style={embed.height
        ? { borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(148,163,184,0.18)" }
        : { position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(148,163,184,0.18)", background: "#000" }}>
        <iframe src={embed.src} title={title} loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen
          style={embed.height
            ? { width: "100%", height: `${embed.height}px`, border: 0, display: "block" }
            : { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
      </div>
    </div>
  );
}
