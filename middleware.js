// Site password (V3-58; open mode V3-90/91): the root Kynda experience goes behind HTTP Basic
// Auth while outside eyes get bare /demo/* share links. Enforcement is
// opt-in: set KYNDA_SITE_PASSWORD (in .env.local and on Vercel) and every
// route except /demo/* demands it; unset, the site stays open (local dev
// convenience). Any username works — only the password is checked.

import { NextResponse } from "next/server";
import { siteOpen, isPrivatePath, hasSitePassword } from "./src/lib/site.js";

// Link-preview crawlers (V3-81): iMessage announces itself as
// facebookexternalhit + Facebot + Twitterbot, so the big three cover
// Apple too. These UAs never reach real content — they are rewritten to
// the /unfurl shell, which serves metadata only (a rewrite does not
// re-enter the middleware). Spoofing this UA earns the shell, not the site.
const PREVIEW_BOT = /facebookexternalhit|facebot|twitterbot|slackbot|slack-imgproxy|linkedinbot|whatsapp|discordbot|telegrambot|applebot|snapchat|pinterest|redditbot|skypeuripreview|iframely|embedly|vkshare|bingpreview/i;

export function middleware(req) {
  const password = process.env.KYNDA_SITE_PASSWORD;
  if (!password) return NextResponse.next();
  // Open site (2026-10-03, src/lib/site.js): KYNDA_SITE_OPEN=1 lets everyone
  // in except the private paths (listening maps, unconsented subjects).
  if (siteOpen() && !isPrivatePath(req.nextUrl.pathname)) return NextResponse.next();
  if (hasSitePassword(req)) return NextResponse.next();
  if (PREVIEW_BOT.test(req.headers.get("user-agent") || "")) {
    const url = req.nextUrl.clone();
    url.pathname = `/unfurl${url.pathname === "/" ? "" : url.pathname}`;
    url.search = "";
    return NextResponse.rewrite(url);
  }
  return new NextResponse("Kynda is invite-only right now.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Kynda"' },
  });
}

export const config = {
  // Everything except the demo share pages, the public OG share cards
  // (crawlers fetch og:image with assorted UAs — it must never 401; it
  // carries only name + counts + a licensed portrait), and Next's assets.
  matcher: ["/((?!demo/|api/og/|_next/|favicon.ico|icon.svg).*)"],
};
