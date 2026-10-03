"use client";

// Influence map (2026-10-01) — the first tab of a subject page. React owns
// this markup; the engine owns the SVG, the canvas and every interaction
// (AD-04). Full-bleed: the panel breaks out of the 880px reading column.

import { useEffect, useRef } from "react";
import { createInfluenceMap } from "./engine.js";

async function fetchGraph(name) {
  const res = await fetch("/api/graph", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject: { name } }),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("graph failed");
  return res.json();
}

export default function InfluenceMap({ subjectName, subjectBio, graph, onOpenSubject, onCenter = null, controlRef = null, status, waiting = true, sealed = false, alternatives = [], onPickAlternative = null }) {
  const rootRef = useRef(null);
  const openRef = useRef(onOpenSubject);
  openRef.current = onOpenSubject;
  const centerRef = useRef(onCenter);
  centerRef.current = onCenter;
  const altRef = useRef({ list: alternatives, pick: onPickAlternative });
  altRef.current = { list: alternatives, pick: onPickAlternative };
  const mapRef = useRef(null);

  useEffect(() => {
    if (!rootRef.current || !graph) return;
    // Admin mode: signed in at /admin in this browser → curate pictures right on the map.
    // Sealed maps (public demo pages) never travel and never show admin controls.
    let adminToken = null;
    if (!sealed) { try { adminToken = localStorage.getItem("kynda_admin_token"); } catch { /* storage blocked */ } }
    const map = createInfluenceMap(rootRef.current, {
      adminToken,
      subjectName,
      subjectBio,
      initialGraph: graph,
      fetchGraph: sealed ? null : fetchGraph,
      onOpenSubject: onOpenSubject && !sealed ? (name) => openRef.current?.(name) : null,
      onCenter: onCenter && !sealed ? (name, g, opts) => centerRef.current?.(name, g, opts) : null,
      getAlternatives: () => altRef.current.list,
      onAlternative: sealed ? null : (i) => altRef.current.pick?.(i),
    });
    mapRef.current = map;
    if (controlRef) controlRef.current = map;
    return () => { if (controlRef?.current === map) controlRef.current = null; map.destroy(); };
    // A new subject is a new map; the same subject's graph object refreshing is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectName, !!graph]);
  // An ambiguous search's other matches can arrive after the map is up.
  const altKey = alternatives.map((a) => a.name).join("|");
  useEffect(() => { mapRef.current?.refreshAbout?.(); }, [altKey]);

  return (
    <div className="kmap" ref={rootRef}>
      <style>{CSS}</style>
      <div className="stage" data-k="stage">
        <canvas className="web" data-k="web" aria-hidden="true" />
        <svg className="map" data-k="map" role="img" aria-label={`Influence map for ${subjectName}`} />
        {/* Mix (the curated picks) or the full map; hidden when a map has too few mix picks. */}
        <div className="viewtoggle" data-k="viewtoggle" role="group" aria-label="What the map shows" hidden>
          <button data-view="mix" aria-pressed="false" title="Only the KyndaMix picks — the curated story">Mix</button>
          <button data-view="full" aria-pressed="false" title="Every documented connection">Full map</button>
        </div>
        {/* The trail only appears once you've travelled — before that it would just repeat the page title. */}
        <div className="trailbox" data-k="trailbox" hidden>
          <nav className="trail" data-k="trail" aria-label="Your path" />
          <button className="openpage" data-k="openpage" hidden />
        </div>
        <div className="menu">
          <button className="burger" data-k="recenter" aria-label="Center the map" title="Center the map">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="5" /><circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" /><path d="M8 1v2.2M8 12.8V15M1 8h2.2M12.8 8H15" /></svg>
          </button>
          <button className="burger" data-k="menubtn" aria-haspopup="true" aria-expanded="false" aria-label="Map options" title="Map options">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 4.5h10M3 8h10M3 11.5h10" /></svg>
          </button>
          <div className="menupanel" data-k="menupanel" hidden>
            <button data-k="pics" aria-pressed="false">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5" /><circle cx="6" cy="7" r="1.3" /><path d="M3 12l3.5-3.5 2.5 2.5 2-2 2.5 2.5" /></svg>
              <span>Pictures</span><i className="check" aria-hidden="true">✓</i>
            </button>
            <button data-k="motion" aria-pressed="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1.5 9c2-3 3.5-3 5.5 0s3.5 3 5.5 0 2.5-1.5 2.5-1.5" /><path d="M1.5 5.5c2-2 3.5-2 5.5 0" opacity=".5" /></svg>
              <span>Motion</span><i className="check" aria-hidden="true">✓</i>
            </button>
            <button data-k="replay">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8a5 5 0 1 0 1.5-3.5" /><path d="M3 2.5V5h2.5" /></svg>
              <span>Replay the build</span>
            </button>
            <button data-k="share">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 10V2.5M5 5l3-3 3 3" /><path d="M3.5 8.5v5h9v-5" /></svg>
              <span>Share link</span>
            </button>
            <a data-k="pdf" href="#" target="_blank" rel="noreferrer">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 2.5h5.5L12 5v8.5H4z" /><path d="M6 8.5h4M6 11h4" /></svg>
              <span>Printable PDF</span>
            </a>
            <button data-k="copy">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="5" width="8.5" height="8.5" rx="1.5" /><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" /></svg>
              <span>Copy path</span>
            </button>
            <div className="legal"><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></div>
          </div>
        </div>
        <button className="keybtn" data-k="keybtn" aria-expanded="false">Key</button>
        <div className="legend" data-k="legend">
          <span className="count" data-k="count" />
          <span><i style={{ background: "var(--pred)" }} />Influences</span>
          <span><i style={{ background: "var(--peer)" }} />Peers &amp; partners</span>
          <span><i style={{ background: "var(--succ)" }} />Successors</span>
          <span className="mixkey" data-k="mixkey" />
        </div>
        <div className="hint" data-k="hint">Hover for the evidence (or the center for a bio) · click to travel · drag a bubble to tug it · scroll to zoom</div>
        {/* Docked details panel: right on desktop, bottom on narrow screens; drag its edge to resize. */}
        <aside className="card" data-k="card" aria-label="Details">
          <div className="grip" data-k="grip" role="separator" tabIndex={0} aria-label="Resize the details panel (arrow keys)" />
          <div className="cardbody" data-k="cardbody" aria-live="polite" />
        </aside>
        <div className="toast" data-k="toast" />
        <aside className="curator" data-k="curator" aria-label="Picture curation" hidden />
        <div className="adminbadge" data-k="adminbadge" hidden>Curator</div>
        {!graph && (
          <div className="loading" role="status">
            {waiting && <i className="pulse" aria-hidden="true" />}{status}
          </div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.kmap {
  --bg: #0f1016; --surface: #161821; --surface-2: #1c1f2b; --line: rgba(148,163,184,0.16);
  --fg: #e2e8f0; --muted: rgba(148,163,184,0.7); --faint: rgba(148,163,184,0.42); --gold: #facc15;
  --pred: #a8c8d8; --peer: #e04040; --succ: #8844cc;
  --display: 'Instrument Serif', Georgia, serif; --body: 'DM Sans', system-ui, sans-serif; --mono: 'DM Mono', ui-monospace, Menlo, monospace;
  position: relative; box-sizing: border-box; width: 100vw; margin-left: calc(50% - 50vw); /* border inside the height: no 1px scroll */
  /* Everything under the 48px subject bar: the map is the page. */
  /* dvh: the screen's current visible height. svh (the smallest it gets) left the page below peeking
     in under the map on phones, reading as the bio card overlapping the panel. svh is the fallback. */
  height: max(420px, calc(100svh - 48px)); height: max(420px, calc(100dvh - 48px)); display: flex; flex-direction: column;
  background: var(--bg); color: var(--fg); font-family: var(--body);
  border-bottom: 1px solid var(--line);
}
.kmap .viewtoggle { position: absolute; top: 10px; left: max(16px, calc(50vw - 600px)); z-index: 3; display: inline-flex; padding: 3px; gap: 2px; border: 1px solid var(--line); border-radius: 17px; background: rgba(22,24,33,0.85); }
.kmap .viewtoggle[hidden] { display: none; }
.kmap .viewtoggle button { height: 26px; padding: 0 12px; border: 0; border-radius: 13px; background: none; color: var(--muted); font-family: var(--mono); font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
.kmap .viewtoggle button span { opacity: 0.7; margin-left: 4px; }
.kmap .viewtoggle button:hover { color: var(--fg); }
.kmap .viewtoggle button[aria-pressed="true"] { background: var(--gold); color: var(--bg); }
.kmap .viewtoggle button[aria-pressed="true"] span { opacity: 0.75; }
.kmap .viewtoggle button:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.kmap .trailbox { position: absolute; top: 50px; left: max(16px, calc(50vw - 600px)); right: 116px; z-index: 3; display: flex; align-items: center; gap: 10px; min-width: 0; }
.kmap .trailbox[hidden] { display: none; }
.kmap .trail { min-width: 0; display: flex; align-items: center; gap: 4px; overflow-x: auto; scrollbar-width: none; font-family: var(--mono); font-size: 0.72rem; background: rgba(15,16,22,0.82); border: 1px solid var(--line); border-radius: 14px; padding: 2px 6px; }
.kmap .trail::-webkit-scrollbar { display: none; }
.kmap .trail button { flex: none; background: none; border: 0; padding: 3px 5px; border-radius: 4px; color: var(--muted); font: inherit; cursor: pointer; white-space: nowrap; }
.kmap .trail button:hover { color: var(--fg); background: var(--surface-2); }
.kmap .trail button[aria-current="true"] { color: var(--gold); }
.kmap .trail .sep { color: var(--faint); flex: none; }

.kmap .menu { position: absolute; top: 10px; right: max(16px, calc(50vw - 600px)); z-index: 4; display: flex; gap: 8px; }
.kmap .burger { width: 34px; height: 34px; border-radius: 17px; border: 1px solid var(--line); background: rgba(22,24,33,0.85); color: var(--muted); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.kmap .burger:hover, .kmap .burger[aria-expanded="true"] { color: var(--fg); border-color: rgba(148,163,184,0.4); }
.kmap .burger svg { width: 16px; height: 16px; }
.kmap .menupanel { position: absolute; top: 42px; right: 0; min-width: 190px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 14px 40px rgba(0,0,0,.5); padding: 6px; display: flex; flex-direction: column; }
.kmap .menupanel[hidden] { display: none; }
.kmap .menupanel button { display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: 0; border-radius: 6px; padding: 9px 10px; color: var(--fg); font-family: var(--body); font-size: 0.84rem; text-align: left; cursor: pointer; }
.kmap .menupanel button:hover, .kmap .menupanel > a:hover { background: var(--surface-2); }
.kmap .menupanel > a { display: flex; align-items: center; gap: 10px; border-radius: 6px; padding: 9px 10px; color: var(--fg); font-family: var(--body); font-size: 0.84rem; text-decoration: none; }
.kmap .menupanel > a[hidden] { display: none; }
.kmap .menupanel .legal { margin-top: 4px; padding: 8px 10px 4px; border-top: 1px solid var(--line); font-family: var(--mono); font-size: 0.64rem; color: var(--faint); }
.kmap .menupanel .legal a { color: var(--muted); text-decoration: none; }
.kmap .menupanel .legal a:hover { color: var(--fg); }
.kmap .card .alts { margin-top: 18px; padding-top: 12px; border-top: 1px solid var(--line); display: grid; gap: 8px; }
.kmap .card .alts .kind { color: var(--muted); }
.kmap .card .alts button { text-align: left; background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 9px 12px; color: var(--fg); cursor: pointer; font-family: var(--body); font-size: 0.84rem; display: grid; gap: 2px; }
.kmap .card .alts button span { color: var(--muted); font-size: 0.76rem; }
.kmap .card .alts button:hover { border-color: var(--gold); }
.kmap .menupanel svg { width: 15px; height: 15px; color: var(--muted); flex: none; }
.kmap .menupanel .check { margin-left: auto; font-style: normal; color: var(--gold); visibility: hidden; }
.kmap .menupanel [aria-pressed="true"] .check { visibility: visible; }
.kmap .burger:focus-visible, .kmap .menupanel button:focus-visible, .kmap .trail button:focus-visible, .kmap .card a:focus-visible, .kmap .card button:focus-visible, .kmap .openpage:focus-visible, .kmap .keybtn:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

.kmap .stage { position: relative; flex: 1; min-height: 0; overflow: hidden; }
.kmap .web { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none;
  -webkit-mask-image: radial-gradient(ellipse 60% 55% at 50% 52%, rgba(0,0,0,.5) 0%, #000 85%);
          mask-image: radial-gradient(ellipse 60% 55% at 50% 52%, rgba(0,0,0,.5) 0%, #000 85%); }
.kmap .map { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
.kmap .map:active { cursor: grabbing; }

.kmap .legend { position: absolute; left: max(20px, calc(50vw - 600px)); bottom: 16px; display: flex; flex-wrap: wrap; gap: 6px 16px; font-family: var(--mono); font-size: 0.64rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); pointer-events: none; }
.kmap .legend span { display: inline-flex; align-items: center; gap: 6px; }
.kmap .legend i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.kmap .legend .mixkey { display: inline-flex; flex-wrap: wrap; gap: 6px 14px; }
.kmap .legend .mixkey:empty { display: none; }
.kmap .legend .ringdot { width: 9px; height: 9px; background: none; border: 2px solid; box-sizing: border-box; }
.kmap .legend .mixkey b { font-weight: 500; color: var(--fg); }
.kmap .keybtn { display: none; position: absolute; left: 16px; bottom: 16px; z-index: 2; height: 30px; padding: 0 12px; border-radius: 15px; border: 1px solid var(--line); background: var(--surface); color: var(--muted); font-family: var(--mono); font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; }
.kmap .legend .count { color: var(--faint); text-transform: none; letter-spacing: 0; font-variant-numeric: tabular-nums; }
.kmap .hint { position: absolute; right: max(20px, calc(50vw - 600px)); bottom: 16px; font-family: var(--mono); font-size: 0.64rem; color: var(--faint); text-align: right; pointer-events: none; }

.kmap .openpage { flex: none; white-space: nowrap; background: var(--surface); border: 1px solid var(--line); color: var(--fg); border-radius: 14px; padding: 5px 12px; font-family: var(--mono); font-size: 0.68rem; cursor: pointer; }
.kmap .openpage:hover { border-color: var(--gold); color: var(--gold); }

.kmap .node { cursor: pointer; }
.kmap .node:active { cursor: grabbing; }
.kmap .node.center { cursor: grab; }
.kmap .node .disc { transition: fill-opacity .25s; }
.kmap .node .ring { fill: none; }
.kmap .node .pic { opacity: 0; transition: opacity .35s; pointer-events: none; }
.kmap .pics-on .node .pic { opacity: 1; }
.kmap .node.center .pic { opacity: 1; }
.kmap .node.center.has-pic .ring { stroke-width: 2px; stroke-opacity: 0.9; }
.kmap .pics-on .node.has-pic .ring { stroke-width: 2.5px; stroke-opacity: 1; }
.kmap .pics-on .node.wide .disc, .kmap .node.center.wide .disc { fill: #1c1f2b; fill-opacity: 1; } /* dark backing for wide pictures */
.kmap .node .initials { font-family: var(--mono); font-size: 10px; fill: var(--bg); text-anchor: middle; dominant-baseline: central; pointer-events: none; transition: opacity .3s; }
.kmap .node.center .initials { display: none; }
.kmap .pics-on .node.has-pic .initials { opacity: 0; }
.kmap .node .label { font-family: var(--body); font-size: 11px; fill: rgba(226,232,240,0.86); text-anchor: middle; paint-order: stroke; stroke: var(--bg); stroke-width: 4px; stroke-linejoin: round; } /* a bubble's name is part of its tap target */
.kmap .node.center .label { font-family: var(--display); font-size: 19px; fill: var(--fg); }
.kmap .node.mix .label { font-size: 12.5px; font-weight: 500; fill: var(--fg); }
.kmap .node:hover .disc, .kmap .node.hot .disc { fill-opacity: 1; }
.kmap .node.pressing .ring { stroke: var(--gold); stroke-width: 3px; stroke-opacity: 1; transition: stroke-width .3s; }
.kmap .node:focus { outline: none; }
.kmap .node:focus-visible .ring { stroke: var(--gold); stroke-width: 2.5; }
.kmap .edge { fill: none; }
.kmap .edge-hit { fill: none; stroke: transparent; stroke-width: 14; cursor: help; }

/* Docked details panel (2026-10-03): never covers the map; the camera frames what's left visible. */
.kmap .card { position: absolute; z-index: 5; box-sizing: border-box; background: var(--surface); visibility: hidden; transition: transform .35s cubic-bezier(.2,.7,.2,1), visibility 0s .35s; }
.kmap .card.open { visibility: visible; transform: none; transition: transform .35s cubic-bezier(.2,.7,.2,1), visibility 0s; }
.kmap[data-panel="right"] .card { top: 0; right: 0; bottom: 0; width: var(--panel-w, 380px); border-left: 1px solid var(--line); box-shadow: -12px 0 40px rgba(0,0,0,.35); transform: translateX(100%); }
.kmap[data-panel="bottom"] .card { left: 0; right: 0; bottom: 0; height: var(--panel-h, 42%); border-top: 1px solid var(--line); border-radius: 14px 14px 0 0; box-shadow: 0 -12px 40px rgba(0,0,0,.35); transform: translateY(100%); }
.kmap .card.open { transform: none; }
.kmap .cardbody { position: relative; height: 100%; overflow-y: auto; box-sizing: border-box; padding: 20px 24px 24px; }
.kmap[data-panel="bottom"] .cardbody { padding-top: 22px; }
.kmap .grip { position: absolute; z-index: 2; touch-action: none; }
.kmap[data-panel="right"] .grip { left: -5px; top: 0; bottom: 0; width: 10px; cursor: ew-resize; }
.kmap[data-panel="bottom"] .grip { top: -6px; left: 0; right: 0; height: 22px; cursor: ns-resize; }
.kmap .grip::after { content: ""; position: absolute; background: rgba(148,163,184,0.35); border-radius: 3px; transition: background .15s; }
.kmap[data-panel="right"] .grip::after { left: 4px; top: 50%; width: 3px; height: 44px; margin-top: -22px; }
.kmap[data-panel="bottom"] .grip::after { top: 12px; left: 50%; width: 44px; height: 4px; margin-left: -22px; }
.kmap .grip:hover::after, .kmap .grip:focus-visible::after { background: var(--gold); }
.kmap .grip:focus-visible { outline: none; }
/* Controls step out of the panel's way. */
.kmap.panel-open[data-panel="right"] .menu { right: calc(var(--panel-w, 380px) + 16px); }
.kmap.panel-open[data-panel="right"] .adminbadge { right: calc(var(--panel-w, 380px) + 102px); }
.kmap.panel-open[data-panel="right"] .trailbox { right: calc(var(--panel-w, 380px) + 116px); }
.kmap.panel-open[data-panel="right"] .legend { max-width: calc(100% - var(--panel-w, 380px) - 48px); }
.kmap.panel-open .hint { display: none; }
.kmap.panel-open[data-panel="bottom"] .keybtn { bottom: calc(var(--panel-h, 42%) + 14px); }
.kmap.panel-open[data-panel="bottom"] .legend { bottom: calc(var(--panel-h, 42%) + 14px); }
.kmap .node.hot .ring { stroke: var(--gold); stroke-width: 2.5px; stroke-opacity: 1; }
.kmap .edge.hot { stroke-opacity: 0.9; }
.kmap .card .kind { font-family: var(--mono); font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; }
.kmap .card h2 { margin: 6px 0 2px; font-family: var(--display); font-weight: 400; font-size: 1.35rem; line-height: 1.15; text-wrap: balance; }
.kmap .card .meta { font-family: var(--mono); font-size: 0.68rem; color: var(--muted); }
.kmap .card .summary.bio { font-size: 0.88rem; line-height: 1.6; }
.kmap .card .summary { margin: 10px 0 0; font-size: 0.84rem; line-height: 1.5; color: rgba(226,232,240,0.82); }
.kmap .card blockquote { margin: 12px 0 0; padding: 0 0 0 12px; border-left: 2px solid var(--line); font-family: var(--display); font-style: italic; font-size: 1.02rem; line-height: 1.45; color: var(--fg); }
.kmap .card blockquote.plain { font-style: normal; font-family: var(--body); font-size: .84rem; }
.kmap .card cite { display: block; margin-top: 6px; font-family: var(--mono); font-style: normal; font-size: 0.64rem; color: var(--faint); }
.kmap .card a { color: var(--muted); }
.kmap .card .foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--line); font-family: var(--mono); font-size: 0.64rem; color: var(--faint); }
.kmap .card .acts { display: flex; gap: 6px; }
.kmap .card .go, .kmap .card .open { background: none; border: 1px solid var(--line); color: var(--fg); border-radius: 12px; padding: 4px 10px; font: inherit; cursor: pointer; white-space: nowrap; }
.kmap .card .open { color: var(--muted); }
.kmap .card .go:hover, .kmap .card .open:hover { border-color: var(--gold); color: var(--gold); }
.kmap .card .request { margin-top: 14px; padding: 12px 14px; border: 1px solid rgba(250,204,21,0.25); border-radius: 10px; background: rgba(250,204,21,0.05); }
.kmap .card .request p { margin: 0 0 10px; font-size: 0.82rem; line-height: 1.5; color: var(--fg); }
.kmap .card .request .ask { background: rgba(250,204,21,0.12); border: 1px solid rgba(250,204,21,0.35); color: var(--gold); border-radius: 8px; padding: 7px 14px; font-family: var(--mono); font-size: 0.66rem; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }
.kmap .card .request .ask:disabled { cursor: default; opacity: 0.85; }
.kmap .card .request .err { margin-left: 10px; font-family: var(--mono); font-size: 0.64rem; color: rgba(248,113,113,0.85); }
.kmap .card .x { position: absolute; top: 10px; right: 12px; width: 30px; height: 30px; border: 0; background: none; color: var(--muted); font-size: 20px; cursor: pointer; border-radius: 15px; }
.kmap .card .x:hover { color: var(--fg); background: var(--surface-2); }
.kmap .card h2 { padding-right: 32px; }

.kmap .toast { position: absolute; left: 50%; top: 14px; transform: translate(-50%, -8px); background: var(--surface-2); border: 1px solid var(--line); padding: 8px 14px; border-radius: 8px; font-size: 0.8rem; color: var(--fg); opacity: 0; transition: opacity .2s, transform .2s; pointer-events: none; z-index: 6; max-width: calc(100% - 32px); text-align: center; }
.kmap .loading { position: absolute; inset: 0; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 10px; font-family: var(--mono); font-size: 0.74rem; color: var(--muted); pointer-events: none; }
.kmap .loading .pulse { width: 7px; height: 7px; border-radius: 50%; background: var(--gold); animation: kmapPulse 1.4s ease-in-out infinite; }
@keyframes kmapPulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .kmap .loading .pulse { animation: none; } }
.kmap .card .via { margin-top: 8px; font-family: var(--mono); font-size: 0.66rem; letter-spacing: 0.03em; color: var(--muted); line-height: 1.5; }
.kmap .card .via i { font-family: 'Instrument Serif', serif; font-style: italic; letter-spacing: 0; font-size: 0.78rem; }
.kmap .card .credit { margin-top: 10px; font-family: var(--mono); font-size: 0.6rem; color: var(--faint); line-height: 1.5; }
.kmap .card .credit a { color: var(--faint); text-decoration: none; }
.kmap .card .credit a:hover { color: var(--muted); }
.kmap .card .fix { background: none; border: 1px solid rgba(250,204,21,0.35); color: var(--gold); border-radius: 12px; padding: 4px 10px; font: inherit; cursor: pointer; white-space: nowrap; }
.kmap .adminbadge { position: absolute; top: 18px; right: calc(max(16px, calc(50vw - 600px)) + 86px); z-index: 4; font-family: var(--mono); font-size: 0.58rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gold); border: 1px solid rgba(250,204,21,0.35); border-radius: 10px; padding: 2px 8px; pointer-events: none; }
.kmap .adminbadge[hidden] { display: none; }

/* Curator panel: slides over the right edge of the map. */
.kmap .curator { position: absolute; top: 0; right: 0; bottom: 0; width: min(440px, 100%); z-index: 7; box-sizing: border-box; overflow-y: auto; background: var(--surface); border-left: 1px solid var(--line); box-shadow: -18px 0 50px rgba(0,0,0,.45); padding: 18px 20px 28px; }
.kmap .curator[hidden] { display: none; }
.kmap .curator.busy { cursor: progress; }
.kmap .curator.busy button { pointer-events: none; opacity: .6; }
.kmap .curator .ch { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.kmap .curator .kind { font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gold); }
.kmap .curator h3 { margin: 4px 0 2px; font-family: var(--display); font-weight: 400; font-size: 1.5rem; line-height: 1.1; }
.kmap .curator .meta { font-family: var(--mono); font-size: 0.66rem; color: var(--muted); }
.kmap .curator .x { width: 30px; height: 30px; border: 0; background: none; color: var(--muted); font-size: 20px; cursor: pointer; flex: none; }
.kmap .curator .ctx { margin: 12px 0 0; font-size: 0.8rem; line-height: 1.5; color: rgba(226,232,240,0.7); }
.kmap .curator .sec { margin: 20px 0 8px; font-family: var(--mono); font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); display: flex; gap: 8px; }
.kmap .curator .sec span { color: var(--faint); }
.kmap .curator .cur { display: flex; gap: 14px; align-items: flex-start; }
.kmap .curator .cur img { width: 96px; height: 96px; object-fit: cover; border-radius: 50%; border: 2px solid var(--line); flex: none; background: var(--surface-2); }
.kmap .curator .lic { font-family: var(--mono); font-size: 0.62rem; color: var(--muted); line-height: 1.5; }
.kmap .curator .lic.fu { color: #fbbf24; }
.kmap .curator .src { font-size: 0.76rem; color: rgba(226,232,240,0.75); margin-top: 4px; }
.kmap .curator a { font-family: var(--mono); font-size: 0.62rem; color: var(--muted); }
.kmap .curator .row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.kmap .curator button { font-family: var(--mono); font-size: 0.66rem; }
.kmap .curator .row button, .kmap .curator figure button, .kmap .curator form button { background: none; border: 1px solid var(--line); color: var(--fg); border-radius: 12px; padding: 5px 11px; cursor: pointer; }
.kmap .curator .row button:hover, .kmap .curator form button:hover { border-color: rgba(148,163,184,0.45); }
.kmap .curator figure button { border-color: rgba(250,204,21,0.4); color: var(--gold); margin-top: auto; }
.kmap .curator figure button:hover { background: rgba(250,204,21,0.08); }
.kmap .curator .link { background: none; border: 0; color: var(--gold); text-decoration: underline; cursor: pointer; padding: 0; }
.kmap .curator .empty { font-size: 0.8rem; color: var(--muted); margin: 0; }
.kmap .curator .status { margin: 0 0 8px; min-height: 1em; font-family: var(--mono); font-size: 0.66rem; color: var(--muted); }
.kmap .curator .status:empty { display: none; }
.kmap .curator .status.bad { color: #f87171; }
.kmap .curator .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.kmap .curator figure { margin: 0; display: flex; flex-direction: column; gap: 6px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 8px; min-width: 0; }
.kmap .curator figure img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; display: block; background: var(--bg); }
.kmap .curator img { object-position: 50% 0%; } /* top crop: heads and titles stay in frame */
.kmap .curator figcaption { display: flex; flex-direction: column; gap: 3px; font-size: 0.72rem; line-height: 1.35; min-width: 0; overflow-wrap: anywhere; }
.kmap .curator figcaption b { font-weight: 500; }
.kmap .curator figcaption span { color: var(--muted); }
.kmap .curator form { display: flex; gap: 8px; margin-top: 14px; }
.kmap .curator input { flex: 1; min-width: 0; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; color: var(--fg); font-family: var(--body); font-size: 0.8rem; outline: none; }
.kmap .curator input:focus { border-color: rgba(250,204,21,0.45); }
.kmap .curator button:focus-visible, .kmap .curator a:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.kmap .toast.show { opacity: 1; transform: translate(-50%, 0); }

html:has(.kmap) { overflow-x: clip; }
@media (max-width: 1240px) { .kmap .hint { display: none; } }
/* Desktop (Tony, 2026-10-03): no ring-colour key row; the trail runs along the bottom where it was,
   with the one-line legend just above it. Phones keep the trail on top and the full key behind "Key". */
@media (min-width: 641px) {
  .kmap .legend .mixkey { display: none; }
  .kmap .trailbox { top: auto; bottom: 12px; right: auto; max-width: calc(100% - 48px); }
  .kmap.panel-open[data-panel="right"] .trailbox { right: auto; max-width: calc(100% - var(--panel-w, 380px) - 48px); }
  .kmap.has-trail .legend { bottom: 56px; }
}
@media (max-width: 640px) {
  .kmap { height: max(380px, calc(100svh - 48px)); height: max(380px, calc(100dvh - 48px)); }
  .kmap .keybtn { display: inline-flex; }
  .kmap .legend { display: none; flex-direction: column; gap: 8px; left: 16px; bottom: 56px; font-size: 0.62rem; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; z-index: 2; pointer-events: auto; }
  .kmap .legend.open { display: flex; }
  .kmap .legend .mixkey { flex-direction: column; gap: 8px; }
  .kmap .trailbox { left: 12px; right: 100px; }
  .kmap .menu { right: 12px; }
}
`;
