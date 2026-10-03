// Discover (2026-10-03): a consumer-friendly home prototype. One card per
// category rotates through featured maps — a rights-cleared photo with a
// Ken Burns drift, wiped left to right to the next feature — with the
// category's full list in a contained panel below the photo. Lives beside the current
// home (/) until Tony picks between them.

import { readFileSync } from "node:fs";
import path from "node:path";
import DiscoverHome from "./discover-home.jsx";
import { listHomeCards } from "../../src/lib/store.js";
import { slugify } from "../../src/lib/slug.js";
import { siteOpen, isPrivateSubject } from "../../src/lib/site.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kynda — discover", robots: { index: false } };

// Display order and labels; the stored domain 'other' reads as "ideas".
const ORDER = ["music", "film", "television", "literature", "art", "dance", "fashion", "comedy", "architecture", "theater", "design", "other"];
const LABEL = { other: "Ideas" };
const BLURB = {
  music: "Who they listened to, and who listened back",
  film: "Directors, stars and the films that made them",
  television: "The shows and showrunners behind the shows",
  literature: "Writers and the writers they read",
  art: "Painters, sculptors and their lineages",
  dance: "Choreographers and the bodies that taught them",
  fashion: "Designers and what they borrowed",
  comedy: "Who made the funny people funny",
  architecture: "Buildings, and the builders behind them",
  theater: "The stage and its family tree",
  design: "Objects, schools and the people who drew them",
  other: "Thinkers, figures and movements",
};

// Same modern-canon gate as the current home (app/page.jsx, V3-57).
const MODERN_ONLY = new Set(["architecture"]);
const isModern = (s) => s.kind === "person" || s.kind === "group"
  ? !(s.year_end != null && s.year_end < 1900) && !(s.year_end == null && s.year_start != null && s.year_start < 1850)
  : !(s.year_start != null && s.year_start < 1900);

function loadFeatured() {
  try { return JSON.parse(readFileSync(path.join(process.cwd(), "data", "home-featured.json"), "utf8")).features || {}; }
  catch { return {}; }
}

// Commons originals can be huge; ask for a card-sized rendition (Wikimedia
// serves only its standard thumbnail widths — 120, 250, 330, 500, 960, 1280…).
function cardImage(url, px = 960) {
  if (!url) return null;
  const u = url.split("?")[0];
  const m = u.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/(\w+)\/(\w)\/(\w\w)\/([^/]+)$/);
  if (m) return `https://upload.wikimedia.org/wikipedia/${m[1]}/thumb/${m[2]}/${m[3]}/${m[4]}/${px}px-${m[4]}${/\.svg$/i.test(m[4]) ? ".png" : ""}`;
  if (/upload\.wikimedia\.org\/.+\/thumb\//.test(u)) return u.replace(/\/\d+px-/, `/${px}px-`);
  return url;
}

const years = (s) => {
  if (s.kind === "work") return s.year_start ? String(s.year_start) : null;
  if (s.year_start && s.year_end) return `${s.year_start}–${s.year_end}`;
  if (s.year_start) return `b. ${s.year_start}`;
  return null;
};

export default async function Page() {
  let rows = [];
  try { rows = await listHomeCards(); } catch { /* no database → empty home */ }
  const featured = loadFeatured();

  const subjects = rows
    .filter((s) => !MODERN_ONLY.has(s.domain) || isModern(s))
    .filter((s) => !(siteOpen() && isPrivateSubject(s.name)))
    .map((s) => ({
      name: s.name,
      slug: slugify(s.name),
      domain: s.domain || "other",
      isWork: s.kind === "work",
      creator: s.creator || null,
      years: years(s),
      image: cardImage(s.image_url),
      imageFull: s.image_url,
      thumb: cardImage(s.image_url, 120),
      credit: s.image_credit || null,
      license: s.image_license || null,
      imagePage: s.image_page || null,
      shape: { preds: s.preds, peers: s.peers, succs: s.succs },
      degree: s.preds + s.peers + s.succs,
    }));

  const categories = ORDER
    .map((domain) => {
      const all = subjects.filter((s) => s.domain === domain).sort((a, b) => a.name.localeCompare(b.name));
      if (!all.length) return null;
      const byName = new Map(all.map((s) => [s.name, s]));
      let feats = (featured[domain] || []).map((n) => byName.get(n)).filter((s) => s?.image);
      // Fallback for a category the featured file doesn't cover yet: best-evidenced with pictures.
      if (!feats.length) feats = all.filter((s) => s.image).sort((a, b) => b.degree - a.degree).slice(0, 8);
      if (!feats.length) return null;
      return { domain, label: LABEL[domain] || domain[0].toUpperCase() + domain.slice(1), blurb: BLURB[domain] || "", featured: feats.map((s) => s.slug), all };
    })
    .filter(Boolean);

  return <DiscoverHome categories={categories} total={subjects.length} />;
}
