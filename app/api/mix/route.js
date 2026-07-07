// Streams the mix as NDJSON events:
//   {type:"intro"} → {type:"item"}×N (badge: verifying) →
//   {type:"verification"}×N (badges resolve as each MusicBrainz check lands,
//   ~1.1s apart per API etiquette) → {type:"done"}
// The visible badge-earning delay is the product working as designed (V3-11):
// "verified" appears only after the deterministic check passes.

import { generateMix, verifyAttribution, verifyConnection, loadSubjectArticle, loadSubjectMembers, getCachedMix, cacheMix } from "../../../src/lib/pipeline/mix.js";
import { persistMixRun, getStoredMix, getCitationsForItem } from "../../../src/lib/store.js";

export const maxDuration = 300;

export async function POST(req) {
  const { subject } = await req.json().catch(() => ({}));
  if (!subject?.name) {
    return Response.json({ error: "subject required" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        // L1: per-instance memory. L2: the claims store (survives deploys and
        // cold starts — V3-17). Both serve the full verified payload instantly.
        let cached = getCachedMix(subject);
        if (!cached) {
          cached = await getStoredMix(subject).catch((err) => {
            console.error("getStoredMix failed:", err.message);
            return null;
          });
          if (cached) cacheMix(subject, cached);
        }
        if (cached?.entries) {
          send({ type: "intro", intro: cached.intro, cached: true });
          cached.entries.forEach((entry, i) => {
            send({ type: "item", index: i, item: entry.item });
            send({ type: "verification", index: i, verification: entry.verification });
          });
          send({ type: "done", cached: true });
          return;
        }

        // Members feed the mix prompt (member-level connections become
        // deliberate) and serve as hop 1 of two-hop verification (V3-16).
        const members = await loadSubjectMembers(subject);
        // Fetch the subject's Wikipedia article while the mix generates —
        // every connection check reads it.
        const [mix, subjectArticle] = await Promise.all([
          generateMix(subject, members),
          loadSubjectArticle(subject),
        ]);
        send({ type: "intro", intro: mix.intro });
        mix.items.forEach((item, i) => send({ type: "item", index: i, item }));

        // Sequential on purpose: MusicBrainz etiquette is ~1 req/sec.
        const entries = [];
        for (let i = 0; i < mix.items.length; i++) {
          const item = mix.items[i];
          const [attribution, connection, citations] = await Promise.all([
            verifyAttribution(item),
            verifyConnection(item, subject, subjectArticle, members),
            // T2 primary-source citations from the agent-researched corpus
            getCitationsForItem(subject, item).catch(() => []),
          ]);
          const verification = { attribution, connection, citations };
          entries.push({ item, verification });
          send({ type: "verification", index: i, verification });
        }

        cacheMix(subject, { intro: mix.intro, entries });
        send({ type: "done" });

        // Persist the run to the claims store (V3-17) — every search
        // permanently enriches the graph. Best-effort: never break the
        // response, which has already been fully delivered.
        try {
          await persistMixRun({ subject, intro: mix.intro, entries });
        } catch (err) {
          console.error("persistMixRun failed:", err.message);
        }
      } catch (err) {
        console.error("mix error:", err);
        send({ type: "error", message: err.message || "mix generation failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
