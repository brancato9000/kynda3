// MusicBrainz client — music ground truth (CC0, no API key).
// Rate-limited to ~1 req/sec per MusicBrainz etiquette; identify with User-Agent.
// This module is part of the deterministic verification path: no model calls,
// exact comparisons only (V3-03).

const MB_ROOT = "https://musicbrainz.org/ws/2";
const USER_AGENT = "Kynda/0.1 (brancato@gmail.com)";
const RATE_MS = 1100;

let lastCall = 0;
let queue = Promise.resolve();

function rateLimited(fn) {
  const run = queue.then(async () => {
    const wait = lastCall + RATE_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
}

async function mbFetch(resource, params) {
  // Retry loops INSIDE the rate-limited task. Re-entering rateLimited() from
  // in here deadlocks: the retry waits on the queue, the queue waits on us
  // (caught live by CI as a Node exit-13 unsettled top-level await).
  return rateLimited(async () => {
    const url = new URL(`${MB_ROOT}/${resource}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("fmt", "json");
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (res.status === 503 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`MusicBrainz ${res.status} for ${resource}`);
      return res.json();
    }
  });
}

// Escape Lucene special characters for use inside a quoted phrase.
function luceneEscape(s) {
  return s.replace(/(["\\])/g, "\\$1");
}

// Normalize for exact-ish comparison: NFC, straighten curly punctuation,
// collapse whitespace, lowercase. Diacritics are preserved (Björk ≠ Bjork
// is not a distinction worth losing; MusicBrainz aliases cover variants).
export function norm(s) {
  return (s || "")
    .normalize("NFC")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Search artists by name. Returns real candidates for retrieval-first
 * disambiguation — the model may only rank these, never invent.
 */
export async function searchArtist(name, limit = 5) {
  const data = await mbFetch("artist", {
    query: `artist:"${luceneEscape(name)}"`,
    limit: String(limit),
  });
  return (data.artists || []).map((a) => ({
    mbid: a.id,
    name: a.name,
    score: a.score,
    disambiguation: a.disambiguation || null,
    country: a.country || null,
    type: a.type || null,
    lifeSpan: a["life-span"] || null,
  }));
}

/**
 * Canonical band-membership relationships (V3-16). For a group, returns its
 * members; for a person, the groups they belong(ed) to. This is hop 1 of
 * two-hop connection verification — a database fact, not a model claim.
 */
export async function getArtistMembers(mbid) {
  const data = await mbFetch(`artist/${mbid}`, { inc: "artist-rels" });
  const members = [];
  const seen = new Set();
  for (const rel of data.relations || []) {
    if (rel.type !== "member of band") continue;
    const other = rel.artist;
    if (!other || seen.has(other.id)) continue;
    seen.add(other.id);
    members.push({
      name: other.name,
      mbid: other.id,
      url: `https://musicbrainz.org/artist/${other.id}`,
      begin: rel.begin || null,
      end: rel.end || null,
    });
  }
  return members;
}

/**
 * Deterministically verify an attribution tuple: does `creator` actually
 * have a release group titled `title`? This is the check that catches the
 * CORRECTIONS.md failure class (a Radiohead album attributed to Blur).
 *
 * verified=true requires: search score ≥ 90, normalized exact title match,
 * and the claimed creator present in the artist credit.
 */
export async function verifyReleaseGroup(title, creator) {
  const data = await mbFetch("release-group", {
    query: `releasegroup:"${luceneEscape(title)}" AND artist:"${luceneEscape(creator)}"`,
    limit: "5",
  });
  const groups = data["release-groups"] || [];
  const wantTitle = norm(title);
  const wantCreator = norm(creator);

  for (const rg of groups) {
    if (rg.score < 90) continue;
    if (norm(rg.title) !== wantTitle) continue;
    const credits = (rg["artist-credit"] || []).map((c) => norm(c.artist?.name ?? c.name));
    if (!credits.includes(wantCreator)) continue;
    return {
      verified: true,
      mbid: rg.id,
      title: rg.title,
      artistCredit: (rg["artist-credit"] || []).map((c) => c.artist?.name ?? c.name),
      firstReleaseDate: rg["first-release-date"] || null,
      primaryType: rg["primary-type"] || null,
    };
  }
  return {
    verified: false,
    candidates: groups.slice(0, 3).map((rg) => ({
      title: rg.title,
      artistCredit: (rg["artist-credit"] || []).map((c) => c.artist?.name ?? c.name).join(" + "),
      score: rg.score,
    })),
  };
}
