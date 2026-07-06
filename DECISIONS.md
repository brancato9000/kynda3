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

## V3-09: Phase 1 model strategy — Fable 5 + Haiku, structured outputs everywhere
**Decision:** `claude-fable-5` generates the KyndaMix (effort `low` for interactive latency — Fable at low effort still exceeds prior models at max; revisit with eval data). `claude-haiku-4-5` ranks disambiguation candidates. All calls use `output_config.format` (structured outputs) — schema-valid JSON is guaranteed, deleting kynda2's hand-rolled streaming JSON parser and its "respond ONLY with valid JSON" prompt scaffolding. Fable calls include the server-side refusal fallback to Opus 4.8 (`server-side-fallback-2026-06-01`) so a classifier false-positive degrades gracefully instead of failing the request.
**Note:** The model no longer outputs confidence or sources at all — those fields are machine-assigned by the verifier (V3-02). Fable 5 requires 30-day data retention; a ZDR org gets 400s on every request.

## V3-10: Retrieval-first disambiguation
**Decision:** Candidates come from MusicBrainz artist search + Wikidata entity search; Haiku only ranks them by index and assigns the certain/likely/ambiguous tier (kynda2 AD-02 UX unchanged). An entity absent from both databases cannot be selected, by construction.
**Trade-off:** Very obscure or brand-new works missing from both databases return "no match" instead of a hallucinated guess. That is the correct failure mode for a truth-first product.

## V3-11: Verification streams as badge events
**Decision:** The mix API streams NDJSON: intro → items (badge: "verifying…") → per-item verification events as each MusicBrainz check completes (~1.1s apart, per API etiquette) → done. Cards appear immediately; badges are visibly earned.
**Rationale:** Inline verification adds ~9s for 8 items. Rather than hiding that behind a spinner, the UI shows verification happening — the latency is the trust story. Failed checks render the card dimmed with an explicit "could not be confirmed" warning; no silent dropping.

## V3-12: Phase 1 lands in slices
**Decision:** Slice 1 is the core loop: search → retrieval-first disambiguation → generated + verified mix. Deferred to follow-up slices: influence graph, Connections tab, slot alternatives ("MORE →"), Wikipedia subject images, TMDb/Open Library verifiers for film/TV/books, Postgres-backed cache (in-memory Map interim, keyed on canonical entity IDs). kynda2 stays deployed until parity.

## V3-13: Two provenance layers — attribution vs. connection
**Decision:** Every card carries two machine-assigned provenance layers. **Attribution** (does this creator actually have this work?) is checked against MusicBrainz (music), Open Library (books), or Wikidata descriptions (film/TV/art). **Connection** (is the influence relationship itself documented?) is checked by deterministic Wikipedia cross-mention: does the subject's article mention the recommended creator, or vice versa? A hit extracts and displays the actual sentence, linked.
**Award-only rule:** weak verifiers (Wikidata description match) may award "verified" but never convict — a miss maps to "unchecked", not "failed". Only strong verifiers (MusicBrainz, Open Library exact matches) can mark an item red.
**Rationale:** This answers "isn't this just copying MusicBrainz?" structurally: the databases fact-check the synthesis; they cannot produce it. The Wikipedia excerpt makes the connection's documentary support visible without any model judging whether a source "supports" a claim (V3-03 upheld — mention detection is a string match; the reader judges the evidence).

## V3-14: Badge language separates the notary from the author
**Decision:** Badges read "✓ facts checked" / "✕ failed fact-check" / "unchecked" (attribution) and "◆ documented" / "synthesis" (connection). Database names are demoted to tooltips and links. The footer states explicitly that the connections are Kynda's synthesis and the databases only fact-check it.
**Rationale:** The slice-1 badge ("verified · MusicBrainz") accidentally presented the fact-checker as the source, making the product read as a MusicBrainz wrapper. Naming the check, not the checker, keeps the trust signal without misattributing the value.

## V3-15: Bios are quoted, never generated
**Decision:** The subject bio is the opening of the subject's Wikipedia article, displayed verbatim with attribution ("— Wikipedia ↗"). Years-active comes from MusicBrainz life-span data; the descriptor line from the database that supplied the candidate. Haiku's disambiguation schema no longer contains bio/genres/yearsActive — its only outputs are candidate indices and the ambiguity tier, fields that cannot carry hallucinated facts. No Wikipedia article → no prose bio, with an explicit note.
**Rationale:** First user-caught hallucination in v3 (2026-07-06): Haiku invented a "hit single 'Almost Here'" for Lazlo Bane — retrieval locked the entity but the bio prose was ungrounded, and it read as reference material. Principle: don't generate what you can quote; honest absence beats confident invention. Side benefit: the grounded bio feeds the mix prompt, giving Fable true context instead of model-guessed context.

## V3-16: Two-hop connections — model proposes the path, machine verifies the hops
**Decision:** The subject's MusicBrainz membership relations feed the mix prompt (member-level connections become deliberate) and mix items gain an optional `via` field naming an intermediate person. When a direct Wikipedia cross-mention fails but `via` is present, the verifier checks the chain deterministically: hop 1 = via↔subject (MusicBrainz membership relation, else subject-article mention), hop 2 = via's article mentions the work (title, else creator). Both hops pass → "documented via {person}" with both pieces of evidence shown (dashed border marks the indirection). ONE intermediate hop maximum.
**Rationale:** User-caught case (2026-07-06): Garden State recommended as Lazlo Bane legacy — correct, but only via member Chad Fischer, who scored it. The model's synthesis out-reasoned the one-hop fact-checker. This is the claims graph (member_of + collaborated_with composition) arriving in the runtime pipeline ahead of the Phase 2 corpus. The hop cap exists because chains through people connect everyone to everything; at three hops the signal dies.

## V3-08: Real decoys as disambiguation tests
**Decision:** Golden subjects record known real-world decoys (e.g., Nirvana the UK 60s band vs. the US grunge band; The Godfather the video game vs. the 1972 film). Disambiguation evals must surface or correctly rank these.
**Rationale:** Retrieval-first disambiguation (candidates come from DB search APIs, model only ranks) makes invented entities impossible by construction — but choosing the wrong *real* entity is still a failure mode, and it's testable.
