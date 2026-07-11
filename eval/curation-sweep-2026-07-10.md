# Pre-launch curation sweep — 2026-07-10

**Scope:** every card served from stored mixes — 398 cards across 23 subjects (all of them: the pilot 16 plus Radiohead, Björk, Talking Heads, Lazlo Bane, Alex Warren, second Sinatra, Lauryn Hill album). Four independent reviewers, each judging whether the receipts shown on a card actually support the prose a visitor reads. Context: kynda.ai public launch ahead of the Brown pitch (Providence, July 27).

**Headline:** the honesty architecture works — synthesis-labeled cards are honestly labeled, `documented_via` two-hop receipts render correctly, failed attributions display "✕ failed fact-check." The problems are concentrated in (1) a name-collision bug in the connection-excerpt matcher that produces receipts about the *wrong entity*, (2) ~8 cards with degenerate prose that escaped the V3-23 gate, and (3) a handful of factual errors and direction flips in reason prose. Roughly 30 cards need action before the outreach emails go out; the rest is opportunistic improvement.

**Methodology note / correction:** four cards initially flagged as "documented_via with no evidence behind the chip" (Godfather: Manhattan, 8½, Dog Day Afternoon; Bowie: Electric Warrior) were false alarms — the dump script driving the review omitted `hop1`/`hop2`. Verified in the DB: all four carry complete two-hop receipts. Struck.

---

## A. LAUNCH BLOCKERS

### A1. Wrong-entity receipts (name-collision excerpt matching) — 9 cards, all severity-high

The connection matcher accepted any Wikipedia sentence containing the subject's name string. On short/common names it matched the wrong entity entirely:

| Subject | Card | What the receipt actually documents |
|---|---|---|
| Prince | The Hissing of Summer Lawns — Joni Mitchell | The town **Prince Albert, Saskatchewan** |
| Prince | A Wizard, a True Star — Todd Rundgren | Tubes drummer **Prairie Prince** |
| Prince | Thriller — Michael Jackson | **MJ's son Prince**, born 1997 |
| Fela Kuti | Music of Many Colours — Roy Ayers | A **Paul McCartney** anecdote about the Shrine |
| Frank Sinatra | Body and Soul — Billie Holiday | Arrangement styles "associated with Sinatra and Ella" — nothing about Holiday influencing him |
| Frank Sinatra | Come Rain or Come Shine — Judy Garland | Sinatra **punching Garland's publicist** (on a *friendship* card) |
| Frank Sinatra | A Place in the Sun — George Stevens | Sinatra quitting a **different** Stevens film |
| Portishead | New Forms — Roni Size | A Reprazent **band-member roster**; Portishead never appears |
| Dolly Parton | 9 to 5 — Colin Higgins | An **unmade 1986 script** ("Washington Girls"), not the film |

Adjacent case: Dolly Parton / Jean Ritchie — excerpt is from Ritchie's article and never mentions Parton.

**Structural fix:** excerpt acceptance must require BOTH endpoints of the claim to appear in/around the matched passage (or pass an entity-disambiguation check), not just the subject's name string. Each row above becomes an eval case. Until the matcher is fixed, these ten cards should have their connection receipts pulled (they'll fall back to the honest synthesis chip).

### A2. Degenerate/corrupted prose that escaped the V3-23 gate — 8 cards

- David Bowie / The Velvet Underground & Nico — ends "…Transformer in 1972.rock's decadent theatre.g Reed's Transformer in 1972."
- Zaha Hadid / Black Square (Malevich) — mid-sentence garble, trails "— foundational. … Truly. Yes. ."
- Alex Warren / Take Me to Church (Hozier) — ends "…cresting on radio.rst wave.rst.rrr.rrrr...rr.r.rrr"
- Frank Sinatra / Where the Blue of the Night (Crosby) — trails "Essential starting point. Listen. . . ."
- Frank Sinatra / White Christmas (Crosby) — orphaned trailing period fragment
- Prince / Sign o' the Times — garbled track reference; also names a nonexistent Prince song ("It's Gonna Be a Lonely Christmas" is a 1948 Orioles song; the live-horns track is "It's Gonna Be a Beautiful Night")
- Doechii / Miseducation (Lauryn Hill) — editorial meta-text leaked into visitor prose: "(Connection: documented in her press-cycle interviews.)"
- Neutral Milk Hotel / "In the Aeroplane Over the Sea (album production) — The Apples in Stereo (1995)" — malformed self-referential card: names the subject's own album, attributes it to another band, wrong year. Prose describes Fun Trick Noisemaker. **Hide or rebuild.**

**Structural fix:** these predate or evade the current `sanitizeReason()` patterns. (a) Run sanitizeReason over all stored payload prose (pure string logic, zero tokens) and extend its patterns to catch single-char repetition runs ("rrr."), orphaned-period trails, and parenthetical editorial asides; (b) add each live string as an eval case.

### A3. Factual errors / fabrications in served prose — 8 cards

| Card | Error | Reviewer confidence |
|---|---|---|
| Björk / LP1 (FKA twigs) | Claims a Björk–twigs duet "Fungal City" on Fossora — that feature is **serpentwithfeet**; duet appears fabricated | high |
| Radiohead / "Mount Vernon and Fairway — Miles Davis (1998)" | Not a Miles Davis work — it's a 1973 **Beach Boys** EP; artifact fabricated (attribution already not_found) | high |
| NMH / "The Rat-Catcher's Beam — A Hawk and a Hacksaw (2018)" | No such release known (their 2018 album is Forest Bathing); attribution not_found | medium-high |
| Lazlo Bane / Business as Usual | "Diamond-selling" — it's 6× platinum US | high |
| Portishead / In a Silent Way | "Sampled Miles Davis directly" — the Dummy sample is Weather Report | high |
| Richard Pryor / Redd Foxx | Claims Pryor appeared in "Norman… Is That You?" — he didn't | medium-high |
| NMH / Funeral (Arcade Fire) | Claims Jeremy Barnes contributed to Funeral's recordings — he briefly drummed live, likely not on the record | medium |
| Kendrick / TPAB | "Won five Grammys" — Kendrick's five-win night included the Bad Blood video; TPAB-tied wins were four | medium |

Also two internal contradictions: Prince/Sheila E. (prose says met 1978, its own receipt says 1977); Portishead/Vertigo prose says "a documented reference point" while the connection field is undocumented (synthesis chip).

### A4. Direction errors — 3 cards

- Alex Warren / Daylight (David Kushner): receipt says Kushner **influenced Warren**; the legacy card claims the reverse. Receipt and chronology agree with each other, against the prose.
- Alex Warren / Austin (Dasha): "post-Warren normalization" — Austin (early 2024) predates Ordinary (2025).
- Doechii / Mani/Pedi (Baby Tate): framed as Doechii's legacy; Baby Tate was established first — peers, not descendants.

### A5. Serving policy for attribution-failed cards — decision needed

Cards where the artifact itself failed attribution (`not_found`) AND the connection is undocumented have **zero verified anchors** — and the three likely-fabricated artifacts above all sit in this bucket. The pipeline signal already exists; the UI serves them anyway (with the ✕ chip). Recommendation: suppress cards with `attribution: not_found` + undocumented connection at serve time. The ✕ chip is honest, but an *invented artifact* is a different failure class than an unverified year — it's exactly what a skeptical academic will screenshot beside our "receipts-first" claim.

---

## B. NON-BLOCKERS (opportunistic, mostly harvest fodder)

### B1. Synthesis-labeled cards with receipt-toned prose (~25 cards)
The synthesis chip is honest, but prose like "has named," "widely cited," "have long acknowledged," "critics routinely paired" *asserts that documentation exists* while showing none. Worst offender: Portishead/Vertigo ("a documented reference point"). Options per card: reword to own the synthesis voice, or re-source (B2). Cards flagged: Talking Heads (Bloc Party, Gang of Four, Pere Ubu), Kraftwerk (Russolo), NMH (Titus Andronicus, Elliott Smith), Mitski (Simpsons, Samia), FotC (Monty Python), Kendrick (Saba, JID), Portishead (Jungle, Burial, Vertigo), Morrison (Whitehead, Ward), Doechii (Whack), Bowie (Silver Apples), Björk (Stalker, twigs), Zaha Hadid (Boccioni "openly mined"), Dolly (Carlile, Yearwood), Sinatra (Heifetz), Alex Warren (Switchfoot "the lineage is direct").

### B2. Famous, trivially sourceable claims served bare — prime harvest targets (~20 cards)
Kendrick/2Pac ("Mortal Man"), Miseducation/Carter G. Woodson (the literal title source), Radiohead/No Logo, Lazlo Bane/Scrubs (the most documentable fact in its mix), Prince/The Time (Jamie Starr), Kraftwerk/Metropolis, Fela/Autobiography of Malcolm X (Sandra Izsadore story), Alex Warren collaborator credits (Cal Shapiro, ROSÉ duet), Talking Heads/Al Green (Take Me to the River), Sinatra/From Here to Eternity, Portishead/Isaac Hayes (Glory Box) + Maxinquaye, Miseducation/Drake sample credit, Dolly/Brandi Carlile (Newport 2019), Fela/Red Hot + Riot, Zaha Hadid/MAD Architects (Ma Yansong at ZHA), Bowie/A Clockwork Orange, Radiohead/alt-J, Toni Morrison/Ellison ("invisible to whom?"), NMH/Titus Andronicus. One harvest batch over the subjects' Wikipedia pages + a few obvious interviews would attach receipts at ~$0.007/citation.

### B3. Receipt rendering quality
- Truncated excerpt fragments render as visible junk: Sinatra/Dorsey ("3 in 1941)…"), Miseducation/D'Angelo ("Blige, and D'Angelo."), NMH/Shaggs, Kendrick/Illmatic ("…Eminem, Dr."), Kraftwerk/La Düsseldorf (a raw "== See also ==" nav list). Excerpt extraction should expand to sentence boundaries and reject nav/list content.
- Reused excerpts across sibling cards (Portishead's two Massive Attack cards; Alex Warren's Boone/Kushner cards) read as lazy on click-through.
- Right-fact-wrong-story receipts (WEAK, ~35 cards): receipt proves the relationship exists but not the specific mechanism the prose narrates (NMH/Shaggs tour-support vs influence; Godfather/On the Waterfront Kazan-as-replacement vs Brando casting; Doechii/Missy feature-credit vs formative influence; Bowie/The Idiot Ziggy-era receipt on a 1977 production card). Fix is per-card: reword prose to the evidence, or re-source.

### B4. Data hygiene
- **Frank Sinatra exists as 3 entities, 2 with mixes** — `/s/frank-sinatra` resolves by raw UUID order (app/s/[slug]/page.jsx:16 `.find()` over `listSubjects()` ordered by e.id), currently landing on the *non-canonical* duplicate (kind=other, no MBID). Only slug collision in the corpus. Fix: merge the Sinatra entities (canonical = person/MBID row); belt-and-suspenders: make resolveSlug prefer canonical-ID'd, non-'other' entities.
- Radiohead & Björk still serve old `entries`-format single-candidate mixes (8 cards vs ~16-23) — consider regenerating for consistency (~$0.60 total).

---

## Recommended fix order (before July 27 outreach emails)

1. **Zero-token, same-day:** pull the 10 wrong-entity receipts (A1) so cards fall back to synthesis chip; hide/suppress the 3 fabricated-artifact cards + NMH self-referential card (A5); sanitizeReason pass over stored prose (A2); Sinatra entity merge + slug preference (B4).
2. **Cheap curation edits:** A3 factual fixes and A4 direction fixes via /admin or direct payload edits — prose rewording, no generation.
3. **Structural (code):** excerpt matcher endpoint check + eval cases from A1; sanitizeReason pattern extensions + eval cases from A2; attribution-gate serve policy (A5).
4. **Harvest batch (needs $ approval, ~$1-3 est.):** B2's ~20 sourceable claims + Brown-demo subjects — receipts where a Brown click is most likely.
5. **Optional:** regenerate Radiohead/Björk mixes ($0.60); B1 prose rewording pass.

Suggested DECISIONS entry: V3-30 — excerpt matching requires both claim endpoints; attribution-failed + undocumented cards are not served; sweep-derived eval corpus added.
