// Permanent subject pages (V3-28): /s/the-godfather etc. Server component —
// resolves the slug against subjects that have a stored mix, fetches the
// Wikipedia bio (free), and boots the app with the subject preloaded.
// The mix itself serves from the claims store: zero model calls.

import { notFound } from "next/navigation";
import KyndaApp from "../../kynda-app.jsx";
import { listSubjects } from "../../../src/lib/store.js";
import { slugify } from "../../../src/lib/slug.js";
import { getIntroExtract } from "../../../src/lib/entities/wikipedia.js";

export const dynamic = "force-dynamic";

async function resolveSlug(slug) {
  const subjects = await listSubjects();
  return subjects.find((s) => slugify(s.name) === slug) || null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const subject = await resolveSlug(slug);
  if (!subject) return { title: "Kynda" };
  const description = subject.intro
    ? subject.intro.slice(0, 200)
    : `The influences, peers, and legacy of ${subject.name} — every connection with its receipt.`;
  // The branded share card (V3-81). Crawlers never see this page directly
  // (the middleware rewrites them to /unfurl), but authed humans who share
  // from apps that reuse the page's own tags get the same card.
  const image = `/api/og/${slug}`;
  return {
    title: `${subject.name} — Kynda`,
    description,
    openGraph: {
      title: `${subject.name} — Kynda`, description, type: "article", siteName: "Kynda",
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: `${subject.name} — Kynda`, description, images: [image] },
  };
}

export default async function SubjectPage({ params, searchParams }) {
  const { slug } = await params;
  // Named cuts (2026-08-17): ?cut=graph-first serves a stored experiment
  // cut by name — behind the site password, and NEVER able to trigger a
  // fresh generation (the mix route refuses unknown cuts).
  const sp = (await searchParams) || {};
  const cut = typeof sp.cut === "string" ? sp.cut : null;
  const subject = await resolveSlug(slug);
  if (!subject) notFound();

  const bio = await getIntroExtract({ name: subject.name, qid: subject.wikidata_qid }).catch(() => null);

  return (
    <KyndaApp
      initialCut={cut}
      initialSubject={{
        name: subject.name,
        kind: subject.kind,
        domain: subject.domain,
        mbid: subject.mbid,
        wikidata_qid: subject.wikidata_qid,
        // No true encyclopedia entry -> a labeled Kynda synthesis (V3-65).
        bio: bio ? { text: bio.text, articleTitle: bio.title, url: bio.url, source: "Wikipedia" }
          : subject.synthesis_bio ? { text: subject.synthesis_bio, source: "Kynda" } : null,
      }}
    />
  );
}
