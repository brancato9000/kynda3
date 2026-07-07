// The load-bearing wall (DECISIONS V3-03).
//
// An agent's claim "this quote appears at this URL" is trusted only if THIS
// function confirms it against the fetched page text. Normalize, then exact
// substring match. No fuzzy matching, no semantic similarity, no model —
// the moment judgment enters this path, the hallucination guarantee is gone.

const MIN_QUOTE_LENGTH = 20; // normalized chars; shorter quotes prove nothing

export function normalizeText(s) {
  return (s || "")
    .normalize("NFC")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    // HTML stripping leaves stray spaces around punctuation ("<a>X</a>, Y" →
    // "X , Y"); normalize haystack and needle identically.
    .replace(/\s+([.,;:!?%)\]])/g, "$1")
    .replace(/([([])\s+/g, "$1")
    .toLowerCase()
    .trim();
}

/**
 * @param {string} pageText - full text extracted from the fetched source
 * @param {string} quote - the exact excerpt the agent claims appears there
 * @returns {{matched: boolean, index?: number, reason?: string}}
 */
export function quoteMatch(pageText, quote) {
  const needle = normalizeText(quote);
  if (needle.length < MIN_QUOTE_LENGTH) {
    return { matched: false, reason: "quote_too_short" };
  }
  const haystack = normalizeText(pageText);
  const index = haystack.indexOf(needle);
  if (index === -1) return { matched: false, reason: "not_found" };
  return { matched: true, index };
}
