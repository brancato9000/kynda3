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
  return {
    title: `${subject.name} — Kynda`,
    description,
    openGraph: { title: `${subject.name} — Kynda`, description, type: "article" },
  };
}

export default async function SubjectPage({ params }) {
  const { slug } = await params;
  const subject = await resolveSlug(slug);
  if (!subject) notFound();

  const bio = await getIntroExtract({ name: subject.name, qid: subject.wikidata_qid }).catch(() => null);

  return (
    <KyndaApp
      initialSubject={{
        name: subject.name,
        kind: subject.kind,
        domain: subject.domain,
        mbid: subject.mbid,
        wikidata_qid: subject.wikidata_qid,
        bio: bio ? { text: bio.text, articleTitle: bio.title, url: bio.url, source: "Wikipedia" } : null,
      }}
    />
  );
}
