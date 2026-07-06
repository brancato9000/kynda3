// Streams the mix as NDJSON events:
//   {type:"intro"} → {type:"item"}×N (badge: verifying) →
//   {type:"verification"}×N (badges resolve as each MusicBrainz check lands,
//   ~1.1s apart per API etiquette) → {type:"done"}
// The visible badge-earning delay is the product working as designed (V3-11):
// "verified" appears only after the deterministic check passes.

import { generateMix, verifyItem, getCachedMix, cacheMix } from "../../../src/lib/pipeline/mix.js";

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
        const cached = getCachedMix(subject);
        if (cached) {
          send({ type: "intro", intro: cached.intro, cached: true });
          cached.items.forEach((entry, i) => {
            send({ type: "item", index: i, item: entry.item });
            send({ type: "verification", index: i, verification: entry.verification });
          });
          send({ type: "done", cached: true });
          return;
        }

        const mix = await generateMix(subject);
        send({ type: "intro", intro: mix.intro });
        mix.items.forEach((item, i) => send({ type: "item", index: i, item }));

        // Sequential on purpose: MusicBrainz etiquette is ~1 req/sec.
        const entries = [];
        for (let i = 0; i < mix.items.length; i++) {
          const verification = await verifyItem(mix.items[i]);
          entries.push({ item: mix.items[i], verification });
          send({ type: "verification", index: i, verification });
        }

        cacheMix(subject, { intro: mix.intro, items: entries });
        send({ type: "done" });
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
