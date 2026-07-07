// Evidence verification worker (MASTERPLAN Pillar II, role 3). NO MODEL.
//
// An agent's claim "this quote appears at this URL" earns T2 only if this
// module confirms it: fetch the page, strip to text, exact-match the quote
// (via quoteMatch's normalization). Also records a Wayback Machine snapshot
// reference so evidence outlives link rot.

import { quoteMatch } from "./quoteMatch.js";

const USER_AGENT = "Kynda/0.2 (brancato@gmail.com)";

/** Pure: crude but effective HTML → text. */
export function htmlToText(html) {
  return (html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&[lr]dquo;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&mdash;|&ndash;/gi, "-")
    .replace(/&#(\d+);/g, (_, n) => {
      try { return String.fromCodePoint(Number(n)); } catch { return " "; }
    })
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchPageText(url, timeoutMs = 20_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,*/*" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, status: res.status };
    const html = await res.text();
    return { ok: true, text: htmlToText(html) };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

/** Existing Wayback snapshot for a URL, if any (does not trigger a crawl). */
export async function waybackSnapshot(url) {
  try {
    const res = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const snap = data?.archived_snapshots?.closest;
    return snap?.available ? snap.url : null;
  } catch {
    return null;
  }
}

/**
 * The T2 gate. Returns:
 *   { status: "quote_confirmed", archivedUrl }  — evidence checks out
 *   { status: "unverifiable", reason }          — page fetched, quote absent
 *   { status: "dead_link", detail }             — URL unreachable
 */
export async function verifyEvidence({ url, quote }) {
  const page = await fetchPageText(url);
  if (!page.ok) return { status: "dead_link", detail: String(page.status || page.error) };
  const match = quoteMatch(page.text, quote);
  if (!match.matched) return { status: "unverifiable", reason: match.reason };
  const archivedUrl = await waybackSnapshot(url);
  return { status: "quote_confirmed", archivedUrl };
}
