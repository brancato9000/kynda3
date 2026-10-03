import { notFound } from "next/navigation";
import KyndaApp from "../../kynda-app.jsx";
import SubjectLedger from "./subject-ledger.jsx";
import { listSubjects, findEntityBySlug, getStoredMix, getGraphForSubject } from "../../../src/lib/store.js";
import { slugify } from "../../../src/lib/slug.js";
import { getIntroExtract } from "../../../src/lib/entities/wikipedia.js";
import { isPrivateSubject, siteOpen, SITE_URL } from "../../../src/lib/site.js";

export const dynamic = "force-dynamic";

async function resolveSlug(slug) {
  const subjects = await listSubjects();
  const mapped = subjects.find((s) => slugify(s.name) === slug);
  if (mapped) return { subject: { ...mapped, mapped: true }, subjects };
  const stop = await findEntityBySlug(slug).catch(() => null);
  return { subject: stop ? { ...stop, mapped: false } : null, subjects };
}

// Search engines (BACKLOG #32): only mapped subjects are worth indexing. An
// unmapped map stop is a thin page (a name and a few links), and a private
// subject is never indexed — both stay reachable, just unlisted.
function indexable(subject) {
  return subject.mapped && !isPrivateSubject(subject.name);
}

// schema.org type for the page's subject — what a search engine needs to
// tie this page to the real person, band or work.
function schemaType({ kind, domain }) {
  if (kind === "person") return "Person";
  if (kind === "group") return domain === "music" ? "MusicGroup" : "Organization";
  if (kind === "work") {
    return { film: "Movie", television: "TVSeries", literature: "Book", music: "MusicRecording", art: "VisualArtwork" }[domain] || "CreativeWork";
  }
  return "Thing";
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { subject } = await resolveSlug(slug);
  if (!subject) return { title: "Kynda" };
  const description = subject.intro
    ? subject.intro.slice(0, 200)
    : `The influences, peers, and legacy of ${subject.name} — every connection with its receipt.`;
  const image = `/api/og/${slug}`;
  return {
    title: `${subject.name}: influences, peers and legacy — Kynda`,
    description,
    alternates: { canonical: `/s/${slug}` },
    robots: indexable(subject) ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: `${subject.name} — Kynda`, description, type: "article", siteName: "Kynda", url: `/s/${slug}`,
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: `${subject.name} — Kynda`, description, images: [image] },
  };
}

export default async function SubjectPage({ params, searchParams }) {
  const { slug } = await params;
  const sp = (await searchParams) || {};
  const cut = typeof sp.cut === "string" ? sp.cut : null;
  const { subject, subjects } = await resolveSlug(slug);
  if (!subject) notFound();

  const bio = await getIntroExtract({ name: subject.name, qid: subject.wikidata_qid }).catch(() => null);

  // The crawlable text of the page (mapped subjects only; a private one only
  // while the site is password-gated, where every visitor is trusted).
  let ledger = null;
  let jsonLd = null;
  if (subject.mapped && !(siteOpen() && isPrivateSubject(subject.name))) {
    const [mix, graph] = await Promise.all([
      getStoredMix(subject, cut ? { cut } : undefined).catch(() => null),
      getGraphForSubject(subject).catch(() => null),
    ]);
    const mappedSlugs = new Set(subjects.map((s) => slugify(s.name)).filter((s) => !isPrivateSubject(s)));
    mappedSlugs.delete(slug);
    const slots = mix?.slots || (mix?.entries || []).map((e) => ({ slotType: e.item.slotType, candidates: [e] }));
    ledger = <SubjectLedger subject={subject} intro={mix?.intro || subject.intro || ""} slots={slots} graph={graph} mappedSlugs={mappedSlugs} />;

    if (indexable(subject)) {
      const sameAs = [
        subject.wikidata_qid && `https://www.wikidata.org/wiki/${subject.wikidata_qid}`,
        bio?.url,
        subject.mbid && `https://musicbrainz.org/${subject.kind === "work" ? "release-group" : "artist"}/${subject.mbid}`,
      ].filter(Boolean);
      const linked = graph
        ? [...graph.predecessors, ...graph.peers, ...graph.successors]
            .filter((n) => mappedSlugs.has(slugify(n.name)))
            .slice(0, 30)
            .map((n) => ({ "@type": "Thing", name: n.name, url: `${SITE_URL}/s/${slugify(n.name)}` }))
        : [];
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        url: `${SITE_URL}/s/${slug}`,
        name: `${subject.name}: influences, peers and legacy`,
        description: mix?.intro || subject.intro || undefined,
        about: { "@type": schemaType(subject), name: subject.name, ...(sameAs.length ? { sameAs } : {}) },
        ...(linked.length ? { mentions: linked } : {}),
        publisher: { "@type": "Organization", name: "Kynda" },
      };
    }
  }

  return (
    <>
      {jsonLd && (
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      )}
      <KyndaApp
        initialCut={cut}
        ledger={ledger}
        initialSubject={{
          name: subject.name,
          kind: subject.kind,
          domain: subject.domain,
          mbid: subject.mbid,
          wikidata_qid: subject.wikidata_qid,
          mapped: subject.mapped,
          bio: bio ? { text: bio.text, articleTitle: bio.title, url: bio.url, source: "Wikipedia" }
            : subject.synthesis_bio ? { text: subject.synthesis_bio, source: "Kynda" } : null,
        }}
      />
    </>
  );
}
