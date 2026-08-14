// Demo share pages (V3-58): isolated duplicates of subject pages for
// outside eyes — Sydney gets links to his three maps and NOTHING else.
// Server component gathers everything from the claims store (zero model
// calls, zero client API surface); only allowlisted slugs exist here.
// The site password middleware exempts /demo — these links work bare.

import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import DemoApp from "../demo-app.jsx";
import { q } from "../../../src/lib/db.js";
import { listSubjects, getStoredMix, getGraphForSubject, getCitationsForItem, getCardMedia } from "../../../src/lib/store.js";
import { slugify } from "../../../src/lib/slug.js";
import { getIntroExtract } from "../../../src/lib/entities/wikipedia.js";

export const dynamic = "force-dynamic";

// Only what Tony has decided to share — everything else 404s.
const DEMO_SLUGS = new Set([
  "the-glass-bead-game",
  "detroit-style-pizza",
  "live-art-in-microgravity",
  // Gregg (Nonesuch Records, 2026-08-10): three artists he asked about.
  "mary-halvorson",
  "chris-thile",
  "molly-tuttle",
  // Tony Berg door (2026-08-13): produced Lost Weekend, connected via label.
  "phoebe-bridgers",
  // Berg himself (2026-08-14) — the transcript experiment. ?cut=before
  // serves the pre-interview baseline; no param serves the latest cut.
  "tony-berg",
]);

export async function generateMetadata({ params }) {
  // Share previews (Tony, 2026-08-11, urgent): without OG metadata,
  // messengers scraped the first large image — a card's album cover
  // (fair-use assets must never be the page's ambassador). Declare the
  // subject's own Commons-licensed portrait, or no image at all, and the
  // proper share copy.
  const { slug } = await params;
  if (!DEMO_SLUGS.has(slug)) return { title: "Kynda", robots: { index: false, follow: false } };
  let name = null, portraitUrl = null;
  try {
    const subjects = await listSubjects();
    const subject = subjects.find((s) => slugify(s.name) === slug) || null;
    if (subject) {
      name = subject.name;
      const pr = await q(
        `SELECT metadata->>'image_url' AS url FROM entities
         WHERE lower(name) = lower($1) AND metadata->>'image_url' IS NOT NULL
           AND metadata->>'image_license' NOT ILIKE '%fair use%' LIMIT 1`,
        [subject.name]
      );
      portraitUrl = pr.rows[0]?.url || null;
    }
  } catch { /* metadata must never break the page */ }
  const title = name ? `${name}'s Influence Map on Kynda` : "Kynda — influence map";
  return {
    title,
    description: name ? `The documented influences behind ${name} — every connection quote-verified against its source.` : undefined,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description: name ? `The documented influences behind ${name}, mapped and verified by Kynda.` : undefined,
      siteName: "Kynda",
      ...(portraitUrl ? { images: [{ url: portraitUrl }] } : {}),
    },
    twitter: { card: portraitUrl ? "summary" : "summary", title },
  };
}

export default async function DemoPage({ params, searchParams }) {
  const { slug } = await params;
  const sp = (await searchParams) || {};
  const cut = typeof sp.cut === "string" ? sp.cut : null;
  if (!DEMO_SLUGS.has(slug)) notFound();
  const subjects = await listSubjects();
  const subject = subjects.find((s) => slugify(s.name) === slug) || null;
  if (!subject) notFound();

  // Visit log (V3-66): these pages are the outward-facing share links —
  // record the serve, best-effort, never blocking the render. IP is
  // one-way hashed for rough unique-visitor counting; nothing else kept.
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    q(`INSERT INTO page_views (path, user_agent, referer, ip_hash) VALUES ($1, $2, $3, $4)`, [
      `/demo/${slug}`,
      h.get("user-agent")?.slice(0, 300) || null,
      h.get("referer")?.slice(0, 300) || null,
      ip ? createHash("sha256").update(ip).digest("hex").slice(0, 16) : null,
    ]).catch(() => {});
  } catch { /* logging must never break the page */ }

  // Bio portrait (Tony, 2026-08-11): the subject's P18/Commons image,
  // license-gated at backfill time, beside the intro bio.
  const pr = await q(
    `SELECT metadata->>'image_url' AS url, metadata->>'image_page' AS page,
            metadata->>'image_license' AS license, metadata->>'image_credit' AS credit,
            metadata->>'vibe_url' AS vibe_url, metadata->>'vibe_page' AS vibe_page, metadata->>'vibe_track' AS vibe_track
     FROM entities WHERE lower(name) = lower($1) AND kind IN ('person','group')
       AND (metadata->>'image_url' IS NOT NULL OR metadata->>'vibe_url' IS NOT NULL) LIMIT 1`,
    [subject.name]
  ).catch(() => ({ rows: [] }));
  const portrait = pr.rows[0]?.url ? { url: pr.rows[0].url, page: pr.rows[0].page, license: pr.rows[0].license, credit: pr.rows[0].credit } : null;
  const vibe = pr.rows[0]?.vibe_url ? { url: pr.rows[0].vibe_url, page: pr.rows[0].vibe_page, track: pr.rows[0].vibe_track } : null;

  const [mix, graph, bio] = await Promise.all([
    getStoredMix(subject, { cut }),
    getGraphForSubject(subject).catch(() => null),
    getIntroExtract({ name: subject.name, qid: subject.wikidata_qid }).catch(() => null),
  ]);
  if (!mix) notFound();

  // Same hydration as the print view: stored payload + claims-store receipts.
  const slots = mix.slots || (mix.entries || []).map((e) => ({ slotType: e.item.slotType, candidates: [e] }));
  const hydrated = [];
  for (const slot of slots) {
    const candidates = [];
    for (const c of slot.candidates || []) {
      if (!c?.item) continue;
      const citations = await getCitationsForItem(subject, c.item).catch(() => c.verification?.citations || []);
      const media = await getCardMedia(c.item).catch(() => null);
      const item = media ? { ...media, ...Object.fromEntries(Object.entries(c.item).filter(([, v]) => v != null)) } : c.item;
      candidates.push({ ...c, item, verification: { ...c.verification, citations } });
    }
    if (candidates.length) hydrated.push({ slotType: slot.slotType, candidates });
  }

  return (
    <DemoApp
      subject={{ name: subject.name, kind: subject.kind, domain: subject.domain, yearsActive: null, description: null, portrait, vibe }}
      bio={bio ? { text: bio.text, articleTitle: bio.title, url: bio.url, source: "Wikipedia" }
        : subject.synthesis_bio ? { text: subject.synthesis_bio, source: "Kynda" } : null}
      intro={mix.intro || subject.intro || ""}
      slots={hydrated}
      graph={graph}
    />
  );
}
