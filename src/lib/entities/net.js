// Transient-network retry for the deterministic verification path.
// CI occasionally loses a socket mid-run to MusicBrainz/Wikidata
// (TypeError: fetch failed / UND_ERR_SOCKET "other side closed"), which
// used to fail the whole eval. Retry ONLY transport-level failures —
// an HTTP response of any status (404, empty results) is a real signal
// and must reach the caller untouched.

const TRANSIENT_CODES = new Set([
  "UND_ERR_SOCKET",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "EAI_AGAIN",
]);

export function isTransientNetworkError(err) {
  for (let e = err, depth = 0; e && depth < 4; e = e.cause, depth++) {
    if (TRANSIENT_CODES.has(e.code)) return true;
    // undici wraps all transport failures as TypeError("fetch failed");
    // other TypeErrors (e.g. Invalid URL) are programming errors, not retried.
    if (e instanceof TypeError && e.message === "fetch failed") return true;
  }
  return false;
}

// Drop-in for fetch(). Callers inside a rate-limited queue slot can use this
// safely: the backoff sleeps within the slot and never re-enters the queue.
export async function fetchWithRetry(url, opts, { retries = 2, backoffMs = 1000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, opts);
    } catch (err) {
      if (attempt >= retries || !isTransientNetworkError(err)) throw err;
      await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
    }
  }
}
