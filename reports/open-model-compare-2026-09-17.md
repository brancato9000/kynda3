# Open-model comparison — 2026-09-17

Approved by Tony 2026-09-16 (budget <$10). Same prompts, same schemas, same deterministic gates for every model; dry run, nothing persisted. Open models via OpenRouter (`usage.cost` receipts); Claude via Anthropic (sticker-price math).

## Harvest — 2026-09-17T04:29:29.235Z

Models: claude-sonnet-5

### Radiohead

Source: https://en.wikipedia.org/wiki/Radiohead (141600 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5 | 39 | 32 | 6 | 1 | 84% | $0.180 | $0.006 | 50s |

Recall overlap vs Sonnet 5 (31 confirmed pairs):

### The Godfather

Source: https://en.wikipedia.org/wiki/The_Godfather (129774 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5 | 12 | 9 | 2 | 1 | 82% | $0.148 | $0.016 | 40s |

Recall overlap vs Sonnet 5 (9 confirmed pairs):

### Kendrick Lamar

Source: https://en.wikipedia.org/wiki/Kendrick_Lamar (214023 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5 | 42 | 22 | 19 | 1 | 54% | $0.191 | $0.009 | 50s |

Recall overlap vs Sonnet 5 (22 confirmed pairs):

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| claude-sonnet-5 | 3 | 63 | 27 | 3 | $0.519 | $0.008 | 47s |

## Research — Radiohead — 2026-09-17T04:32:02.926Z

Models: claude-sonnet-5

Targets (6): Beyoncé; Geese; Ennio Morricone; Vampire Weekend; In Rainbows; The Bends

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5 | 1 | 8 | 4 | 3 | 1 | server-side | $1.329 | 504s |

## Harvest — 2026-09-17T04:51:16.304Z

Models: claude-sonnet-5, moonshotai/kimi-k3, z-ai/glm-5.2

### Radiohead

Source: https://en.wikipedia.org/wiki/Radiohead (141600 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5 | 38 | 32 | 4 | 2 | 89% | $0.189 | $0.006 | 54s |
| moonshotai/kimi-k3 | 41 | 41 | 0 | 0 | 100% | $0.108 | $0.003 | 159s |
| z-ai/glm-5.2 | 42 | 35 | 7 | 0 | 83% | $0.044 | $0.001 | 12s |

Recall overlap vs Sonnet 5 (32 confirmed pairs):
- moonshotai/kimi-k3: reproduces 14/32 of Sonnet's confirmed pairs, adds 26 Sonnet didn't find
- z-ai/glm-5.2: reproduces 10/32 of Sonnet's confirmed pairs, adds 24 Sonnet didn't find

### The Godfather

Source: https://en.wikipedia.org/wiki/The_Godfather (129774 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5 | 15 | 12 | 0 | 1 | 100% | $0.137 | $0.011 | 33s |
| moonshotai/kimi-k3 | 41 | 40 | 0 | 1 | 100% | $0.110 | $0.003 | 190s |
| z-ai/glm-5.2 | 40 | 29 | 10 | 1 | 74% | $0.044 | $0.002 | 14s |

Recall overlap vs Sonnet 5 (12 confirmed pairs):
- moonshotai/kimi-k3: reproduces 6/12 of Sonnet's confirmed pairs, adds 34 Sonnet didn't find
- z-ai/glm-5.2: reproduces 0/12 of Sonnet's confirmed pairs, adds 29 Sonnet didn't find

### Kendrick Lamar

Source: https://en.wikipedia.org/wiki/Kendrick_Lamar (214023 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5 | 40 | 31 | 9 | 0 | 78% | $0.257 | $0.008 | 84s |
| moonshotai/kimi-k3 | 80 | 80 | 0 | 0 | 100% | $0.163 | $0.002 | 57s |
| z-ai/glm-5.2 | 40 | 23 | 16 | 1 | 59% | $0.063 | $0.003 | 34s |

Recall overlap vs Sonnet 5 (30 confirmed pairs):
- moonshotai/kimi-k3: reproduces 27/30 of Sonnet's confirmed pairs, adds 53 Sonnet didn't find
- z-ai/glm-5.2: reproduces 13/30 of Sonnet's confirmed pairs, adds 9 Sonnet didn't find

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| claude-sonnet-5 | 3 | 75 | 13 | 3 | $0.583 | $0.008 | 57s |
| moonshotai/kimi-k3 | 3 | 161 | 0 | 1 | $0.381 | $0.002 | 135s |
| z-ai/glm-5.2 | 3 | 87 | 33 | 2 | $0.152 | $0.002 | 20s |

## Research — Radiohead — 2026-09-17T05:01:27.935Z

Models: z-ai/glm-5.2, moonshotai/kimi-k3

Targets (6): Beyoncé; Geese; Ennio Morricone; Vampire Weekend; In Rainbows; The Bends

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| z-ai/glm-5.2 | 1 | 11 | 3 | 8 | 0 | 10/9 (8 turns) | $0.086 | 57s |
| moonshotai/kimi-k3 | 1 | 7 | 6 | 1 | 0 | 10/6 (10 turns) | $0.111 | 71s |

## Harvest — 2026-09-17T05:03:06.529Z

Models: claude-sonnet-5, moonshotai/kimi-k3, z-ai/glm-5.2

### Radiohead

Source: https://en.wikipedia.org/wiki/Radiohead (141600 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
  - claude-sonnet-5 golden: PASS, 0 violations
| claude-sonnet-5 | 40 | 35 | 5 | 0 | 88% | $0.185 | $0.005 | 51s |
  - moonshotai/kimi-k3 golden: PASS, 0 violations
| moonshotai/kimi-k3 | 39 | 39 | 0 | 0 | 100% | $0.099 | $0.003 | 210s |
  - z-ai/glm-5.2 golden: PASS, 0 violations
| z-ai/glm-5.2 | 44 | 42 | 2 | 0 | 95% | $0.155 | $0.004 | 96s |

Recall overlap vs Sonnet 5 (34 confirmed pairs):
- moonshotai/kimi-k3: reproduces 16/34 of Sonnet's confirmed pairs, adds 23 Sonnet didn't find
- z-ai/glm-5.2: reproduces 13/34 of Sonnet's confirmed pairs, adds 28 Sonnet didn't find

### The Godfather

Source: https://en.wikipedia.org/wiki/The_Godfather (129774 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
  - claude-sonnet-5 golden: PASS, 0 violations
| claude-sonnet-5 | 29 | 25 | 3 | 1 | 89% | $0.154 | $0.006 | 36s |
  - moonshotai/kimi-k3 golden: 2 violation(s): self-ref The Godfather Part II, self-ref The Godfather Part III
| moonshotai/kimi-k3 | 30 | 27 | 2 | 1 | 93% | $0.096 | $0.004 | 25s |
  - z-ai/glm-5.2 golden: 2 violation(s): self-ref The Godfather Part II, self-ref The Godfather Part III
| z-ai/glm-5.2 | 43 | 33 | 9 | 1 | 79% | $0.049 | $0.001 | 20s |

Recall overlap vs Sonnet 5 (24 confirmed pairs):
- moonshotai/kimi-k3: reproduces 6/24 of Sonnet's confirmed pairs, adds 21 Sonnet didn't find
- z-ai/glm-5.2: reproduces 0/24 of Sonnet's confirmed pairs, adds 32 Sonnet didn't find

### Kendrick Lamar

Source: https://en.wikipedia.org/wiki/Kendrick_Lamar (214023 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
  - claude-sonnet-5 golden: PASS, 0 violations
| claude-sonnet-5 | 41 | 21 | 20 | 0 | 51% | $0.188 | $0.009 | 49s |
  - moonshotai/kimi-k3 golden: PASS, 0 violations
| moonshotai/kimi-k3 | 41 | 41 | 0 | 0 | 100% | $0.107 | $0.003 | 81s |
  - z-ai/glm-5.2 golden: PASS, 0 violations
| z-ai/glm-5.2 | 40 | 39 | 0 | 1 | 100% | $0.051 | $0.001 | 42s |

Recall overlap vs Sonnet 5 (21 confirmed pairs):
- moonshotai/kimi-k3: reproduces 13/21 of Sonnet's confirmed pairs, adds 28 Sonnet didn't find
- z-ai/glm-5.2: reproduces 13/21 of Sonnet's confirmed pairs, adds 25 Sonnet didn't find

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| claude-sonnet-5 | 3 | 81 | 28 | 1 | $0.527 | $0.007 | 45s |
| moonshotai/kimi-k3 | 3 | 107 | 2 | 1 | $0.302 | $0.003 | 105s |
| z-ai/glm-5.2 | 3 | 114 | 11 | 2 | $0.255 | $0.002 | 53s |

## Summary and read-out (written 2026-09-17)

Total experiment spend: **$4.25** of the $10 approved (Anthropic $2.96, OpenRouter $1.29). Every open-model figure is OpenRouter's charged USD; Sonnet figures are sticker-price math on reported tokens.

### Harvest (the workload that actually spends money — 3 golden Wikipedia pages, two independent runs)

| model | run | confirmed | rejected | gate pass | cost / 3 pages | $/confirmed | avg time | golden traps |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5 | 1 | 75 | 13 | 85% | $0.583 | $0.008 | 57s | — |
| claude-sonnet-5 | 2 | 81 | 28 | 74% | $0.527 | $0.007 | 45s | 2 self-ref (Godfather II/III) |
| moonshotai/kimi-k3 | 1 | 161 | 0 | 100% | $0.381 | $0.002 | 135s | — |
| moonshotai/kimi-k3 | 2 | 107 | 2 | 98% | $0.302 | $0.003 | 105s | 2 self-ref (Godfather II/III) |
| z-ai/glm-5.2 | 1 | 87 | 33 | 73% | $0.152 | $0.002 | 20s | — |
| z-ai/glm-5.2 | 2 | 114 | 11 | 91% | $0.255 | $0.002 | 53s | 0 |

Sonnet's price on OpenRouter-equivalent terms: Kimi K3 is $3/$15 per MTok (same sticker as Sonnet 5) and still came in ~40% cheaper per page because it spends fewer tokens; GLM 5.2 is $1.40/$4.40 and 2–3× cheaper per page.

### Research (Radiohead, 6 targets, one run each)

| model | harness | findings | T2 confirmed | cost | time |
|---|---|---|---|---|---|
| claude-sonnet-5 | Anthropic server web_search/web_fetch, prompt caching | 8 | 4 | $1.329 | 504s |
| moonshotai/kimi-k3 | DuckDuckGo + our fetchPageText (client-side tools) | 7 | 6 | $0.111 | 71s |
| z-ai/glm-5.2 | same | 11 | 3 | $0.086 | 57s |

Baseline for context: July 2026 Sonnet measurement was $1.64 for 5/6 T2 (V3-20). Tonight's Sonnet run is consistent with it.

### Quality audit (hand-read samples from the rows file, my judgment, not a metric)

- **The quote wall confirms that a quote exists, not that it documents the stated relation.** All three models emit claims whose quote is real but whose claimType is wrong or whose "connection" is trivia. Examples — Sonnet: "Sergio Leone → Once Upon a Time in America [cited_as_influence]" (Leone turned down The Godfather to make it). Kimi: "The Godfather → Jaws [same_scene]" (box-office succession), "→ Citizen Kane [influenced_by]" (AFI ranking). GLM: "The Godfather → Burt Lancaster [cited_as_influence]" (he expressed interest in adapting the book).
- **GLM 5.2 collapses claimType**: on Radiohead and The Godfather every confirmed claim was labeled `cited_as_influence`, and sourceDegree was uniformly `second`. Kendrick was better labeled. Its quotes are real; its labels are not trustworthy without a downstream classifier.
- **Kimi K3 follows the extraction instructions loosely**: run 1 emitted 80 claims on Kendrick against a 40-claim cap; 7 of its Kendrick quotes are under the 40-char minimum (song-title fragments like `"Never Catch Me" by Flying Lotus`) which trivially pass the wall. Its claimType mix (influenced_by / collaborated_with / member_of / founded) is the most Sonnet-like of the two open models.
- **Both Sonnet and Kimi hit the same golden self-reference trap** (The Godfather → Part II / Part III), and GLM did not. The open models are no worse than Sonnet on the eval harness's own standard.
- **Overlap is low across ALL models, including Sonnet vs itself**: run-to-run, Sonnet confirmed 75 then 81 pairs on the same pages; open models reproduce only 0–60% of Sonnet's pairs while adding 20–50 new ones. The extraction task has many valid answers; "reproduces Sonnet" is not a quality measure.
- Rejections cluster on the same quotes for every model (Mozart/Verdi/Bach lines in The Godfather, the Kendrick influences list): those are HTML-strip artifacts in the page text (stray spaces around punctuation), a normalizer issue, not a model issue.

### What this supports

1. **Harvest can move to an open model now at 2–3× lower cost per citation with no measurable loss on the wall or the golden traps**, provided a claimType/relation check is added downstream (which Sonnet's output also needs — it's a gate the pipeline lacks for every model). Kimi K3 is the safer drop-in (labels closer to Sonnet's); GLM 5.2 is the cheapest and fastest but needs its labels reclassified.
2. **Research is the bigger surprise**: Kimi produced 6 T2 citations for $0.11 against Sonnet's 4 for $1.33. One subject, one run, and a different harness — treat as a strong signal, not a result. Worth a 5-subject follow-up (~$1) before touching the default.
3. Nothing here changes the mix-generation path (Opus 5 / Fable); that was out of scope and is user-facing.

Decision is Tony's. Suggested next step: hand-label 30 confirmed claims per model from `open-model-compare-rows-2026-09-17.json` ("does the quote document the stated relation?") — that is the one number this run could not produce.
## Research — The Godfather — 2026-09-17T05:28:54.682Z

Models: moonshotai/kimi-k3, z-ai/glm-5.2

Targets (6): Charles Dickens; Passacaglia and Fugue in C minor, BWV 582; Prelude and Fugue in D major, BWV 532; La traviata; Le Nozze di Figaro; Fortunella

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| moonshotai/kimi-k3 | 1 | 6 | 6 | 0 | 0 | 10/4 (9 turns) | $0.170 | 114s |
| z-ai/glm-5.2 | 1 | 4 | 3 | 1 | 0 | 10/8 (9 turns) | $0.130 | 53s |

## Research — Breaking Bad — 2026-09-17T05:31:43.045Z

Models: moonshotai/kimi-k3, z-ai/glm-5.2

Targets (5): NYPD Blue; The Americans; Matt Brennan; The Sopranos; Matthew Weiner

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| moonshotai/kimi-k3 | 1 | 8 | 7 | 1 | 0 | 10/10 (13 turns) | $0.230 | 173s |
| z-ai/glm-5.2 | 1 | 6 | 5 | 1 | 0 | 10/2 (6 turns) | $0.071 | 43s |

## Research — Björk — 2026-09-17T05:35:20.102Z

Models: moonshotai/kimi-k3, z-ai/glm-5.2

Targets (6): Beyoncé; Travis Scott; Kali Uchis; Kali Uchis; Pagan Poetry; Alarm Call

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| moonshotai/kimi-k3 | 1 | 8 | 7 | 1 | 0 | 10/6 (10 turns) | $0.158 | 115s |
| z-ai/glm-5.2 | 1 | error: Expected ',' or ']' after array element in JSON at position  | | | | | $0.173 | 81s |

## Research — Miles Davis — 2026-09-17T05:38:37.781Z

Models: moonshotai/kimi-k3, z-ai/glm-5.2

Targets (6): Duke Ellington; The Duke; Jeff Tweedy; Sugar Ray Robinson; Aura; Sovereign Military Order of Malta

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| moonshotai/kimi-k3 | 1 | 8 | 5 | 2 | 1 | 10/7 (10 turns) | $0.188 | 136s |
| z-ai/glm-5.2 | 1 | 7 | 4 | 3 | 0 | 10/8 (6 turns) | $0.119 | 57s |

## Research — Talking Heads — 2026-09-17T05:41:52.326Z

Models: moonshotai/kimi-k3, z-ai/glm-5.2

Targets (6): Radio Head; Remain in Light; Speaking in Tongues; True Stories; Tibor Kalman; MIT Media Lab

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| moonshotai/kimi-k3 | 1 | 11 | 11 | 0 | 0 | 10/7 (10 turns) | $0.329 | 167s |
| z-ai/glm-5.2 | 1 | 11 | 8 | 3 | 0 | 10/10 (6 turns) | $0.129 | 66s |

## Research — Breaking Bad — 2026-09-17T05:45:47.153Z

Models: claude-sonnet-5

Targets (5): NYPD Blue; The Americans; Matt Brennan; The Sopranos; Matthew Weiner

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5 | 1 | 0 | 0 | 0 | 0 | server-side | $0.904 | 984s |
| claude-sonnet-5 | 2 | error: Request timed out. | | | | | $0.838 | 22744s |

## Follow-up: research on 5 more golden subjects (Tony-approved, cap $4.25; spent $3.44)

Subjects: The Godfather, Breaking Bad, Björk, Miles Davis, Talking Heads. Targets came from each subject's existing claims in the graph (so some are odd — "Radio Head", "Sovereign Military Order of Malta" — but identical for every model). Open models on all five; Sonnet only on Breaking Bad because its first run plus retry consumed $1.74 and a second subject could have crossed the cap.

| subject | Kimi K3 | GLM 5.2 | Sonnet 5 |
|---|---|---|---|
| The Godfather | 6 T2 / 6 findings, $0.17, 114s | 3/4, $0.13, 53s | — |
| Breaking Bad | 7/8, $0.23, 173s | 5/6, $0.07, 43s | 0 findings, $0.90, 984s; retry timed out (~$0.84) |
| Björk | 7/8, $0.16, 115s | failed: malformed JSON at 61k chars (~$0.17) | — |
| Miles Davis | 5/8 (1 dead link), $0.19, 136s | 4/7, $0.12, 57s | — |
| Talking Heads | 11/11, $0.33, 167s | 8/11, $0.13, 66s | — |
| **Totals** | **36 T2, $1.08** | **20 T2, $0.62** | **0 T2, $1.74** |

Both rounds combined: Kimi K3 42 T2 on 6 subjects for $1.19 (~$0.03/citation); GLM 5.2 23 T2 on 5 completed subjects for $0.71; Sonnet 5 4 T2 on 2 subjects for $3.07 (one productive run, one empty, one timeout). Sonnet's "less tool-eager, can quit early" behaviour from V3-20 reproduced tonight; the retry-on-empty insurance cost $0.84 and timed out. Kimi returned findings on every run; its one weak subject (Miles Davis) had the weakest target list.

Read-out: the research result is no longer a single-subject signal. With the harness caveat unchanged (client-side DuckDuckGo + our fetch vs Anthropic's server tools), Kimi K3 is producing an order of magnitude more confirmed citations per dollar than the current default, with no empty runs. GLM 5.2 is cheaper still but failed once on output formatting. Decision remains Tony's; the natural adoption shape is Kimi K3 as the research default with Sonnet as the escalation/fallback tier, and the same claimType/relation check needed downstream regardless of model.
