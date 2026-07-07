// Streams the mix as NDJSON events (protocol v2, V3-19 — multi-candidate slots):
//   {type:"intro"}
//   {type:"item", s, c, slotType, item}          one per candidate
//   {type:"verification", s, c, verification}    badges resolve as checks land
//   {type:"rank", s, order}                      provenance ranking per slot —
//                                                the default card is the best-
//                                                EVIDENCED candidate, recomputed
//                                                on every serve as the corpus grows
//   {type:"done"}

import { generateMix, verifyAttribution, verifyConnection, loadSubjectArticle, loadSubjectMembers, getCachedMix, cacheMix, rankCandidates } from "../../../src/lib/pipeline/mix.js";
import { persistMixRun, getStoredMix, getCitationsForItem } from "../../../src/lib/store.js";

export const maxDuration = 300;

// Old cached payloads ({entries}) normalize to single-candidate slots.
function normalizePayload(payload) {
  if (payload?.slots) return payload;
  if (payload?.entries) {
    return {
      intro: payload.intro,
      slots: payload.entries.map((e) => ({ slotType: e.item.slotType, candidates: [e] })),
    };
  }
  return null;
}

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
        // L1: per-instance memory. L2: the claims store (survives deploys).
        let cached = getCachedMix(subject);
        if (!cached) {
          const stored = await getStoredMix(subject).catch((err) => {
            console.error("getStoredMix failed:", err.message);
            return null;
          });
          cached = normalizePayload(stored);
          if (cached) cacheMix(subject, cached);
        }
        if (cached?.slots) {
          send({ type: "intro", intro: cached.intro, cached: true });
          for (let s = 0; s < cached.slots.length; s++) {
            const slot = cached.slots[s];
            const verifications = [];
            for (let c = 0; c < slot.candidates.length; c++) {
              const entry = slot.candidates[c];
              // Citations re-read on every serve: the corpus keeps growing
              // after a mix is cached, and new primary sources must surface
              // (and can re-rank the carousel).
              const citations = await getCitationsForItem(subject, entry.item).catch(() => entry.verification?.citations || []);
              const verification = { ...entry.verification, citations };
              verifications.push(verification);
              send({ type: "item", s, c, slotType: slot.slotType, item: entry.item });
              send({ type: "verification", s, c, verification });
            }
            send({ type: "rank", s, order: rankCandidates(verifications) });
          }
          send({ type: "done", cached: true });
          return;
        }

        // Members feed the mix prompt and hop 1 of via-verification (V3-16).
        const members = await loadSubjectMembers(subject);
        const [mix, subjectArticle] = await Promise.all([
          generateMix(subject, members),
          loadSubjectArticle(subject),
        ]);
        send({ type: "intro", intro: mix.intro });
        mix.slots.forEach((slot, s) =>
          slot.candidates.forEach((item, c) => send({ type: "item", s, c, slotType: slot.slotType, item }))
        );

        // Verify defaults (c=0) across all slots first so lead badges resolve
        // quickly, then the alternates. Sequential per MusicBrainz etiquette.
        const verifs = mix.slots.map((slot) => new Array(slot.candidates.length).fill(null));
        const maxCandidates = Math.max(...mix.slots.map((slot) => slot.candidates.length));
        for (let c = 0; c < maxCandidates; c++) {
          for (let s = 0; s < mix.slots.length; s++) {
            const item = mix.slots[s].candidates[c];
            if (!item) continue;
            const [attribution, connection, citations] = await Promise.all([
              verifyAttribution(item),
              verifyConnection(item, subject, subjectArticle, members),
              getCitationsForItem(subject, item).catch(() => []),
            ]);
            verifs[s][c] = { attribution, connection, citations };
            send({ type: "verification", s, c, verification: verifs[s][c] });
          }
        }

        const slotsWithVerifs = mix.slots.map((slot, s) => ({
          slotType: slot.slotType,
          candidates: slot.candidates.map((item, c) => ({ item, verification: verifs[s][c] })),
        }));
        slotsWithVerifs.forEach((slot, s) =>
          send({ type: "rank", s, order: rankCandidates(slot.candidates.map((x) => x.verification)) })
        );

        cacheMix(subject, { intro: mix.intro, slots: slotsWithVerifs });
        send({ type: "done" });

        // Persist (V3-17) — every candidate becomes a claim in the graph.
        try {
          await persistMixRun({ subject, intro: mix.intro, slots: slotsWithVerifs });
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
