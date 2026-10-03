# Kynda — Backlog

The single ranked list. Status marks: **open**, **waiting** (on Tony or a third party), **parked** (deliberately shelved), **done** (kept one cycle for the record, then removed). Decisions go in DECISIONS.md, run records in RUNS.md, card fixes in CORRECTIONS.md.

Last full review: 2026-09-16.

## Now — Brown follow-through

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Eric Gershman intro | waiting | Sydney's first step after the Sept 14 call. Tony's outbound. |
| 2 | Brown → Anthropic proposal | open | Sydney's thread: the influence graph on the open curriculum. Needs a one-page shape; pilot-shapes doc v1 is the starting material. |
| 3 | Data-ownership position | open | Who owns claims a Brown scholar curates. Contributor-attributed CC-BY on Kynda infrastructure is the defensible default; Tony to confirm. |
| 4 | Berg consent | waiting | His page and the named-cut experiment stay private until he says yes. Tony's outbound. |

## Next — correctness and cost

| # | Item | Status | Notes |
|---|---|---|---|
| 5 | Full image re-verification sweep under V3-83 gates | open | Zero model cost, ~30 min of Wikipedia API. The Sept 14 sweep only caught the album-class version of the Method Man collision. |
| 6 | Curator queue: 257 pending | open | Triage session or an auto-expiry rule for the low-confidence tail. |
| 7 | Soft-floor / blended architecture entry | open | Ratified by the Beyoncé experiment (graph as floor, model may refuse weak pool tails) — never written into DECISIONS. |
| 8 | Song-level verification (MusicBrainz recordings) | open | The album-shaped bias, quantified twice. Biggest single accuracy upgrade on the board. |
| 9 | `anti_influence`, `sample`, `toured_with` claim types | open | Taxonomy gaps exposed by the Beyoncé import. Schema work, cheap. |
| 10 | Wave script passes its category to disambiguation | open | The two Paul Taylors are the case (V3-82). |
| 11 | Batch API for corpus builds | open | 50% off for non-interactive work: top-ups, gap pages, harvests. Takes the Opus corpus from ~$210 to ~$105. |
| 12 | Prompt caching in `generateMix` | open | System prompt is rebuilt per request. Free win on any model; pennies at current volume. |
| 13 | Fable 5.1 golden-set eval | open | Three subjects, ~$1. Same price as Fable 5; only a quality gain would justify it over Opus 5. |
| 14 | Rebuild `listening-map-build.mjs` | open | Lost with the session scratchpad. Walk v3, Rising, household subtraction, polyglot noise filter — spec in RUNS.md 2026-08-19. |

## Later — product

| # | Item | Status | Notes |
|---|---|---|---|
| 15 | Listening-map productization | open | "Upload your Spotify export" as a real lane. Family test proved the value; post-Brown. |
| 16 | Layer-2 Beyoncé classifier sweep | open | $50–75, golden set ready. |
| 17 | Reader-testimony curator lane | open | Eyewitness accounts as a labeled lane distinct from citations (the Clayden comments idea). |
| 18 | Mix-prompt intro rules | open | No carded-artist opener; structural first sentence. |
| 19 | Subtraction tightening (2× dominance) | open | Optional; current behavior is honest and labeled. |
| 20 | Media long tail | parked | ~128 music cards with no preview anywhere; ~1,900 art cards with no confident image; Chappelle's Show and SNL have no lead image on Wikipedia. Correctly empty. |
| 21 | Ledger v2 for dense pages | open | The 572-edge Beyoncé ledger is a wall. |
| 22 | Share surface for `/s/*` pages | open | Unfurls are solved (V3-81); a public flag or share token per page is the remaining design. |
| 27 | Fold demo maps into the main graph | done | Tony, 2026-10-03: make sure no demo map or graph lives outside the main graph. Audit the same day found **none outstanding**: all 15 demo pages (`app/demo/[slug]`, incl. Glass Bead Game, Detroit-style pizza, Live Art in Microgravity, the Nonesuch three, Golin three, Bowie/Chappelle/Ghostbusters) are mapped subjects in the main graph, and every demo builder (`demo-build`, `demo-three-build`, `clayden-build`) writes through `persistMixRun`/`upsertEntity`. The influence-map prototype scripts only *read* from the graph. **Kept separate on purpose:** the personal and family listening maps (`listening_maps` table — derived intersections only, privacy posture). **Rule going forward:** any new demo builder writes to the main graph, never a side file. |
| 26 | Influence map: what should bubble size mean? | open | **Open question, tied to how the weighting system evolves** (Tony, 2026-10-02). Today size = evidence (1 + 3 per cited quote + 1.5 per documented source, max 10) and KyndaMix picks are drawn biggest, which Tony is comfortable with. But some connections feel bigger than their evidence count: Radiohead *named themselves after* a Talking Heads song, yet the Talking Heads bubble on Radiohead's map is weight 4 (from a critic's comparison). The naming story itself is split across three nodes — the song "Radio Head" (7), *True Stories* (1), *Remain in Light* (7) — because evidence about an artist's works never pools to the artist. Questions to settle: should some claim kinds count for more (a name taken from, a teacher, a self-declared "biggest influence") than a critic's comparison? Should works' evidence roll up to their maker's bubble? Should size mean strength of influence, amount of evidence, or editorial importance — and does the legend say which? |
| 25 | Influence map: phone interaction model | done | Tony, 2026-10-02 — built the same day. Today a tap travels, so on a phone you can't look at a relationship without the map redrawing around it. Flip it: **tap** opens the relationship card (evidence, or the bio on the center); **press and hold** re-centers the map on that subject. Desktop unchanged (hover shows, click travels). |

## Books

| # | Item | Status | Notes |
|---|---|---|---|
| 23 | Anthropic Console totals for Aug/Sep | waiting | Dashboard-only numbers; runtime generation isn't in the script receipts. Tony pastes, accountant books. |
| 24 | Vercel / Supabase / domain plan prices | waiting | Books hold `null` for all three. |

## Waiting on Tony (not backlog)

- The Janitors Tapes interview answers (artifact is live for voice use in the car).
- Sidebar lane names for per-lane sessions (proposed: Kynda › Pipeline, Kynda › Media, Kynda › Pitch & Brown, Family maps, Finance, Elderus).

## Parked on purpose

Density program ($250), Phase-3 predictive analytics, patent groundwork, TV closed-captions source, pricing/crowdfunding architecture (resurfaces with the pilot shape).

## Done since last review (2026-09-14 → 09-16)

- Share unfurls (V3-81). Pilot-shapes doc v1 in Drive. Smoke test of Sydney's three pages. Demo pages: Bowie, Chappelle, Ghostbusters. Article-image identity fix (V3-83).
- 2026-09-20: Golin demo pages (Tycho, Zhang Yimou, Vonnegut) via the spec-driven builder; V3-83 creatorship-phrase refinement.
