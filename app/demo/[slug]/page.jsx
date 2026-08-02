// Demo share pages (V3-58): isolated duplicates of subject pages for
// outside eyes — Sydney gets links to his three maps and NOTHING else.
// Server component gathers everything from the claims store (zero model
// calls, zero client API surface); only allowlisted slugs exist here.
// The site password middleware exempts /demo — these links work bare.

import { notFound } from "next/navigation";
import DemoApp from "../demo-app.jsx";
import { listSubjects, getStoredMix, getGraphForSubject, getCitationsForItem } from "../../../src/lib/store.js";
import { slugify } from "../../../src/lib/slug.js";
import { getIntroExtract } from "../../../src/lib/entities/wikipedia.js";

export const dynamic = "force-dynamic";

// Only what Tony has decided to share — everything else 404s.
const DEMO_SLUGS = new Set([
  "the-glass-bead-game",
  "detroit-style-pizza",
  "live-art-in-microgravity",
]);

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return { title: "Kynda — influence map", robots: { index: false, follow: false } };
}

export default async function DemoPage({ params }) {
  const { slug } = await params;
  if (!DEMO_SLUGS.has(slug)) notFound();
  const subjects = await listSubjects();
  const subject = subjects.find((s) => slugify(s.name) === slug) || null;
  if (!subject) notFound();

  const [mix, graph, bio] = await Promise.all([
    getStoredMix(subject),
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
      candidates.push({ ...c, verification: { ...c.verification, citations } });
    }
    if (candidates.length) hydrated.push({ slotType: slot.slotType, candidates });
  }

  return (
    <DemoApp
      subject={{ name: subject.name, kind: subject.kind, domain: subject.domain, yearsActive: null, description: null }}
      bio={bio ? { text: bio.text, articleTitle: bio.title, url: bio.url, source: "Wikipedia" } : null}
      intro={mix.intro || subject.intro || ""}
      slots={hydrated}
      graph={graph}
    />
  );
}
