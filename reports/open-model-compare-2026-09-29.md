# Open-model comparison — 2026-09-29

Approved by Tony 2026-09-16 (budget <$10). Same prompts, same schemas, same deterministic gates for every model; dry run, nothing persisted. Open models via OpenRouter (`usage.cost` receipts); Claude via Anthropic (sticker-price math).

## Harvest — 2026-09-29T06:09:15.873Z

Models: claude-sonnet-5-5

### Radiohead

Source: https://en.wikipedia.org/wiki/Radiohead (141605 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
  - claude-sonnet-5-5 golden: PASS, 0 violations
| claude-sonnet-5-5 | 13 | 13 | 0 | 0 | 100% | $0.072 | $0.006 | 14s |

Recall overlap vs Sonnet 5 (34 confirmed pairs):
- claude-sonnet-5-5: reproduces 8/34 of Sonnet's confirmed pairs, adds 5 Sonnet didn't find

### The Godfather

Source: https://en.wikipedia.org/wiki/The_Godfather (129784 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
  - claude-sonnet-5-5 golden: PASS, 0 violations
| claude-sonnet-5-5 | 8 | 7 | 0 | 1 | 100% | $0.065 | $0.009 | 7s |

Recall overlap vs Sonnet 5 (24 confirmed pairs):
- claude-sonnet-5-5: reproduces 3/24 of Sonnet's confirmed pairs, adds 4 Sonnet didn't find

### Kendrick Lamar

Source: https://en.wikipedia.org/wiki/Kendrick_Lamar (214062 chars of text)

| model | extracted | confirmed | rejected | shape-dropped | gate pass | cost | $/confirmed | time |
|---|---|---|---|---|---|---|---|---|
  - claude-sonnet-5-5 golden: PASS, 0 violations
| claude-sonnet-5-5 | 17 | 17 | 0 | 0 | 100% | $0.080 | $0.005 | 14s |

Recall overlap vs Sonnet 5 (21 confirmed pairs):
- claude-sonnet-5-5: reproduces 9/21 of Sonnet's confirmed pairs, adds 8 Sonnet didn't find

### Harvest totals

| model | pages | confirmed | rejected | dropped | total cost | $/confirmed | avg time |
|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 3 | 37 | 0 | 1 | $0.217 | $0.006 | 12s |

## Research — Radiohead — 2026-09-29T06:10:02.241Z

Models: claude-sonnet-5-5

Targets (6): Beyoncé; Geese; Ennio Morricone; Vampire Weekend; In Rainbows; The Bends

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 1 | 5 | 3 | 0 | 2 | server-side | $0.280 | 126s |

## Research — Breaking Bad — 2026-09-29T06:12:10.075Z

Models: claude-sonnet-5-5

Targets (5): NYPD Blue; The Americans; Matt Brennan; The Sopranos; Matthew Weiner

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 1 | 0 | 0 | 0 | 0 | server-side | $0.174 | 68s |
| claude-sonnet-5-5 | 2 | 0 | 0 | 0 | 0 | server-side | $0.162 | 68s |

## Research — Talking Heads — 2026-09-29T06:14:27.438Z

Models: claude-sonnet-5-5

Targets (6): Radio Head; Remain in Light; Speaking in Tongues; True Stories; Tibor Kalman; MIT Media Lab

| model | attempt | findings | T2 confirmed | unverifiable | dead link | searches/fetches | cost | time |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 1 | 7 | 6 | 1 | 0 | server-side | $0.238 | 97s |

## Summary: Sonnet 5.5 (written 2026-09-29; Tony-approved $4, spent $1.07)

Same harness, prompts, and gates as 2026-09-22; Sonnet 5.5 run at Sonnet 5's effort settings (harvest "medium", research "high"). Sonnet 5.5's effort levels are recalibrated relative to Sonnet 5 and weren't swept here.

| Job | Sonnet 5 | Sonnet 5.5 | GPT-6 Sol |
|---|---|---|---|
| Wikipedia reading, 3 benchmark pages | 75–81 confirmed, 74–85% of quotes real, ~$0.37 | 37 confirmed, 100% real, 0 trap failures, $0.22 | 108 confirmed, 100%, $0.27 |
| Interview hunting (Radiohead, Breaking Bad, Talking Heads) | 4 confirmed on 2 subjects, ~$1.02/subject | 9 confirmed (3 / 0 / 6), $0.28/subject; Breaking Bad empty twice | 28 of 28, $0.17/subject |

Read-out: Sonnet 5.5 is more accurate and much cheaper at hunting than Sonnet 5, but it finds about a third of what Sol finds on both jobs, and costs more per subject (~$0.35 vs ~$0.26 for reading plus hunting). Breaking Bad still comes back empty, as it did for Sonnet 5. Doesn't change the standing recommendation.
