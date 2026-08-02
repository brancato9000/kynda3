// Site password (V3-58): the root Kynda experience goes behind HTTP Basic
// Auth while outside eyes get bare /demo/* share links. Enforcement is
// opt-in: set KYNDA_SITE_PASSWORD (in .env.local and on Vercel) and every
// route except /demo/* demands it; unset, the site stays open (local dev
// convenience). Any username works — only the password is checked.

import { NextResponse } from "next/server";

export function middleware(req) {
  const password = process.env.KYNDA_SITE_PASSWORD;
  if (!password) return NextResponse.next();
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Basic ")) {
    try {
      const supplied = atob(auth.slice(6)).split(":").slice(1).join(":");
      if (supplied === password) return NextResponse.next();
    } catch { /* malformed header falls through to the challenge */ }
  }
  return new NextResponse("Kynda is invite-only right now.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Kynda"' },
  });
}

export const config = {
  // Everything except the demo share pages and Next's own assets.
  matcher: ["/((?!demo/|_next/|favicon.ico).*)"],
};
