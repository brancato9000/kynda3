// YouTube Data API adapter (V3-40): resolve a cover claim to an actual video
// of the performance — the most visceral experience link in the product.
// Verification stays dumb (V3-03): a video counts only if its TITLE contains
// both the coverer and the song, normalized — no model judges relevance.
// Quota: search costs 100 units of the 10k/day free tier (~90 safe lookups).

const KEY = () => process.env.KYNDA_YOUTUBE_KEY;

export function youtubeConfigured() {
  return !!KEY();
}

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/['’‘"“”().,!?:\-–—]/g, " ")
    .replace(/\s+&\s+/g, " and ")
    .replace(/\s+/g, " ")
    .trim();

/** Deterministic title gate: both the coverer and the song, or no video. */
export function videoTitleMatches(title, coverer, song) {
  const t = ` ${norm(title)} `;
  const c = norm(coverer);
  const s = norm(song);
  return c.length >= 2 && s.length >= 2 && t.includes(` ${c} `) && t.includes(` ${s} `);
}

/**
 * Search for a video of {coverer} performing {song}; return the first result
 * whose title passes the deterministic gate, or null.
 */
export async function findCoverVideo(coverer, song) {
  const q = encodeURIComponent(`${coverer} ${song} live`);
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${q}&key=${KEY()}`
  );
  if (res.status === 403 || res.status === 429) throw new Error("youtube quota exhausted (resets daily)");
  if (!res.ok) throw new Error(`youtube ${res.status}`);
  const data = await res.json();
  for (const item of data.items || []) {
    const title = item.snippet?.title || "";
    if (videoTitleMatches(title, coverer, song)) {
      return {
        videoId: item.id.videoId,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        title,
        channel: item.snippet?.channelTitle || "",
      };
    }
  }
  return null;
}
