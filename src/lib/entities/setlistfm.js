// setlist.fm adapter (V3-39, Class A source from the UCLA sheet). Live-show
// cover history: the one influence signal that's behavioral, not verbal —
// what an artist repeatedly chose to play, not what they said in interviews.
// Free API, key required (https://api.setlist.fm/docs/1.0/index.html):
// KYNDA_SETLISTFM_KEY in the environment. Deterministic; zero model tokens.

const BASE = "https://api.setlist.fm/rest/1.0";

export function setlistfmConfigured() {
  return !!process.env.KYNDA_SETLISTFM_KEY;
}

async function sfmGet(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "x-api-key": process.env.KYNDA_SETLISTFM_KEY,
      Accept: "application/json",
      "User-Agent": "Kynda/3.0 (cultural influence graph; brancato@gmail.com)",
    },
  });
  if (res.status === 404) return null; // no setlists for this artist
  if (!res.ok) throw new Error(`setlist.fm ${res.status}`);
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Aggregate the covers an artist has performed live, from their setlist
 * history. Returns [{ song, artist, artistMbid, count, firstYear, lastYear }]
 * sorted by count desc. Pages politely (setlist.fm etiquette).
 */
export async function getLiveCovers(mbid, { maxPages = 15 } = {}) {
  const covers = new Map();
  for (let page = 1; page <= maxPages; page++) {
    const data = await sfmGet(`/artist/${mbid}/setlists?p=${page}`);
    if (!data?.setlist?.length) break;
    for (const sl of data.setlist) {
      const year = (sl.eventDate || "").split("-").pop() || null; // dd-MM-yyyy
      for (const set of sl.sets?.set || []) {
        for (const song of set.song || []) {
          if (!song.cover?.name || !song.name) continue;
          const key = `${song.cover.name}::${song.name}`.toLowerCase();
          const entry = covers.get(key) || {
            song: song.name,
            artist: song.cover.name,
            artistMbid: song.cover.mbid || null,
            count: 0,
            firstYear: year,
            lastYear: year,
          };
          entry.count += 1;
          if (year) {
            if (!entry.firstYear || year < entry.firstYear) entry.firstYear = year;
            if (!entry.lastYear || year > entry.lastYear) entry.lastYear = year;
          }
          covers.set(key, entry);
        }
      }
    }
    const seen = page * (data.itemsPerPage || 20);
    if (seen >= (data.total || 0)) break;
    await sleep(650);
  }
  return [...covers.values()].sort((a, b) => b.count - a.count);
}
