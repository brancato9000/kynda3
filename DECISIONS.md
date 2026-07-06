# Kynda v3 — Decision Log

Started: 2026-07-05. Carries forward the kynda2 decision log (product vision, slot taxonomy, disambiguation tiers, design language, rejected paths) — see `../kynda2/DECISIONS.md`. Entries here are new decisions for the v3 rebuild.

---

## V3-01: From-scratch rebuild
**Decision:** Rebuild rather than iterate on kynda2. New repo, server-side orchestration, truth-first data model.
**Rationale:** The anti-hallucination architecture (verification pipeline, claims store, provenance) is greenfield either way, and kynda2's client-side orchestration and string-keyed data model actively fight it. Full reasoning in [REBUILD_PLAN.md](REBUILD_PLAN.md). Salvage list is explicit there; kynda2 stays deployed until Phase 1 reaches parity.

## V3-02: Confidence = machine-assigned provenance
**Decision:** Confidence tiers (`verified` / `sourced` / `inferred`) are derived from provenance records by deterministic code. Models never self-assign confidence. Encoded in the database itself via the `claim_state` view.
**Rationale:** kynda2's self-reported tiers produced the canonical failure — a wrong attribution stamped "verified" (CORRECTIONS.md 2026-02-14). A model cannot reliably grade its own homework in the same forward pass that confabulates.

## V3-03: The verifier stays dumb
**Decision:** Quote verification is normalize-and-string-match. Entity verification is a structured-database lookup with exact artist-credit comparison. No model in the verification path, ever.
**Rationale:** This is the load-bearing wall. The moment a model judges whether a source "supports" a claim, the hallucination guarantee evaporates — you've moved confabulation up a layer instead of eliminating it. An agent's claim is trusted only insofar as a dumb script can confirm its artifact (URL + exact quote, or DB record).

## V3-04: Phase 0 is plain Node + SQL; Next.js arrives in Phase 1
**Decision:** No web framework yet. Phase 0 is the schema, entity clients, verifier primitives, and eval harness — zero runtime dependencies except `pg` (used only by the migration runner). The eval harness runs on Node built-ins.
**Rationale:** Keeps the foundation reviewable and CI fast (no install step). The app framework is a Phase 1 concern; committing to it now adds noise to the part of the project that must be most trustworthy.

## V3-05: Plain JavaScript (ESM), not TypeScript
**Decision:** JS with JSDoc where signatures matter.
**Rationale:** Matches the maintainer's existing codebase and keeps friction low for a solo project. The correctness burden here is carried by the eval harness and deterministic verifiers, not by static types. Revisit if the team grows.

## V3-06: Golden set honesty rule
**Decision:** Golden-set data splits into two trust classes. Machine-checkable facts (canonical IDs, attribution tuples) were verified against live MusicBrainz/Wikidata at authoring time. Interpretive facts (`influence_facts`) ship `human_confirmed: false` and are advisory until a human flips the flag.
**Rationale:** An eval harness seeded with hallucinated ground truth is worse than none. The golden set must hold itself to the same provenance standard as the product. (The trap attributions are seeded from kynda2's CORRECTIONS.md — real observed failures.)

## V3-07: Ground-truth sources per domain
**Decision:** MusicBrainz (CC0, no key) is the music ground truth; Wikidata (CC0) is the cross-domain spine; TMDb (needs API key) and Open Library are deferred to Phase 1.
**Rationale:** Start where verification is free, keyless, and richest. Music-first matches kynda2's AD-15. Film/TV golden subjects are included now with Wikidata resolution only, so the schema and eval format are cross-domain from day one.

## V3-08: Real decoys as disambiguation tests
**Decision:** Golden subjects record known real-world decoys (e.g., Nirvana the UK 60s band vs. the US grunge band; The Godfather the video game vs. the 1972 film). Disambiguation evals must surface or correctly rank these.
**Rationale:** Retrieval-first disambiguation (candidates come from DB search APIs, model only ranks) makes invented entities impossible by construction — but choosing the wrong *real* entity is still a failure mode, and it's testable.
