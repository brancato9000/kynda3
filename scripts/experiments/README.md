# scripts/experiments

One-off builds and probes that wrote rows or produced pages. The rule (2026-09-16): **if it wrote a row, it lives in git** — never in a session scratchpad, which is wiped between sessions. Durable, reusable tooling stays in `scripts/`.

Every script here loads `.env.local` from the repo root and derives the root from its own location, so it runs from anywhere:

```bash
node scripts/experiments/<name>.mjs [args]
```

| Script | What it did | Run record |
|---|---|---|
| `intersection-map-build.mjs` | Two Spotify exports → one shared-ancestry page (common spine, common roots, listening together, ratio handoffs, `--subtract` a household member) | RUNS.md 2026-08-16 → 08-19 |
| `import-beyonce-2022.mjs` | Tony's 2022 spreadsheet → 568 human-curated claims, quote-wall re-verified against live Wikipedia | RUNS.md 2026-08-17 |
| `clayden-build.mjs` | Pauline Clayden: QID-first entity, Wikipedia harvest, NYT obituary text-in-hand, Opus mix with curated context | RUNS.md 2026-08-19 |
| `demo-three-build.mjs` | Ghostbusters build + generation-time media on Bowie / Chappelle / Ghostbusters (`--media-only` to skip generation) | RUNS.md 2026-09-14 |
| `smoke-subjects.mjs` | Stored-mix health per subject: cards per slot, verification tiers, media coverage | — |
| `media-gaps.mjs` | Lists cards on named subjects that carry no image or preview | — |
| `probe-article-image.mjs` | Replays the Wikipedia article-image lookup with full logging, no writes — the V3-83 autopsy tool | DECISIONS V3-83 |

Lost with the scratchpad and not yet rebuilt: the personal listening-map builder (walk v3, Rising, household subtraction, polyglot noise filter) — BACKLOG #14.
