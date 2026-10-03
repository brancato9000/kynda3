// Opening the site (Tony, 2026-10-03). The site password used to guard
// everything but /demo/*. KYNDA_SITE_OPEN=1 opens the site to the public
// and to search engines, and the password then guards only what must stay
// private:
//   • personal listening maps (/listen/*, V3-79 — private by design)
//   • subjects whose page is private until the person consents (Tony Berg,
//     BACKLOG #4): their /s/ page needs the password, the mix and graph
//     APIs refuse them, and they never appear in the sitemap or browse.
// No database or Node imports: the middleware runs this on the edge.
import { slugify } from "./slug.js";

export const PRIVATE_SUBJECT_SLUGS = new Set(["tony-berg"]);

/** The public origin — metadata, sitemap and structured data use it.
 * Moving to a real domain is one environment variable (NEXT_PUBLIC_SITE_URL). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://kynda3.vercel.app").replace(/\/$/, "");

export function siteOpen() {
  return process.env.KYNDA_SITE_OPEN === "1";
}

export function isPrivateSubject(name) {
  return PRIVATE_SUBJECT_SLUGS.has(slugify(name));
}

/** Paths the password still guards once the site is open. */
export function isPrivatePath(pathname) {
  if (/^\/listen(\/|$)/.test(pathname)) return true;
  const m = pathname.match(/^\/s\/([^/]+)/);
  return !!m && PRIVATE_SUBJECT_SLUGS.has(decodeURIComponent(m[1]));
}

/** True when the request carries the site password (HTTP Basic, any username). */
export function hasSitePassword(req) {
  const password = process.env.KYNDA_SITE_PASSWORD;
  if (!password) return false;
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) return false;
  try {
    return atob(auth.slice(6)).split(":").slice(1).join(":") === password;
  } catch {
    return false;
  }
}

/** An open site never serves a private subject's map or mix to the public. */
export function privateSubjectBlocked(req, name) {
  return siteOpen() && isPrivateSubject(name) && !hasSitePassword(req);
}
