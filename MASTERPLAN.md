# Kynda — The Master Plan

Drafted: 2026-07-06
Scope: Kynda as a map of the entire history of human culture, through the lens of influence and inspiration.
Companion docs: [REBUILD_PLAN.md](REBUILD_PLAN.md) (the truth-first architecture, now largely built) and [DECISIONS.md](DECISIONS.md) (the running decision log).

---

## 1. North star

**The Cultural Influence Graph**: every work and creator in human culture, connected by documented influence — who shaped whom, through what, with the evidence one click away. Across music, film, television, literature, fashion, architecture, comedy, art, and design. Built by agents mining the record of human culture continuously, refined by fans, vetted by trusted curators, and attested by the creators themselves.

The experience promise: **culture at a deeper level** — every song, film, or building becomes a doorway into the web that produced it, and every connection can be interrogated down to its source.

## 2. The atom is already built

Everything in this plan scales one unit that already exists in production:

```
CLAIM        (A influenced B / A member-of B / A covered B / ...)
+ EVIDENCE   (source, archived link, exact excerpt or timestamp)
+ VERIFICATION (deterministic: fetch → match → entity-resolve; never a model's judgment)
+ HONEST LABEL (the trust tier the evidence actually earns — nothing more)
```

The runtime pipeline already does this per-query: entity-locked disambiguation, database-checked attributions, Wikipedia-documented connections, two-hop chains through members, quoted bios. The master plan is that same atom multiplied across sources, domains, contributors, and time — never replaced by something looser.

## 3. The Trust Ladder

One spine unifies AI, fans, curators, and creators. Every claim sits on a rung, and every rung is machine- or human-assigned — no model ever self-assigns:

| Tier | Name | Earned by |
|---|---|---|
| T0 | Synthesis | Model knowledge, honestly labeled ("Kynda's synthesis") |
| T1 | Documented | Deterministic cross-reference (encyclopedia mention, database relation, two-hop chain) |
| T2 | Cited | Primary source: interview, autobiography, podcast, liner notes, review — quote-confirmed against the fetched artifact (or timestamped against audio) |
| T3 | Vetted | A trusted curator reviewed the T2 evidence and endorsed it |
| T4 | Attested | The creator themself confirmed it, under verified identity |

Votes and popularity **never move a claim up this ladder** — they affect visibility and review priority only. Truth tiers are earned by evidence and identity, not applause. Divergence between tiers is a feature: where the artist's own map (T4) disagrees with critical consensus (T3) or the fan map, that gap is a discovery surface, not a bug to reconcile.

## 4. Pillar I — The Canonical Source Layer

Expand evidence from "Wikipedia + open catalogs" to the full documentary record. Each source class gets an acquisition strategy, a rights posture, and a verification method:

| Source class | Acquisition | Rights posture | Verification |
|---|---|---|---|
| Open structured (MusicBrainz, Wikidata, Open Library, TMDb) | APIs (live) | Open/attribution | DB relation match ✅ built |
| Encyclopedic (Wikipedia) | API (live) | Open | Cross-mention + excerpt ✅ built |
| Interviews & news | Agent web research; archives (Internet Archive, publisher APIs) | Link + short excerpt (citation posture); archive snapshot | Fetch → quote string-match ✅ primitive built (`quoteMatch`) |
| Autobiographies & books | Metadata + page-cited excerpts; Google Books/OL previews | Short excerpts, page-cited | Quote-match where text is accessible; page citation otherwise (capped at T2-pending) |
| Podcasts | Public RSS feeds → transcription (Whisper-class) | Store timestamps + short quotes, never full transcripts | Quote + episode + timestamp; re-checkable against audio |
| Documentaries & video | Metadata + subtitle/caption files where public | Timestamped citation | Caption match or timestamped citation |
| Reviews & criticism | Aggregators, publisher feeds, agent research | Link + excerpt | Quote-match |
| Liner notes & credits | Discogs, MusicBrainz annotations, physical-media communities | Factual credits (uncopyrightable facts) | DB cross-check |

Two rules hold everywhere: **store pointers and short excerpts, never full texts** (the licensable asset is our graph, not their archives — and this keeps the citation posture defensible), and **snapshot everything to archive.org at ingest** (evidence must outlive link rot). Full-text licensing deals (news archives, Rock's Backpages, podcast networks) are Phase-later business negotiations we enter holding a working product.

## 5. Pillar II — The Agent Fleet

The Phase-2 "corpus batch job" grows into a permanent, always-on mining system. Five agent roles:

1. **Subject researchers** — given an entity, hunt primary sources for its candidate connections (the original REBUILD_PLAN design). Prioritized by query demand (Zipf), graph centrality, and coverage gaps.
2. **Source harvesters** — the scale unlock. Given a *source* (a new podcast episode, an interview archive, a critic's back catalog), extract every claim in it: "in this episode, X cites Y as formative." One source yields claims across dozens of entities. Standing watches on high-yield feeds (interview podcasts, major-outlet culture desks) make the graph self-updating.
3. **Verification workers** — no model: fetch, archive, quote-match, entity-resolve, write provenance. The only path to T1/T2. (V3-03: the verifier stays dumb, forever.)
4. **Contradiction & drift detectors** — flag conflicting claims, dead links, revised articles; route to the curator queue rather than silently resolving.
5. **Gap auditors** — "what's missing": domains with thin coverage, hub entities with no primary sources, claims stuck at T1 that likely have findable interviews.

Economics: Batch API for the fleets, effort-tiered models (Fable for extraction judgment, Haiku for routing), hard token budgets per run, and the current free-Fable window spent on the **initial corpus sprint** — the top ~1,000 subjects across all launch domains, source-harvested and verified.

## 6. Pillar III — The Human Layer

**Fans.** Two contribution lanes, deliberately different in trust required:

*Lane 1 — Evidence patching (low friction, ships first).* Any card labeled "Kynda's synthesis" carries an affordance: **know a source? add it.** The claim already exists; the contributor supplies what the research agent supplies — URL + exact quote (or episode + timestamp) — and the SAME deterministic fetch-and-match gate judges it. No moderator opinion decides whether the fan is right; the page contains the quote or it doesn't. This lane crowdsources exactly what agents reach worst: print magazines, liner notes on the shelf, podcast moments, paywalled archives. Three orthogonal axes keep it honest: **degree** = whose words the quote is (a fan-submitted Lumet quote is still first-degree voice), **origin** = who found it (`user_submission` alongside `agent_research`), **vetting tier** = how reviewed. Confirmed patches display immediately with a "fan-contributed, pending review" marker; curator review clears the marker or pulls the source.

*Lane 2 — New cards (higher trust, human+AI vetting before publish).* Anyone can propose a new candidate for a slot — a claim + evidence, never a bare opinion. The pipeline before anything goes public: (1) **AI gate, deterministic first** — attribution tuple check, evidence quote-match, dedupe against existing claims, slot-rule enforcement; (2) **AI critique** — an adversarial model pass on slot fit and reason quality (advisory, never sufficient alone); (3) **curator approval** — a human vets and publishes. Until approved, submissions are visible only to the contributor and the review queue. Published cards enter the carousel ranked by their earned evidence like any other candidate — contribution buys entry, not position.

Votes rank visibility and flag review priority in both lanes — never truth. This kills most abuse structurally: you can't brigade a string match.

**Trusted curators.** Critics, journalists, scene historians, proven superfans. Earned role (track record of surviving submissions) or invited. They vet T2 evidence to T3, resolve contradictions, and own domain queues. Every action attributed and logged — curation history is public record.

**Creators.** Verified identity (label/publisher/platform-linked), then two powers: **attest or dispute** any claim about their work (→ T4 or a visible dispute state — disputes display, they don't delete), and **curate their own influence map** in their own words. The multi-perspective toggle — *artist's map / critical consensus / fan map / AI map* — ships here (this is kynda2's Phase 6 vision, now with the data model to hold it).

**Reputation.** Contributors accrue standing from verified-and-vetted submissions. Standing weights review priority, never truth. All of this lands in the existing schema's `reviews` table lineage — extended with `users`, `votes`, `attestations`.

## 7. Pillar IV — Domain expansion

Each domain needs two things: an **entity spine** (canonical IDs) and **domain-native claim types**. Rollout in waves, each wave gated by the eval harness proving entity-error ≈ 0 in that domain before launch:

| Wave | Domain | Spine | Domain-native claims (examples) |
|---|---|---|---|
| ✅ | Music | MusicBrainz | covered_by, sampled_by, produced_by, member_of, used_gear |
| A | Film & TV | TMDb + Wikidata | homage_to, shot_reference, scored_by, adapted_from |
| A | Literature | Open Library + Wikidata | adapted_from, responds_to, translated_by |
| B | Comedy | Wikidata + specials/podcast catalogs | mentored_by, writing_room_with, bit_lineage |
| B | Art & design | Wikidata + museum APIs (Met, Rijksmuseum are open) | school_of, studied_under, movement_member |
| C | Fashion | Wikidata + runway archives (Vogue Runway later, licensed) | house_lineage, silhouette_reference, muse_of |
| C | Architecture | Wikidata + ArchDaily-class sources | studied_under, firm_lineage, responds_to_site |

Fashion, comedy, and architecture are **spine-poor** — no MusicBrainz equivalent exists. There, agent-built entity records (Wikidata-anchored, evidence-backed) are themselves part of the moat. And the **cross-medium edges** — the music→film→fashion threads no vertical database can see — are Kynda's unique wedge; the `culture` slot was always the prototype of this.

**Strategy inversion (2026-07-09, after the harvester's economics landed):** the wave gates above apply to the MIX PRODUCT's attribution verifiers, not to the graph. Harvest verification is quote-confirmation — medium-agnostic by construction — so **the corpus goes wide across all of culture first; per-domain verifiers deepen the product behind it.** The whole-culture Wikipedia index (Tier 1: ~100–200k substantial cultural articles across every medium, section-targeted + Batch API) prices at **$3–8k one-time** — the funded-phase purchase is not a music database but the first cross-medium influence graph. Kynda is not constrained by medium; that is the point of Kynda.

## 8. Pillar V — Product surfaces

- **The Mix** ✅ — the curated doorway (stays the wedge product).
- **The Graph** — port kynda2's D3 force map, but node weight = documented-claim count and edge weight = trust tier. This *fixes* the old "significance is a black box" problem (kynda2's Signal Integrity assessment): size becomes a provenance measurement, not a model's vibe.
- **Pathfinding** — "how do you get from Bach to Kendrick?" Shortest documented path, every hop clickable to its evidence. The single most shareable artifact the graph can produce.
- **Scenes & eras** — lens views: Laurel Canyon 1969, Bronx 1977, Factory Records, the Bauhaus. Geography and time as first-class queries (the `geography` slot generalized).
- **Subject pages** — permanent, URL-addressable, ever-deepening: the mix, the map, the evidence, the perspectives toggle, the contribution panel.
- **Creator studio** — where artists build their attested maps.
- **The API** (later) — the graph as licensable infrastructure for streaming services, editorial, education.

## 9. Sequencing

Phases overlap; each is gated by measurable trust, not by calendar.

**Phase A — Persistence & the flywheel's first turn (now).**
Stand up Postgres (the Phase-0 schema is written and waiting). Persist every runtime-derived claim, verification, and evidence record — from this point, *every user search permanently enriches the graph* instead of evaporating from an in-memory cache. Query log feeds the research queue. Port the Graph tab with provenance-weighted nodes.

**Phase B — The corpus sprint (the free-Fable window).**
Source harvesters + subject researchers over the top ~1,000 subjects and the highest-yield open archives. Interview citations start appearing under mix reasons ("Thom Yorke, Melody Maker 1993 ↗" with a quote-confirmed excerpt). Success metric: majority of mix connections for top subjects at T2+.

**Phase C — Contribution alpha.**
Lane 1 (evidence patching) ships first — and its curator-mode form can be pulled forward into Phase B: the founding household are users #1 and #2, and reviewing pilot output while holding a "add the source you know" form is the contribution loop in miniature, before accounts exist. Then Lane 2 (new cards) with the human+AI vetting pipeline, votes + review queues, and the first cohort of trusted curators (recruit from music journalism and scene-historian communities). Wave-A domains (film/TV, literature) get their spines and eval golden sets.

**Phase D — Creators & perspectives.**
Verified-creator attestation and dispute; creator-curated maps; the four-way perspective toggle. Wave-B domains.

**Phase E — The deep product.**
Pathfinding, scenes & eras, subject pages as the canonical cultural reference, Wave-C domains, the outward-facing API, and licensing negotiations from strength.

## 9½. THE BOOTSTRAP CONSTRAINT (governing until funding or ~100× cheaper research)

Recorded 2026-07-08, measured economics: research ≈ $2–4.50/subject (one-time capex), fresh search ≈ $0.30 (once per subject, ever), cached search ≈ $0.001. Until grant/funding or a dramatically cheaper research methodology or token pricing arrives, Kynda is **unlaunchable unfettered** — and every decision must respect that:

- **No corpus sprints.** Research spend only by explicit per-batch approval.
- **Fettered beta is the launch shape**: the daily generation cap IS the business model — a fixed daily budget admits N new subjects/day, demand-ordered by the query log; the indexed corpus serves everyone at ~zero marginal cost.
- **Phase selection biases to zero-marginal-token work** — which is most of the remaining vision (graph tab, subject pages, contribution Lane 1, source-harvester architecture).
- **The 100× roadmap, by credibility:** (1) source-harvesting — read each source once, extract claims for every entity it mentions; collapses cost-per-citation 5–20×; (2) Lane 1 fan contributions — URL+quote verified by the dumb gate ≈ free research; (3) cheap-model research + Batch API — the gate carries precision, so the finder only needs recall (3–10× + flat 50%); (4) token price declines over time. Owning the dataset while renting the model means time works for us.

## 10. The hard parts, honestly

- **Rights.** Excerpt + link + archive is a defensible citation posture; full texts never stored; transcription kept to quotes + timestamps. Archives and podcast networks eventually want deals — good: by then the graph is the thing they want to be in.
- **Moderation at scale.** Evidence-gating does the heavy lifting; curator queues and public attribution do the rest. Votes never touch truth. Disputes display rather than delete.
- **Entity resolution.** The universal failure mode of open contribution ("Prince" the artist, the film, the concept). Wikidata QIDs as the cross-domain spine, embedding-assisted dedup in the ingest path, and the disambiguation UX we already have.
- **Infinity.** "The known universe of information" is unbounded; coverage is a prioritization problem forever. Demand (query log) + centrality + curator judgment decide where agents dig. Publish coverage metrics; never imply completeness.
- **Cost.** Per-subject research budgets, batch pricing, effort tiers, and corpus-first economics (a verified claim is bought once and served forever; a generation is paid for every time). The eval harness gates every prompt/pipeline change so quality regressions can't silently ship.
- **Cold start for the community.** The mix product earns the audience first; contribution follows traffic, not the reverse. Creator outreach starts with artists whose maps are already rich (they have the most to react to).
- **Defensibility.** The model is rented; the moat is the verified graph + the community + the creator relationships. Everything in this plan compounds into that moat.

## 11. What we measure

- **Trust:** entity-error rate (~0, enforced by eval), % of served connections at T1/T2/T3+, unsupported-citation rate (0 by construction — citations are quote-confirmed or not shown).
- **Depth:** claims per entity, sources per claim, cross-domain edge share.
- **Coverage:** % of queries served from the corpus vs. gap path; domains at launch quality.
- **Community:** submission→verification→vetting funnel, curator throughput, creator attestations, dispute resolution time.
- **Experience:** evidence-expansion rate (do people click into sources?), path shares, return depth.

## 12. The one-sentence version

Kynda already knows how to prove a single connection; the master plan is to prove all of them — with agents doing the reading, the community doing the judging, creators holding the pen on their own history, and every user one click from the receipt.
