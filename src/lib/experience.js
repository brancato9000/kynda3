// "Where to experience it" (V3-38, Brown alumni-board feature 3).
// Library-first by deliberate brand position: Kynda's trust layer is built on
// public institutions, and the consumption layer completes the same thought —
// the map hands you to a library, not a storefront. Convenience follows as a
// second tier, deep-linked into the streaming service the user already pays
// for (their own login; we never touch accounts).
//
// Every link is a deterministic search-URL template from title + creator:
// zero tokens, zero API keys, zero infrastructure. Honest limitation: search
// links, not exact-item links — the only zero-infrastructure option that
// works across every library system. Exact-ID resolution (Odesli) can layer
// on later without changing this interface.

const enc = (item) =>
  encodeURIComponent([item.title, item.creator].filter(Boolean).join(" ").trim());

export const STREAM_SERVICES = [
  { id: "spotify", label: "Spotify", url: (q) => `https://open.spotify.com/search/${q}` },
  { id: "apple", label: "Apple Music", url: (q) => `https://music.apple.com/us/search?term=${q}` },
  { id: "youtube", label: "YouTube", url: (q) => `https://www.youtube.com/results?search_query=${q}` },
];

const YT = (q) => `https://www.youtube.com/results?search_query=${q}`;

/**
 * Returns { library: [{label, url}], stream: {label, url} | null, pickService }
 * for one mix item. `pickService` marks media where the streaming-service
 * preference applies (music) so the UI can offer the switcher there.
 */
export function experienceLinks(item, { service = "youtube", subjectName = "" } = {}) {
  const q = enc(item);
  if (!q) return { library: [], stream: null, pickService: false };
  const svc = STREAM_SERVICES.find((s) => s.id === service) || STREAM_SERVICES[2];

  // Covers cards (V3-39): the most visceral experience link in the product —
  // point straight at the performance. "Covered Them" → the subject playing
  // the song; "Covered By" → the coverer playing the subject's song.
  if (item.slotType === "covers" || item.slotType === "covered_by") {
    // Title-verified video (V3-40) beats a search when the ingest found one.
    if (item.videoUrl) {
      return {
        library: [{ label: "▶ watch the cover", url: item.videoUrl }],
        stream: { label: svc.label, url: svc.url(q) },
        pickService: true,
      };
    }
    const coverer = item.slotType === "covers" ? subjectName : item.creator || item.title;
    const perfQ = encodeURIComponent([coverer, item.title, "live cover"].filter(Boolean).join(" "));
    return {
      library: [{ label: "watch the cover", url: YT(perfQ) }],
      stream: { label: svc.label, url: svc.url(q) },
      pickService: true,
    };
  }

  switch (item.medium) {
    case "music":
      return {
        library: [
          { label: "Internet Archive", url: `https://archive.org/search?query=${q}&and%5B%5D=mediatype%3A%22audio%22` },
          { label: "Hoopla (library card)", url: `https://www.hoopladigital.com/search?q=${q}` },
        ],
        stream: { label: svc.label, url: svc.url(q) },
        pickService: true,
      };
    case "film":
    case "television":
      return {
        library: [
          { label: "Kanopy (library card)", url: `https://www.kanopy.com/en/search?query=${q}` },
          { label: "Internet Archive", url: `https://archive.org/search?query=${q}&and%5B%5D=mediatype%3A%22movies%22` },
        ],
        stream: { label: "JustWatch", url: `https://www.justwatch.com/us/search?q=${q}` },
        pickService: false,
      };
    case "literature":
      return {
        library: [
          { label: "Open Library (borrow free)", url: `https://openlibrary.org/search?q=${q}` },
          { label: "WorldCat (find nearby)", url: `https://search.worldcat.org/search?q=${q}` },
        ],
        stream: null,
        pickService: false,
      };
    case "art":
    case "design":
    case "architecture":
      return {
        library: [{ label: "Google Arts & Culture", url: `https://artsandculture.google.com/search?q=${q}` }],
        stream: null,
        pickService: false,
      };
    case "dance":
    case "theater":
      return {
        library: [{ label: "Jacob's Pillow archive", url: `https://danceinteractive.jacobspillow.org/?s=${q}` }],
        stream: { label: "YouTube", url: YT(q) },
        pickService: false,
      };
    default:
      return {
        library: [{ label: "Internet Archive", url: `https://archive.org/search?query=${q}` }],
        stream: { label: "YouTube", url: YT(q) },
        pickService: false,
      };
  }
}
