# Kynda — Backlog

The single ranked list. Status marks: **open**, **waiting** (on Tony or a third party), **parked** (deliberately shelved), **done** (kept one cycle for the record, then removed). Decisions go in DECISIONS.md, run records in RUNS.md, card fixes in CORRECTIONS.md.

Last full review: 2026-10-03.

## Now — Brown follow-through

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Eric Gershman intro | scheduled | Tony and Meagan speak with and demo for Gershman on Monday 2026-10-05. The demo journeys verified 2026-10-02 (Miguel → Prince → James Brown → Fela Kuti → Talking Heads → Radiohead; Bowie → *Metropolis* → Kraftwerk → Björk → Mitski → Jeff Buckley → Radiohead) are in RUNS.md / DECISIONS V3-85. |
| 2 | Brown → Anthropic proposal | waiting | Depends on the Brown conversation moving forward (Gershman first). Sydney's thread: the influence graph on the open curriculum; pilot-shapes doc v1 is the starting material. |
| 3 | Data-ownership position | waiting | Depends on the Brown conversation. Who owns claims a Brown scholar curates; contributor-attributed CC-BY on Kynda infrastructure is the defensible default. |
| 4 | Berg consent | waiting | Berg is out of the country; resumes on his return. His page and the named-cut experiment stay private until he says yes. Tony's outbound. |

## Next — correctness and cost

| # | Item | Status | Notes |
|---|---|---|---|
| 29 | Finish the 750 | open | Part A (206) + two samples per Part B/C category built 2026-10-03 (RUNS). Remaining: full Part B and Part C runs, then a second mining pass that holds the 32% women floor. New fields (food, cars, games, perfume, cocktails, businesses) currently file under "ideas"; they need their own field labels before they can be browse rows. Measured cost ~$0.45/subject (maps ran long). |
| 30 | Works with no maker recorded | open | 2026-10-03 evidence-anchored Wikidata sweep (`scripts/experiments/stamp-work-creators.mjs`): 39 makers stamped, 10 ambiguous and 4 held back for review, 348 unmatched of 401. Unmatched ones still leave map dead ends; many are artists misfiled as works (next item). |
| 31 | Field labels and misfiled kinds | open | ~7,550 entities have no field; ~5,300 are kind "other"; artists are filed as works (Chaplin, Picasso, AC/DC). Only ~470 of the no-field ones carry a Wikidata ID, which the existing classifier needs. Skews bridge rankings, own-work checks and travel. **Done 2026-10-03 for the new build:** 80 subjects pinned to their build-list field, 28 kinds fixed; the build now pins fields itself. **Blocker found:** `classify-entities.mjs` overwrites curated fields of people (would have moved Warhol to film, Copland to dance) — fix it before running it on the rest. |
| 5 | Full image re-verification sweep under V3-83 gates | open | Zero model cost, ~30 min of Wikipedia API. Partly done 2026-10-02: a *shape* sweep of all 2,082 stored pictures stripped 33 wordmarks/banners (CORRECTIONS). The identity sweep is still open. |
| 6 | Reader-contribution queue: 258 pending | open | Triage session or an auto-expiry rule for the low-confidence tail. |
| 6b | Map-picture queue: 6,469 subjects with candidates | open | From the map-image backfill (V3-84). Curate in place (admin overlay) or via `/admin/images`; consider auto-expiry for low-score tails. |
| 7 | Soft-floor / blended architecture entry | open | Ratified by the Beyoncé experiment (graph as floor, model may refuse weak pool tails) — never written into DECISIONS. |
| 8 | Song-level verification (MusicBrainz recordings) | open | The album-shaped bias, quantified twice. Biggest single accuracy upgrade on the board. |
| 9 | `anti_influence`, `sample`, `toured_with` claim types | open | Taxonomy gaps exposed by the Beyoncé import. Schema work, cheap. |
| 10 | Wave script passes its category to disambiguation | done | Wrong-subject repair (V3-89, merged to main 2026-10-03): full-text and category-hinted search; rosters may carry a Wikidata ID column. |
| 11 | Batch API for corpus builds | done | `scripts/build-batch.mjs` (V3-87). Map output ceiling raised 32k → 48k (batch and live retry) on 2026-10-03: 21 of 227 maps were cut off and redone at full price. |
| 12 | Prompt caching in `generateMix` | parked | ~93% of a map's cost is output (V3-87), so caching moves almost nothing. |
| 13 | Fable 5.1 golden-set eval | parked | Superseded: Tony chose Opus 5 for maps after the blind side-by-side (V3-87). |
| 14 | Rebuild `listening-map-build.mjs` | open | Lost with the session scratchpad. Walk v3, Rising, household subtraction, polyglot noise filter — spec in RUNS.md 2026-08-19. |

## Opening the site

| # | Item | Status | Notes |
|---|---|---|---|
| 33 | Close the paid taps before dropping the password | done | 2026-10-03 (DECISIONS V3-90): search never builds a map, only the admin key can; visitors request maps into an `/admin` queue ranked by distinct visitors; approved ones → `scripts/experiments/requests-roster.mjs` → batch build; a search naming a mapped subject skips the model; "Ask Kynda" capped at 200/day site-wide. **Tony's clicks:** monthly spend limits in the Anthropic Console and on OpenRouter; then set `KYNDA_SITE_OPEN=1` on Vercel once #32 is ready (don't remove the password: it still guards listening maps and Berg's page). |
| 32 | Search-engine readiness (SEO) | open | Tony, 2026-10-03: the point of opening the site is for Google to crawl it and build authority. **Built the same day (DECISIONS V3-91):** `robots.txt`; `sitemap.xml` with every mapped subject (410 at build time); each mapped subject page now carries a canonical address, schema.org structured data tied to Wikidata/Wikipedia/MusicBrainz, a descriptive title, and a server-rendered "influences, peers and legacy" section (intro, mix picks with reasons, every connection with its first receipt, links to other mapped subjects); unmapped map stops and private subjects are `noindex`. **Remaining:** (a) **a real domain** — the site still answers at kynda3.vercel.app, and authority earned there doesn't move with it later; set `NEXT_PUBLIC_SITE_URL` when one is chosen, before Google is invited; (b) Google Search Console + submit the sitemap (Tony's account); (c) set `KYNDA_SITE_OPEN=1` on Vercel (keep the password set — it still guards private pages); (d) later: a browse index page per field, and watching which pages earn impressions. |

## Later — product

| # | Item | Status | Notes |
|---|---|---|---|
| 28 | Influence map: card overlays move to a side panel | done | **Tony, 2026-10-03, designed in another thread and merged the same day (branch `claude/side-panel`): cards dock right on desktop, bottom on narrow screens, resizable.** The evidence and bio cards currently float over the graph and cover what you're exploring; they should live in a side panel beside the map instead. |
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
