# Kynda v3

Contextual recommendation engine mapping the influences, connections, and legacy of any work of culture — rebuilt from scratch on a truth-first architecture. See [REBUILD_PLAN.md](REBUILD_PLAN.md) for the full architecture and [DECISIONS.md](DECISIONS.md) for the v3 decision log.

**Core principle: confidence is machine-assigned provenance, never model self-report.** The word "verified" is only ever awarded by deterministic code — a structured-database match or a fetched-and-string-matched quote — regardless of which model produced the claim.

## Status: Phase 0 (Foundation)

What exists now:
- **Database schema** ([db/migrations/001_initial_schema.sql](db/migrations/001_initial_schema.sql)) — entities, claims, provenance, reviews, research queue. The schema is the Phase 0 deliverable: it encodes the provenance model in SQL, including a view that derives claim confidence from verification records.
- **Eval harness** ([eval/](eval/)) — golden set of subjects with verified canonical IDs, true attributions, trap attributions (seeded from kynda2's CORRECTIONS.md), and self-reference traps. Measures entity error rate before any pipeline exists.
- **Entity clients** ([src/lib/entities/](src/lib/entities/)) — MusicBrainz and Wikidata resolution and tuple verification (rate-limited, deterministic).
- **Quote verifier** ([src/lib/verify/quoteMatch.js](src/lib/verify/quoteMatch.js)) — the load-bearing wall: normalize-and-string-match. It must stay dumb; see DECISIONS V3-03.
- **Design tokens** ([src/design/tokens.js](src/design/tokens.js)) — ported from kynda2 (slot taxonomy, colors, fonts, graph palette).

Not yet here (Phase 1+): the Next.js app, runtime pipeline, research agents.

## Commands

```bash
npm run eval           # full eval: golden validation, verifier self-tests, live entity/tuple checks (~1 min, hits MusicBrainz/Wikidata)
npm run eval:offline   # skips network stages; runs in <1s
npm run migrate        # applies db/migrations/*.sql (requires DATABASE_URL)
```

## Golden set honesty rule

Machine-checkable golden data (canonical IDs, attribution tuples) was verified against live MusicBrainz/Wikidata when authored. Influence facts (`influence_facts`) ship with `human_confirmed: false` until a human reviews them — the eval harness treats unconfirmed facts as advisory, never as ground truth. Flip the flag only after checking the fact yourself.
