// Print/PDF view (V3-37, Brown alumni-board feedback): a clean document with
// the full influence list — every carousel candidate with its receipts — and
// the influence graph. Server component gathers everything from the claims
// store (zero model calls); the browser's print-to-PDF does the rendering.

import { notFound } from "next/navigation";
import PrintView from "./print-view.jsx";
import { listSubjects, getStoredMix, getGraphForSubject, getCitationsForItem } from "../../../../src/lib/store.js";
import { slugify } from "../../../../src/lib/slug.js";
import { getIntroExtract } from "../../../../src/lib/entities/wikipedia.js";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return { title: `Kynda — influence map (print)`, robots: { index: false } };
}

export default async function PrintPage({ params }) {
  const { slug } = await params;
  const subjects = await listSubjects();
  const subject = subjects.find((s) => slugify(s.name) === slug) || null;
  if (!subject) notFound();

  const [mix, graph, bio] = await Promise.all([
    getStoredMix(subject),
    getGraphForSubject(subject).catch(() => null),
    getIntroExtract({ name: subject.name, qid: subject.wikidata_qid }).catch(() => null),
  ]);
  if (!mix) notFound();

  // Normalize legacy payloads and hydrate citations from the claims store —
  // the printed card shows the same receipts as the live serve.
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
    <PrintView
      subject={{ name: subject.name, domain: subject.domain, kind: subject.kind }}
      intro={mix.intro || subject.intro || ""}
      bio={bio}
      slots={hydrated}
      graph={graph}
      slug={slug}
    />
  );
}
