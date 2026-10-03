# Kynda — Run Log

Build and run records with cost. One entry per run that changed the graph or produced a page. Decisions live in DECISIONS.md; the ranked backlog in BACKLOG.md; card fixes in CORRECTIONS.md. Dollar figures are the pipeline's own receipts (`spend.jsonl`) unless marked *estimate*; the accountant's books are the authority for monthly totals.

Entries before 2026-09-14 were reconstructed on 2026-09-16 from session notes when the log was split out of DECISIONS.md — the two long-form entries (Beyoncé import, listening-map verdict) are moved verbatim.

---

## 2026-08-12 → 08-13 — Demo-page polish (Thile, Halvorson, Tuttle; Phoebe Bridgers)

Thile bio IPA garble fixed; three card corrections (see CORRECTIONS.md); demo-page media enrichment with loose preview matching and Deezer fallback. Phoebe Bridgers demo generated with the new curated-context (notes) channel — Tony Berg weighting, then de-Berged per Tony's taste. Cost: fractions of a dollar per page.

## 2026-08-14 → 08-16 — Tony Berg: three named cuts

`before` (pre-interview baseline), `after` (Opus 5 with the 2022 UCLA interview transcript as curated context), `after-fable` (Fable 5, same context). Named cuts addressable by `?cut=`; the bare URL serves the latest by created_at, so the Fable cut was backdated below Opus. Cost: $0.52 + $0.35 for the two curated cuts. Finding: "Berg varied sources; Beyoncé varied method."

## 2026-08-14 → 08-15 — Corpus top-up and media backfill

Card-count rules (3 default; ghost/legacy evidence-gated 2–5, never padded, never truncated) applied corpus-wide: +1,028 cards, ~$11. Book-jacket class rule (V3-76) applied; creator-less media entities repaired (14 stamped; Godfather / Gone With the Wind correctly left ambiguous).

## 2026-08-16 → 08-19 — Personal listening maps (V3-79)

Spotify GDPR exports for Tony, August, Meagan, Eva → four personal maps, two intersection maps (father–son, marriage), distilled variants with household subtraction (Eva's car-hijack hours). Zero model calls — deterministic walks over the claims graph. Findings: West End Blues as the five-receipt marriage root; the Grateful Dead surfacing through descendants despite pre-Spotify invisibility; Geese as family convergence; The Janitors (Tony's own band) at 29 of August's hours. Builder script lost with the session scratchpad — BACKLOG #14.

## 2026-08-17 — Twelve listening-gap pages

Django Reinhardt → The Velvet Underground, the artists the family maps pointed at that had no page. $4.27 total, ~$0.36 per page. Two name-resolution failures (Spoon = utensil, Pavement = road; zero garbage stored) led to V3-80.

## 2026-08-17 — The Beyoncé 2022 import (Layer 0 of the supernova)
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

## 2026-08-18 — Beyoncé: model-first, graph-first, blended cuts

Three named cuts on the densest subject in the corpus (24 / 12 / 23 cards). Graph-first pools proved too restrictive (dropped Michael Jackson, Prince, Solange, Rihanna, Jay-Z — the 2022 sheet's Wikipedia-text bias); blended with a soft floor is the default. Legacy-is-last slot reorder applied to 240 stored mixes the same day. Architecture entry still owed — BACKLOG #7.

## 2026-08-19 — The listening-map prediction: verdict
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

## 2026-08-19 — Pauline Clayden (dance, from the NYT obituary)

QID-first entity, Wikipedia harvest, NYT obituary text-in-hand via `harvestText` (25 citations), Opus mix with the obituary's facts as curated context. 21 cards, 7 verified — the no-catalog-for-dance finding. Reader comments deliberately not ingested (eyewitness gems, not citations) — the reader-testimony lane idea, BACKLOG #17.

## 2026-08 — Month total

Anthropic API, scripted runs: **$55.42** ($45.30 receipted, $10.12 *estimate* where the ledger died mid-run), per the Kynda books. Runtime generation on the live site is not in the receipts.

## 2026-09-11 — V3-82 data repair

Ellington / Morricone / Davis reshaped to person/music with QIDs; Pavement restored as the band, Kyle Abraham's *Pavement* split into its own dance work; the two Paul Taylors separated, the choreographer's mix regenerated from his QID — 22 cards, 7 verified, 13 documented, $0.16, then media (3 images, 2 previews).

## 2026-09-14 — Demo pages: David Bowie, Dave Chappelle, Ghostbusters

Bowie (24 cards, July) and Chappelle (22 cards, Aug 9) kept their stored full-stack mixes. Ghostbusters built fresh, QID-first (Q108745): Wikipedia harvest 20 confirmed claims; Opus mix 23 cards, 19 attribution-verified, 6 documented; generation-time media 17 images + 1 preview. Bowie setlist.fm covers pass: 12 cover claims ("Under Pressure" ×177). **$0.30 total.** Media after the V3-83 lookup fix: Bowie 23/24, Ghostbusters 19/23, Chappelle 16/22. The Method Man collision and its corpus sweep (35 hits, 30 legitimate) are in CORRECTIONS.md.

## 2026-09-16 — Log restructure

DECISIONS.md split into decisions / RUNS / BACKLOG / CORRECTIONS; recoverable session scripts committed to `scripts/experiments/`. No model calls.

## 2026-09-20 — Demo pages for Mark Golin: Tycho, Zhang Yimou, Kurt Vonnegut

First run of the spec-driven builder (`scripts/experiments/demo-build.mjs` + `specs/golin-2026-09-20.json`). All three new to the store, QID-first (Tycho also MBID-anchored — "Scott Hansen from SF"). Wikipedia harvests: 6 / 21 / 36 confirmed claims. Mixes (Opus 5): Tycho 22 cards, 19 verified, 4 documented; Zhang Yimou 22 cards, 21 verified, 10 documented; Vonnegut 24 cards, 22 verified, 16 documented. Generation-time media: 18 images + 19 previews / 11 images / 19 images. **$0.98 total.** Tycho covers pass: 1 claim. After the V3-83 refinement (creatorship-phrase gate, "drama directed by" poster class): Tycho 21/22, Zhang Yimou 22/22, Vonnegut 21/24 cards with media — the three Vonnegut gaps are an 1883 poetry collection, a 1941 anthropology monograph and a 1918 courtroom speech, correctly empty.

## 2026-09-22 — Adaptation-stamp repair (V3-83 refinement 2)

Tony caught the *Going All the Way* film poster on Vonnegut's novel card. Class-and-filename sweep found 36 adaptation stamps across 27 subjects: 30 stripped, 6 relabeled. Medium-aware re-run: 221 cards examined, 56 stamped (38 class-rule, 18 licensed/public-domain), 7 queued, 158 correctly empty. Zero model calls; Wikipedia API only.

## 2026-09-16/17 — Open-model experiment: Kimi K3 and GLM 5.2 vs Sonnet 5 (harvest + research)

Tony-approved (<$10) after the Mozilla open-model report (Ars Technica 2026-09-15). `scripts/experiments/open-model-compare.mjs`, dry run, nothing persisted; open models via OpenRouter with charged-USD receipts. **Harvest, 3 golden Wikipedia pages, two runs:** Sonnet $0.007–0.008/confirmed citation; Kimi K3 $0.002–0.003 (98–100% wall pass); GLM 5.2 $0.002 (73–91%). Golden traps: Sonnet and Kimi both self-ref'd Godfather II/III once; GLM clean. **Research, Radiohead:** Sonnet 4 T2 / $1.33 / 8 min; Kimi 6 T2 / $0.11 / 71s; GLM 3 T2 / $0.09 / 57s (client-side DDG+fetch harness, not Anthropic's). Hand-read caveat: every model, Sonnet included, emits real quotes with wrong claimTypes; GLM collapses labels to cited_as_influence. **$4.25 total.** Full tables and read-out: `reports/open-model-compare-2026-09-17.md`; per-claim rows: `reports/open-model-compare-rows-2026-09-17.json`. No decision taken; Tony's call.

## 2026-09-17 — Open-model research follow-up, 5 subjects

Tony-approved (cap $4.25; spent $3.44). The Godfather, Breaking Bad, Björk, Miles Davis, Talking Heads, targets from the graph. Kimi K3: 36 confirmed citations for $1.08, no empty runs. GLM 5.2: 20 for $0.62, one malformed-output failure (Björk). Sonnet 5 on Breaking Bad: 0 findings for $0.90 in 16 min, retry timed out (~$0.84) — the V3-20 quit-early behaviour again. Combined with the first round, Kimi is 42 citations / $1.19 vs Sonnet 4 / $3.07. Tables in `reports/open-model-compare-2026-09-17.md`. No default changed; Tony's call.

## 2026-09-22 — Opus 5.5 mix-generation check (3 golden subjects, $0.28)

`model-compare.mjs --model claude-opus-5-5` at the pipeline's effort "low", unchanged prompt, dry. Radiohead 23 candidates / 74% verified / 65% documented but 1 self-reference violation; The Godfather 23 / 100% verified / 26% documented with 4 violations (3 essential-slot cards not by the subject, 1 self-reference); **Kendrick Lamar returned a single candidate** (stored Opus 5 mix: 24). Opus 5 passed all three with zero violations in July (V3-44). Not a drop-in at low effort with the current prompt; untested at medium (Opus 5.5's default). Also today: kynda3 PRICES table corrected (Sonnet 5 $2/$10, not $3/$15 — every Sonnet figure in this log before today is 1.5× high) and Opus 5.5 / Fable 5.1 added.

## 2026-09-22 — GPT-6 comparison (Sol, Luna, Astra) via OpenRouter, $2.76

Tony-approved (cap $3.50). Same harness as the open-model runs; first attempt spent $0 (OpenAI rejects `temperature`; fixed in openrouter.js). **Harvest, 3 golden pages:** Sol 108 confirmed / 0 rejected for $0.27 (Sonnet ~$0.37 corrected, 74–85% pass); Luna 67/29 for $0.015; Astra 40/0 on Radiohead for $0.49. **Research, 3 subjects:** Sol 28/28 confirmed for $0.51; Luna 15/16 for $0.03; Astra 8/8 on Radiohead for $0.76; Kimi's same-subject numbers were 24 for $0.67. **Mix, effort low:** Sol 86–95% verified, $0.04/mix; Luna 86–95%, $0.002/mix; Astra 95%/68% documented on Radiohead, $0.19. Golden PASS on Radiohead and Kendrick for all three. **Finding:** every new model (Opus 5.5 included) fails The Godfather golden identically because `eval/scoring.js` predates V3-62's work-subject canon rule — scorer bug, not model; Godfather rows unscored until fixed. Full tables: `reports/open-model-compare-2026-09-22.md`. No default changed.

## 2026-09-22 — Luna vs Sol, 20 graph subjects, reading + hunting ($5.00)

Tony-approved (cap $6) to test whether Luna's lower recall is filler. 18 paired subjects per job across 11 domains. Reading: Sol 586 confirmed / 0 rejected vs Luna 345 / 87 rejected; Luna missed 393 of Sol's pairs, added 152. Hunting: Sol 162 confirmed citations covering 129 targets vs Luna 87 covering 68; Luna missed 81 targets. Per subject: Sol $0.26, Luna $0.014. Verdict: Luna alone ≈ half the graph; misses are spread across every subject so a Luna-first/Sol-gaps scheme saves nothing. Luna as a *second* reader adds ~26% confirmed page claims for ~$0.005/page. Tables in `reports/open-model-compare-2026-09-22.md`; rows in the `-rows-` and `-research-` JSON files. No default changed.

## 2026-10-02 — Music pivot pilot: James Brown, Joni Mitchell, Marvin Gaye ($0.90)

Tony-approved (~$1) after the map-travel audit (V3-85): these three are shared influences of 4–7 mapped music subjects each but were 4–6-link stubs filed as works, so leaping to them dead-ended. Built with `scripts/experiments/demo-build.mjs` + `specs/pivots-pilot-2026-10-02.json`, QID- and MBID-first; the stubs were reshaped in place, keeping their claims. Wikipedia harvests: 33 / 24 / 27 confirmed claims (1 / 14 / 15 failed the quote wall). Mixes (Opus 5): 23 cards each; verified 16 / 20 / 15, documented 15 / 13 / 14. Media: 16+13 / 17+13 / 12+9 images + previews. **$0.33 / $0.28 / $0.29.** Map nodes 6 → 47, 4 → 45, 4 → 55; James Brown now leads to Prince, Kendrick Lamar, Miles Davis, Fela Kuti, Kraftwerk and Miguel. Fifteen pivots remain (Hendrix, the Beatles, Stevie Wonder, Kanye West, Michael Jackson, Funkadelic, Madonna, Janelle Monáe, Lauryn Hill, Missy Elliott, Siouxsie and the Banshees, Steve Reich, Stockhausen, Nina Simone, Ornette Coleman), ~$4–7 at this rate.

## 2026-10-02 — Wrong-subject repair (V3-87), $0.79

Audit of all 236 maps found five on the wrong subject. Removed: Psycho punk band (14 links rejected), Lucile Watson, Jesus of Nazareth miniseries, John Meyer. Re-seeded by Wikidata ID through `build-batch.mjs` (roster `data/repairs/2026-10-02-reseed.tsv`): **Psycho (1960)** 20 cards (✓20 ◆8), 40 Wikipedia + 8 interview citations, on the existing film record so its poster and links carried over; **Lucy, Lady Duff-Gordon** 23 cards, 30 Wikipedia + 9 interview citations. Maps $0.18 (batch), reading $0.15, interviews $0.46. Matching test on 25 names: $0.03. Pre-repair rows backed up in `data/repairs/2026-10-02-wrong-subjects-backup.json`.

## 2026-10-02 — Map-image backfill, full graph (V3-84)

`scripts/map-images.mjs` over every entity on the influence map, zero model calls, three shards in parallel (~3 h). Earlier the same day: Vonnegut's map (23 applied / 11 queued / 3 nothing) and the 300 busiest entities (193 / 90 / 17). **Full run, 9,638 entities:** 1,635 applied automatically, 6,356 queued for the curator, 1,647 with nothing in any free source, 0 errors. Automatic picks by identity route: 857 works through the V3-83 gates, 647 people/institutions by role match, 110 by a connected-name mention, 21 by Wikidata ID. Spot-checks: one wrong pick found and removed in the 300-run (a music entity named "Psycho" took the 1960 film poster via a self-mention; self-mentions no longer count). Sampled role and mention picks in the full run were right, including two that looked wrong at a glance (Morse's *The House of Representatives* painting; the Ziegfeld Follies revue). The queue is triaged through the "By category" bulk tab in /admin/images; "Unclear" (photo-search-only candidates) is the long tail.
