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
