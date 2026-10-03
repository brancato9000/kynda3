"use client";

// Discover home (2026-10-03). Each category card holds a photo for a few
// seconds under a Ken Burns drift, then the next photo fades in behind a
// soft edge that wipes left to right. (Tony tried a graph-constellation
// hand-off, a bezier swoop and a fragmenting swell first; all overkill.)
// prefers-reduced-motion gets a plain crossfade.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FONTS, BASE } from "../../src/design/tokens.js";
import Wordmark from "../../src/design/wordmark.jsx";

// ?pace=1.5 slows everything by half again (a dial for tuning by eye).
const PACE = typeof window !== "undefined" ? Number(new URLSearchParams(window.location.search).get("pace")) || 1 : 1;
const HOLD = 5600 * PACE;   // ms a feature stays up
const TRANS = 1300 * PACE;  // ms for the wipe
const STAGGER = 1700 * PACE; // ms between neighbouring cards' first turns

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const initials = (s) => s.replace(/^(The|A|An) /, "").split(/\s+/).filter((w) => /^[A-Z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join("") || s[0];

// Ken Burns per subject: a slow push toward the upper third (where faces sit), drifting one way.
function kenBurns(slug) {
  const r = hash(slug + "kb");
  const dx = (r() - 0.5) * 5, dy = (r() - 0.5) * 3;
  return {
    "--kb-from": `scale(1.04) translate(${dx.toFixed(2)}%, ${dy.toFixed(2)}%)`,
    "--kb-to": `scale(1.17) translate(${(-dx).toFixed(2)}%, ${(-dy - 1.5).toFixed(2)}%)`,
  };
}

const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function Portrait({ subject }) {
  if (subject.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img key={subject.slug} src={subject.image} alt="" draggable={false} className="kyn-kb" style={kenBurns(subject.slug)}
        onError={(e) => { if (subject.imageFull && e.currentTarget.src !== subject.imageFull) e.currentTarget.src = subject.imageFull; }} />
    );
  }
  return (
    <div key={subject.slug} style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "radial-gradient(circle at 50% 42%, rgba(250,204,21,0.10), rgba(15,16,22,0) 60%), #14151d" }}>
      <span style={{ fontFamily: FONTS.display, fontSize: "120px", color: "rgba(250,204,21,0.55)", transform: "translateY(-8%)" }}>{initials(subject.name)}</span>
    </div>
  );
}

function Caption({ subject, label }) {
  return (
    <div className="kyn-cap">
      <a href={`/s/${subject.slug}`} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
        style={{ color: "#f8fafc", textDecoration: "none" }}>
        <div style={{ fontFamily: FONTS.display, fontStyle: subject.isWork ? "italic" : "normal", fontSize: "clamp(26px, 8.5cqw, 40px)", lineHeight: 1.02, textShadow: "0 1px 18px rgba(0,0,0,0.5)" }}>
          {subject.name}
        </div>
      </a>
      <div style={{ fontFamily: FONTS.mono, fontSize: "11px", letterSpacing: "0.06em", color: "rgba(226,232,240,0.72)", marginTop: "6px" }}>
        {[subject.isWork && subject.creator, subject.years, `${subject.degree} connections`].filter(Boolean).join("  ·  ")}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", marginTop: "14px" }}>
        <a href={`/s/${subject.slug}`} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} className="kyn-open">
          Explore the map <span aria-hidden>→</span>
        </a>
        {subject.credit && (
          <a href={subject.imagePage || "#"} target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
            style={{ fontFamily: FONTS.mono, fontSize: "9px", color: "rgba(226,232,240,0.42)", textDecoration: "none", textAlign: "right", maxWidth: "48%", lineHeight: 1.4 }}>
            Photo: {subject.credit}{subject.license ? ` · ${subject.license}` : ""}
          </a>
        )}
      </div>
    </div>
  );
}

function CategoryCard({ cat, index }) {
  const bySlug = useMemo(() => new Map(cat.all.map((s) => [s.slug, s])), [cat]);
  const feats = useMemo(() => cat.featured.map((s) => bySlug.get(s)).filter(Boolean), [cat, bySlug]);
  const [slots, setSlots] = useState([feats[0], null]);
  const [front, setFront] = useState(0);
  const [current, setCurrent] = useState(feats[0].slug);
  const [featIdx, setFeatIdx] = useState(0);
  const [filter, setFilter] = useState("");

  const stage = useRef(null), layers = [useRef(null), useRef(null)], caps = [useRef(null), useRef(null)];
  const ticks = useRef([]);
  const bar = { get current() { return ticks.current[featIdxRef.current]; } };
  const featIdxRef = useRef(0);
  const ctl = useRef({ elapsed: -index * STAGGER, hold: HOLD, trans: null, pending: null, hover: false, held: false, visible: false, busy: false });

  const REDUCED = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Ask for the next feature: preload its photo, mount it in the back layer, then animate.
  const go = useRef(null);
  go.current = async (target, dir = 1, { manual = false, nextFeatIdx = null } = {}) => {
    const c = ctl.current;
    if (c.busy || !target || target.slug === current) return;
    c.busy = true;
    if (target.image) {
      await Promise.race([
        new Promise((res) => { const im = new Image(); im.onload = im.onerror = res; im.src = target.image; }),
        new Promise((res) => setTimeout(res, 2500)),
      ]);
    }
    const back = 1 - front;
    c.pending = { target, back };
    c.hold = manual ? HOLD * 2 : HOLD;
    if (nextFeatIdx != null) setFeatIdx(nextFeatIdx);
    setSlots((s) => { const n = [...s]; n[back] = target; return n; });
  };

  const step = (dir, manual = false) => {
    const i = (featIdx + dir + feats.length) % feats.length;
    go.current(feats[i], dir, { manual, nextFeatIdx: i });
  };

  // The back layer is mounted — start the wipe.
  useLayoutEffect(() => {
    const c = ctl.current;
    if (!c.pending) return;
    const { back } = c.pending;
    c.pending = null;
    const B = layers[back].current, img = B.firstElementChild;
    // The incoming photo waits at the start of its drift until it's fully in.
    if (img?.tagName === "IMG") img.style.animationPlayState = "paused";
    c.trans = { t: 0, back, img };
    B.style.zIndex = "2";
    B.style.opacity = "1";
    wipe(B, 0);
  }, [slots]);

  // One loop per card: the hold timer, the progress bar, and the hand-off frames.
  useEffect(() => {
    let raf, last = performance.now();
    const tick = (now) => {
      const c = ctl.current, dt = Math.min(64, now - last);
      last = now;
      if (c.trans) frame(c, dt);
      else if (!c.busy) {
        if (c.visible && !c.hover && !c.held && !document.hidden) c.elapsed += dt;
        if (bar.current) bar.current.style.transform = `scaleX(${clamp(c.elapsed / c.hold)})`;
        if (c.elapsed >= c.hold) step(1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  // A soft edge a third of the card wide, travelling from off the left side to off the right.
  function wipe(el, p) {
    const x = -35 + 135 * p;
    const m = REDUCED ? `linear-gradient(rgba(0,0,0,${p}), rgba(0,0,0,${p}))` : `linear-gradient(to right, #000 ${x}%, transparent ${x + 35}%)`;
    el.style.maskImage = el.style.webkitMaskImage = m;
  }

  function frame(c, dt) {
    const tr = c.trans;
    tr.t = Math.min(1, tr.t + dt / (REDUCED ? 600 : TRANS));
    const p = ease(tr.t);
    const A = layers[1 - tr.back].current, B = layers[tr.back].current;
    wipe(B, p);
    caps[1 - tr.back].current.style.opacity = String(1 - smooth(0, 0.45, p));
    caps[tr.back].current.style.opacity = String(smooth(0.5, 1, p));
    if (tr.t >= 1) {
      B.style.maskImage = B.style.webkitMaskImage = "";
      B.style.zIndex = "1";
      A.style.opacity = "0"; A.style.zIndex = "0";
      if (tr.img?.tagName === "IMG") tr.img.style.animationPlayState = "running";
      c.trans = null;
      c.elapsed = 0;
      c.busy = false;
      const target = slots[tr.back];
      setFront(tr.back);
      setCurrent(target.slug);
    }
  }

  // Ticks before the current feature are full, the rest empty; the current one fills as it holds.
  useLayoutEffect(() => {
    featIdxRef.current = featIdx;
    ticks.current.forEach((el, i) => { if (el) el.style.transform = `scaleX(${i < featIdx ? 1 : 0})`; });
  }, [featIdx]);

  // Only rotate while the card is on screen.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { ctl.current.visible = e.isIntersecting; }, { threshold: 0.35 });
    io.observe(stage.current);
    return () => io.disconnect();
  }, []);

  // Tap the left third for the previous feature, anywhere else for the next; swipe either way.
  const press = useRef(null);
  const onDown = (e) => { press.current = { x: e.clientX, t: performance.now() }; if (e.pointerType !== "mouse") ctl.current.held = true; };
  const onUp = (e) => {
    ctl.current.held = false;
    const p = press.current;
    press.current = null;
    if (!p || performance.now() - p.t > 600) return;
    const dx = e.clientX - p.x;
    if (Math.abs(dx) > 40) return step(dx < 0 ? 1 : -1, true);
    const rect = stage.current.getBoundingClientRect();
    step(e.clientX - rect.left < rect.width / 3 ? -1 : 1, true);
  };

  const shown = filter.trim()
    ? cat.all.filter((s) => s.name.toLowerCase().includes(filter.trim().toLowerCase()))
    : cat.all;

  return (
    <article id={`cat-${cat.domain}`} className="kyn-card" style={{ animationDelay: `${index * 70}ms` }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", padding: "18px 20px 14px" }}>
        <div>
          <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "30px", margin: 0, lineHeight: 1 }}>{cat.label}</h2>
          <div style={{ fontSize: "13px", color: "rgba(148,163,184,0.75)", marginTop: "6px" }}>{cat.blurb}</div>
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: "11px", letterSpacing: "0.08em", color: BASE.gold, whiteSpace: "nowrap" }}>{cat.all.length} maps</div>
      </header>

      <div ref={stage} className="kyn-stage"
        onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { ctl.current.held = false; }}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") ctl.current.hover = true; }}
        onPointerLeave={() => { ctl.current.hover = false; ctl.current.held = false; }}>
        {[0, 1].map((i) => (
          <div key={i} ref={layers[i]} className="kyn-layer" style={{ opacity: i === front ? 1 : 0, zIndex: i === front ? 1 : 0 }}>
            {slots[i] && <Portrait subject={slots[i]} />}
          </div>
        ))}
        <div className="kyn-shade" />
        {[0, 1].map((i) => (
          <div key={i} ref={caps[i]} className={`kyn-capwrap${i === front ? " on" : ""}`} style={{ opacity: i === front ? 1 : 0 }}>
            {slots[i] && <Caption subject={slots[i]} label={cat.label} />}
          </div>
        ))}
        <div className="kyn-ticks" aria-hidden>
          {feats.map((f, i) => (
            <span key={f.slug} className="kyn-tick">
              <span ref={(el) => { ticks.current[i] = el; }} />
            </span>
          ))}
        </div>
        <button className="kyn-arrow" style={{ left: "10px" }} aria-label="Previous" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={() => step(-1, true)}>‹</button>
        <button className="kyn-arrow" style={{ right: "10px" }} aria-label="Next" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={() => step(1, true)}>›</button>
      </div>

      <div className="kyn-panel">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px 8px" }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(148,163,184,0.6)", whiteSpace: "nowrap" }}>
            All {cat.label.toLowerCase()}
          </span>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Find in ${cat.label.toLowerCase()}…`} className="kyn-filter" />
        </div>
        <ul className="kyn-list">
          {shown.map((s) => (
            <li key={s.slug}>
              <a href={`/s/${s.slug}`} className="kyn-row">
                {s.thumb
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={s.thumb} alt="" loading="lazy" />
                  : <span className="kyn-initials">{initials(s.name)}</span>}
                <span style={{ fontFamily: s.isWork ? FONTS.display : FONTS.body, fontStyle: s.isWork ? "italic" : "normal", fontSize: s.isWork ? "15.5px" : "14px" }}>{s.name}</span>
                <span className="kyn-meta">{s.isWork && s.creator ? s.creator : s.years || ""}</span>
                <span className="kyn-go" aria-hidden>→</span>
              </a>
            </li>
          ))}
          {!shown.length && <li className="kyn-empty">Nothing by that name here yet.</li>}
        </ul>
      </div>
    </article>
  );
}

export default function DiscoverHome({ categories, total }) {
  const [q, setQ] = useState("");
  const everyone = useMemo(() => categories.flatMap((c) => c.all), [categories]);
  const matches = q.trim().length > 1
    ? everyone.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];
  const submit = (e) => {
    e.preventDefault();
    const text = q.trim();
    if (!text) return;
    const exact = everyone.find((s) => s.name.toLowerCase() === text.toLowerCase());
    window.location.href = exact ? `/s/${exact.slug}` : `/?q=${encodeURIComponent(text)}`;
  };

  return (
    <main className="kyn-home">
      <style>{CSS}</style>
      <header className="kyn-hero">
        <h1 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: "clamp(52px, 9vw, 76px)", margin: 0, lineHeight: 1 }}><Wordmark /></h1>
        <p style={{ fontFamily: FONTS.display, fontSize: "clamp(20px, 3.2vw, 26px)", lineHeight: 1.3, margin: "12px 0 0", color: "rgba(226,232,240,0.9)", maxWidth: "560px" }}>
          Every artist has a family tree. Pick someone you love and follow where they came from — and who came after.
        </p>
        <form onSubmit={submit} className="kyn-search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any artist, film, book or band…" aria-label="Search" />
          <button type="submit">Map</button>
          {matches.length > 0 && (
            <div className="kyn-suggest">
              {matches.map((s) => (
                <a key={s.slug} href={`/s/${s.slug}`}>
                  {s.thumb
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={s.thumb} alt="" />
                    : <span className="kyn-initials">{initials(s.name)}</span>}
                  <span>{s.name}</span>
                  <span className="kyn-meta">{s.domain === "other" ? "ideas" : s.domain}</span>
                </a>
              ))}
            </div>
          )}
        </form>
        <nav className="kyn-chips" aria-label="Categories">
          {categories.map((c) => <a key={c.domain} href={`#cat-${c.domain}`}>{c.label}</a>)}
        </nav>
        <div style={{ fontFamily: FONTS.mono, fontSize: "11px", letterSpacing: "0.08em", color: "rgba(148,163,184,0.55)", marginTop: "18px" }}>
          {total} maps so far, and growing
        </div>
      </header>

      <section className="kyn-grid">
        {categories.map((c, i) => <CategoryCard key={c.domain} cat={c} index={i} />)}
      </section>

      <form method="GET" action="/path" className="kyn-thread">
        <div style={{ fontFamily: FONTS.display, fontSize: "26px", marginBottom: "6px" }}>Find the thread</div>
        <div style={{ fontSize: "13.5px", color: "rgba(148,163,184,0.8)", marginBottom: "14px" }}>
          The shortest documented path between any two people or works in the graph.
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input name="from" placeholder="From (e.g. Kraftwerk)" />
          <input name="to" placeholder="To (e.g. Doechii)" />
          <button type="submit">Trace</button>
        </div>
      </form>
    </main>
  );
}

const CSS = `
.kyn-home { max-width: 1240px; margin: 0 auto; padding: 56px 16px 120px; }
.kyn-hero { padding: 0 4px 34px; }
.kyn-search { position: relative; display: flex; gap: 10px; margin-top: 26px; max-width: 620px; }
.kyn-search input { flex: 1; min-width: 0; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 999px; padding: 15px 22px; font-size: 16px; color: #e2e8f0; font-family: ${FONTS.body}; outline: none; }
.kyn-search input:focus { border-color: rgba(250,204,21,0.45); }
.kyn-search button, .kyn-thread button { background: rgba(250,204,21,0.12); border: 1px solid rgba(250,204,21,0.38); color: ${BASE.gold}; border-radius: 999px; padding: 0 24px; font-family: ${FONTS.mono}; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }
.kyn-suggest { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 20; background: #171822; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 6px; box-shadow: 0 18px 50px rgba(0,0,0,0.5); }
.kyn-suggest a { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 10px; color: #e2e8f0; text-decoration: none; font-size: 14px; }
.kyn-suggest a:hover { background: rgba(255,255,255,0.05); }
.kyn-suggest img, .kyn-list img, .kyn-initials { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; object-position: 50% 25%; flex: none; background: #1d1f2a; }
.kyn-initials { display: grid; place-items: center; font-family: ${FONTS.display}; font-size: 15px; color: rgba(250,204,21,0.7); }
.kyn-meta { margin-left: auto; font-family: ${FONTS.mono}; font-size: 10.5px; color: rgba(148,163,184,0.55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40%; }
.kyn-chips { display: flex; gap: 8px; margin-top: 22px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
.kyn-chips::-webkit-scrollbar { display: none; }
.kyn-chips a { flex: none; font-size: 13px; color: rgba(226,232,240,0.85); text-decoration: none; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); border-radius: 999px; padding: 7px 15px; }
.kyn-chips a:hover { border-color: rgba(250,204,21,0.4); color: ${BASE.gold}; }

.kyn-grid { display: grid; grid-template-columns: 1fr; gap: 26px; }
@media (min-width: 760px) { .kyn-grid { grid-template-columns: 1fr 1fr; gap: 28px; } }
@media (min-width: 1100px) { .kyn-grid { grid-template-columns: 1fr 1fr 1fr; gap: 24px; } }
.kyn-card { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; overflow: hidden; scroll-margin-top: 20px; animation: kynRise 700ms ease-out both; }
@keyframes kynRise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }

.kyn-stage { container-type: inline-size; position: relative; aspect-ratio: 4 / 5; overflow: hidden; background: radial-gradient(circle at 50% 42%, #191a24, #0d0e14 70%); cursor: pointer; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
@media (min-width: 760px) { .kyn-stage { aspect-ratio: 1 / 1; } }
.kyn-layer { position: absolute; inset: 0; overflow: hidden; will-change: clip-path; }
.kyn-kb { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 25%; transform-origin: 50% 30%; animation: kynKB 10s ease-in-out infinite alternate; }
@keyframes kynKB { from { transform: var(--kb-from) } to { transform: var(--kb-to) } }
@media (prefers-reduced-motion: reduce) { .kyn-kb { animation: none; } }
.kyn-shade { position: absolute; inset: 0; z-index: 4; background: linear-gradient(to bottom, rgba(10,11,16,0.45) 0%, rgba(10,11,16,0) 18%, rgba(10,11,16,0) 46%, rgba(10,11,16,0.92) 100%); pointer-events: none; }
.kyn-cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 22px 20px 18px; }
.kyn-open { display: inline-flex; gap: 8px; align-items: center; font-family: ${FONTS.mono}; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #0f1016; background: ${BASE.gold}; border-radius: 999px; padding: 9px 16px; text-decoration: none; white-space: nowrap; }
.kyn-open:hover { background: #fde047; }
.kyn-capwrap { position: absolute; inset: 0; z-index: 5; pointer-events: none; }
.kyn-capwrap.on .kyn-cap { pointer-events: auto; }
.kyn-ticks { position: absolute; top: 12px; left: 14px; right: 14px; display: flex; gap: 4px; z-index: 6; pointer-events: none; }
.kyn-tick { flex: 1; height: 2px; border-radius: 2px; background: rgba(255,255,255,0.22); overflow: hidden; }
.kyn-tick > span { display: block; height: 100%; background: rgba(255,255,255,0.85); transform-origin: left; }
.kyn-arrow { position: absolute; top: 42%; transform: translateY(-50%); z-index: 6; width: 38px; height: 38px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.18); background: rgba(15,16,22,0.45); color: #f1f5f9; font-size: 22px; line-height: 1; cursor: pointer; opacity: 0; transition: opacity 300ms; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.kyn-stage:hover .kyn-arrow { opacity: 1; }
@media (hover: none) { .kyn-arrow { display: none; } }

.kyn-panel { border-top: 1px solid rgba(255,255,255,0.06); }
.kyn-filter { flex: 1; min-width: 0; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 999px; padding: 7px 14px; font-size: 13px; color: #e2e8f0; font-family: ${FONTS.body}; outline: none; }
.kyn-filter:focus { border-color: rgba(250,204,21,0.4); }
.kyn-list { list-style: none; margin: 0; padding: 2px 8px 10px; max-height: 232px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent;
  -webkit-mask-image: linear-gradient(to bottom, #000 85%, transparent); mask-image: linear-gradient(to bottom, #000 85%, transparent); }
.kyn-row { display: flex; align-items: center; gap: 12px; padding: 7px 8px; border-radius: 12px; color: #e2e8f0; text-decoration: none; font-family: ${FONTS.body}; }
.kyn-row:hover { background: rgba(255,255,255,0.035); }
.kyn-row > span:nth-child(2) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kyn-go { flex: none; color: rgba(148,163,184,0.5); font-size: 15px; padding: 0 4px; }
.kyn-row:hover .kyn-go { color: ${BASE.gold}; }
.kyn-empty { padding: 14px 10px; font-size: 13px; color: rgba(148,163,184,0.6); }

.kyn-thread { margin-top: 44px; padding: 24px; border-radius: 20px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07); }
.kyn-thread input { flex: 1 1 160px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 999px; padding: 11px 16px; font-size: 14px; color: #e2e8f0; outline: none; font-family: ${FONTS.body}; }
.kyn-thread button { padding: 11px 22px; }
`;
