# Open-model comparison — 2026-09-22

Approved by Tony 2026-09-16 (budget <$10). Same prompts, same schemas, same deterministic gates for every model; dry run, nothing persisted. Open models via OpenRouter (`usage.cost` receipts); Claude via Anthropic (sticker-price math).

## Harvest — 2026-09-22T18:43:15.629Z

Models: openai/gpt-6-sol, openai/gpt-6-luna

### Radiohead

Source: https://en.wikipedia.org/wiki/Radiohead (141610 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
  - openai/gpt-6-sol golden: PASS, 0 violations
| openai/gpt-6-sol | 40 | 40 | 0 | 0 | 100% | $0.091 | $0.002 | 31s |
  - openai/gpt-6-luna golden: PASS, 0 violations
| openai/gpt-6-luna | 36 | 29 | 7 | 0 | 81% | $0.005 | $0.000 | 30s |

Recall overlap vs Sonnet 5 (34 confirmed pairs):
- openai/gpt-6-sol: reproduces 19/34 of Sonnet's confirmed pairs, adds 21 Sonnet didn't find
- openai/gpt-6-luna: reproduces 6/34 of Sonnet's confirmed pairs, adds 23 Sonnet didn't find

### The Godfather

Source: https://en.wikipedia.org/wiki/The_Godfather (129784 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
  - openai/gpt-6-sol golden: PASS, 0 violations
| openai/gpt-6-sol | 29 | 29 | 0 | 0 | 100% | $0.090 | $0.003 | 34s |
  - openai/gpt-6-luna golden: PASS, 0 violations
| openai/gpt-6-luna | 21 | 18 | 2 | 1 | 90% | $0.004 | $0.000 | 28s |

Recall overlap vs Sonnet 5 (24 confirmed pairs):
- openai/gpt-6-sol: reproduces 0/24 of Sonnet's confirmed pairs, adds 29 Sonnet didn't find
- openai/gpt-6-luna: reproduces 0/24 of Sonnet's confirmed pairs, adds 18 Sonnet didn't find

### Kendrick Lamar

Source: https://en.wikipedia.org/wiki/Kendrick_Lamar (214036 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
  - openai/gpt-6-sol golden: PASS, 0 violations
| openai/gpt-6-sol | 40 | 39 | 0 | 1 | 100% | $0.084 | $0.002 | 35s |
  - openai/gpt-6-luna golden: PASS, 0 violations
| openai/gpt-6-luna | 40 | 20 | 20 | 0 | 50% | $0.005 | $0.000 | 44s |

Recall overlap vs Sonnet 5 (21 confirmed pairs):
- openai/gpt-6-sol: reproduces 14/21 of Sonnet's confirmed pairs, adds 25 Sonnet didn't find
- openai/gpt-6-luna: reproduces 10/21 of Sonnet's confirmed pairs, adds 10 Sonnet didn't find

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-sol | 3 | 108 | 0 | 1 | $0.265 | $0.002 | 33s |
| openai/gpt-6-luna | 3 | 67 | 29 | 1 | $0.015 | $0.000 | 34s |

## Harvest — 2026-09-22T18:46:40.455Z

Models: openai/gpt-6-astra

### Radiohead

Source: https://en.wikipedia.org/wiki/Radiohead (141610 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
  - openai/gpt-6-astra golden: PASS, 0 violations
| openai/gpt-6-astra | 40 | 40 | 0 | 0 | 100% | $0.493 | $0.012 | 97s |

Recall overlap vs Sonnet 5 (34 confirmed pairs):
- openai/gpt-6-astra: reproduces 17/34 of Sonnet's confirmed pairs, adds 23 Sonnet didn't find

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-astra | 1 | 40 | 0 | 0 | $0.493 | $0.012 | 97s |

## Research — Radiohead — 2026-09-22T18:48:18.216Z

Models: openai/gpt-6-sol, openai/gpt-6-luna

Targets (6): Beyoncé; Geese; Ennio Morricone; Vampire Weekend; In Rainbows; The Bends

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-sol | 1 | 9 | 9 | 0 | 0 | 10/8 (4 turns) | $0.170 | 72s |
| openai/gpt-6-luna | 1 | 6 | 5 | 1 | 0 | 10/8 (4 turns) | $0.009 | 55s |

## Research — Breaking Bad — 2026-09-22T18:50:25.467Z

Models: openai/gpt-6-sol, openai/gpt-6-luna

Targets (5): NYPD Blue; The Americans; Matt Brennan; The Sopranos; Matthew Weiner

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-sol | 1 | 8 | 8 | 0 | 0 | 10/8 (4 turns) | $0.214 | 56s |
| openai/gpt-6-luna | 1 | 2 | 2 | 0 | 0 | 10/4 (4 turns) | $0.006 | 49s |

## Research — Talking Heads — 2026-09-22T18:52:10.992Z

Models: openai/gpt-6-sol, openai/gpt-6-luna

Targets (6): Radio Head; Remain in Light; Speaking in Tongues; True Stories; Tibor Kalman; MIT Media Lab

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-sol | 1 | 11 | 11 | 0 | 0 | 10/10 (7 turns) | $0.124 | 83s |
| openai/gpt-6-luna | 1 | 8 | 8 | 0 | 0 | 10/10 (5 turns) | $0.014 | 89s |

## Research — Radiohead — 2026-09-22T18:55:03.978Z

Models: openai/gpt-6-astra

Targets (6): Beyoncé; Geese; Ennio Morricone; Vampire Weekend; In Rainbows; The Bends

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-astra | 1 | 8 | 8 | 0 | 0 | 10/10 (5 turns) | $0.757 | 156s |

## Summary and read-out (GPT-6 batch, written 2026-09-22)

Tony-approved cap $3.50 including Astra; spent **$2.76** (first attempt failed on a `temperature` parameter and spent $0; mix runs were done twice because the first log lost the summary lines to a grep locale bug). All GPT-6 charges are OpenRouter receipts. Sonnet figures below are corrected to the real $2/$10 price.

### Harvest — 3 golden Wikipedia pages, same text and same gates as the 2026-09-17 runs

| model | confirmed | rejected | wall pass | $ / 3 pages | $/confirmed | avg time |
|---|---|---|---|---|---|---|
| Sonnet 5 (current) | 75–81 | 13–28 | 74–85% | ~$0.37 | ~$0.005 | 45–57s |
| Kimi K3 | 107–161 | 0–2 | 98–100% | $0.30–0.38 | $0.002–0.003 | 105–135s |
| GLM 5.2 | 87–114 | 11–33 | 73–91% | $0.15–0.26 | $0.002 | 20–53s |
| **GPT-6 Sol** | **108** | **0** | **100%** | **$0.265** | **$0.002** | **33s** |
| **GPT-6 Luna** | 67 | 29 | 50–90% | **$0.015** | **$0.0002** | 34s |
| GPT-6 Astra (Radiohead only) | 40 | 0 | 100% | $0.49/page | $0.012 | 97s |

Golden traps: every GPT-6 harvest run PASS, 0 violations (Sonnet and Kimi each tripped the Godfather II/III self-reference once on 2026-09-17).

### Research — Radiohead, Breaking Bad, Talking Heads (client-side DDG + fetch harness for every non-Claude model)

| model | T2 confirmed (of findings) | cost, 3 subjects | avg per subject |
|---|---|---|---|
| Sonnet 5 (Anthropic server tools) | 4 of 8 (Radiohead), 0 of 0 (Breaking Bad); Talking Heads not run | ~$2.05 for 2 | ~$1.02 |
| Kimi K3 (2026-09-17) | 6/8, 7/8, 11/11 = **24** | $0.67 | $0.22 |
| **GPT-6 Sol** | 9/9, 8/8, 11/11 = **28** | **$0.51** | **$0.17** |
| **GPT-6 Luna** | 5/6, 2/2, 8/8 = 15 | **$0.03** | **$0.01** |
| GPT-6 Astra (Radiohead only) | 8/8 | $0.76 | $0.76 |

Sol confirmed every finding it returned on all three subjects, in 4–7 turns and under 90 seconds each. Luna is thinner (2 findings on Breaking Bad) but never wrong, at roughly a cent a subject.

### Mix generation — 3 golden subjects, effort "low", unchanged prompt, verified by the same catalog checks

| model | Radiohead | The Godfather | Kendrick Lamar | $/mix |
|---|---|---|---|---|
| Opus 5 (current; July measurement) | 88% verified / 59% documented | 86% / 64% | 90% / 60% | $0.11 |
| Opus 5.5 (2026-09-22) | 74% / 65%, 1 self-ref | 100% / 26% | **1 card** | $0.09 |
| **GPT-6 Sol** | 95% / 64% | 86% / 18% | 86% / 45% | **$0.04** |
| **GPT-6 Luna** | 95% / 65% | 95% / 21% | 86% / 50% | **$0.002** |
| GPT-6 Astra (Radiohead only) | 95% / 68% | — | — | $0.19 |

Card counts 19–22 for every GPT-6 run (Opus 5 gives 21–24). Golden: Radiohead and Kendrick PASS for Sol, Luna, and Astra.

**The Godfather trap failures are the scorer, not the models.** Opus 5.5, Sol, and Luna all fail The Godfather identically (3× essential_not_subject + self_reference_title). `eval/scoring.js` still requires the essential slot's creator to equal the subject's *name* and lists Part II / Part III as self-references — rules that V3-62 (2026-08) deliberately changed for work-subjects (canon = other works by the subject's creator). The stored Opus 5 mix "passed" only because it predates V3-62 (2026-07-07). The scorer needs the V3-62 work-subject rule before any Godfather result means anything. Opus 5.5's real problems remain the one-card Kendrick collapse and the Radiohead self-reference.

**Documented-connection rates on The Godfather** (18–26% for every new model vs 52–64% stored) share the same cause: the canon cards the new prompt produces are Coppola films, which the "documented" check evaluates differently than the pre-V3-62 cards. Treat Godfather rows as unscored until the eval is updated.

### Read-out

1. **GPT-6 Sol is the best measured model on every Kynda job**, at Sonnet's exact list price: 100% wall pass on harvest, 28/28 confirmed research citations for $0.17 a subject, mix quality at or near Opus 5 on the two scorable subjects for $0.04 a mix.
2. **GPT-6 Luna is 20–50× cheaper than anything else tested and not obviously worse on maps.** Its harvest and research recall is lower (roughly half of Sol's citations). At a cent a subject it could be the *first pass* on everything, with Sol filling gaps.
3. Astra costs Fable money and did not beat Sol on the one subject tried.
4. Corpus estimate for the remaining 770 subjects: Sol on all three jobs ≈ **$0.30/subject, ~$230**; Luna on all three ≈ **$0.02/subject, ~$13**; Opus 5 maps + Sol harvest/research ≈ $0.37, ~$285.
5. Nothing is adopted. Same caveats as before: the wall proves the quote exists, not the relation; the research harness differs from Anthropic's; single runs on three subjects. New caveat: the golden scorer is stale for work-subjects and should be fixed before any model decision leans on The Godfather.
## Harvest — 2026-09-22T19:34:58.495Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Henry Hobson Richardson

Source: https://en.wikipedia.org/wiki/Henry_Hobson_Richardson (58355 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 17 | 17 | 0 | 0 | 100% | $0.004 | $0.000 | 38s |
| openai/gpt-6-sol | 35 | 35 | 0 | 0 | 100% | $0.079 | $0.002 | 27s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 17 | 0 | 0 | $0.004 | $0.000 | 38s |
| openai/gpt-6-sol | 1 | 35 | 0 | 0 | $0.079 | $0.002 | 27s |

## Research — Henry Hobson Richardson — 2026-09-22T19:36:04.094Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): Allegheny County Courthouse; Mabel Tainter Memorial; Trinity Church; Richardsonian Romanesque; Allegheny County Jail; Richardsonian Romanesque

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 6 | 6 | 0 | 0 | 10/10 (5 turns) | $0.009 | 82s |
| openai/gpt-6-sol | 1 | 12 | 12 | 0 | 0 | 10/10 (5 turns) | $0.302 | 97s |

## Harvest — 2026-09-22T19:39:03.690Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Caravaggio

Source: https://en.wikipedia.org/wiki/Caravaggio_(1986_film) (22141 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 24 | 24 | 0 | 0 | 100% | $0.004 | $0.000 | 40s |
| openai/gpt-6-sol | 18 | 16 | 0 | 2 | 100% | $0.040 | $0.002 | 19s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 24 | 0 | 0 | $0.004 | $0.000 | 40s |
| openai/gpt-6-sol | 1 | 16 | 0 | 2 | $0.040 | $0.002 | 19s |

## Research — Caravaggio — 2026-09-22T19:40:03.257Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (1): Caravaggio

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 5 | 5 | 0 | 0 | 10/6 (5 turns) | $0.011 | 92s |
| openai/gpt-6-sol | 1 | 6 | 6 | 0 | 0 | 10/7 (5 turns) | $0.158 | 72s |

## Harvest — 2026-09-22T19:42:48.004Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Richard Pryor

Source: https://en.wikipedia.org/wiki/Richard_Pryor (86212 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 23 | 23 | 0 | 0 | 100% | $0.006 | $0.000 | 48s |
| openai/gpt-6-sol | 40 | 40 | 0 | 0 | 100% | $0.104 | $0.003 | 41s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 23 | 0 | 0 | $0.006 | $0.000 | 48s |
| openai/gpt-6-sol | 1 | 40 | 0 | 0 | $0.104 | $0.003 | 41s |

## Research — Richard Pryor — 2026-09-22T19:44:17.797Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): Tig Notaro; Steve Martin; Joan Rivers; Eddie Murphy; Lenny Bruce; Bill T. Jones

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 3 | 3 | 0 | 0 | 10/10 (5 turns) | $0.008 | 86s |
| openai/gpt-6-sol | 1 | 6 | 6 | 0 | 0 | 10/10 (6 turns) | $0.228 | 86s |

## Harvest — 2026-09-22T19:47:10.502Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Merce Cunningham

Source: https://en.wikipedia.org/wiki/Merce_Cunningham (36134 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 39 | 38 | 1 | 0 | 97% | $0.005 | $0.000 | 43s |
| openai/gpt-6-sol | 42 | 42 | 0 | 0 | 100% | $0.087 | $0.002 | 46s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 38 | 1 | 0 | $0.005 | $0.000 | 43s |
| openai/gpt-6-sol | 1 | 42 | 0 | 0 | $0.087 | $0.002 | 46s |

## Research — Merce Cunningham — 2026-09-22T19:48:40.305Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): Roratorio; Mikhail Baryshnikov; Paul Kaiser; Robert Rauschenberg; Cornish College of the Arts; Martha Graham

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 7 | 6 | 1 | 0 | 10/8 (4 turns) | $0.008 | 104s |
| openai/gpt-6-sol | 1 | 9 | 9 | 0 | 0 | 10/10 (5 turns) | $0.196 | 82s |

## Harvest — 2026-09-22T19:51:47.898Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Marc Jacobs

Source: https://en.wikipedia.org/wiki/Marc_Jacobs (33400 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 15 | 10 | 5 | 0 | 67% | $0.003 | $0.000 | 35s |
| openai/gpt-6-sol | 40 | 39 | 0 | 1 | 100% | $0.088 | $0.002 | 40s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 10 | 5 | 0 | $0.003 | $0.000 | 35s |
| openai/gpt-6-sol | 1 | 39 | 0 | 1 | $0.088 | $0.002 | 40s |

## Research — Marc Jacobs — 2026-09-22T19:53:04.248Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): Heaven by Marc Jacobs; Marc Jacobs International Company, L.P.; Louis Vuitton; Perry Ellis; Bella Hadid; Christina Ricci

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 4 | 4 | 0 | 0 | 10/8 (4 turns) | $0.008 | 92s |
| openai/gpt-6-sol | 1 | 11 | 11 | 0 | 0 | 10/10 (5 turns) | $0.168 | 79s |

## Harvest — 2026-09-22T19:55:56.429Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Federico Fellini

Source: https://en.wikipedia.org/wiki/Federico_Fellini (93094 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 38 | 20 | 18 | 0 | 53% | $0.006 | $0.000 | 62s |
| openai/gpt-6-sol | 40 | 40 | 0 | 0 | 100% | $0.093 | $0.002 | 37s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 20 | 18 | 0 | $0.006 | $0.000 | 62s |
| openai/gpt-6-sol | 1 | 40 | 0 | 0 | $0.093 | $0.002 | 37s |

## Research — Federico Fellini — 2026-09-22T19:57:35.901Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): La Strada; La Strada; The Miracle; Paisan; Open City; Wes Anderson

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 7 | 7 | 0 | 0 | 10/7 (4 turns) | $0.011 | 156s |
| openai/gpt-6-sol | 1 | 12 | 12 | 0 | 0 | 10/10 (5 turns) | $0.234 | 127s |

## Harvest — 2026-09-22T20:02:19.633Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Ursula K. Le Guin

Source: https://en.wikipedia.org/wiki/Ursula_K._Le_Guin (153122 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 28 | 23 | 5 | 0 | 82% | $0.005 | $0.000 | 57s |
| openai/gpt-6-sol | 40 | 40 | 0 | 0 | 100% | $0.083 | $0.002 | 34s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 23 | 5 | 0 | $0.005 | $0.000 | 57s |
| openai/gpt-6-sol | 1 | 40 | 0 | 0 | $0.083 | $0.002 | 34s |

## Research — Ursula K. Le Guin — 2026-09-22T20:03:51.407Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): Columbia University; Radcliffe College; Stanford University; Bennington College; Tulane University; Mercer University

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 4 | 4 | 0 | 0 | 10/10 (6 turns) | $0.006 | 75s |
| openai/gpt-6-sol | 1 | 13 | 13 | 0 | 0 | 10/10 (8 turns) | $0.206 | 101s |

## Harvest — 2026-09-22T20:06:49.489Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Dolly Parton

Source: https://en.wikipedia.org/wiki/Dolly_Parton (204815 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 40 | 23 | 17 | 0 | 58% | $0.006 | $0.000 | 40s |
| openai/gpt-6-sol | 40 | 40 | 0 | 0 | 100% | $0.079 | $0.002 | 29s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 23 | 17 | 0 | $0.006 | $0.000 | 40s |
| openai/gpt-6-sol | 1 | 40 | 0 | 0 | $0.079 | $0.002 | 29s |

## Research — Dolly Parton — 2026-09-22T20:07:58.984Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): Beyoncé; Barry Gibb; Jad Abumrad; Dolly Parton-inspired Dress; Hello, I'm Dolly; Love Is Like a Butterfly

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 6 | 5 | 1 | 0 | 10/10 (5 turns) | $0.009 | 122s |
| openai/gpt-6-sol | 1 | 8 | 8 | 0 | 0 | 10/10 (5 turns) | $0.119 | 115s |

## Harvest — 2026-09-22T20:11:57.528Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Mary Wollstonecraft

Source: https://en.wikipedia.org/wiki/Mary_Wollstonecraft (106779 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 23 | 18 | 5 | 0 | 78% | $0.005 | $0.000 | 51s |
| openai/gpt-6-sol | 40 | 39 | 0 | 1 | 100% | $0.089 | $0.002 | 43s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 18 | 5 | 0 | $0.005 | $0.000 | 51s |
| openai/gpt-6-sol | 1 | 39 | 0 | 1 | $0.089 | $0.002 | 43s |

## Research — Mary Wollstonecraft — 2026-09-22T20:13:32.110Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): William Godwin; Virginia Woolf; Elizabeth Cady Stanton; Lucretia Mott; Joseph Johnson; Robert Browning

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 6 | 6 | 0 | 0 | 10/10 (5 turns) | $0.012 | 87s |
| openai/gpt-6-sol | 1 | 8 | 8 | 0 | 0 | 10/10 (5 turns) | $0.182 | 80s |

## Harvest — 2026-09-22T20:16:19.466Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### The Great British Sewing Bee

Source: https://en.wikipedia.org/wiki/The_Great_British_Sewing_Bee (25847 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 14 | 14 | 0 | 0 | 100% | $0.003 | $0.000 | 31s |
| openai/gpt-6-sol | 25 | 25 | 0 | 0 | 100% | $0.057 | $0.002 | 32s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 14 | 0 | 0 | $0.003 | $0.000 | 31s |
| openai/gpt-6-sol | 1 | 25 | 0 | 0 | $0.057 | $0.002 | 32s |

## Research — The Great British Sewing Bee — 2026-09-22T20:17:23.257Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): The Great British Bake Off; Strictly Come Dancing; Joe Lycett's Got Your Back; Making It; Next in Fashion; Kirstie's Handmade Britain

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 4 | 4 | 0 | 0 | 10/8 (6 turns) | $0.007 | 72s |
| openai/gpt-6-sol | 1 | 8 | 7 | 1 | 0 | 10/10 (6 turns) | $0.156 | 93s |

## Harvest — 2026-09-22T20:20:09.839Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Dragan Živadinov

Source: https://en.wikipedia.org/wiki/Dragan_%C5%BDivadinov (5177 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 4 | 4 | 0 | 0 | 100% | $0.001 | $0.000 | 11s |
| openai/gpt-6-sol | 3 | 3 | 0 | 0 | 100% | $0.010 | $0.003 | 6s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 4 | 0 | 0 | $0.001 | $0.000 | 11s |
| openai/gpt-6-sol | 1 | 3 | 0 | 0 | $0.010 | $0.003 | 6s |

## Research — Dragan Živadinov — 2026-09-22T20:20:27.472Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): Academy of Music, Radio, Television and Film; Red Pilot; Scipion Nasice Sisters Theatre; Neue Slowenische Kunst; Makrolab; Krst pod Triglavom – Baptism

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 7 | 7 | 0 | 0 | 10/10 (4 turns) | $0.012 | 125s |
| openai/gpt-6-sol | 1 | 10 | 10 | 0 | 0 | 10/10 (6 turns) | $0.168 | 98s |

## Harvest — 2026-09-22T20:24:12.187Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Rem Koolhaas

Source: https://en.wikipedia.org/wiki/Rem_Koolhaas (31485 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 24 | 22 | 1 | 1 | 96% | $0.005 | $0.000 | 58s |
| openai/gpt-6-sol | 25 | 25 | 0 | 0 | 100% | $0.065 | $0.003 | 32s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 22 | 1 | 1 | $0.005 | $0.000 | 58s |
| openai/gpt-6-sol | 1 | 25 | 0 | 0 | $0.065 | $0.003 | 32s |

## Research — Rem Koolhaas — 2026-09-22T20:25:43.108Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): Virgil Abloh; De Rotterdam; Prada; Harvard University; Denise Scott Brown; Robert Venturi

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 7 | 7 | 0 | 0 | 10/10 (5 turns) | $0.010 | 91s |
| openai/gpt-6-sol | 1 | 13 | 13 | 0 | 0 | 10/10 (5 turns) | $0.179 | 105s |

## Harvest — 2026-09-22T20:29:00.756Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Raphael

Source: https://en.wikipedia.org/wiki/Raphael (71092 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 15 | 13 | 2 | 0 | 87% | $0.005 | $0.000 | 45s |
| openai/gpt-6-sol | 40 | 40 | 0 | 0 | 100% | $0.090 | $0.002 | 39s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 13 | 2 | 0 | $0.005 | $0.000 | 45s |
| openai/gpt-6-sol | 1 | 40 | 0 | 0 | $0.090 | $0.002 | 39s |

## Research — Raphael — 2026-09-22T20:30:25.762Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): Virgin and Child with Saint Anne; Samuel Morse; Rembrandt; Rembrandt; Frank Auerbach; Tom Phillips

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 3 | 2 | 1 | 0 | 10/10 (5 turns) | $0.007 | 67s |
| openai/gpt-6-sol | 1 | 3 | 3 | 0 | 0 | 10/10 (5 turns) | $0.149 | 56s |

## Harvest — 2026-09-22T20:32:30.234Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Tig Notaro

Source: https://en.wikipedia.org/wiki/Tig_Notaro (38246 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 12 | 8 | 4 | 0 | 67% | $0.003 | $0.000 | 57s |
| openai/gpt-6-sol | 22 | 22 | 0 | 0 | 100% | $0.064 | $0.003 | 29s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 8 | 4 | 0 | $0.003 | $0.000 | 57s |
| openai/gpt-6-sol | 1 | 22 | 0 | 0 | $0.064 | $0.003 | 29s |

## Research — Tig Notaro — 2026-09-22T20:33:57.888Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): Contact; John Coltrane; Charlie Parker; This American Life; Ira Glass; Paula Poundstone

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | error: fetch failed | | | | | $0.001 | 101s |
| openai/gpt-6-sol | 1 | 8 | 8 | 0 | 0 | 10/10 (6 turns) | $0.154 | 1519s |

## Harvest — 2026-09-22T21:00:59.478Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|

## Research — Kitsou Dubois — 2026-09-22T21:01:01.404Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): L'Homme de Hus; Hic Hoc; Celui qui tombe; Le Cri du caméléon; Plan B; 2001: A Space Odyssey

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 1 | 1 | 0 | 0 | 10/8 (4 turns) | $0.007 | 62s |
| openai/gpt-6-sol | 1 | 7 | 7 | 0 | 0 | 10/10 (5 turns) | $0.165 | 107s |

## Harvest — 2026-09-22T21:03:51.724Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Issey Miyake

Source: https://en.wikipedia.org/wiki/Issey_Miyake (20961 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 19 | 18 | 0 | 1 | 100% | $0.004 | $0.000 | 38s |
| openai/gpt-6-sol | 29 | 29 | 0 | 0 | 100% | $0.065 | $0.002 | 38s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 18 | 0 | 1 | $0.004 | $0.000 | 38s |
| openai/gpt-6-sol | 1 | 29 | 0 | 0 | $0.065 | $0.002 | 38s |

## Research — Issey Miyake — 2026-09-22T21:05:08.325Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): Elsa Schiaparelli; Miyake Issey Foundation; Miyake Design Studio; Cai Guo-Qiang; Tim Hawkinson; Nobuyoshi Araki

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 7 | 7 | 0 | 0 | 10/6 (4 turns) | $0.008 | 107s |
| openai/gpt-6-sol | 1 | 9 | 9 | 0 | 0 | 10/10 (5 turns) | $0.158 | 80s |

## Harvest — 2026-09-22T21:08:15.873Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Brian De Palma

Source: https://en.wikipedia.org/wiki/Brian_De_Palma (44459 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 29 | 19 | 9 | 1 | 68% | $0.005 | $0.000 | 48s |
| openai/gpt-6-sol | 40 | 38 | 0 | 2 | 100% | $0.082 | $0.002 | 39s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 19 | 9 | 1 | $0.005 | $0.000 | 48s |
| openai/gpt-6-sol | 1 | 38 | 0 | 2 | $0.082 | $0.002 | 39s |

## Research — Brian De Palma — 2026-09-22T21:09:44.383Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): Francis Coppola; Steven Spielberg; Martin Scorsese; Alfred Hitchcock; Domino; Mark Romanek

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 6 | 4 | 2 | 0 | 10/10 (5 turns) | $0.012 | 138s |
| openai/gpt-6-sol | 1 | 10 | 10 | 0 | 0 | 10/10 (5 turns) | $0.157 | 103s |

## Harvest — 2026-09-22T21:13:46.118Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Pablo Neruda

Source: https://en.wikipedia.org/wiki/Pablo_Neruda (77376 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 39 | 28 | 8 | 3 | 78% | $0.006 | $0.000 | 58s |
| openai/gpt-6-sol | 40 | 40 | 0 | 0 | 100% | $0.095 | $0.002 | 44s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 28 | 8 | 3 | $0.006 | $0.000 | 58s |
| openai/gpt-6-sol | 1 | 40 | 0 | 0 | $0.095 | $0.002 | 44s |

## Research — Pablo Neruda — 2026-09-22T21:15:29.114Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): Walt Whitman; Francisco Castillo Najera; Communist Party of Chile; Octavio Paz; David Alfaro Siqueiros; Pablo Picasso

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 3 | 3 | 0 | 0 | 10/9 (5 turns) | $0.010 | 64s |
| openai/gpt-6-sol | 1 | 9 | 9 | 0 | 0 | 10/10 (6 turns) | $0.129 | 80s |

## Harvest — 2026-09-22T21:17:53.913Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

### Kali Uchis

Source: https://en.wikipedia.org/wiki/Kali_Uchis (50299 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 40 | 28 | 12 | 0 | 70% | $0.006 | $0.000 | 55s |
| openai/gpt-6-sol | 40 | 40 | 0 | 0 | 100% | $0.082 | $0.002 | 34s |

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 28 | 12 | 0 | $0.006 | $0.000 | 55s |
| openai/gpt-6-sol | 1 | 40 | 0 | 0 | $0.082 | $0.002 | 34s |

## Research — Kali Uchis — 2026-09-22T21:19:23.722Z

Models: openai/gpt-6-luna, openai/gpt-6-sol

Targets (6): Coachella 2024 performance; Mariah the Scientist; Childish Gambino; Jennie; JT; El Alfa

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-6-luna | 1 | 8 | 6 | 2 | 0 | 10/8 (4 turns) | $0.009 | 84s |
| openai/gpt-6-sol | 1 | 9 | 9 | 0 | 0 | 10/10 (5 turns) | $0.188 | 83s |

## Luna vs Sol on 20 graph subjects — reading + hunting (Tony-approved cap $6; spent $5.00)

Question: does Luna's lower recall matter, or is it filler? 20 subjects across 11 domains (none from earlier rounds), each subject's Wikipedia page read by both models and each subject's interview hunt run by both, same gates. 18 subjects fully paired on each job (Kitsou Dubois's page fetch failed; Luna's Tig Notaro hunt died on a fetch).

| | Luna | Sol | shared | Sol found, Luna missed | Luna found, Sol missed |
|---|---|---|---|---|---|
| Wikipedia reading: confirmed claim pairs, 18 pages | 345 (+87 rejected) | 586 (0 rejected) | 193 | **393** | 152 |
| Interview hunting: confirmed citations, 18 subjects | 87 | 162 | — | — | — |
| Interview hunting: targets with ≥1 confirmed citation | 68 | 129 | 48 | **81** | 20 |

Cost, per subject for reading + hunting: **Sol $0.26** ($0.075 page + $0.18 hunt); **Luna $0.014**. Over the remaining 770 subjects: Sol ~$196, Luna ~$11.

**Read-out.** Luna alone captures about 47% of the page claims and 46% of the interview citations that Sol does, and it leaves 81 of Sol's 129 covered targets with no citation at all. The misses are spread across every subject (Sol out-found Luna on 17 of 18 pages and 18 of 18 hunts), so "Luna first, Sol for the gaps" would still mean running Sol on essentially every subject — it saves nothing. The $185 difference buys roughly twice the graph. Luna's 87 rejected page claims (vs Sol's 0) are paraphrases the wall correctly threw out; Sol copied quotes exactly every time.

**The cheap win is the opposite direction:** on reading, Luna found 152 confirmed pairs Sol did not. Running both on every page costs Sol + ~$0.005 and yields ~26% more confirmed claims (738 vs 586). Same "union" idea does not hold for hunting (Luna-only targets: 20 of 149).

Recommendation stands: Sol for reading and hunting, Luna for maps; optionally Luna as a second reader on every page for the extra 26%.
