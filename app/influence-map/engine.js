// Influence map engine (2026-10-01, from the Vonnegut prototype in
// scripts/experiments/influence-map/). D3 owns the SVG and the background
// canvas; the React wrapper only supplies the markup (AD-04).
//   - the map builds itself: center, then the KyndaMix headliners, then the rest
//   - click travels in place (a free /api/graph read), leaving a gold thread back
//   - hover (desktop, 1s) or press-and-hold (touch) opens the evidence card
//   - drag: bubbles stretch on a rubber band and spring home; the center goes
//     wherever it's dropped and the map swings in after it
//   - an endless background web with one slow swell rolling through it

import * as d3 from "d3";
import { slugify } from "../../src/lib/slug.js";

const COLORS = { predecessor: "#a8c8d8", peer: "#e04040", successor: "#8844cc" };
const TEXT_COLORS = { predecessor: "#a8c8d8", peer: "#f07070", successor: "#b48ae6" };
const TYPE_LABEL = { predecessor: "Influence", peer: "Peer or partner", successor: "Successor" };
// KyndaMix slot vocabulary and colors (MIX_SLOT_TYPES / SLOT_COLORS in src/design/tokens.js),
// plus which side of the map a mix card sits on when the claims graph doesn't hold it.
const SLOTS = {
  titan: ["Key Influence", "#ff8c32", "predecessor"], ghost: ["Influencia Obscura", "#94a3b8", "predecessor"],
  geography: ["Local Roots", "#38bdf8", "peer"], culture: ["Beyond the Medium", "#a855f7", "predecessor"],
  peer: ["Peer", "#fb7185", "peer"], legacy: ["Legacy", "#34d399", "successor"],
  collaborator: ["Key Collaborator", "#818cf8", "peer"],
  covers: ["Covered Them", "#2dd4bf", "predecessor"], covered_by: ["Covered By", "#e879f9", "successor"],
};
const CLAIM_LABELS = {
  influenced_by: "influence", cited_as_influence: "cited influence", cross_medium_influence: "cross-medium influence",
  same_scene: "shared scene", collaborated_with: "collaboration", produced_by: "production", member_of: "membership",
  covers: "cover", covered_by: "covered by", used_gear: "gear", recorded_at: "recorded at", founded: "founded",
  taught_at: "taught at", studied_under: "studied under", created_by: "created by",
};
const CENTER_R = 54;
const STRETCH = 150;

// Bios for travelled-to centers, shared across map instances. (Pictures come only from the
// server — rights-cleared images applied by the backfill or a curator; the map fetches none itself.)
const bioCache = new Map();
function loadBio(name) {
  if (!bioCache.has(name)) {
    bioCache.set(name, fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, "_"))}?redirect=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && j.type !== "disambiguation" && j.extract
        ? { text: j.extract, description: j.description || null, url: j.content_urls?.desktop?.page || null, source: "Wikipedia" }
        : null))
      .catch(() => null));
  }
  return bioCache.get(name);
}

const short = (s, n = 24) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const initials = (s) => s.replace(/^(The|A|An) /, "").split(/\s+/).filter((w) => /^[A-Z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join("") || s[0];
// Size: anything in the KyndaMix is a headliner; everything else scales with its evidence.
const radius = (n) => (n.mix ? 36 + Math.min(n.weight || 4, 10) * 1.2 : 9 + Math.min(n.weight || 0, 10) * 2.4);
const normT = (s) => String(s || "").toLowerCase().replace(/^(the|a|an) /, "").replace(/[^a-z0-9]+/g, " ").trim();
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };
const fmtYear = (y) => (y < 0 ? `${-y} BCE` : String(y));

// Mix images are stored at full size; ask Wikimedia for a small thumbnail instead.
function smallImage(url) {
  if (!url) return null;
  const u = url.split("?")[0];
  const m = u.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/(\w+)\/(\w)\/(\w\w)\/([^/]+)$/);
  if (m) return `https://upload.wikimedia.org/wikipedia/${m[1]}/thumb/${m[2]}/${m[3]}/${m[4]}/250px-${m[4]}${/\.svg$/i.test(m[4]) ? ".png" : ""}`;
  if (/upload\.wikimedia\.org\/.+\/thumb\//.test(u)) return u.replace(/\/\d+px-/, "/250px-");
  return url;
}

export function createInfluenceMap(root, { subjectName, subjectBio, initialGraph, fetchGraph = null, onOpenSubject, onCenter = null, adminToken = null, getAlternatives = () => [], onAlternative = null }) {
  // No fetchGraph = a sealed map (the public demo pages): clicking a bubble opens its card, nothing travels.
  const canTravel = !!fetchGraph;
  const q = (k) => root.querySelector(`[data-k="${k}"]`);
  // Cards live in a docked panel (Tony, 2026-10-03): right side on desktop, bottom on narrow
  // screens, resizable, and the camera frames only the part of the map the panel leaves visible.
  const stage = q("stage"), panel = q("card"), card = q("cardbody");
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const graphs = new Map([[subjectName, initialGraph]]);
  const missing = new Set();
  const pending = new Map();
  // The page's own subject uses the page's bio (QID-matched); other centers fetch a Wikipedia summary.
  if (subjectBio?.text) bioCache.set(subjectName, Promise.resolve(subjectBio));
  let alive = true;
  // Pictures default on (2026-10-02); the menu turns them off.
  let picsOn = true;
  stage.classList.add("pics-on");
  q("pics").setAttribute("aria-pressed", "true");

  const svg = d3.select(q("map"));
  const clipId = `kmap-circ-${Math.random().toString(36).slice(2, 8)}`;
  svg.append("defs").append("clipPath").attr("id", clipId).attr("clipPathUnits", "objectBoundingBox")
    .append("circle").attr("cx", 0.5).attr("cy", 0.5).attr("r", 0.5);
  const world = svg.append("g");
  const gEdges = world.append("g");
  const gHits = world.append("g");
  const gNodes = world.append("g");
  let webView = d3.zoomIdentity;
  const zoom = d3.zoom().scaleExtent([0.25, 4]).on("zoom", (e) => { world.attr("transform", e.transform); webView = e.transform; sizeLabels(); });

  // Names never shrink below a readable size on screen (Tony, 2026-10-03 — "too small to read on
  // a phone"). Zooming in still enlarges them; zooming out stops shrinking them at the floor.
  const LABEL = { center: [19, 15, 14], mix: [12.5, 12, 11], other: [11, 10.5, 9.5] }; // [map units, phone min px, desktop min px]
  function sizeLabels() {
    const k = webView.k || 1, phone = size().w < 640;
    gNodes.selectAll("g.node").each(function (d) {
      const [base, minPhone, minDesk] = LABEL[d.type === "center" ? "center" : d.mix ? "mix" : "other"];
      d.labelFs = Math.max(base, (phone ? minPhone : minDesk) / k);
      // A bubble too small on screen to carry a name keeps it hidden until you zoom in (mix picks always show theirs).
      d.labelHidden = d.type !== "center" && !d.mix && (d.r || d.ccr || 0) * 2 * k < 18;
      d3.select(this).select(".label").style("font-size", `${d.labelFs}px`).style("stroke-width", `${d.labelFs * 0.36}px`);
    });
    if (!anim && !wobble) draw();
  }
  svg.call(zoom).on("dblclick.zoom", null);

  const live = new Map(); // name -> node on screen (incl. exiting)
  let center = subjectName;
  let trail = [subjectName];
  let trailPos = 0;
  let anim = null;
  let lastCenter = null;

  function loadGraph(name) {
    if (graphs.has(name)) return Promise.resolve(graphs.get(name));
    if (!canTravel) return Promise.resolve(null);
    if (missing.has(name)) return Promise.resolve(null);
    if (!pending.has(name)) {
      pending.set(name, fetchGraph(name).then((g) => {
        pending.delete(name);
        if (g) graphs.set(name, g); else missing.add(name);
        return g;
      }).catch(() => { pending.delete(name); return null; }));
    }
    return pending.get(name);
  }

  // A work node travels to the artist who made it (Tony, 2026-10-02): influence
  // claims usually name a record, and a record's own graph is two or three
  // links, so tapping "What's Going On" should land on Marvin Gaye. A work
  // that is itself a mapped subject keeps its own map (Metropolis on Bowie's
  // map opens Metropolis, not Fritz Lang's five links). Never
  // re-enter the center (a subject's own work leads nowhere new); the work's
  // own graph stays the fallback when its maker isn't mapped.
  const WORK_KINDS = new Set(["work", "film", "tv_show", "book", "release", "recording"]);
  function destOf(d) {
    if (d.mapped) return d.name; // a mapped work (Metropolis) opens its own map
    const maker = d.creator && (WORK_KINDS.has(d.kind) || !d.kind) ? d.creator : null;
    return maker && normT(maker) !== normT(center) && normT(maker) !== normT(d.name) ? maker : d.name;
  }
  const isDead = (d) => missing.has(destOf(d)) && missing.has(d.name);

  function neighbors(name) {
    const g = graphs.get(name); if (!g) return [];
    const seen = new Set([name.toLowerCase()]); const out = [];
    for (const [key, type] of [["predecessors", "predecessor"], ["peers", "peer"], ["successors", "successor"]]) {
      for (const it of g[key] || []) {
        const k = it.name.toLowerCase(); if (seen.has(k)) continue; seen.add(k);
        out.push({ ...it, type });
      }
    }
    const byTitle = new Map(out.map((n) => [normT(n.name), n]));
    for (const c of g.mix || []) {
      if (c.slotType === "essential") continue; // their own canon stays off the map
      const slot = SLOTS[c.slotType] || ["In the mix", "#facc15", "predecessor"];
      let n = byTitle.get(normT(c.title));
      if (!n) {
        // Mix cards the claims graph doesn't hold yet still belong on the map.
        n = { name: c.title, creator: c.creator, year: c.year, type: slot[2], weight: 4, evidence: [], tier: "mix pick" };
        out.push(n); byTitle.set(normT(c.title), n);
      }
      n.mix = { slot: c.slotType, label: slot[0], color: slot[1], reason: c.reason, image: smallImage(c.imageUrl),
        imageCredit: c.imageCredit || null, imageLicense: c.imageLicense || null, imagePage: c.imagePage || null };
    }
    const typeOrder = { predecessor: 1, peer: 2, successor: 3 };
    return out.sort((a, b) => (a.mix ? 0 : 1) - (b.mix ? 0 : 1) || typeOrder[a.type] - typeOrder[b.type] || (a.year ?? 9999) - (b.year ?? 9999));
  }

  function size() { const r = svg.node().getBoundingClientRect(); return { w: r.width, h: r.height }; }

  // ── Mix view (Tony, 2026-10-03): a phone can't read 40–500 bubbles. "Mix" shows only the
  // KyndaMix picks (~20, the curated story) — plus the way back along the trail; "Full" shows
  // everything. Default: Mix on narrow screens and on any map over 60 connections, Full otherwise;
  // an explicit choice is remembered in this browser. Maps with too few mix picks are always Full.
  const VIEW_KEY = "kynda_map_view", MIN_MIX = 6;
  let viewPref = null;
  try { viewPref = localStorage.getItem(VIEW_KEY); } catch { /* storage blocked */ }
  let lastCounts = { all: 0, mix: 0 };
  function viewFor(counts) {
    if (counts.mix < MIN_MIX) return "full";
    if (viewPref === "mix" || viewPref === "full") return viewPref;
    return size().w < 700 || counts.all > 60 ? "mix" : "full";
  }
  function shownNeighbors(name) {
    const all = neighbors(name);
    lastCounts = { all: all.length, mix: all.filter((n) => n.mix).length };
    if (viewFor(lastCounts) === "full") return all;
    const back = trail[trailPos - 1];
    return all.filter((n) => n.mix || n.name === back);
  }
  function updateViewToggle() {
    const box = q("viewtoggle"), view = viewFor(lastCounts);
    box.hidden = lastCounts.mix < MIN_MIX;
    box.querySelector('[data-view="mix"]').innerHTML = `Mix <span>${lastCounts.mix}</span>`;
    box.querySelector('[data-view="full"]').innerHTML = `Full map <span>${lastCounts.all}</span>`;
    for (const b of box.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.view === view));
  }

  // Settle a static layout for one subject, seeded from where things are now so persisting nodes barely move.
  function layout(name, fresh = false) {
    const { w, h } = size();
    const narrow = w < 640;
    // Phones are tall and narrow: stack influences above and successors below, and keep the columns slim.
    const span = narrow ? Math.max(h, 600) * 0.5 * (h / Math.max(w, 1) > 1.4 ? 1.25 : 1) : Math.max(w, 900) * 0.36;
    const rand = d3.randomLcg(name.length * 7919 + 13);
    const old = live.get(name);
    const g = graphs.get(name) || {};
    const nodes = [{ name, type: "center", r: CENTER_R, fx: 0, fy: 0, id: g.subjectId || null, image: g.subjectImage || null }];
    let peerI = 0;
    for (const n of shownNeighbors(name)) {
      const prev = live.get(n.name);
      const t = n.type === "predecessor" ? -1 : n.type === "successor" ? 1 : 0;
      const node = { ...n, r: radius(n), t, side: n.type === "peer" ? (peerI++ % 2 ? 1 : -1) : 0 };
      // Seed from where things sit (travel keeps the picture steady) — unless the view changed, when Mix must pull in tight.
      const ox = !fresh && old && prev ? prev.x - old.x : null, oy = !fresh && old && prev ? prev.y - old.y : null;
      if (narrow) { node.x = ox ?? (rand() - 0.5) * 260; node.y = oy ?? t * span + (rand() - 0.5) * 140; }
      else { node.x = ox ?? t * span + (rand() - 0.5) * 160; node.y = oy ?? (rand() - 0.5) * 360; }
      nodes.push(node);
    }
    const links = nodes.slice(1).map((n) => ({ source: nodes[0], target: n }));
    const sim = d3.forceSimulation(nodes).stop()
      .force("link", d3.forceLink(links).distance((l) => 120 + l.target.r).strength(0.04))
      .force("charge", d3.forceManyBody().strength(-70))
      .force("collide", d3.forceCollide((d) => d.r + (d.type === "center" || d.mix ? 34 : 26)).strength(0.9).iterations(2));
    if (narrow) {
      sim.force("y", d3.forceY((d) => (d.t || 0) * span).strength((d) => (d.type === "peer" ? 0.1 : 0.14)))
        .force("x", d3.forceX((d) => (d.side || 0) * 110).strength((d) => (d.type === "peer" ? 0.14 : 0.12)));
    } else {
      sim.force("x", d3.forceX((d) => (d.t || 0) * span).strength((d) => (d.type === "peer" ? 0.12 : 0.14)))
        .force("y", d3.forceY((d) => (d.side || 0) * 230).strength((d) => (d.type === "peer" ? 0.12 : 0.04)));
    }
    for (let i = 0; i < 320; i++) sim.tick();
    return nodes;
  }

  // Edges run between where the bubbles are drawn — physics position plus the swell's lift.
  function edgePath(a, b) {
    const ax = a.cx ?? a.x, ay = (a.cy ?? a.y) + (a.sw || 0), bx = b.cx ?? b.x, by = (b.cy ?? b.y) + (b.sw || 0);
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const sx = ax + ux * a.cr, sy = ay + uy * a.cr, tx = bx - ux * b.cr, ty = by - uy * b.cr;
    const bend = Math.min(40, len * 0.12);
    return `M${sx},${sy}Q${(sx + tx) / 2 - uy * bend},${(sy + ty) / 2 + ux * bend} ${tx},${ty}`;
  }

  // Move to a subject: lay it out, then one animation that exits, moves and builds nodes.
  let waitingForSize = false;
  let pendingGo = null; // a move asked for while hidden; the resize observer replays it
  function go(name, { push = true, quiet = false, fresh = false } = {}) {
    if (!alive) return;
    if (size().w === 0) { waitingForSize = true; pendingGo = { name, push, quiet }; return; } // hidden tab; the resize observer resumes us
    waitingForSize = false;
    const keepPanel = panelOpen;
    clearSelection();
    closeCurator();
    if (glide) { glide.stop(); glide = null; }
    if (wobble) { wobble.stop(); wobble = null; grabbed = null; for (const n of live.values()) { n.fx = n.fy = null; n.vx = n.vy = 0; } }
    const prevCenter = center;
    if (push && name !== center) { trail = trail.slice(0, trailPos + 1); trail.push(name); trailPos = trail.length - 1; }
    center = name;
    // The page follows the center (Tony, 2026-10-02): header, tabs, address.
    // quiet = the move came from the browser's Back/Forward, so no new history entry.
    if (onCenter && name !== prevCenter) onCenter(name, graphs.get(name) || null, { quiet });
    const target = layout(name, fresh);
    const keep = new Set(target.map((n) => n.name));
    const anchor = live.get(name) || { x: 0, y: 0 };
    const shift = { x: anchor.x || 0, y: anchor.y || 0 };
    const now = performance.now();
    let buildIdx = 0;
    const firstBuild = live.size === 0;
    zoomAfterBuild = true; // narrow screens ease in once the build finishes
    target.forEach((t) => {
      const x1 = t.x + shift.x, y1 = t.y + shift.y;
      let n = live.get(t.name);
      if (n) {
        // fx/fy cleared: the layout pins its center at the layout's own origin, and a former center
        // carried that pin into the next map — the springs then yanked it toward a stale spot.
        Object.assign(n, t, { x0: n.cx, y0: n.cy, x1, y1, s0: n.cs, s1: 1, cr0: n.ccr, r1: t.r, delay: 0, dur: 700, exiting: false, fx: null, fy: null, vx: 0, vy: 0, k: null });
      } else {
        const order = t.type === "center" ? 0 : ++buildIdx;
        n = { ...t, fx: null, fy: null, cx: shift.x, cy: shift.y, cs: 0, ccr: t.r, x0: shift.x, y0: shift.y, x1, y1, s0: 0, s1: 1, cr0: t.r, r1: t.r,
              delay: t.type === "center" ? 0 : (firstBuild ? 500 : 650) + order * Math.min(70, 2600 / target.length), dur: 820 };
        live.set(t.name, n);
      }
    });
    for (const [k, n] of live) if (!keep.has(k)) Object.assign(n, { x0: n.cx, y0: n.cy, x1: n.cx + (n.cx - anchor.x) * 0.25, y1: n.cy + (n.cy - anchor.y) * 0.25, s0: n.cs, s1: 0, cr0: n.ccr, r1: n.ccr, delay: 0, dur: 420, exiting: true });
    if (REDUCED) for (const n of live.values()) { n.delay = 0; n.dur = 1; }
    lastCenter = prevCenter;
    render();
    fit(target.map((t) => ({ x: t.x + shift.x, y: t.y + shift.y, r: t.r })), firstBuild);
    if (keepPanel) setTimeout(() => { const c = live.get(name); if (alive && c && panelOpen) showCard(c, false); }, 50);
    if (anim) anim.stop();
    anim = d3.timer(() => frame(now));
    updateTrail();
    updateLegend(target);
    updateViewToggle();
    loadBio(name);
  }

  // The first build frames the camera instantly, so the subject appears in the middle and the map grows
  // around it; after that the camera glides with each hop.
  // Frame the map inside the part of the stage the panel leaves visible. `nodes` are absolute positions.
  function fit(nodes, instant) {
    if (!nodes.length) return;
    const v = visibleRect();
    const narrow = v.w < 640, pad = narrow ? 12 : 28, lab = narrow ? 22 : 36;
    const xs = nodes.flatMap((n) => [n.x - n.r - lab, n.x + n.r + lab]), ys = nodes.flatMap((n) => [n.y - n.r - 10, n.y + n.r + lab]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const k = Math.min(1.4, (v.w - pad * 2) / (x1 - x0), (v.h - pad * 2 - (narrow ? 60 : 44)) / (y1 - y0)); // room for the menu button and the legend
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const to = d3.zoomIdentity.translate(v.x + v.w / 2 - cx * k, v.y + v.h / 2 + 10 - cy * k).scale(k);
    if (instant || REDUCED) { svg.interrupt(); svg.call(zoom.transform, to); return; }
    svg.transition().duration(instant === false ? 1100 : 700).ease(d3.easeCubicInOut).call(zoom.transform, to);
  }
  // Re-frame the map as it stands (after the panel opens, closes or is resized).
  const homes = () => [...live.values()].filter((n) => !n.exiting).map((n) => ({ x: n.x1 ?? n.cx, y: n.y1 ?? n.cy, r: n.r || n.ccr || 20 }));
  // The resting view. Wide screens: the whole map in the visible area. Narrow screens (Tony,
  // 2026-10-03): the whole map is too small to read on a phone, so the map spans the visible
  // width, centered on the subject, and you pan up and down — after the build has played zoomed out.
  let zoomAfterBuild = false;
  function frameDefault(how) {
    const nodes = homes();
    if (!nodes.length) return;
    const v = visibleRect();
    if (v.w >= 640) { fit(nodes, how); return; }
    const pad = 12, lab = 22;
    const x0 = Math.min(...nodes.map((n) => n.x - n.r - lab)), x1 = Math.max(...nodes.map((n) => n.x + n.r + lab));
    const k = Math.min(2.2, (v.w - pad * 2) / (x1 - x0));
    const c = live.get(center);
    const cx = (x0 + x1) / 2, cy = c ? (c.y1 ?? c.cy) : 0;
    const to = d3.zoomIdentity.translate(v.x + v.w / 2 - cx * k, v.y + v.h / 2 - cy * k).scale(k);
    if (REDUCED) { svg.interrupt(); svg.call(zoom.transform, to); return; }
    svg.transition().duration(how === "ease-in" ? 1400 : 800).ease(d3.easeCubicInOut).call(zoom.transform, to);
  }

  // ── The docked panel ──
  const PANEL_KEY = "kynda_map_panel";
  let panelOpen = false, panelW = 380, panelH = 0;
  try { const p = JSON.parse(localStorage.getItem(PANEL_KEY) || "null"); if (p?.w) panelW = p.w; if (p?.h) panelH = p.h; } catch { /* storage blocked */ }
  const panelSide = () => (size().w < 700 ? "bottom" : "right");
  function clampPanel() {
    const { w, h } = size();
    panelW = Math.round(Math.max(280, Math.min(panelW, w * 0.6)));
    panelH = Math.round(Math.max(150, Math.min(panelH || h * 0.42, h * 0.75)));
  }
  function applyPanel() {
    clampPanel();
    root.style.setProperty("--panel-w", `${panelW}px`);
    root.style.setProperty("--panel-h", `${panelH}px`);
    root.dataset.panel = panelSide();
    root.classList.toggle("panel-open", panelOpen);
    panel.classList.toggle("open", panelOpen);
  }
  // The part of the stage the map can use: beside/above the panel, below the top controls (Mix/Full toggle).
  function visibleRect() {
    const { w, h } = size();
    const top = q("viewtoggle") && !q("viewtoggle").hidden ? 40 : 0;
    const bottom = w > 640 && trail.length >= 2 ? 40 : 0; // desktop: the trail runs along the bottom
    if (!panelOpen) return { x: 0, y: top, w, h: h - top - bottom };
    return panelSide() === "right" ? { x: 0, y: top, w: Math.max(200, w - panelW), h: h - top - bottom } : { x: 0, y: top, w, h: Math.max(160, h - panelH - top) };
  }
  // Opening, closing or resizing the panel never moves the map (Tony, 2026-10-03): the camera
  // moves only when you drag or zoom, press ◎, or travel. ◎ frames whatever space is visible.
  function setPanel(open) {
    if (open === panelOpen) return;
    panelOpen = open;
    applyPanel();
  }
  // Drag the panel's inner edge to resize it; the size is remembered in this browser.
  const grip = q("grip");
  grip.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { grip.setPointerCapture(e.pointerId); } catch { /* capture is a nicety; moves still arrive */ }
    const st = stage.getBoundingClientRect();
    const move = (ev) => {
      if (panelSide() === "right") panelW = st.right - ev.clientX; else panelH = st.bottom - ev.clientY;
      applyPanel();
    };
    const up = () => {
      grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); grip.removeEventListener("pointercancel", up);
      try { localStorage.setItem(PANEL_KEY, JSON.stringify({ w: panelW, h: panelH })); } catch { /* storage blocked */ }
    };
    grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up); grip.addEventListener("pointercancel", up);
  });
  grip.addEventListener("keydown", (e) => {
    // Keyboard resize: arrows grow or shrink the panel by 24px.
    const right = panelSide() === "right";
    const d = { ArrowLeft: right ? 24 : 0, ArrowRight: right ? -24 : 0, ArrowUp: right ? 0 : 24, ArrowDown: right ? 0 : -24 }[e.key];
    if (!d) return;
    e.preventDefault();
    if (right) panelW += d; else panelH += d;
    applyPanel();
    try { localStorage.setItem(PANEL_KEY, JSON.stringify({ w: panelW, h: panelH })); } catch { /* storage blocked */ }
  });
  applyPanel();


  // A curator's choice wins, then the mix card's own art, then the backfill's pick.
  const picOf = (d) => (d.image?.status === "approved" && d.image.url) || d.mix?.image || d.image?.url || null;
  const creditOf = (d) => {
    if (d.image?.status === "approved" || (!d.mix?.image && d.image?.url)) return d.image;
    if (d.mix?.image) return { credit: d.mix.imageCredit, license: d.mix.imageLicense, page: d.mix.imagePage };
    return null;
  };
  const creditLine = (d) => {
    const c = picOf(d) && creditOf(d);
    if (!c || !(c.credit || c.license)) return "";
    const text = [c.credit, c.license].filter(Boolean).map(esc).join(" · ");
    return `<div class="credit">Picture: ${c.page ? `<a href="${esc(c.page)}" target="_blank" rel="noopener">${text}</a>` : text}</div>`;
  };

  function render() {
    const prevCenter = trail[trailPos - 1];
    const data = [...live.values()];
    const sel = gNodes.selectAll("g.node").data(data, (d) => d.name);
    const enter = sel.enter().append("g").attr("class", "node").attr("tabindex", 0);
    enter.append("circle").attr("class", "halo");
    enter.append("circle").attr("class", "disc");
    // Cropped from the top: a tall picture keeps what matters most — a portrait's head, a jacket's or poster's title.
    enter.append("image").attr("class", "pic").attr("clip-path", `url(#${clipId})`).attr("preserveAspectRatio", "xMidYMin slice");
    enter.append("text").attr("class", "initials");
    enter.append("circle").attr("class", "ring");
    enter.append("text").attr("class", "label");
    enter.on("pointerenter", onEnter).on("pointerleave", onLeave).on("pointerdown", onDown).on("click", onClick)
      .on("focus", (e, d) => showCard(d, false))
      .on("blur", () => hideCard())
      .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); travel(d); } })
      .call(drag);
    sel.exit().remove();

    const all = gNodes.selectAll("g.node");
    all.classed("center", (d) => d.type === "center")
      .classed("dead", (d) => d.type !== "center" && isDead(d))
      .classed("mix", (d) => !!d.mix)
      .attr("aria-label", (d) => (d.type === "center" ? d.name : `${d.name}, ${d.mix ? d.mix.label : TYPE_LABEL[d.type]}`));
    all.select(".halo").attr("fill", "none").attr("stroke", (d) => (d.mix ? d.mix.color : "none")).attr("stroke-width", 2.2);
    all.select(".disc")
      .attr("fill", (d) => (d.type === "center" ? "#1a1b22" : COLORS[d.type]))
      .attr("fill-opacity", (d) => (d.type === "center" || d.mix ? 1 : 0.5 + (Math.min(d.weight, 10) / 10) * 0.4));
    all.select(".ring")
      .attr("stroke", (d) => (d.type === "center" || d.name === prevCenter ? "#facc15" : COLORS[d.type]))
      .attr("stroke-opacity", (d) => (d.type === "center" ? 0.75 : d.name === prevCenter ? 0.9 : 0.85))
      .attr("stroke-width", (d) => (d.type === "center" ? 1.5 : d.name === prevCenter ? 2 : 1.2))
      .attr("stroke-dasharray", (d) => (d.type !== "center" && isDead(d) ? "3 3" : null));
    updatePics();
    all.select(".initials").text((d) => (d.type === "center" ? "" : initials(d.name)));
    const phone = size().w < 640;
    all.select(".label").text((d) => (d.type === "center" ? d.name : short(d.name, phone ? (d.mix ? 20 : 16) : d.mix ? 28 : 24)));
    sizeLabels();

    // Edges: center to each live node. Exiting nodes keep a fading edge to whoever was center.
    const centerNode = live.get(center);
    const edges = data.filter((d) => d.name !== center).map((d) => ({ id: d.name, a: d.exiting ? live.get(lastCenter) || centerNode : centerNode, b: d }));
    gEdges.selectAll("path.edge").data(edges, (e) => e.id).join("path").attr("class", "edge")
      .attr("stroke", (e) => (e.b.name === prevCenter && !e.b.exiting ? "#facc15" : COLORS[e.b.type]))
      .attr("stroke-dasharray", (e) => (e.b.type === "peer" ? "3 5" : null));
    gHits.selectAll("path.edge-hit").data(edges.filter((e) => !e.b.exiting), (e) => e.id).join("path").attr("class", "edge-hit")
      .on("pointerenter", (ev, e) => onEnter(ev, e.b)).on("pointerleave", onLeave).on("pointerdown", (ev, e) => onDown(ev, e.b))
      .on("click", (ev, e) => onClick(ev, e.b));
  }

  // Wide pictures (wordmarks, TV title cards: wider than 1.6:1) are shown whole, inset in the
  // circle on a dark backing, instead of cropped to a fragment. Shape is measured as each loads.
  const shapeOf = new Map();
  function measure(url) {
    if (!url || shapeOf.has(url)) return shapeOf.get(url) ?? null;
    shapeOf.set(url, null);
    const im = new Image();
    im.onload = () => { shapeOf.set(url, im.naturalWidth / (im.naturalHeight || 1)); if (alive) updatePics(); };
    im.src = url;
    return null;
  }
  function updatePics() {
    const all = gNodes.selectAll("g.node");
    all.each((d) => { d.picWide = (measure(picOf(d)) ?? 0) > 1.6; });
    all.classed("has-pic", (d) => !!picOf(d)).classed("wide", (d) => !!picOf(d) && d.picWide);
    all.select(".pic").attr("href", (d) => picOf(d)).style("display", (d) => (picOf(d) ? null : "none"))
      .attr("preserveAspectRatio", (d) => (d.picWide ? "xMidYMid meet" : "xMidYMin slice"))
      .attr("clip-path", (d) => (d.picWide ? null : `url(#${clipId})`)); // inset wide pictures already clear the circle
    if (!anim && !wobble) draw();
  }

  const ease = d3.easeCubicOut, easeBack = d3.easeBackOut.overshoot(1.4);
  function frame(t0) {
    const t = performance.now() - t0;
    let busy = false;
    for (const n of live.values()) {
      const p = Math.max(0, Math.min(1, (t - n.delay) / n.dur));
      if (p < 1) busy = true;
      const e = ease(p);
      n.cx = n.x0 + (n.x1 - n.x0) * e;
      n.cy = n.y0 + (n.y1 - n.y0) * e;
      n.cs = n.s0 + (n.s1 - n.s0) * (n.s1 > n.s0 ? easeBack(p) : e);
      n.ccr = n.cr0 + (n.r1 - n.cr0) * e;
      n.x = n.cx; n.y = n.cy;
      n.labelP = Math.max(0, Math.min(1, (t - n.delay - n.dur * 0.6) / 300));
    }
    draw();
    if (!busy) {
      anim.stop(); anim = null;
      for (const [k, n] of live) if (n.exiting) live.delete(k);
      render();
      if (zoomAfterBuild) { zoomAfterBuild = false; if (visibleRect().w < 640) frameDefault("ease-in"); }
    }
  }

  function draw() {
    gNodes.selectAll("g.node").each(function (d) {
      const g = d3.select(this);
      const r = d.ccr;
      g.attr("transform", `translate(${d.cx},${d.cy + (d.sw || 0)}) scale(${Math.max(0, d.cs)})`).style("opacity", d.exiting ? Math.max(0, d.cs) : null);
      g.select(".disc").attr("r", r);
      g.select(".ring").attr("r", r);
      g.select(".halo").attr("r", d.mix ? r + 4.5 : 0);
      // A wide picture sits in an inner square (0.75r out from center) so the whole of it clears the circle.
      const pr = d.picWide ? r * 0.75 : r;
      g.select(".pic").attr("x", -pr).attr("y", -pr).attr("width", pr * 2).attr("height", pr * 2);
      g.select(".initials").style("font-size", `${Math.max(8, r * 0.55)}px`);
      const fs = d.labelFs || (d.type === "center" ? 19 : 11);
      g.select(".label").attr("y", r + fs * (d.type === "center" ? 1.35 : 1.25)).style("opacity", d.labelHidden ? 0 : d.labelP);
    });
    const back = trail[trailPos - 1];
    gEdges.selectAll("path.edge").each(function (e) {
      const a = e.a, b = e.b;
      if (!a || !b) return;
      a.cr = a.ccr * Math.max(a.cs, 0.001); b.cr = b.ccr * Math.max(b.cs, 0.001);
      d3.select(this).attr("d", edgePath(a, b))
        .attr("stroke-opacity", (b.exiting ? 0.45 * Math.max(0, b.cs) : 0.5 * Math.min(1, Math.max(0, b.cs))) * (b.name === back ? 1.6 : b.mix ? 1.5 : 0.8))
        .attr("stroke-width", b.name === back && !b.exiting ? 2.2 : b.mix ? 2.4 : 0.8 + (Math.min(b.weight || 0, 10) / 10) * 1.2);
    });
    gHits.selectAll("path.edge-hit").attr("d", (e) => edgePath(e.a, e.b));
  }

  // Rubber-band drag. Each node is a damped spring to its home; while one is grabbed the others'
  // homes lean toward it by proximity, so they follow and lag on the way back.
  let wobble = null, dragging = false, grabbed = null;
  function springs() {
    let nodes;
    function force() {
      const ox = grabbed ? grabbed.x - grabbed.hx : 0, oy = grabbed ? grabbed.y - grabbed.hy : 0;
      const pullingCenter = grabbed && grabbed.type === "center";
      for (const n of nodes) {
        let w = 0;
        if (pullingCenter && n !== grabbed) {
          // The whole map follows the center; far bubbles hang on looser springs, so they trail and swing.
          const d = Math.hypot(n.hx - grabbed.hx, n.hy - grabbed.hy);
          w = 0.96;
          n.k = 0.005 + 0.018 * Math.exp(-(d * d) / (2 * 170 * 170));
        } else if (grabbed && n !== grabbed) {
          const d2 = (n.hx - grabbed.hx) ** 2 + (n.hy - grabbed.hy) ** 2;
          w = n.type === "center" ? 0.32 : 0.6 * Math.exp(-d2 / (2 * 190 * 190));
        }
        const k = n === grabbed ? 0.02 : n.k || 0.018;
        n.vx += (n.hx + ox * w - n.x) * k;
        n.vy += (n.hy + oy * w - n.y) * k;
      }
    }
    force.initialize = (ns) => { nodes = ns; };
    return force;
  }
  function startWobble() {
    const nodes = [...live.values()].filter((n) => !n.exiting);
    for (const n of nodes) { n.x = n.cx; n.y = n.cy; n.hx = n.x1; n.hy = n.y1; n.vx = n.vx || 0; n.vy = n.vy || 0; }
    if (wobble) wobble.stop();
    wobble = d3.forceSimulation(nodes)
      // Softer springs with more friction (Tony, 2026-10-02: "too springy"): neighbors drift after
      // the center and settle with at most a slight overshoot; the farthest float in without one.
      .alphaDecay(0.022).velocityDecay(0.17)
      .force("springs", springs())
      .force("bump", d3.forceCollide((n) => n.ccr + 6).strength(0.5))
      .on("tick", () => { for (const n of nodes) { n.cx = n.x; n.cy = n.y; } draw(); })
      .on("end", () => { for (const n of nodes) { n.cx = n.x = n.hx; n.cy = n.y = n.hy; n.vx = n.vy = 0; n.k = null; } draw(); wobble = null; });
  }
  // Momentum (Tony, 2026-10-02): a thrown center keeps going and eases to a stop instead of
  // halting on release. Velocity comes from the last ~100ms of the drag; it decays
  // exponentially (time constant GLIDE_TAU), and the map trails it on the same springs.
  const GLIDE_TAU = 325, MAX_SCREEN_V = 1.6; // ms; screen pixels per ms (so a flick looks the same at any zoom)
  let glide = null, samples = [];
  function settleCenter(d) {
    // The center's resting place becomes the map's new home; the others swing in around it.
    const ox = d.x - d.hx, oy = d.y - d.hy;
    for (const n of live.values()) { n.hx += ox; n.hy += oy; n.x1 += ox; n.y1 += oy; }
    d.fx = d.fy = null;
    grabbed = null;
    if (wobble) wobble.alphaTarget(0).alpha(1).restart();
  }
  function stopGlide(d) { if (!glide) return; glide.stop(); glide = null; if (d) settleCenter(d); }
  function startGlide(d) {
    const now = performance.now();
    const recent = samples.filter((p) => now - p.t < 100);
    samples = [];
    if (REDUCED || recent.length < 2) { settleCenter(d); return; }
    const a = recent[0], b = recent[recent.length - 1], span = Math.max(b.t - a.t, 16);
    let vx = (b.x - a.x) / span, vy = (b.y - a.y) / span;
    const speed = Math.hypot(vx, vy);
    if (speed < 0.05) { settleCenter(d); return; }
    const maxV = MAX_SCREEN_V / (webView.k || 1);
    if (speed > maxV) { vx *= maxV / speed; vy *= maxV / speed; }
    let last = 0;
    glide = d3.timer((elapsed) => {
      const dt = Math.min(elapsed - last, 50); last = elapsed;
      const decay = Math.exp(-dt / GLIDE_TAU);
      vx *= decay; vy *= decay;
      d.fx += vx * dt; d.fy += vy * dt;
      if (Math.hypot(vx, vy) < 0.01) stopGlide(d);
    });
  }

  const drag = d3.drag()
    .clickDistance(5)
    .subject((ev, d) => ({ x: d.cx, y: d.cy }))
    .on("start", (ev, d) => { if (glide && d.type === "center") stopGlide(d); }) // a touch catches it
    .on("drag", (ev, d) => {
      if (anim || d.exiting) return;
      if (!dragging) {
        // Only a real move starts the tug, so taps, clicks and press-and-hold still work.
        clearTimeout(holdT); clearTimeout(hoverT); unpress();
        dragging = true;
        if (!wobble) startWobble();
        grabbed = d;
        wobble.alphaTarget(0.35).restart();
      }
      if (!wobble) return;
      if (d.type === "center") { // the center goes wherever you take it
        d.fx = ev.x; d.fy = ev.y;
        samples.push({ t: performance.now(), x: ev.x, y: ev.y });
        if (samples.length > 12) samples.shift();
        return;
      }
      const dx = ev.x - d.hx, dy = ev.y - d.hy, dist = Math.hypot(dx, dy) || 1;
      const k = (STRETCH * Math.tanh(dist / STRETCH)) / dist;
      d.fx = d.hx + dx * k; d.fy = d.hy + dy * k;
    })
    .on("end", (ev, d) => {
      if (!dragging) return;
      dragging = false;
      if (!wobble) return;
      if (d.type === "center") { startGlide(d); return; } // coasts, then settles
      d.fx = d.fy = null;
      grabbed = null;
      wobble.alphaTarget(0).alpha(1).restart();
    });

  // Hover (or press-and-hold on touch) shows the evidence; click or tap travels.
  let hoverT = null, hideT = null, holdT = null, held = false, cardFor = null;
  function onEnter(ev, d) {
    if (dragging || ev.pointerType === "touch" || d.exiting) return;
    clearTimeout(hideT); clearTimeout(hoverT);
    hoverT = setTimeout(() => { if (!dragging) showCard(d, false); }, panelOpen ? 320 : 1000);
  }
  function onLeave(ev) { if (ev.pointerType === "touch") return; clearTimeout(hoverT); } // the panel stays; nothing pops away
  // Phones (2026-10-02, Tony): a tap is for looking, a hold is for going. Tap opens the
  // relationship card (the bio on the center); press and hold re-centers the map on that
  // bubble, with its ring lighting up while the hold registers. Desktop: hover shows, click travels.
  let touchTap = false, pressT = null;
  const unpress = () => { clearTimeout(pressT); gNodes.selectAll(".pressing").classed("pressing", false); };
  function onDown(ev, d) {
    touchTap = ev.pointerType === "touch";
    if (!touchTap) return;
    held = false; clearTimeout(holdT); unpress();
    const el = gNodes.selectAll("g.node").filter((n) => n === d);
    pressT = setTimeout(() => el.classed("pressing", true), 140);
    holdT = setTimeout(() => {
      held = true; unpress();
      try { navigator.vibrate?.(12); } catch { /* optional */ }
      if (d.type === "center" || !canTravel) showCard(d, true); else travel(d);
    }, 480);
    const cancel = () => { clearTimeout(holdT); unpress(); window.removeEventListener("pointerup", cancel); window.removeEventListener("pointercancel", cancel); };
    window.addEventListener("pointerup", cancel); window.addEventListener("pointercancel", cancel);
  }
  function onClick(ev, d) {
    ev.stopPropagation();
    if (held) { held = false; return; }
    if (touchTap || !canTravel) { showCard(d, touchTap); return; } // a tap only changes what the panel shows
    travel(d);
  }
  let travelling = null;
  async function travel(d) {
    if (d.type === "center" || d.exiting) return;
    const dest = destOf(d);
    travelling = dest;
    const slow = setTimeout(() => toast(`Loading ${dest}…`, true), 250);
    let name = dest, g = await loadGraph(dest);
    if (!g && dest !== d.name) { name = d.name; g = await loadGraph(d.name); }
    clearTimeout(slow);
    if (!alive || travelling !== dest) return;
    hideToast();
    if (!g) { toast(`Kynda hasn't mapped ${d.name} yet.`); render(); return; }
    go(name);
  }
  const menuPanelClosed = () => q("menupanel").hidden; // Esc closes the open menu first
  const onEsc = (e) => { if (e.key === "Escape" && panelOpen && menuPanelClosed()) hideCard(true); };
  document.addEventListener("keydown", onEsc);
  // A tap or click on empty map does nothing: the panel closes only with × (or Esc).

  // "Ask Kynda to map this" in map mode (Tony, 2026-10-03, BACKLOG #34): an
  // unmapped center (Chuck Mangione, one link back to Dizzy Gillespie) or a
  // stop the map can't travel to offers the same request the Mix tab does —
  // one vote in the admin queue (V3-90), never a generation.
  const requested = new Map(); // name → "sending" | "sent" | "error"
  function requestBlock(name, lead) {
    if (!canTravel) return "";
    const st = requested.get(name);
    return `<div class="request"><p>${lead}</p><button class="ask"${st === "sending" || st === "sent" ? " disabled" : ""}>${st === "sent" ? "Requested ✓ — thanks" : st === "sending" ? "Sending…" : "Ask Kynda to map this"}</button>${st === "error" ? `<span class="err">Couldn't send that — try again.</span>` : ""}</div>`;
  }
  function wireRequest(d, ids, rerender) {
    const btn = card.querySelector(".ask"); if (!btn) return;
    btn.onclick = async () => {
      requested.set(d.name, "sending"); rerender();
      try {
        const r = await fetch("/api/request-map", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: d.name, ...ids }) });
        requested.set(d.name, r.ok ? "sent" : "error");
      } catch { requested.set(d.name, "error"); }
      if (alive && cardFor === d) rerender();
    };
  }

  // "Not this one?" — when the search behind this page was ambiguous, the other matches sit in the
  // About panel (they used to sit under the map).
  function altsBlock(d) {
    const alts = d.name === subjectName && onAlternative ? (getAlternatives() || []) : [];
    if (!alts.length) return "";
    return `<div class="alts"><div class="kind">Not this one?</div>${alts.map((a, i) =>
      `<button data-alt="${i}"><b>${esc(a.name)}</b>${a.description ? `<span>${esc(a.description)}</span>` : ""}</button>`).join("")}</div>`;
  }

  async function showBioCard(d, touch) {
    cardFor = d;
    const bio = await loadBio(d.name);
    if (!alive || cardFor !== d) return;
    const cg = graphs.get(d.name);
    const unmapped = cg?.hasMix === false;
    const links = cg ? (cg.predecessors?.length || 0) + (cg.peers?.length || 0) + (cg.successors?.length || 0) : 0;
    const text = bio?.text ? (bio.text.length > 700 ? bio.text.slice(0, 700).replace(/\s+\S*$/, "") + "…" : bio.text) : null;
    card.innerHTML = `
      <button class="x" aria-label="Close">×</button>
      <div class="kind" style="color:var(--gold)">${bio?.source === "Kynda" ? "About · Kynda synthesis" : "About"}</div>
      <h2>${esc(d.name)}</h2>
      ${bio?.description ? `<div class="meta">${esc(bio.description)}</div>` : ""}
      ${text ? `<p class="summary bio">${esc(text)}</p>` : `<p class="summary">No bio for ${esc(d.name)} yet.</p>`}
      ${creditLine(d)}
      ${unmapped ? requestBlock(d.name, `Kynda hasn't mapped ${esc(d.name)} yet${links <= 3 ? ", so this is as far as the map goes from here" : "; these are the connections other maps found"}. Ask, and it joins the queue for the next build.`) : ""}
      ${bio?.url || (d.name !== subjectName && onOpenSubject) || curating(d) ? `<div class="foot"><span>${bio?.url ? `<a href="${esc(bio.url)}" target="_blank" rel="noopener">${esc(bio.articleTitle ? `Wikipedia: ${bio.articleTitle}` : "Wikipedia")} ↗</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener license">text CC BY-SA 4.0</a>` : ""}</span>
        <span class="acts">${curating(d) ? `<button class="fix">Fix image</button>` : ""}${d.name !== subjectName && onOpenSubject ? `<button class="open">Open page</button>` : ""}</span></div>` : ""}
      ${altsBlock(d)}`;
    placeCard(d, touch);
    card.querySelectorAll("[data-alt]").forEach((b) => { b.onclick = () => onAlternative?.(+b.dataset.alt); });
    const openBtn = card.querySelector(".open"); if (openBtn) openBtn.onclick = () => onOpenSubject(d.name);
    const fixBtn = card.querySelector(".fix"); if (fixBtn) fixBtn.onclick = () => openCurator(d);
    if (unmapped) wireRequest(d, { wikidata_qid: cg.subjectQid || null, mbid: cg.subjectMbid || null, domain: (cg.domain || "").toLowerCase() || null }, () => showBioCard(d, touch));
  }

  function showCard(d, touch) {
    if (d.type === "center") { showBioCard(d, touch); return; }
    cardFor = d;
    const dest = destOf(d);
    // Warm the next hop so travel is instant; if it turns out to be a dead end, redraw with the request.
    loadGraph(dest).then(() => { if (alive && cardFor === d && isDead(d) && canTravel && !card.querySelector(".request")) showCard(d, touch); });
    const ev0 = (d.evidence || [])[0];
    const normQ = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const quotes = [];
    for (const x of d.evidence || []) {
      if (!x.quote) continue;
      const k = normQ(x.quote);
      if (quotes.some((p) => { const j = normQ(p.quote); return j.includes(k) || k.includes(j); })) continue;
      quotes.push(x); if (quotes.length === 2) break;
    }
    const rel = CLAIM_LABELS[d.claimType] || d.claimType || "";
    const n = (d.evidence || []).length;
    card.innerHTML = `
      <button class="x" aria-label="Close">×</button>
      <div class="kind" style="color:${d.mix ? d.mix.color : TEXT_COLORS[d.type]}">${d.mix ? esc(d.mix.label) : `${TYPE_LABEL[d.type]} · ${esc(rel)}`}</div>
      <h2>${esc(d.name)}</h2>
      ${d.creator || d.year ? `<div class="meta">${esc(d.creator || "")}${d.creator && d.year ? " · " : ""}${d.year ? fmtYear(d.year) : ""}</div>` : ""}
      ${d.mix?.reason ? `<p class="summary">${esc(d.mix.reason)}</p>` : d.summary ? `<p class="summary">${esc(d.summary)}</p>` : ""}
      ${d.via?.length ? `<div class="via">${d.viaOnly ? "Via" : "Also via"} ${d.via.slice(0, 3).map((w) => `<i>${esc(w)}</i>`).join(", ")}${d.via.length > 3 ? ` and ${d.via.length - 3} more` : ""}</div>` : ""}
      ${quotes.map((x) => `<blockquote>“${esc(x.quote.replace(/^["“]|["”]$/g, ""))}”<cite>${x.speaker ? esc(x.speaker) + " · " : ""}${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.publication || host(x.url))}</a>` : esc(x.publication || "")}</cite></blockquote>`).join("")}
      ${!quotes.length && ev0 ? `<blockquote class="plain">Documented link${ev0.url ? ` · <a href="${esc(ev0.url)}" target="_blank" rel="noopener">${esc(ev0.publication || host(ev0.url))}</a>` : ""}</blockquote>` : ""}
      ${creditLine(d)}
      ${canTravel && isDead(d) ? requestBlock(d.name, `Kynda hasn't mapped ${esc(d.name)} yet, so the map can't travel there.`) : ""}
      <div class="foot"><span>${n ? `${n} source${n === 1 ? "" : "s"} · ${esc(d.tier || "")}` : "mix pick"}</span>
        <span class="acts">${curating(d) ? `<button class="fix">Fix image</button>` : ""}${onOpenSubject ? `<button class="open">Open page</button>` : ""}${!canTravel || isDead(d) ? "" : `<button class="go">${dest !== d.name && !missing.has(dest) ? `Travel to ${esc(dest)} →` : "Travel →"}</button>`}</span></div>`;
    const goBtn = card.querySelector(".go"); if (goBtn) goBtn.onclick = () => travel(d);
    if (canTravel && isDead(d)) wireRequest(d, { domain: (d.domain || "").toLowerCase() || null }, () => showCard(d, touch));
    const fixBtn = card.querySelector(".fix"); if (fixBtn) fixBtn.onclick = () => openCurator(d);
    const openBtn = card.querySelector(".open"); if (openBtn) openBtn.onclick = () => onOpenSubject(d.name);
    placeCard(d, touch);
  }

  // Place the card beside its node, clamped to the stage, and dim everything else.
  // Show a card in the docked panel and mark its bubble; the map itself is never covered.
  function placeCard(d, touch) {
    clearSelection();
    gNodes.selectAll("g.node").classed("hot", (n) => n === d);
    gEdges.selectAll("path.edge").classed("hot", (e) => e.b === d);
    const x = card.querySelector(".x"); if (x) x.onclick = () => hideCard(true);
    card.scrollTop = 0;
    setPanel(true);
  }
  function clearSelection() {
    gNodes.selectAll("g.node").classed("hot", false);
    gEdges.selectAll("path.edge").classed("hot", false);
  }
  // Closing is always deliberate now (×, Esc, a click on empty map, tapping the same bubble).
  function hideCard(force) {
    if (!force) return;
    cardFor = null;
    clearSelection();
    setPanel(false);
  }

  // ── Admin overlay (2026-10-02): a signed-in curator fixes pictures in place while browsing.
  // Same API as the /admin/images queue; every change shows on the map immediately.
  const curator = q("curator");
  const curating = (d) => !!adminToken && !!d.id;
  let curatorFor = null;
  async function adminCall(method, body, query = "") {
    const res = await fetch(`/api/admin/images${query}`, {
      method, headers: { "Content-Type": "application/json", "x-kynda-admin": adminToken },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("Your admin sign-in has expired. Sign in again at /admin.");
    if (!res.ok) throw new Error(data.error || "That didn't work.");
    return data;
  }
  function closeCurator() { curator.hidden = true; curatorFor = null; }
  async function openCurator(d) {
    hideCard(true);
    curatorFor = d;
    curator.hidden = false;
    curator.innerHTML = `<div class="ch"><div><div class="kind">Picture for</div><h3>${esc(d.name)}</h3></div><button class="x" aria-label="Close">×</button></div><p class="status">Loading…</p>`;
    curator.querySelector(".x").onclick = closeCurator;
    try {
      let view = await adminCall("GET", null, `?entity_id=${encodeURIComponent(d.id)}`);
      if (curatorFor !== d) return;
      renderCurator(d, view);
      if (!view.candidates.length && view.settled !== "none") {
        setCuratorStatus("Searching free sources…");
        view = await adminCall("POST", { action: "find", entity_id: d.id });
        if (curatorFor === d) renderCurator(d, view);
      }
    } catch (err) { if (curatorFor === d) setCuratorStatus(err.message, true); }
  }
  function setCuratorStatus(msg, bad) {
    const st = curator.querySelector(".status");
    if (st) { st.textContent = msg; st.classList.toggle("bad", !!bad); }
  }
  function applyToMap(d, view) {
    // Every node for this entity, on this map and any cached map, takes the new picture.
    const img = view.current ? { ...view.current } : null;
    for (const n of live.values()) if (n.id === d.id) n.image = img;
    for (const g of graphs.values()) {
      if (g.subjectId === d.id) g.subjectImage = img;
      for (const k of ["predecessors", "peers", "successors"]) for (const n of g[k] || []) if (n.id === d.id) n.image = img;
    }
    updatePics();
  }
  function renderCurator(d, view) {
    const cur = view.current;
    const tag = (c) => [c.license, c.credit].filter(Boolean).map(esc).join(" · ");
    curator.innerHTML = `
      <div class="ch"><div><div class="kind">Picture for</div><h3>${esc(view.entity.name)}</h3>
        <div class="meta">${esc([view.entity.kind, view.entity.domain, view.entity.creator].filter((x) => x && x !== "other").join(" · "))}</div></div>
        <button class="x" aria-label="Close">×</button></div>
      ${view.context?.length ? `<p class="ctx">${view.context.map(esc).join("<br>")}</p>` : ""}
      <div class="sec">Now showing</div>
      ${cur ? `<div class="cur"><img src="${esc(cur.url)}" alt=""><div><div class="lic">${tag(cur)}</div>
          <div class="src">${esc(cur.status === "auto" ? `Picked automatically${cur.identity ? ` (${cur.identity})` : ""}` : cur.status === "approved" ? "Chosen by a curator" : "From the pipeline")}</div>
          ${cur.page ? `<a href="${esc(cur.page)}" target="_blank" rel="noopener">Source ↗</a>` : ""}
          <div class="row"><button data-act="remove">Remove</button><button data-act="none">No good picture</button></div></div></div>`
        : `<p class="empty">${view.settled === "none" ? "Marked as having no good picture." : "No picture yet."}${!cur && view.settled !== "none" ? ` <button class="link" data-act="none">Mark as no good picture</button>` : ""}</p>`}
      <div class="sec">Candidates <span>${view.candidates.length}</span></div>
      <p class="status"></p>
      <div class="grid">${view.candidates.map((c) => `
        <figure>
          <a href="${esc(c.page || c.url)}" target="_blank" rel="noopener" title="Open the source"><img src="${esc(c.url)}" alt="" loading="lazy"></a>
          <figcaption><b>${esc(c.title || c.source)}</b>${c.description ? `<span>${esc(c.description)}</span>` : ""}
            <span class="lic${c.fair_use ? " fu" : ""}">${c.fair_use ? "Fair use · " : ""}${tag(c)}</span></figcaption>
          <button data-use="${esc(c.id)}">Use this</button>
        </figure>`).join("") || `<p class="empty">No candidates. Try a search below.</p>`}</div>
      <form class="search"><input name="q" placeholder="Search with other words…" aria-label="Search for a picture"><button>Search</button></form>
      <form class="paste"><input name="u" placeholder="Or paste a Wikimedia Commons file link" aria-label="Commons file link"><button>Use link</button></form>`;
    curator.querySelector(".x").onclick = closeCurator;
    const act = async (body, busy) => {
      setCuratorStatus(busy);
      curator.classList.add("busy");
      try {
        const v = await adminCall("POST", { entity_id: d.id, ...body });
        if (curatorFor !== d) return;
        applyToMap(d, v);
        renderCurator(d, v);
      } catch (err) { setCuratorStatus(err.message, true); }
      finally { curator.classList.remove("busy"); }
    };
    curator.querySelectorAll("[data-use]").forEach((b) => { b.onclick = () => act({ action: "approve", candidate_id: b.dataset.use }, "Applying…"); });
    curator.querySelectorAll("[data-act]").forEach((b) => { b.onclick = () => act({ action: b.dataset.act }, b.dataset.act === "remove" ? "Removing…" : "Saving…"); });
    curator.querySelector(".search").onsubmit = (e) => { e.preventDefault(); const v = e.target.q.value.trim(); if (v) act({ action: "find", query: v }, "Searching free sources…"); };
    curator.querySelector(".paste").onsubmit = (e) => { e.preventDefault(); const v = e.target.u.value.trim(); if (v) act({ action: "use_url", url: v }, "Checking the license…"); };
  }
  if (adminToken) q("adminbadge").hidden = false;

  function updateTrail() {
    const el = q("trail");
    el.innerHTML = "";
    trail.forEach((n, i) => {
      if (i) { const s = document.createElement("span"); s.className = "sep"; s.textContent = "→"; el.appendChild(s); }
      const b = document.createElement("button"); b.textContent = n;
      if (i === trailPos) b.setAttribute("aria-current", "true");
      b.onclick = () => { trailPos = i; go(n, { push: false }); };
      el.appendChild(b);
    });
    el.querySelector('[aria-current="true"]')?.scrollIntoView({ inline: "nearest", block: "nearest" });
    q("trailbox").hidden = trail.length < 2;
    root.classList.toggle("has-trail", trail.length >= 2); // desktop: the legend steps up to make room for the trail
    const open = q("openpage");
    // With the page following the center, "Open X" would only repeat the header.
    open.hidden = !onOpenSubject || !!onCenter || center === subjectName;
    open.textContent = `Open ${short(center, 26)} →`;
  }
  function updateLegend(target) {
    const slots = [...new Map(target.filter((n) => n.mix).map((n) => [n.mix.slot, n.mix])).values()];
    q("mixkey").innerHTML = slots.length ? `<b>KyndaMix</b>` + slots.map((m) => `<span><i class="ringdot" style="border-color:${m.color}"></i>${esc(m.label)}</span>`).join("") : "";
    q("count").textContent = viewFor(lastCounts) === "mix"
      ? `${lastCounts.mix} KyndaMix picks · ${lastCounts.all} connections in all`
      : `${target.length - 1} connections${slots.length ? ` · ${target.filter((n) => n.mix).length} in the KyndaMix` : ""}`;
  }

  let toastT;
  function toast(msg, sticky) {
    const t = q("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); if (!sticky) toastT = setTimeout(hideToast, 2600);
  }
  function hideToast() { q("toast").classList.remove("show"); }

  // Controls
  q("keybtn").onclick = (e) => { const open = q("legend").classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", String(open)); };
  // Options menu: Pictures, Replay, Copy path behind one button.
  const menuBtn = q("menubtn"), menuPanel = q("menupanel");
  const setMenu = (open) => { menuPanel.hidden = !open; menuBtn.setAttribute("aria-expanded", String(open)); };
  menuBtn.onclick = (e) => { e.stopPropagation(); setMenu(menuPanel.hidden); };
  const closeMenuOutside = (e) => { if (!menuPanel.hidden && !menuPanel.contains(e.target) && e.target !== menuBtn) setMenu(false); };
  const closeMenuOnEsc = (e) => { if (e.key === "Escape" && !menuPanel.hidden) { setMenu(false); menuBtn.focus(); } };
  document.addEventListener("pointerdown", closeMenuOutside);
  document.addEventListener("keydown", closeMenuOnEsc);
  q("pics").onclick = (e) => {
    picsOn = e.currentTarget.getAttribute("aria-pressed") !== "true";
    e.currentTarget.setAttribute("aria-pressed", String(picsOn));
    stage.classList.toggle("pics-on", picsOn);
    setMenu(false);
  };
  q("replay").onclick = () => {
    for (const n of [...live.values()]) if (n.name !== center) live.delete(n.name);
    gNodes.selectAll("g.node").filter((d) => d.name !== center).remove();
    gEdges.selectAll("path.edge").remove();
    live.clear();
    setMenu(false);
    go(center, { push: false });
  };
  // ◎ Center: back to the resting view, wherever the map has been dragged, thrown or panned.
  q("recenter").onclick = () => { setMenu(false); frameDefault("glide"); };
  // Mix ⇄ Full: the extra bubbles grow in (or shrink away) through the usual build animation.
  q("viewtoggle").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-view]");
    if (!b || b.getAttribute("aria-pressed") === "true") return;
    viewPref = b.dataset.view;
    try { localStorage.setItem(VIEW_KEY, viewPref); } catch { /* storage blocked */ }
    go(center, { push: false, fresh: true });
  });
  // Share and print the subject now at the center (the page address follows the map's center).
  q("share").onclick = async () => {
    setMenu(false);
    const url = `${location.origin}${location.pathname}`;
    try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch { toast(url); }
  };
  const pdfLink = q("pdf");
  if (!canTravel) pdfLink.hidden = true; // the printable page sits behind the site password; demo pages are public
  pdfLink.addEventListener("click", () => { pdfLink.href = `/s/${slugify(center)}/print`; setMenu(false); });
  q("copy").onclick = async () => {
    const text = trail.slice(0, trailPos + 1).join(" → ");
    setMenu(false);
    try { await navigator.clipboard.writeText(text); toast("Path copied"); } catch { toast(text); }
  };
  q("openpage").onclick = () => onOpenSubject?.(center);
  if (!canTravel) q("hint").textContent = matchMedia("(hover: none)").matches
    ? "Tap a bubble for the evidence · drag to tug" : "Hover or click a bubble for the evidence · drag to tug · scroll to zoom";
  else if (matchMedia("(hover: none)").matches) q("hint").textContent = "Tap for the evidence · press and hold to travel · drag to tug";

  // Re-fit when the panel changes size (window resize, or the tab coming back into view).
  // lastW starts at the current width: the observer's first report on mount is not a resize, and
  // treating it as one restarted the build mid-animation (every bubble popped at once).
  let rz, lastW = 0;
  const ro = new ResizeObserver(() => {
    resizeWeb();
    const { w } = size();
    if (w === 0) return;
    if (waitingForSize || Math.abs(w - lastW) > 40) {
      clearTimeout(rz);
      rz = setTimeout(() => { const p = pendingGo; pendingGo = null; p ? go(p.name, { push: p.push, quiet: p.quiet }) : go(center, { push: false }); }, waitingForSize ? 0 : 250);
    }
    lastW = w;
  });
  ro.observe(stage);

  // Background web: an endless jittered mesh (connectivity comes from hashing grid coordinates, so it never
  // runs out), held in place, with one slow swell rolling through it. Follows pan and zoom at a fraction.
  const cv = q("web"), ctx = cv.getContext("2d");
  const GAP = 38, PARALLAX = 0.18, BUCKETS = 6;
  const hash = (i, j, s) => { let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  let cw = 0, chh = 0, dpr = 1;
  function resizeWeb() {
    dpr = Math.min(2, devicePixelRatio || 1);
    const r = cv.getBoundingClientRect(); cw = r.width; chh = r.height;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(chh * dpr);
    webFrame(motionOn ? performance.now() : frozenAt);
  }
  // The surface both planes ride: two slow travelling waves (z) and one broad swell (band),
  // in screen coordinates. The swell enters and leaves off-screen, so the loop never pops.
  function swellFront(t) {
    const span = cw * 0.8 + chh * 0.6, period = 14000;
    return -700 + ((t % period) / period) * (span + 1400);
  }
  function surface(x, y, t, front) {
    const z = Math.sin(x * 0.0042 + t * 0.00021) * Math.cos(y * 0.0051 - t * 0.00016) + 0.6 * Math.sin((x + y) * 0.0023 + t * 0.00013);
    const along = x * 0.8 + y * 0.6 - front;
    return { z, band: Math.exp(-(along * along) / (2 * 230 * 230)) };
  }
  // The map floats on a plane above the web: each bubble takes the surface's lift at its spot on
  // screen, about half a second behind the web. Drawing only — physics and layout never see it.
  const SWAY_LAG = 550;
  function sway(t) {
    const tt = t - SWAY_LAG, front = swellFront(tt), k = webView.k || 1;
    for (const n of live.values()) {
      const sx = webView.x + (n.cx ?? 0) * k, sy = webView.y + (n.cy ?? 0) * k;
      const { z, band } = surface(sx, sy, tt, front);
      n.sw = (z * 8 - band * 14) / k; // screen pixels → map units
    }
  }

  function webFrame(t) {
    if (!cw || !chh) return;
    const k = 1 + (webView.k - 1) * PARALLAX, gap = GAP * k;
    const ox = webView.x * PARALLAX, oy = webView.y * PARALLAX;
    const i0 = Math.floor(-ox / gap) - 1, j0 = Math.floor(-oy / gap) - 1;
    const cols = Math.ceil(cw / gap) + 3, rows = Math.ceil(chh / gap) + 3;
    const P = new Array(cols * rows);
    const front = swellFront(t);
    for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) {
      const i = i0 + a, j = j0 + b;
      const x = ox + (i + (hash(i, j, 1) - 0.5) * 0.8) * gap;
      let y = oy + (j + (hash(i, j, 2) - 0.5) * 0.8) * gap;
      const { z, band } = surface(x, y, t, front);
      y += z * 8 - band * 14;
      P[a * rows + b] = [x, y, ((z + 1.6) / 3.2) * 0.8 + band * 0.6];
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cw, chh);
    const paths = Array.from({ length: BUCKETS }, () => new Path2D());
    const seg = (p, s) => { const l = Math.min(BUCKETS - 1, Math.max(0, Math.floor(((p[2] + s[2]) / 2) * BUCKETS))); paths[l].moveTo(p[0], p[1]); paths[l].lineTo(s[0], s[1]); };
    for (let a = 0; a < cols - 1; a++) for (let b = 0; b < rows - 1; b++) {
      const i = i0 + a, j = j0 + b, p = P[a * rows + b];
      if (hash(i, j, 4) > 0.12) seg(p, P[(a + 1) * rows + b]);
      if (hash(i, j, 5) > 0.12) seg(p, P[a * rows + b + 1]);
      if (hash(i, j, 6) > 0.3) { if (hash(i, j, 7) > 0.5) seg(p, P[(a + 1) * rows + b + 1]); else seg(P[(a + 1) * rows + b], P[a * rows + b + 1]); }
    }
    ctx.lineWidth = 0.6;
    for (let l = 0; l < BUCKETS; l++) { ctx.strokeStyle = `rgba(148,163,184,${0.022 + l * 0.026})`; ctx.stroke(paths[l]); }
    for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) {
      const p = P[a * rows + b], big = hash(i0 + a, j0 + b, 9) > 0.93;
      ctx.fillStyle = `rgba(168,200,216,${Math.min(0.5, (big ? 0.12 : 0.06) + p[2] * (big ? 0.22 : 0.12))})`;
      ctx.beginPath(); ctx.arc(p[0], p[1], big ? 1.5 : 0.8, 0, 6.283); ctx.fill();
    }
  }
  // Ambient motion (the swell under the web and the map) can be turned off from the menu;
  // the choice is remembered in this browser. Reduced-motion users start with it off.
  let raf = 0, lastWeb = 0, frozenAt = 0;
  let motionOn = !REDUCED;
  try { const pref = localStorage.getItem("kynda_map_motion"); if (pref) motionOn = pref === "on"; } catch { /* storage blocked */ }
  const motionBtn = q("motion");
  function setMotion(on, remember) {
    motionOn = on;
    motionBtn.setAttribute("aria-pressed", String(on));
    if (remember) { try { localStorage.setItem("kynda_map_motion", on ? "on" : "off"); } catch { /* storage blocked */ } }
    if (!on) {
      // Freeze where things are: the web holds its last frame, the map settles onto its plane.
      frozenAt = lastWeb || 0;
      for (const n of live.values()) n.sw = 0;
      if (!anim && !wobble) draw();
      webFrame(frozenAt);
    }
  }
  motionBtn.onclick = () => { setMotion(!motionOn, true); setMenu(false); };
  setMotion(motionOn, false);
  zoom.on("zoom.web", () => { if (!motionOn) webFrame(frozenAt); }); // a still web still follows pan and zoom
  const loop = (t) => {
    if (!alive) return;
    if (motionOn && !document.hidden && cw && t - lastWeb > 33) {
      lastWeb = t; webFrame(t);
      sway(t);
      if (!anim && !wobble) draw(); // otherwise the running animation draws with these offsets
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  resizeWeb();

  // The panel opens with the subject's About text (Tony, 2026-10-03), framed in from the first frame.
  panelOpen = true;
  applyPanel();
  go(subjectName, { push: false });
  lastW = size().w;
  { const c = live.get(subjectName); if (c) showCard(c, false); }

  return {
    // Alternatives arrived (an ambiguous search resolves after the map mounts): redraw the About card if it's showing.
    refreshAbout() { if (cardFor && cardFor.type === "center" && panelOpen) showCard(cardFor, false); },
    // Browser Back/Forward: step along the trail if the stop is on it, else travel there.
    // quiet (default) = Back/Forward, no new history entry; quiet:false = an "Open page" travel.
    async show(name, { quiet = true } = {}) {
      if (!alive || name === center) return;
      const i = trail.indexOf(name);
      if (i !== -1) { trailPos = i; go(name, { push: false, quiet }); return; }
      const g = await loadGraph(name);
      if (g && alive) go(name, { quiet });
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (anim) anim.stop();
      if (wobble) wobble.stop();
      if (glide) glide.stop();
      svg.interrupt();
      clearTimeout(hoverT); clearTimeout(hideT); clearTimeout(holdT); clearTimeout(rz); clearTimeout(toastT);
      document.removeEventListener("keydown", onEsc);
      document.removeEventListener("pointerdown", closeMenuOutside);
      document.removeEventListener("keydown", closeMenuOnEsc);
      svg.selectAll("*").remove();
    },
  };
}
