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
