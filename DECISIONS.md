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

## V3-17: Persistence — every search enriches the graph (MASTERPLAN Phase A)
**Decision:** The Phase 0 schema is live in Supabase (transaction pooler). Every completed mix run persists: subject and work entities (canonical-ID keyed), one claim per non-essential slot (legacy claims stored direction-reversed per the schema's inverse-read convention), provenance rows mirroring the machine verifications, the mix payload as a durable L2 cache (180-day TTL), and the query log for research-queue prioritization. Cache hierarchy: L1 per-instance memory → L2 claims store → generate. All persistence is best-effort — without DATABASE_URL or on any write failure, serving is unaffected.
**Notes:** Provenance rows attach only on first sight of a claim (idempotent re-serves). Round-trip verified against live Supabase including the claim_state view deriving confidence from evidence. The view's verified/sourced/inferred vocabulary predates the MASTERPLAN T0–T4 trust ladder; reconciliation lands with the contribution layer.

## V3-18: The research pipeline — agents propose, the evidence gate decides (MASTERPLAN Phase B)
**Decision:** Subject researchers (Fable 5 + web search/fetch, refusal fallback to Opus 4.8) hunt primary sources for a subject's known claims and may add strongly-sourced new ones. Every finding is a URL + EXACT quote; the deterministic evidence worker (fetch → HTML-strip → quoteMatch → Wayback lookup) is the only path to T2. Unconfirmed findings are stored as 'unverifiable'/'dead_link' for audit but earn nothing. Confirmed citations surface at serve time under mix reasons ("cited · primary source" with the quote, publication, and archive link) and outrank the Wikipedia cross-mention display. Queue mechanics: query_log Zipf seeding (`--enqueue-top`), manual enqueue, batch draining via `scripts/research.js`.
**Notes:** Researcher degrades gracefully across tool versions (web_*_20260209 → basic) and output modes (structured → JSON-from-text) since Fable's server-tool surface may vary. Live-tested the gate on real pages: true quote confirmed, plausible fabrication rejected, dead link flagged. The gate also caught an HTML artifact (stray spaces before punctuation after tag-stripping) now handled in the shared normalizer — haystack and needle normalize identically, still zero judgment.

## V3-19: Multi-candidate slots with provenance-ranked carousels
**Decision:** Influence is never singular: each slot now carries 2-3 candidates, generated in one Fable call (alternates ride on output tokens — no extra input cost), each independently verified and persisted as its own claim. The card shows a carousel (‹ n/N ›) whose default is the best-EVIDENCED candidate, ranked by a deterministic provenance score (T2 citations ≫ documented connection ≫ fact-checked attribution; failed fact-checks sink). Ranking recomputes on every serve, so corpus growth can promote a different candidate to a card's front overnight. Stream protocol v2: item/verification events carry (slot, candidate) coordinates plus per-slot rank events; defaults verify before alternates so lead badges resolve first. Old cached payloads normalize to single-candidate slots.
**Rationale:** Generalizes kynda2's AD-06 ("MORE →" alternatives) into the core data model, and gives the trust ladder a visible consequence: evidence doesn't just badge a card, it decides what you see first.

## V3-20: Research economics (measured 2026-07-07) and the model-tiering answer
**Measured, one subject each:** Fable uncached $14.90 (6/9 T2); Fable capped-fetches-but-uncached $23.69, 46 min (10/15 T2 — quality excellent, cost driven by pause_turn turns re-paying the full conversation); Sonnet 5 capped+cached: attempt 1 returned zero findings ($0.23 — Sonnet is less tool-eager and can quit early), attempt 2 returned 5/6 T2 for **$1.64 in 6 min**. Prompt caching is the decisive lever (945k input tokens cost $1.64 total).
**Decision:** Research defaults to **Sonnet 5 + capped fetches + prompt caching + retry-on-empty** (empty runs cost ~$0.23, so one retry is cheap insurance). Fable remains the escalation tier for subjects where Sonnet returns thin results, and stays the generation model for the mix itself. Sprint planning number: ~$2–3/subject blended ⇒ ~$2–3k for the 1,000-subject corpus, ~$0.30 additional per subject for the seed mix.
**Note:** Fable+caching was not directly measured (Sonnet's success short-circuited it); estimated ~$4–6/subject if ever needed.

## V3-21: Source degrees & speaker attribution
**Decision:** Citations carry a `speaker` (whose words the quote is — never the outlet) and a `source_degree`: **first** (the subject/its creators/collaborators speaking), **second** (named critics, journalists, scholars), **third** (fan analysis, wikis — also where fan submissions will enter the ladder). Degree attaches to the speaker, not the publication: a Lumet quote inside a blog post is first-degree voice in a third-degree venue, and renders as "— Sidney Lumet, via CinemaTyler ↗". Chip labels: "cited · artist's own words / critical source / fan source". Carousel ranking weights degrees (120/100/60 per citation). The research agent is directed to deliberately hunt second-degree (critical) sources for connections that live in criticism rather than artist statements — the mechanism that anchors "Kynda's synthesis" connections like King Lear→The Godfather.
**Honesty note:** quote verification stays deterministic and degree-blind; speaker/degree are agent-classified metadata, displayed so readers can judge and curator-correctable later. This field is the machine-readable seed of the MASTERPLAN's artist/critics/fans perspective toggle.

## V3-22: Abuse guards — daily circuit breaker + per-IP limits
**Decision:** Fresh generations (the ~$0.30 path) are guarded twice: a per-IP sliding window (10 fresh mixes/hour, 60 searches/hour — in-memory per serverless instance, deliberately leaky) and a DB-backed global daily circuit breaker (`KYNDA_DAILY_GENERATION_CAP`, default 100 mixes/day counted from the mixes table; `KYNDA_DAILY_SEARCH_CAP` 2000/day from query_log). Past the cap, the API answers "at capacity — cached subjects still work." Cached serves bypass all guards. Worst-case daily spend is bounded at ~cap × $0.30 regardless of attack shape; the retrieval-first disambiguation gate already means gibberish costs ~$0.001. Vercel dashboard bot protection is the recommended third layer (user-side toggle).
**Note:** The expensive research path (~$3/subject) is CLI-only and has no public route.

## V3-23: Degeneration gate on reason prose + layout armor
**Decision:** User-caught (2026-07-08, Flight of the Conchords card): a generated reason ended in a token-repetition loop ("done.yes.end.stop.done…") — one unbreakable string that also blew the card layout off-page. Three layers: `sanitizeReason()` (pure string logic: cut at the first 46+-char multi-period token, hard-cap 700 chars, trim to sentence boundary) runs on every generated candidate; `overflow-wrap: anywhere` on cards so no content can escape layout regardless of source; the poisoned seed regenerated through the gate. Eval covers the exact live failure string.
**Rationale:** Character-count pressure in the prompt occasionally makes models pad degenerately; prose quality gets a deterministic gate just like facts do.

## V3-24: The Bootstrap Constraint
**Decision (2026-07-08):** Until funding or ~100× cheaper research economics, Kynda cannot launch unfettered. Standing rules: no research spend without explicit per-batch approval; the daily generation cap is the launch mechanism (fixed daily budget admits N new subjects/day, query-log-ordered); subsequent build phases selected for zero marginal token cost. See MASTERPLAN §9½ for the cost-collapse roadmap (source-harvesting → fan contributions → cheap-model research + batch → price declines).
**Context:** measured $2–4.50/subject research capex, $0.30 once-ever per fresh subject, ~$0.001 cached. The distinction between corpus capex and search opex is load-bearing: traffic is already cheap; corpus buildout is what needs funding.

## V3-25: The influence graph, evidence-weighted — and the entity-dedupe lesson
**Decision:** The Graph tab returns (kynda2 AD-04/05/07 preserved: D3 owns the SVG, lazy load, click-for-context/double-click-to-navigate) as a pure claims-store read — zero tokens. Node size = evidence weight (T2 citations ×3, confirmed documentation ×1.5, capped 10), finally replacing kynda2's model-vibes "significance". T2-cited nodes wear a gold ring. Click opens a provenance panel with actual quotes/links (replacing kynda2's per-click Haiku call with a free DB read).
**Lesson:** the graph immediately exposed duplicate entities — research targets upserted with domain "other" didn't match mix entities with real domains, so citations lived on shadow duplicates (mix cards, matching citations by name, masked it). Fixes: name-matching now ignores domain and uses creator as the tiebreaker; graph nodes with the same normalized name merge their evidence pools. A DB-level dedupe migration for existing duplicates remains an open thread.

## V3-26: Contributions pulled forward — evidence patching + hallucination flags
**Decision:** MASTERPLAN Lane 1 ships now (accelerated after a user-caught synthesis hallucination: a fact-checked card whose reason falsely claimed Commissioner Gordon Williams worked on Nirvana's MTV Unplugged — honest label, damaging prose). Every card carries "⚑ report an issue"; synthesis-labeled connections carry "know a source? add it." Evidence submissions pass the SAME deterministic gate as agent findings (fetch → quote-match → archive) — confirmed quotes attach as provenance immediately with a "fan-contributed (pending review)" marker; failed quotes are rejected with honest guidance; confirmed quotes with no matching connection are held rather than force-attached. Flags and evidence land in a contributions table; scripts/contributions.js is the interim curator queue. No accounts yet — contributor is a free-form handle; per-IP rate limits apply.
**Zero tokens throughout** — the whole lane is fetches and string matches, per the bootstrap constraint.

## V3-27: Founder dashboard at /admin
**Decision:** A shared-secret admin surface (KYNDA_ADMIN_TOKEN env var; x-kynda-admin header; token remembered per-browser): corpus stats, 24h search/generation counters (the budget dial's gauge), the last 100 searches with disambiguation tiers, and the contribution review queue with approve/deny. Approve clears the fan-contributed pending marker; **reject pulls the attached provenance** so the citation disappears from cards on next serve. Flags: resolve/dismiss. No accounts — the token IS the curator role until Phase C brings identity. Zero tokens; pure DB reads/writes.

## V3-28: Permanent subject pages, share links, and the bare checkmark
**Decision:** Every subject with a stored mix gets a permanent URL — /s/[slug] (diacritic-folded name slug) — rendered by a server component that resolves the slug, fetches the quoted Wikipedia bio, sets page metadata (title/description/OG from the stored intro), and boots the app with the subject preloaded; the mix serves from the claims store with zero model calls. A share button on the subject card copies the permanent link. The app itself became a reusable component (home renders it bare). Also per Tony's design call: the attribution chip is now a bare linked ✓ — "FACTS CHECKED" overstated a check that only covers title/creator/year; the checkmark sits beside exactly the facts it verified.
**Rationale:** every demo, grant conversation, and August session needs a URL, not a search box. Hygiene batch same day: 136 duplicate entities merged (canonical IDs as merge barriers — the two Nirvanas stay separate), 103 duplicate claims collapsed, 97 citations speaker/degree-backfilled ($0.018), Lauryn Hill seed regenerated ($0.31) purging the flagged Gordon Williams prose. Corpus voice census: 53 first-degree, 63 second, 9 third.

## V3-29: The source harvester — measured at $0.007 per confirmed citation
**Decision:** Harvesting replaces subject research as the default corpus-building method. Architecture: WE fetch the page once (free, deterministic); ONE structured-output call (Sonnet 5, no tools, no loops) extracts every stated connection; quotes verify against the very text we hold; claims/provenance persist through the standard store path with speaker/degree attribution.
**Validated 2026-07-09 (9 sources, $0.58 total):** 93 confirmed citations, 12 rejected (89% gate pass-rate vs ~50-70% for subject research), 39 distinct subjects touched — **$0.007/confirmed citation vs $0.50-1.00 via subject research: two orders of magnitude, the bootstrap constraint's own target.** One Wikipedia page (Neutral Milk Hotel) yielded 25 claims across 20 subjects — the amortization thesis in one line.
**Honest wrinkles:** ~10-15% of confirmed claims have poorly-shaped targets (genres/descriptions/events as entities, e.g. "aggro punk", "Kanye West's first Grammy speech"); harvest lacks the mix pipeline's self-reference guard; one paywalled source (Rolling Stone) rejected 9/14. Next iteration: prompt constraint that targets be specific named works/artists, plus a target-shape filter. Discovery of which sources to harvest remains the open cost (subject research found tonight's URLs) — but subjects' own Wikipedia pages are free, known URLs and the single richest source class found.

## V3-30: Harvest entity-shape gates
**Decision:** Two-layer shape enforcement on harvest claims. Model layer: entity-shape rules in the prompt (specific named works/artists/movements only; no genres, events, versions, descriptions, or composite lists; one claim per entity; named movements by proper name) plus a `targetKind` enum where "other" self-labels junk for discard. Deterministic layer: `validEntityShape()` — length 2-80, <3 commas, must contain an uppercase/digit (genres are all-lowercase), with a symbol-title exception (">>>", "!!!"). Self-referential claims dropped. Eval fixtures use the first batch's actual noise.
**Cleanup + false-positive lesson:** 15 malformed entities and their claims purged from the graph — but the dry-run flagged 5 REAL entities the rules would have killed (Beak>'s ">>>" albums, Trick Daddy's "www.thug.com", early Elephant 6 projects Ruby Bulbs and Pree-Sisters), human-reviewed onto a keep list. Accepted limitation: stylized all-lowercase titles with letters ("www.thug.com") still fail the ingest gate — rare, re-enterable via curation. Validation harvest (Kraftwerk Wikipedia): 39 clean claims across 38 subjects, $0.006/citation, zero malformed entities.

## V3-33: The homepage index — and the identity-pool fix it exposed
**Decision:** The homepage lists every indexed subject as clickable chips below the search bar, grouped by domain ("In the graph so far — N subjects") — a demo recipient never guesses what's been built. Server-rendered from listSubjects(), hidden once a search starts.
**What it exposed:** three Frank Sinatras. Root cause was systemic — kind guesses differ per pipeline (person via MusicBrainz, other via Wikidata, and the harvester hardcoded every target as work), and name-matching required kind equality. Fixes: (1) upsertEntity treats creator-shaped kinds (person/group/other + creator-less works) as ONE identity pool, with works-with-creators kept separate (real collisions exist: Cake's song "Frank Sinatra"); (2) matches absorb canonical IDs they lack (id enrichment prevents future id-lookup misses); (3) recordFinding uses harvest targetKind instead of hardcoding work; (4) dedupe script gained the cross-kind pass, intra-group claim pre-deletion (self-reference CHECK caused whole-group rollbacks), and strip-before-copy ID absorption (unique-index rollbacks). 59 cross-kind duplicates merged across two passes; zero dupe groups remain; keeper Sinatra now carries both his MBID and QID.

## V3-34: Institutional claims — the vocabulary the Skybetter harvest demanded
**Decision:** Three new claim types — `founded`, `taught_at`, `studied_under` (migration 005) — wired through both extraction schemas, the harvest prompt, and the graph. `studied_under` renders as a PREDECESSOR edge: lineage IS influence, and in dance the form transmits teacher-to-body. `founded`/`taught_at` render as peers. `institution` joined the harvest `targetKind` enum: the first live run with the new claim types dropped "Skybetter taught_at Brown University" because the model (correctly) refused to call a university a work and "other" is the discard bucket — claim types without the matching entity kind are half a vocabulary. Eval now enforces the wiring invariant: every claim type the harvester can emit must have a graph role.
**Why:** bio/profile pages state roles, not influences ("founded CRCI", "taught at Brown", "studied under Graham") — the earlier Skybetter field harvests yielded zero partly because the vocabulary had no words for what those pages say. First yield (L.A. Dance Chronicle interview, $0.11): Skybetter first-degree-cites dance critics Edwin Denby, John Martin, and Deborah Jowett as influences — critic-as-influence, the second-degree voices becoming first-degree subjects.
**Same batch, three harvester hardening fixes:** (1) `extractJson` now names `stop_reason: max_tokens` instead of surfacing "Unterminated string in JSON at position 137" — on dense pages thinking shares (and can exhaust) the output-token budget before the JSON starts; harvest retries once at 32k. This was the REAL giant-page failure mode; the 40-claim cap alone didn't fix Radiohead/Björk/Talking Heads. (2) `addProvenance` is idempotent on (claim, url, quote, status), so re-harvesting a source page never stacks duplicate citations. (3) `callModel` streams (SDK rejects non-streaming requests that could exceed 10 minutes, which the 32k retry can).
**Batch outcome (~$3.30 total):** all 27 corpus Wikipedia pages harvested — the giants finally in (Sinatra 22, Talking Heads, Björk, Radiohead) — plus two Skybetter sources (Dance Magazine profile fetched via Wayback after a 403; interviews are first-degree gold). Graph: 1,431 entities, ~965 T2 citations, 18 institutional claims. Sydney Skybetter is now an entity with edges to Brown University [taught_at], CRCI [founded], and his cited critic-influences. Known limitation surfaced: leading-article name variants ("The CRCI" vs "CRCI") aren't auto-merged — normalization is unsafe ("The The" is a band); two such pairs hand-merged.

## V3-35: Lane 2 — fans propose whole cards; Kynda builds them
**Decision:** On every finished mix, an "Add a connection" card: the fan names the influence and links a page containing the evidence — no typing evidence out. Flow: free deterministic pre-gate (fetch page, Wayback fallback on 403, require BOTH names present — zero tokens spent on junk); full `harvestSource` (the fan's page enriches the whole graph, not just their card); machine check that the named pair emerged quote-confirmed; contribution row for curator review; on approve, one small grounded Fable call writes the reason FROM the confirmed quote ($0.009 measured) and the card appends into the stored mix payload with a COMMUNITY chip. Citations re-read from the DB at serve, so the card ranks by real evidence — the live test card entered its carousel in FIRST position on provenance score.
**Why this shape:** the open cost in harvest economics is source DISCOVERY, and fans solve it for free, out of love. The machine does everything it already knows (fetch, extract, quote-confirm, attribute); the fan is the courier, not the source — a fan-submitted interview where the artist speaks is still first-degree. Guards: 2/hour per IP + global daily cap (KYNDA_DAILY_CONTRIB_CAP=20, fails closed), ~$0.10-0.15 per accepted URL.
**Live-test lesson (the honest-miss path):** a real submission (The Shins ← Echo & the Bunnymen, Best Fit "Nine Songs" interview) pre-gated fine, yielded 15 confirmed citations — and correctly did NOT confirm the named pair, because the machine attributed the claims to James Mercer (it's his personal interview) and to the specific songs he named. Accurate attribution beats fan phrasing; the rejection message says what verified anyway. Fixed en route: pre-gate and pair-check share name normalization ("&" ≡ "and"), and contributed cards carry attribution "skipped" (null means "still checking" to the UI). Known gap for later: band↔member aliasing (Mercer's citations should be findable from The Shins' page).

## V3-36: The UCLA source sheet — gear as cultural entities, sources beyond Wikipedia
**Decision:** Meagan's UCLA resource list (42 curated sources) assessed at zero model cost and triaged into four classes: (A) structured connection databases for future API adapters — Genius, Discogs, setlist.fm free; WhoSampled requires a metadata license, flagged as a partnership conversation; (B) prose publications the harvester eats today (DJBooth, Okayplayer, GRM Daily, P&P, RBMA); (C) gear/software as SUBJECTS, not sources — the sheet's own descriptions argue the thesis; (D) platforms/tools, mostly not evidence sources.
**Pilot (9 articles, $0.84, 2026-07-13):** 95 confirmed / 5 rejected — first non-Wikipedia, non-music-press harvest at the same economics (~$0.009/citation). The graph now contains **FL Studio as a cultural node with 24 edges**: Hudson Mohawke, Skepta, and Darq E Freaker first-degree-cite FruityLoops; three producers trace their lineage to Music Creation For The PlayStation (a video game → cross_medium_influence); FL Studio itself cites the Hammerhead Rhythm Station. Also seeded: E-mu SP-1200, MPC60, LinnDrum, TR-808, Okayplayer, DatPiff. Graph: ~1,596 entities / 1,105 T2 citations. Hand-merged FruityLoops→FL Studio (rename aliases — same curation class as leading-article variants, V3-34). The "tools are influences" beat is UCLA-course-shaped and demo-ready: the TR-808 is a node in the influence graph, same as Kraftwerk.

## V3-37: Alumni-board polish — category explainers and the printable map
**Decision:** Two of the three features from the Brown alumni-board demo (2026-07-13). (1) Every slot label carries a tappable ⓘ — the taxonomy descriptions have lived unused in the design tokens since day one; now they surface in place, tap-toggled (touch has no hover), outside-tap dismissed. (2) Share grew a PDF path: /s/[slug]/print renders a light-themed document — quoted bio, intro, EVERY carousel candidate with reason + up to 2 citations (speaker, publication, date) + text badges, the influence graph in a dark figure box, and a machine-earned-badges footnote with the live URL — and the browser's print dialog does the PDF. Zero model calls, zero new dependencies; break-inside CSS keeps cards whole across pages.
**Third feature (queued for planning):** "where to experience it" links per recommendation — needs Tony's per-medium calls on the free-vs-accessible balance.

## V3-38: Experience it — library-first, then the service you already pay for
**Decision:** Every card gets an "experience it" row (alumni-board feature 3; Tony's call: "strongly library-forward"). Tier 1, always first: a library/free-archive link per medium — Open Library + WorldCat (books), Kanopy + Internet Archive (film), Hoopla + Internet Archive (music), Jacob's Pillow archive (dance), Google Arts & Culture (art/design/architecture). Tier 2: convenience — music deep-links into the user's own streaming service (Spotify/Apple/YouTube, preference in localStorage, one picker syncs all cards via a window event; deep links land in their logged-in player so we never touch accounts), film routes to JustWatch.
**Why library-first:** Kynda's trust layer is built on public institutions; the consumption layer completes the thought — the map hands you to a library, not a storefront. Also the right texture for grant conversations (IMLS, university libraries, Brown).
**Mechanics + honest limitation:** every link is a deterministic search-URL template from title + creator — zero tokens, zero API keys, zero infrastructure, works for all 1,100+ cards retroactively. Search links, not exact-item links: occasionally a search lands on the wrong edition. Odesli exact-ID resolution can layer on later without changing the interface. Eval locks the invariants: every medium leads with a library link, URLs encode safely, literature never routes to a streaming service.

## V3-39: Covers — the first fully machine-sourced slots
**Decision:** Two new slots, named by Tony's direct call: "Covered Them" (↻) and "Covered By" (↺). They are the first slots with NO model in the loop: built from the claims store at serve time (getCoversSlots), deterministic reasons, appended after the mix slots on both serve paths. Sources: (1) existing harvest covers/covered_by claims — Talking Heads' "Take Me to the River" card materialized from corpus data the moment the slot existed, quote citation auto-surfaced; (2) setlist.fm live-show history (adapter + scripts/covers.mjs, Class A from the UCLA sheet): each artist's setlists aggregate into "performed live N times (YYYY–YYYY)" claims, origin structured_db, provenance db_relationship — the ✓ chip links to the setlist.fm record. **Needs KYNDA_SETLISTFM_KEY (free, api.setlist.fm) before the ingest can run.**
**Why covers matter (Tony's framing):** covers are behavioral influence — what an artist DID, repeatedly, in public, not what they said in an interview. "Performed live 14 times" is influence data no interview contains.
**Experience-it synergy (Tony, same session):** cover cards' primary link is "watch the cover" — a performance-targeted YouTube search ({coverer} {song} live cover). Verified-video resolution (YouTube Data API at ingest, stored on the claim) is backlogged as the upgrade. Also per Tony: the streaming-service picker now reads "more options ⌄" (the bare select was clipping).

## V3-40: Verified cover videos — see the influence happen
**Decision:** Cover cards resolve to an actual YouTube video of the performance ("▶ watch the cover"). The verifier stays dumb (V3-03): a video counts only if its TITLE contains both the coverer and the song after normalization — no model judges relevance; miss → fall back to the targeted search link. Resolution happens at ingest (scripts/cover-videos.mjs, most-played first, quota-aware: search = 100 of 10k free daily units → 85/run cap) and stores as provenance (method youtube_video) on the claim; getCoversSlots surfaces it as item.videoUrl.
**First run:** 71 of 85 title-verified (84%), 14 honest misses. The lead demo card — Talking Heads' "Take Me to the River" — resolves to the band's OFFICIAL channel's live 1978 Entermedia Theatre video: behavioral claim ("240 performances"), primary-source quote, and now the performance itself, one tap away. Bug caught in verification: the video LATERAL join was added without its column in the SELECT list — the UI showed no ▶ until the API stream was inspected directly.
**Ops:** KYNDA_SETLISTFM_KEY + KYNDA_YOUTUBE_KEY live in .env.local; both still need adding to Vercel env (with KYNDA_ADMIN_TOKEN, still pending) for production ingests.

## V3-41: Pathfinding — find the thread
**Decision:** /path?from=X&to=Y traces the shortest DOCUMENTED path between any two entities. Evidence-weighted Dijkstra over the full claims edge list (loaded in one query; the graph is small): quote-confirmed hops cost 1, db-confirmed 1.2, bare synthesis 3 — so a longer path with receipts beats a shorter leap without them, by construction. Pure DB read, zero tokens, server-rendered and shareable; homepage gets a "find the thread" GET form; unknown names get ILIKE suggestions; no-path gets the honest line ("a map of what's documented, not a claim that no connection exists"). Pure pathfinder lives in src/lib/path.js with eval fixtures locking the weighting behavior.
**First traces:** Kraftwerk → Doechii in 3 hops, all quote-cited (via Gary Numan and Janelle Monáe — the Monáe hop through Prince's equipment recommendations). Burt Bacharach → Kendrick Lamar in 7 hops, ALL cited: Carpenters → Beatles → Radiohead → Jeff Buckley → Billie Holiday → Beth Gibbons → "Mother I Sober." The first two hops come from the Mercer interview that the Lane 2 TEST SUBMISSION harvested — the contribution flywheel visibly feeding pathfinding.

## V3-42: Covers become a tab, the thread finder steps back
**Decision (all three Tony's calls, 2026-07-14):** (1) Covers leave the mix — "[artist] took on [artist]" over and over is too repetitive as cards; the data is playlist-shaped. New COVERS tab between MIX and GRAPH: two simple lists ("Covered them" / "Covered by"), each row a song + original artist + play-count stat + ▶ verified video + setlist.fm receipt. Lazy and free, same pattern as the graph tab; /api/covers is a pure claims read. The covers slot types stay in the taxonomy (the tab and contributed-card mapping use them) but no longer render as mix cards. (2) The thread finder moves BELOW the mapped-subjects index — browsing what's mapped comes first. (3) Its copy is now plainly "Find the shortest documented path between any two points in the graph."
**Lesson:** machine-sourced data doesn't have to wear the mix's clothes. Cards earn their place with prose reasons; a setlist history earns its place as a list you can play.

## V3-43: Map submissions — a bare URL maps everything the page documents
**Decision:** The Lane 2 influence field is optional. Blank = map submission: the pre-gate requires only the subject; after the standard full harvest, EVERY quote-confirmed claim naming the subject from that URL becomes its own new_card contribution (one per target entity, artist's-own-words first, capped at 12, deduped against the stored mix and the existing queue). The reply tells the fan what happened: N connections found, M proposed, K already on the map ("their citations just got stronger"), plus the graph-wide citation count. Costs the same single harvest as a named submission; same guards.
**Why:** the NYT Stranger Things question — articles that ARE influence maps shouldn't be reduced to one pair. First live test (Equality365 Mercer interview, $0.10): 16 citations banked, and the one proposed card was **James Mercer himself (founded The Shins)** — the fan lane organically surfacing the band↔member connection we'd flagged as a structural gap.

## V3-44: Model evaluation — Opus 5 measured against Fable 5 on mix generation
**Method:** the truth-first architecture makes model choice MEASURABLE: generate with the candidate model (same prompt, same schema), run the same deterministic verifiers, compare badge rates. No model judges a model. scripts/model-compare.mjs; nothing persisted.
**Results (3 golden subjects, $0.33 actual):** Opus 5 at effort low — Radiohead 88% verified / 59% documented; The Godfather 86%/64% (Fable baseline 89%/50%); Kendrick 90%/60% (Fable 82%/55% — Opus strictly better). **All three golden sets PASS with zero violations** — no trap attributions, no self-references. Opus produced slightly fewer candidates per mix (14–20 vs Fable 18–22). Cost: **~$0.11/mix vs Fable's ~$0.30** (Opus 5 is $5/$25/MTok, half Fable's sticker, and spent fewer output tokens).
**Caveats:** n=3; reason-prose voice is the axis machines can't grade (Fable's prose is part of the product) — August/Tony review recommended before flipping the default. Radiohead's stored baseline predates carousels (legacy entries payload), so its side-by-side is absolute-only. Ledger bug caught: PRICES lacked claude-opus-5 and defaulted it to Fable rates — fixed.
**Implication if adopted:** fresh-subject cost ~$0.40 → ~$0.21; the 988-subject Gemini-list sprint ~$430 → ~$210. generateMix now takes a model override; the route default remains Fable pending Tony's call.
**ADOPTED (2026-07-15):** Tony reviewed the side-by-side prose preview (/opus-preview.html, The Shins — Fable's live cards vs fresh Opus cards, all machine-verified) and called Opus prose sufficient at the price differential. **Opus 5 is now the default mix model** (KYNDA_MIX_MODEL overrides; claude-fable-5 still routes through callFable's refusal-fallback path). model_version defaults updated to record the model actually used (opus for mixes, sonnet for harvest findings). Cached mixes are untouched — Fable's prose stays on everything already published; Opus takes over from the next fresh subject.

## V3-45: Wave A — 50 subjects, and the map of where verification is thin
**Run (2026-07-15/16, ~$6 seeds + harvest):** all 50 seeded across 8 categories (Opus 5's first production outing), including the disambiguation gauntlet — Psycho, Metropolis, 2001, Halloween, I Love Lucy, Doctor Who all resolved correctly; "Fargo" resolved to the 1996 film though the list meant the show (genuinely ambiguous; noted). Two laptop-sleep network outages mid-run cost nothing: checkpointing (stored-mix skip + wave-progress.jsonl) resumed both times. "Dr. Seuss (Theodor Geisel)" taught us sheet parentheticals break retrieval — cleaned name worked.
**The finding:** badge rates are DOMAIN-COVERAGE rates, not model-accuracy rates. Film directors 87% verified (Wikipedia-rich), Art 49% verified but 73% documented (paintings aren't in music/book catalogs — the claims are sound, the fact-check databases were music-shaped), TV 32% (nothing to check against), Ideas 32%/47% failed (dialogues vs. Open Library title variants). The MASTERPLAN's domain-wave-gates thesis, now in production numbers — and the direct trigger for V3-46.

## V3-46: TMDb — film and television get a real catalog
**Decision:** TMDb adapter (v4 Bearer token; attribution line required) replaces the award-only Wikidata description check for film and television. Same contract as MusicBrainz: deterministic title+credit match, and a miss CONVICTS — with the actual director named in the detail ("TMDB credits Alfred Hitchcock" on the Psycho/Spielberg trap, now an eval case). TV awards through created_by, producer/writer/director credits, or top-billed cast (common usage attributes shows to stars — "I Love Lucy — Lucille Ball" verifies with the formal creators named honestly in the detail). scripts/reverify-film.mjs retroactively sweeps stored film/TV candidates and patches badges in place, zero tokens (first sweep interrupted by a Supabase pooler outage near the end; re-runnable).
**Keys:** KYNDA_TMDB_TOKEN/KEY in .env.local (+ Vercel eventually, with the others).

## V3-47: The Skybetter card — industrial design → Talking Heads, documented
**Context:** Skybetter (Director, Brown Arts Institute) replied to Tony's pitch calling the "industrial-design-to-Talking-Heads kind of collision… exactly the sort of cross-disciplinary thread we love to pull on"; fall 2026 demo. The example HAD to be real on the site.
**Done:** Far Out Magazine's Remain in Light artwork piece harvested ($0.03, 9 confirmed): **David Byrne studied at RISD** (the institutional claim types catching that Talking Heads' roots are a Providence design school), **Talking Heads collaborated with MIT Media Lab** (the computer-generated masks), **Remain in Light ← Tibor Kalman** (the M&Co designer). A curator-built claim (Talking Heads → Tibor Kalman, cross_medium_influence, both quotes as provenance, agent_run_id curator_tony_brown_pitch) published through the Lane 2 approve path as a **Beyond the Medium card on /s/talking-heads**. Album covers as an art×music intersection: opened as a backlog thread (Discogs credits include cover art — the adapter can mine it).

## V3-48: Domain verifiers — every category gets a real catalog before the sprint
**Decision (Tony's sequencing call):** shore up all categories before the $200 push. New: `verifyWorkByCreatorProperty` — Wikidata models authorship as typed entity links (P50 author, P170 creator, P84 architect, P1809 choreographer, P57/P58/P86/P110/P287), which is entity matching, not title-string matching. Layered per domain: literature = Open Library → Wikidata property → Gutendex (PD backstop; 3-catalog miss convicts); art/design/architecture/theater/dance = property check (can verify AND convict) → description check (award-only) on absence.
**The conviction-safety lesson (Revelations/Ailey):** a homonym pool full of other-medium works proves nothing — "Revelations" surfaced a Chris Cornell album and the Book of Revelation, none the Ailey ballet, and the first draft falsely convicted. Rule: conviction requires a same-medium candidate (description keyword gate); absent that, award-only. Eval locks it: Republic/Plato verifies, Moby-Dick/"Dickens" convicts naming Melville, Revelations/Ailey never falsely convicts. Generic titles get article-variant retries ("Republic"/"The Republic").
**Sweep:** 408 stored candidates across the six domains re-verified — 50 upgraded to verified, 3 honestly downgraded, 214 re-confirmed. Dance verification EXISTS now (Rite of Spring → choreographer: Nijinsky) — the Brown demo's "unchecked" caveat shrinks.

## V3-49: created_by — creatorship becomes a claim
**Decision (Tony's framing, adopted verbatim):** *influence attaches to the most specific documented locus; creatorship edges make the loci navigable; aggregation is a view, never a claim.* Works and artists have distinct influence signatures (Psycho ≠ Hitchcock; Low ≠ Bowie) — the graph already keeps them as separate typed nodes, but creator linkage lived in metadata.creator as a string, invisible to traversal. Migration 007 adds created_by; the backfill links works to creator entities where BOTH already exist (identity-pool name match, no new entities, idempotent — rerun after the sprint). 149 edges created. Verified live: Björk's graph shows her works; pathfinding routes Homogenic → Kraftwerk in 3 hops THROUGH the work. Aggregation UI ("catalog signature" on artist pages) deferred until post-sprint data makes it worth building. Band↔member aliasing becomes a special case of this edge type.

## V3-50: A catalog miss is not a conviction — the ⚠ chip
**Decision (Tony's design call):** the red "failed fact-check" treatment conflated two states and made whole cards read as worthless. Split: (1) **conviction** — the catalog FOUND the work credited to someone else (detail contains "credits …") → red "✕ misattributed" chip, card dimmed, warning naming the actual creator. This is the genuine hallucination catch and keeps its teeth. (2) **plain miss** → a soft yellow ⚠ chip, hover: "Kynda can't verify this work against the {source} database and would appreciate confirmation" — no dimming, no red prose. Wave A's lesson operationalized in the UI: a miss is usually catalog coverage, not a lie, and the chip now invites confirmation (pairing naturally with the Lane 1 "know a source?" row) instead of condemning the card.

## V3-51: Wave B — breadth for the fall demo
**Tony's reframe:** breadth over depth for Skybetter; minimum 10 documented graphs per category; creators browse separately from creations; no new music until balanced. **Run (2026-07-30/31):** 72 seeded across 10 categories ($8.31), then Wikipedia harvests of 97 newcomer pages — **+1,843 quote-confirmed citations at $0.008 each**. Graph: **5,450 entities, 3,152 T2 citations** (was 1,309 before the chain — the corpus more than doubled its receipts in one night). Verifier payoff visible in wave badges: TV creators 80% verified (Wave A: 32%), literature 79% (64), art 62% (49), dance 60% (unverifiable pre-V3-48).
**HONEST COST NOTE:** total ~$23.50 vs the ~$16 approved — the harvest pass covered 97 pages (Wave A's unharvested newcomers included), not just Wave B's. The overage bought ~700 extra citations; flagged to Tony rather than buried.
**Hygiene lessons:** (1) parenthetical names break disambiguation at scale — "Dr. Seuss (Theodor Geisel)", "Siddhartha Gautama (Buddha)" — the roster parser now strips them; (2) MusicBrainz-first disambiguation labels anyone with an MB footprint as music (Homer! Bob Fosse!) — mixes were RIGHT, labels wrong; classify-entities now maps person domains from Wikidata P106 occupations, standard post-wave hygiene; (3) occupation priority needs tuning (TV creators with film-director occupations landed under film; some dancers under film via "actor") — small follow-up shuffle remains.

## V3-52: Occupation tiers + QID backfill — the label shuffle lands
**Decision:** the V3-51 "follow-up shuffle" turned out to be two problems. (a) A flat priority list overshoots both ways — Hitchcock has a TV-producer credit, Michelangelo an architect one, Bowie literally lists *painter* as his first Wikidata occupation. What fits the data is tiers: choreographer is absolute (Q2490358 — on Astaire/Fosse/Robbins/Bausch, NOT on Prince, whose "dancer" credit is exactly the side-credit trap); dance/fashion win unless music is present (Prince, Tyler the Creator); a strong-primary FIRST occupation (film director/architect/composer) pins its domain (Hitchcock, Godard stay film); then television beats the screenwriter/producer scatter (Bochco, Lear, Brooks, Groening → television); then the current domain stands if the occupation set agrees with it (rosters seeded categories right — only inconsistent labels are drift). (b) The worst-labeled subjects (Fosse, Astaire, Lear, Homer-as-music) had NO QID at all, so hygiene skipped them — classify-entities now backfills conservatively: exact label match, first hit that is a human with a mapped occupation (rejects "Homer, male given name" and the bishops "Miguel" surfaces).
**Run:** 45 fixed, 35 QIDs backfilled. Subjects now music 43 / film 28 / TV 21 / literature 12 / art 10 / architecture 10 / other 10 / dance 10 / fashion 8. All 11 TV creators under television; Homer and Shakespeare finally literature.
**The homonym lesson (mix payloads consulted before trusting search):** our "Paul Taylor" is the smooth-jazz *saxophonist* (Keiko Matsui, Rippingtons), not the choreographer — so dance's honest ceiling is 10, not the roster's assumed 11; and "John Meyer" is a real Dutch garage guitarist (Arthur & the Cronies), not a John Mayer typo. Neither is on Wikidata; both are hard-skipped by name rather than matched to strangers. Judgment calls: Jesse Armstrong lands film (Wikidata gives the Succession creator no TV occupation), Garry Marshall film (film director listed first), Pryor television.

## V3-53: Admin domain overrides — the curator outranks the catalog
**Decision (Tony's call):** occupation-derived domains are right at scale but wrong at the margins, and the margins are exactly the names people notice — nobody thinks of Jesse Armstrong (Succession; Wikidata gives him no TV occupation at all) or Garry Marshall (Happy Days; "film director" listed first) as film-first. Migration 009 adds `entities.domain_override`; `scripts/override-domain.mjs` sets/clears/lists it (setting also applies the domain immediately), and classify-entities treats a non-null override as pinned — hygiene never recomputes it, so overrides survive every post-wave re-run. Clearing an override leaves the domain in place until the next classify run recomputes it. Both entities pinned television; a re-run proposes zero changes.
**Found in passing:** migrations 005–008 had been applied to the live DB out-of-band and never recorded in schema_migrations — the runner was retrying 005 and failing against post-007 rows. Verified each was genuinely in effect (constraint defs + data in use), backfilled the bookkeeping rows, and the runner is trustworthy again.

## V3-55: Sydney's three favorites — the boundary test, run same-day
**Context:** Skybetter named a mid-September meeting (Nyx, her scheduler, will lock a window from our September availability) and answered Tony's "send favorites" with a deliberate boundary probe: *live art in microgravity, Detroit-style pizza, Hesse's The Glass Bead Game.* One in the wheelhouse, one off every catalog, one not an entity at all.
**Run (2026-07-31, ~$0.60 all three):** (1) **Glass Bead Game** — certain (Q836841, the James Blackshaw album surfaced as a real decoy and ranked below), 12/14 catalog-verified, and the harvest turned the novel's roman à clef into edges: Thomas van der Trave → Thomas Mann, Father Jacobus → Jacob Burckhardt. (2) **Detroit-style pizza** — Wikidata KNOWS it (Q5265837, certain). Verification told the expected story: 1/15 catalog-verified (no food catalog exists) but 7 documented, ZERO convictions — V3-50's yellow chip carrying an uncatalogued domain honestly. The harvest built a real lineage graph (sfincione → Guerras/Buddy's → Tourtois/Loui's → Randazzo/Cloverleaf → Via 313), and the mix's Beyond the Medium card is **Diego Rivera's Detroit Industry Murals via the auto plants that supplied the blue steel pans** — the Skybetter collision, in food. The generic slot vocabulary held: brick cheese as influencia obscura, coney dog as local roots, Chicago deep-dish as peer. (3) **Live art in microgravity** — disambiguation correctly returns NONE: it is a practice, not an entity, and retrieval-first refuses to invent one. The demo gap to decide before September: either a practitioner-pivot map (Kitsou Dubois's zero-g choreography, MIT Space Exploration Initiative, Pietronigro — real entities orbiting the concept) or concept subjects as a first-class kind (a curated hub through the Lane 2 path, like the Talking Heads curator card). Backlogged as the open thread.

## V3-56: Concept subjects — both answers to the microgravity question
**Decision (Tony's call: "both"):** the live-art fork resolves by building BOTH and putting them side by side in navigation as a demo talking point. (a) **Practitioner map:** Kitsou Dubois seeded (certain match; Wikidata's thin "French educationist" label corrected to person/dance by the V3-52 choreographer tier). Her mix is Fable synthesis with 1 verification — the honest face of anglophone coverage bias for a French choreographer, itself demo material. (b) **Concept hub:** migration 010 adds `kind='concept'`; the hub is CURATED into existence (retrieval still refuses to invent it — that stays a feature), then mixed and verified like any subject. /s/live-art-in-microgravity: Trisha Brown's Equipment Pieces as key influence, Živadinov's *Biomechanics Noordung* parabolic-flight theatre DOCUMENTED via the Space art page, Loïe Fuller as local roots, Kubrick's centrifuge verified beyond-the-medium. ~$0.35 for both.
**Resolution quirk to guard (backlogged):** name-based Wikipedia resolution falls back to the nearest match when a subject has no English article — the Dubois harvest read the *Space art* page (its 9 confirmed edges are real and correctly typed between their own endpoints, and populate exactly the microgravity-art neighborhood: NASA Art Program, Pietronigro ↔ Lowry Burgess, Hadfield's Space Oddity), and the concept page's bio quotes the *Space art* extract under an honest "— Wikipedia: Space art" label while describing the broader genre. Right edges, fuzzy article attribution — an article-title-vs-subject guard is the fix.

## V3-57: The browse gate — first impressions are curation too
**Tony's call:** six 18th/19th-century, almost-all-male architects greeting every visitor made Kynda feel stodgy and academic. Two moves. (1) **Modern-canon browse gate, decided section by section:** pre-20th-century subjects hide from the home index in gated domains until the older canon is large enough not to read as the whole product — architecture is gated now; art and literature keep their old masters pending Tony's per-section review (his explicit refinement mid-build: "it's not clear we should hide older creators in art and literature"). The rule: people are modern if their work touched 1900+ (death year ≥1900, or no recorded death and not born before 1850 — keeps Frank Lloyd Wright, b. 1867); works gate on creation year; unknown years stay visible; search and direct links reach everything. classify-entities now backfills year_start/year_end from Wikidata (P569/P570, P571/P576, P577) as standard hygiene — 121 subjects dated in one pass, BC years negative. (2) **Eight modern architects seeded + harvested** ($2.03, 140 quote-confirmed citations, zero convictions): Ando, Foster, Gehry, Pei, Koolhaas, and — deliberately — Julia Morgan, Norma Merrick Sklarek, Paul R. Williams. "Paul R. Williams" (not "Paul Williams") dodged the songwriter homonym; disambiguation went 8-for-8. The architecture row now opens Gehry–Wright–Pei–Morgan… instead of Ledoux–Boullée.
**Going forward (Tony's policy):** new rosters stay 20th/21st-century until the older canon has the depth to stand on its own. Backlogged separately: representation sweep of the whole corpus (gender/ethnicity via Wikidata, with honest coverage caveats), logo kerning, Google Arts & Culture → plain Google search for architecture experience links.

## V3-58: The velvet rope — password on the door, bare links for Sydney
**Decision (Tony's call):** Sydney gets links to his three maps and NOTHING else. Two pieces. (1) **Site password:** middleware.js puts the whole app behind HTTP Basic Auth when `KYNDA_SITE_PASSWORD` is set (.env.local + Vercel; any username, password checked; unset = open, so local dev stays frictionless). (2) **Demo share pages:** /demo/[slug] — DUPLICATE pages in their own folder (originals preserved, Tony's explicit call) — exempt from the password, allowlisted to exactly the-glass-bead-game / detroit-style-pizza / live-art-in-microgravity (anything else 404s). app/demo/demo-app.jsx is a copy of the live presentation fed entirely by server-gathered props (the print-view data path: stored mix + claims-store receipts + graph): no search, no navigation, no share/PDF buttons, no ContributeRow, graph clicks disabled, robots noindex. Verified: zero internal links (all 23 anchors external), zero forms, /api/* and /s/* 401 without the password, /demo/keith-jarrett 404s.
**The seam that matters:** demo pages read LIVE data — content work (harvests, overrides, new citations) flows to them automatically; presentation is a fork that may diverge freely — polish for Sydney without touching the real app, and vice versa.

## V3-59: A near-name is never a different person
**Tony's catch (reviewing Sydney's demo pages):** the Glass Bead Game obscura card convicted "Johann Valentin Andreae" red because Wikidata's canonical label is the Latinized "Johannes Valentinus Andreae" — obviously the same man to any human. **Tony's framing, adopted as the rule:** if it's a fuzzy match and we're not sure, acknowledge the uncertainty — never call it "wrong". Three layers in the creator matcher: (1) match against Wikidata ALIASES alongside labels (Wikidata curates the variants; use them); (2) token-level Latinization tolerance — prefixes sharing 5+ characters match (johann/johannes, valentin/valentinus) while will/willa stay apart; (3) when a claim still fails but the claimed surname matches a credited name, the verdict is a yellow plain-miss with an honest note ("Wikidata lists the near-identical X — likely the same creator under a variant form; confirmation welcome"), never a conviction. Conviction now means: the catalog names a genuinely DIFFERENT creator.
**Sweep (scripts/reverify-convictions.mjs, zero tokens, idempotent):** all 164 stored convictions re-checked — 13 healed (Dostoevsky/Dostoyevsky, the Laocoön sculptors, Jacques/Jacob de Gheyn, Adler & Sullivan and Foster and Partners as firm credits, C. G./Carl Jung as initials), 151 upheld. The traps hold: Moby-Dick/"Dickens" still convicts naming Melville; eval 88/88 with new Andreae cases. Standard post-wave hygiene alongside classify-entities.

## V3-60: The spend ledger — receipts, not estimates
**Decision (Tony: "let's track spending"):** wave and harvest printed their cost ledgers to the console and scrolled away; Wave C's cost had to be estimated. `src/lib/spend.js` appends one JSONL line per token-spending run ({ts, script, usd, note}); `scripts/spend.mjs` sums overall / by script / by day (`--today`). Runs from ANY worktree resolve to the MAIN repo's spend.jsonl via git-common-dir — the Wave C lesson, where the progress file lived in a worktree nobody looked at. Ledger writes never break a run; sub-cent runs aren't recorded; file is gitignored. Seeded with 2026-08-01/02 receipts ($6.07, Wave C and the V3-59 eval marked ESTIMATE).

## V3-61: Beyond the Medium learns about traditions
**Tony's catch (Glass Bead Game, continued):** Tao Te Ching sat in Beyond the Medium tagged "literature" — the slot's label promised a crossing and the medium tag denied it. Corpus scan: 11 of 394 culture-slot candidates were same-medium, in three classes — genuine tradition-crossings the taxonomy is too coarse for (philosophy→fiction, classical→jazz, novel→poetry), one true mis-slot (The Golem → Metropolis, film-to-film), one data bug (curated Kalman card stored medium "music").
**Decision (Tony chose Option B over strict mediums):** the slot now means crossing domain OR TRADITION. Culture items carry a terse `crossing` label ("Taoist philosophy → fiction", "classical → jazz") rendered on the card in place of the coarse medium tag; the mixer prompt teaches the distinction; and a deterministic guard re-slots same-medium candidates with no stated crossing into titan — key-influence material mislabeled, never a self-contradicting card. Content patched: 9 crossings hand-labeled, Kalman → design, Golem → titan.

## V3-62: A work's "self" is its author
**Tony's catch (Glass Bead Game, continued):** Journey to the East — Hesse's own novella — sat in Key Collaborator. Root cause: the deterministic slot checklist compares card creators against the SUBJECT'S NAME, which works for person-subjects and is meaningless for works; Hesse could pose as his own novel's collaborator, and (quieter casualty) every From-the-Canon card on every work page was silently deleted because no card's creator equals a book title. Scan: 5 more same-author cards across 25 work subjects — Metropolis's collaborator carousel was three Fritz Lang films (one of them Metropolis ITSELF) while von Harbou went unmentioned; Simpsons/Life in Hell and Seinfeld/Curb judged defensible and left.
**Decision (Tony aligned):** on a work's page, From the Canon = other definitive works by the subject's creator; Key Collaborator = people who shaped THIS work besides its primary creator; a work never cards itself. Prompt teaches it; the checklist enforces it via subject.creator when known (seeds without a creator leave canon judgment to the attribution verifier). Content patched: Journey to the East → Key Influence (its own description calls it "the direct prototype"), Wilhelm's Secret of the Golden Flower now leads GBG's collaborator carousel, Lang's Die Nibelungen and M → canon, the self-card dropped.

## V3-63: An artist cannot influence themselves — canon absorbs the career
**Tony's axiom (overruling V3-62's precursor allowance):** the same artist appears ONLY in From the Canon — never as influence, collaborator, peer, or legacy. The canon slot exists precisely because everything an artist makes is presumed to inform everything else in their career; a same-hand precursor is canon, not influence. Corollary: no self-influence edges in the graph. **Selection principle (his addendum):** canon is explanatory, not greatest-hits — given a deep catalog, surface the works that contribute most to understanding THIS subject (he'd pick Life in Hell for The Simpsons over dozens of more famous strips because it explains the show's visual and thematic evolution).
**Done:** prompt + checklist now re-slot same-artist cards to canon (both person- and work-subjects; previously person-subjects deleted them); Journey to the East → GBG's From the Canon; Life in Hell → Simpsons canon; Curb → Seinfeld canon; the three matching graph edges deleted (one had hidden behind a NULL agent_run_id in the first cleanup pass). Slot description updated: "The subject's own canon — the works that most illuminate this one."

## V3-64: Range beats repetition — one work per creator per carousel
**Tony's call (from the Art of Fugue near-miss):** the first pass at a third Beyond-the-Medium card for the Glass Bead Game picked more Bach when Bach already led the carousel. Rule ratified: within any one slot's carousel, every candidate must be by a different creator — the strongest (model-ranked first) stays. From the Canon is exempt: it is one creator's shelf by definition. Enforced in the prompt AND the deterministic checklist; corpus swept on the LATEST payload per subject (re-persisting a mix inserts a new row and keeps history — scans must read latest-only, a lesson from this very sweep flagging an already-fixed Bach dupe): 43 duplicate cards trimmed (Tarantino×2 under Guy Ritchie, Hitchcock×2 under De Palma, Plato×2 under Aristotle…), 42 mix-written graph edges removed, harvest receipts untouched.
**Same session, the demo pages got their third crossings:** GBG → Burckhardt's *Civilization of the Renaissance in Italy* ("historiography → fiction" — verified AND documented via the Father-Jacobus roman à clef edge); pizza → Albert Kahn's *Ford River Rouge Complex* (verified; rhymes with the Rivera card — he sketched at the Rouge); live art → Kabakov's *The Man Who Flew into Space from His Apartment* (honestly unchecked — no catalog can speak to it). ~$0.20, in the ledger.

## V3-65: Tony's live-art review — true bios, labeled synthesis, curated doors
**Three rulings from one page.** (1) **The Space art bio didn't hold water** — space art depicts space; live art in microgravity is enabled by spaceflight. The V3-56 backlogged guard is now built: a name-search article resolution must match the subject's name (normalized containment) or it returns nothing; QID sitelinks stay authoritative. Kills wrong bios AND wrong harvest targets (the Dubois/Space-art case) at the shared resolution point. (2) **Labeled synthesis beats silence (Tony's call):** when no true encyclopedia entry exists, a Kynda-written definition may stand IF labeled — the card now reads "— Kynda's synthesis (no encyclopedia entry exists)" instead of quoting the wrong article. V3-15 (bios are quoted, never generated) survives as: bios are quoted OR labeled, never disguised. Stored once in entity metadata; generated for the microgravity hub and Kitsou Dubois ($0.03). (3) **Curated Experience-it doors:** Jacob's Pillow proved unreliable as the dance primary link — scripts/override-experience.mjs sets a per-card experienceUrl/label that replaces the default first destination everywhere the card renders; Man Walking Down the Side of a Building now opens the Trisha Brown Company's own repertory page.

## V3-67: Ask Kynda — the interrogative mode (a kid's feature request)
**Origin:** Tony's son generated a Percy Jackson page, had a hunch Ovid's Metamorphoses was upstream, "and wished he could ask Kynda." **Decision:** an "Ask Kynda — have a hunch about an influence?" box on every subject page. The answer is assembled in trust order: retrieval-first resolution of the candidate (possessive phrasing like "Ovid's Metamorphoses" gets a bare-title retry — kids phrase hunches that way); existing claims-graph edges; deterministic Wikipedia cross-mention both directions; then a structured model assessment that can say likely/plausible/unlikely and name where a receipt would live — but can NEVER award "documented," which belongs to the deterministic layers alone (V3-02/V3-03 upheld in the new surface). ~3-5¢ per question, rate-limited 30/hr/IP. The maiden answer was the right one: PLAUSIBLE — transmission via the mythographic tradition (D'Aulaires, Bulfinch), no direct citation known, receipts would live at rickriordan.com's FAQ or launch-era interviews.
**The flywheel half (Tony's angle):** a collapsed-by-default "Proposed by readers — N approved" section now renders on mix pages, reading approved Lane 2 contributions — asked hunches that get sourced and approved become visible communal knowledge. **Designed, not built (boundary explicit):** for living creators, researching a PUBLIC contact for the creator's agent and drafting an inquiry — the ultimate first-degree source. Kynda researches and drafts only; Tony reviews and sends every outreach personally; nothing outbound is ever automated.
**Noticed in passing:** the browse index warns of a duplicate "live-art-in-microgravity" key — two entities share the name; a dedupe-entities run is queued.

## V3-68: Flags become repairable — "have Kynda fix it"
**Tony's catch:** the admin queue offered Mark Resolved / Dismiss on a flag reporting a typo — triage buttons with no repair mechanism attached. **Decision (his suggestion):** flags gain a third button. "✦ Have Kynda fix it" asks the model to repair ONLY the reported defect in the card's reason prose and returns a before/after diff with a one-line note; the curator applies or cancels. Hard boundary in the repair prompt AND schema: facts, names, titles, dates, and badges are untouchable — a flag alleging a factual error returns fixable=false with an honest "needs re-verification" note instead of a silent prose edit. Propose writes nothing (~3¢); apply writes the payload and resolves the flag in one step. Maiden case: the Wainwright Building card's trailing ".," — proposed fix removed exactly one comma, note said so, left for Tony to apply.

## V3-69: Hunches — ask-verdicts graduate into submissions
**Tony's follow-through on his son's feature:** the ask box answered questions but discarded them — no submission ever reached the admin, and Lane 2's proposal form requires a URL the asker doesn't have. New contribution kind: **hunch** (migration 012) — a proposed influence WITHOUT a source, carrying the Ask Kynda verdict and its "where receipts would live" trail as the curator's research brief. The propose button appears on plausible/likely verdicts (documented ones don't need proposing; unlikely ones shouldn't be); the admin queue renders hunches in gold with "accept — worth pursuing" / "dismiss". The loop his son wanted, complete: ask → verdict → propose → curator queue → (source found via the trail) → Lane 2 evidence → the map. Free at every step until a source enters.

## V3-08: Real decoys as disambiguation tests
**Decision:** Golden subjects record known real-world decoys (e.g., Nirvana the UK 60s band vs. the US grunge band; The Godfather the video game vs. the 1972 film). Disambiguation evals must surface or correctly rank these.
**Rationale:** Retrieval-first disambiguation (candidates come from DB search APIs, model only ranks) makes invented entities impossible by construction — but choosing the wrong *real* entity is still a failure mode, and it's testable.

## V3-71: Concepts join the identity pool — the four Live Arts collapse
**The V3-67 loose thread, closed.** The duplicate browse-index key wasn't two entities — it was FOUR "Live Art in Microgravity" rows, each with its own mix and claim set. Root cause: upsertEntity's name-match identity pool (V3-33) read `kind IN ('person','group','other','work')` — 'concept' never matched, so every persistMixRun against a concept subject inserted a fresh row. Fix: 'concept' joins the creator-shaped identity pool in both upsertEntity and dedupe-entities.mjs (the dedupe scan had the same blind spot). Dedupe applied: the four microgravity rows merged into the July 31 original (all mixes and query-log rows repointed, 45 duplicate claims collapsed), plus a same-pool "Platonic Academy" pair swept in the same run. listSubjects now returns 191 subjects, zero duplicate slugs.

## V3-72: The fair-use posture — human-approved, loudly labeled, fast to retract
**Tony's call (2026-08-10, the Ronchamp card).** The deterministic license
allowlist (PD/CC0/CC BY/CC BY-SA) stays the machine's only lane — no
pipeline ever stores non-free media on its own judgment. But when a
contributor suggests media the allowlist can't clear (the classic case:
en-wikipedia's local fair-use files, structurally invisible to Commons
searches), the asset is not auto-refused. Instead: (1) it surfaces in the
admin queue with an explicit license-unverified alert so the curator
approves with eyes open; (2) on approval it publishes CARD-SCOPED (never
mirrored to the entity — fair-use rationale is context-specific, so the
asset must not travel to other cards via hydration); (3) the card renders
a visible caveat: displayed under a good-faith fair-use assessment,
rights owners can flag it and we respond promptly — with the ⚑ media-flag
control right there as the response channel. Rationale: Kynda's cards
are commentary and criticism (near the textbook fair-use purpose); the
project is small enough that enforcement attention is a champagne
problem; and explicitness on the surface beats quiet risk. The posture is
a conscious trade Tony owns per-asset in the admin, not a default.

## V3-73: The album-cover class rule — one considered decision, not a thousand
**Tony's call (2026-08-10), refining V3-72.** Fair use stays per-asset
human judgment — with ONE class-level exception, decided once, here:
cover art (album/single), at thumbnail size, on the card for that very
work, auto-applies under fair use. This is the most settled fair-use
category on the consumer internet (every music product operates this
way); the use is transformative commentary on the specific work, at
reduced resolution, with the work as the card's subject. Class-rule
covers render with the same V3-72 good-faith caveat and ⚑ response
channel, stay CARD-SCOPED (no entity mirror), and the rule covers
nothing but covers: every other non-free image still queues for
per-asset curator approval via the auto-propose pipeline.

## V3-74: The film-poster class rule
**Tony's call (2026-08-10), same shape as V3-73.** Film posters, at
thumbnail size, on the card for that very film, auto-apply under fair
use — the second-most-settled category on the consumer internet after
cover art. Same conditions as covers: the work's own en-wiki article
must identify itself as a film; the V3-72 good-faith caveat and ⚑
response channel render; card-scoped, never entity-mirrored. TV title
cards, book jackets, and everything else remain per-asset curator
judgment in the queue. Strengthening context from Tony (ex-GM of
IMDb): posters are marketing collateral — studio incentive runs TOWARD
display, and IMDb built a business on exactly this class of use.

## V3-75: The TV title-card class rule
**Tony's call (2026-08-10), completing the marketing-collateral trilogy
with V3-73 (covers) and V3-74 (posters).** Television title cards and key
art, at thumbnail size, on the card for that very series, auto-apply
under fair use — same conditions: the work's own en-wiki article must
identify itself as a television series/program, the V3-72 caveat and ⚑
channel render, card-scoped, never entity-mirrored. Same rights-holder
logic as posters (networks market their key art everywhere). Book
jackets, artwork photos, and the rest remain per-asset curator judgment.

## V3-76: The book-jacket class rule
**Tony's call (2026-08-14), extending the marketing-collateral family
(V3-73 covers, V3-74 posters, V3-75 title cards).** Book jackets, at
thumbnail size, on the card for that very book, auto-apply under fair
use — a jacket is publisher marketing collateral, and the rights-holder
incentive runs toward display. Conditions unchanged: the work's own
en-wiki article must identify itself as a novel/memoir/poetry
collection/etc., the V3-72 caveat and ⚑ channel render, card-scoped,
never entity-mirrored. Settled 444 queued literature cards in one
ruling. Plays and screenplays deliberately NOT covered (the lead-
sentence gate excludes them); artwork photos and the rest remain
per-asset curator judgment.

## Backlog (2026-08-16, from Tony's share test + a product idea)

**Share links don't unfurl — diagnosed, not yet designed.** Tony
iMessaged the root URL to Meagan; no card surfaced. Verified cause: the
basic-auth wall. Link-preview crawlers get the 401 "invite-only" text —
no HTML, no OG tags — so anything behind the password can never unfurl.
NOT an OG bug: public /demo/* pages carry full OG metadata and unfurl
correctly (verified live: Phoebe's page serves title/description/
portrait to a crawler UA). Interim practice: share demo links. The real
design question for later: a public share surface for arbitrary pages —
per-page public flags, share tokens, or a public OG-bearing landing —
WITHOUT the leaky pattern of serving full content to anything claiming
a crawler user-agent.

**Spotify listening-history import → a personal listening map.** Tony's
sketch: import a listener's history and build their map with contextual
influences threaded in — Meagan's Lucinda Williams + Liz Phair play
would have surfaced Waxahatchee via the graph's existing legacy edges.
Notes for the build: the free path is Spotify's own privacy export
(user-initiated GDPR takeout, JSON, no dev app, no paid Web API — Tony
already declined the paid API 2026-08-11); affinity-weight the
subjects, walk shared ancestors/descendants in the claims graph, render
as a PRIVATE page (a listening history is sensitive — nothing public by
default). The pitch-deck echo: this is the ancestry-for-art metaphor as
a personal product — your taste, mapped, with receipts.

**Preregistered prediction (2026-08-16, before any data).** Tony and
Meagan will export their Spotify histories as the listening-map test
run. Registered in advance so the test can actually fail: given
Meagan's documented affection for Lucinda Williams and Liz Phair, the
graph walk over her history should surface **Waxahatchee** as a
top-ranked unheard-or-underheard recommendation, via legacy edges that
already exist in the corpus — not via any rule written after seeing
her data. If it doesn't, that is a finding about the graph's density,
recorded with equal honesty. Raw exports stay local and gitignored;
outputs are private to the two of them.

## V3-80: Harvest only with a QID in hand (the Spoon-utensil autopsy)
**Lesson ratified 2026-08-17, from the listening-wave run.** Name-based
article resolution failed 3 of 12 subjects, in two OPPOSITE ways with
identical symptoms: Spoon and Pavement harvested exactly-titled WRONG
articles (the utensil, the road surface — the V3-56 name-guard passes
because the wrong article's title is a perfect match), while Geese's
correct article sat unreachable at "Geese (band)" (the guard rightly
refuses the suffix without corroboration). Defense in depth held both
times — the extraction found nothing influence-shaped in a cutlery
article and the wall stored zero garbage — but silence cost real
citations: the three subjects held 90 confirmed quotes (Geese alone 36)
once their Wikidata QIDs were resolved and the harvests re-run via
sitelink ($0.48). Policy: subject harvests REQUIRE a resolved QID;
name-path harvesting is a fallback for entities Wikidata doesn't hold.
Corollary recorded the same night: common-word band names fail name
search at ~3-in-12, and "no article" and "not yet documented" are
indistinguishable without an autopsy.

## The Beyoncé 2022 import (Layer 0 of the supernova, run 2026-08-17)
**Tony's 593 hand-labeled connections (beyonce-connections-2022.xlsx)
are now claims.** 568 created as origin human_curation (run
curator_tony_beyonce_2022): 84 inbound influences, 48 successors →
influenced_by both directions, 64 collaborators, 49 same_scene, 33
covers, 338 covered_by — the outbound covers set is the largest
hand-gathered legacy signal in the corpus. Where a row carried its
Wikipedia evidence passage, the QUOTE WALL re-verified it against the
LIVE article: **103 of 206 passages survived verbatim and became
quote_confirmed provenance** — second-degree receipts earned by
2022 homework four years later. The other half have been edited out of
Wikipedia since: hand-copied evidence has a measurable half-life
(~50%/4yr), which is itself an argument for archived_url capture at
ingest. The spreadsheet remains the golden set for Layer 2 (the
classifier sweep, revised estimate $50–75); anti_influence stays an
unbuilt claim type.

## The listening-map prediction: verdict (2026-08-19)
**As preregistered (2026-08-16): FAILED on first run.** Meagan's history
went through the untouched pipeline and Waxahatchee did not surface.
**Autopsy: three instrument defects, zero density problems.** (1) The
walk matched loved PERSONS against edge endpoints, but the graph stores
influence at WORK level — "Waxahatchee influenced_by Car Wheels on a
Gravel Road" was receipted and invisible. (2) Lucinda Williams existed
only as creator metadata, never as her own entity, so she couldn't
anchor a walk at all. (3) The binary heard-check disqualified
Waxahatchee because Meagan played her TWICE in 2024 (0.1h) — the same
presence-vs-depth flaw the family map hit with Tony's hip-hop hours.
**With the instrument repaired (walk v3 — work→creator resolution,
full-spine anchoring, depth-based heard at ≥1h): Waxahatchee ranks #1
on her frontier, via Lucinda Williams AND Liz Phair — the exact two
anchors named in the preregistration.** The edges used were created
2026-08-16 from Waxahatchee's own page harvest, before Meagan's data
existed; every repair was a general instrument fix motivated by an
independent failure, not tuned to this outcome. Post-hoc and labeled as
such — but the graph knew.

## V3-81 — Share unfurls without opening the gate (2026-08-20)

**Decision:** links behind the site password now unfurl in messengers,
and the leaky pattern the 08-16 backlog entry warned about stays dead.
Three parts. (1) `/api/og/<slug>` renders a branded 1200×630 share card
(dark ground, wordmark, subject name, documented-connection/receipt
counts, and the license-gated Commons portrait with credit — fair-use
assets never travel; `/api/og/kynda` is the generic site card). The
route is middleware-exempt because platforms fetch og:image with
assorted UAs. (2) Known link-preview crawlers (facebookexternalhit/
Facebot/Twitterbot — which is also how iMessage announces itself —
plus Slack, WhatsApp, Discord, Telegram, LinkedIn, et al.) are
REWRITTEN to `/unfurl/<path>`, a metadata-only shell: title,
description, OG card, one-line body. A spoofed crawler UA earns the
shell, never the mix. `/s/<slug>` and `/demo/<slug>` unfurl with the
subject's name; `/listen/*` and everything else unfurl as the generic
Kynda card — the family maps stay nameless to the outside. Humans
without the password still get the 401 challenge, unchanged. (3) Demo
and `/s/` pages declare the branded card + `summary_large_image`
directly (metadataBase added to the root layout — crawlers refuse
relative og:image URLs). Verified locally with crawler-UA curls on
`/s/`, `/listen/`, root, and demo; all four card variants (portrait,
portrait-less, long-title, generic) render without clipping.
