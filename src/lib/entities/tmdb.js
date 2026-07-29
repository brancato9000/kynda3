// TMDb adapter (V3-46): real attribution verification for film and
// television — the catalog the Wave A numbers said we were missing. Same
// contract as MusicBrainz for music: deterministic title+creator match,
// machine-earned badge, and a miss CONVICTS (TMDb's coverage is
// comprehensive enough that absence is evidence, unlike the award-only
// Wikidata description check it replaces).
//
// Requires KYNDA_TMDB_TOKEN (v4 read token, Bearer header) or KYNDA_TMDB_KEY
// (v3 key). Attribution: "This product uses the TMDB API but is not endorsed
// or certified by TMDB."

const BASE = "https://api.themoviedb.org/3";

export function tmdbConfigured() {
  return !!(process.env.KYNDA_TMDB_TOKEN || process.env.KYNDA_TMDB_KEY);
}

async function tmdb(path, params = {}) {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") url.searchParams.set(k, v);
  const headers = { Accept: "application/json" };
  if (process.env.KYNDA_TMDB_TOKEN) headers.Authorization = `Bearer ${process.env.KYNDA_TMDB_TOKEN}`;
  else url.searchParams.set("api_key", process.env.KYNDA_TMDB_KEY);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`tmdb ${res.status}`);
  return res.json();
}

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/['’‘"“”().,:!?\-–—]/g, " ")
    .replace(/\s+&\s+/g, " and ")
    .replace(/\s+/g, " ")
    .trim();

const titleMatches = (a, b) => norm(a) === norm(b);
const nameIn = (people, creator) => people.some((p) => norm(p) === norm(creator));

/**
 * Verify a film: does a movie with this title exist, and is `creator`
 * actually its director (or writer)? Year, when given, narrows the search
 * but a mismatch falls back to an unrestricted search — models sometimes
 * carry re-release years.
 */
export async function verifyFilm(title, creator, year = null) {
  const searches = year ? [{ query: title, year }, { query: title }] : [{ query: title }];
  for (const params of searches) {
    const data = await tmdb("/search/movie", { query: params.query, year: params.year });
    const candidates = (data.results || []).filter(
      (r) => titleMatches(r.title, title) || titleMatches(r.original_title, title)
    ).slice(0, 3);
    for (const c of candidates) {
      const credits = await tmdb(`/movie/${c.id}/credits`);
      const directors = (credits.crew || []).filter((p) => p.job === "Director").map((p) => p.name);
      const writers = (credits.crew || []).filter((p) => p.department === "Writing").map((p) => p.name);
      if (nameIn(directors, creator) || nameIn(writers, creator)) {
        return {
          verified: true,
          url: `https://www.themoviedb.org/movie/${c.id}`,
          detail: `${directors.length ? `directed by ${directors.join(", ")}` : "credited"}${c.release_date ? ` (${c.release_date.slice(0, 4)})` : ""}`,
        };
      }
      if (directors.length) {
        return { verified: false, actualCreator: directors.join(", "), url: `https://www.themoviedb.org/movie/${c.id}` };
      }
    }
    if (candidates.length) break; // title found under year filter; creator just didn't match
  }
  return { verified: false };
}

/** Verify a TV show: title exists and `creator` is among its credited creators. */
export async function verifyTvShow(title, creator, year = null) {
  const data = await tmdb("/search/tv", { query: title, first_air_date_year: year });
  const results = data.results?.length ? data.results : (await tmdb("/search/tv", { query: title })).results || [];
  const candidates = results.filter(
    (r) => titleMatches(r.name, title) || titleMatches(r.original_name, title)
  ).slice(0, 3);
  for (const c of candidates) {
    const detail = await tmdb(`/tv/${c.id}`);
    const creators = (detail.created_by || []).map((p) => p.name);
    const credits = await tmdb(`/tv/${c.id}/aggregate_credits`).catch(() => ({ crew: [] }));
    const producers = (credits.crew || []).filter((p) => /Producer|Writing|Directing/.test(p.department || "")).map((p) => p.name);
    // Common usage attributes shows to their stars ("I Love Lucy —
    // Lucille Ball"); a top-billed cast match awards, with the formal
    // creators named honestly in the detail.
    const topCast = (credits.cast || []).slice(0, 6).map((p) => p.name);
    if (nameIn(creators, creator) || nameIn(producers, creator) || nameIn(topCast, creator)) {
      const via = nameIn(creators, creator) || nameIn(producers, creator) ? null : "starring";
      return {
        verified: true,
        url: `https://www.themoviedb.org/tv/${c.id}`,
        detail: `${via ? `starring ${creator}; ` : ""}${creators.length ? `created by ${creators.join(", ")}` : "credited"}${c.first_air_date ? ` (${c.first_air_date.slice(0, 4)})` : ""}`,
      };
    }
    if (creators.length) {
      return { verified: false, actualCreator: creators.join(", "), url: `https://www.themoviedb.org/tv/${c.id}` };
    }
  }
  return { verified: false };
}
