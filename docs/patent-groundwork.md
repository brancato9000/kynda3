# Patent groundwork — The Influence Project / Kynda

Prepared 2026-08-06 for the backlogged item in [PITCH.md](../PITCH.md) ("Divergences —
RESOLVED" #4: nothing filed yet; Tony wants to pursue). Research basis: the v3
decision log ([DECISIONS.md](../DECISIONS.md)), the 2024 deck material captured in
PITCH.md, and a web prior-art scan run 2026-08-06 (Google Patents, USPTO, secondary
coverage).

> **This is groundwork for patent counsel, not legal advice.** Nothing here is an
> opinion of patentability, freedom to operate, or validity. Patent status labels
> below are as shown on Google Patents and unverified against USPTO records.
> Applications filed within the last ~18 months are unpublished and invisible to any
> web scan. A registered patent attorney should re-run every search and make every
> judgment call before anything is filed or relied on.

---

## 1. Candidate patentable subject matter

Three candidates, in Tony's order of interest (PITCH.md names the first two; the
third is the substrate both sit on).

### Candidate A — the influence-biography narrative format

The Phase 4 pilot that already exists: a biography told through the lens of
influence — an artist (the pilot's subject is modeled on Beyoncé) walks through
their own influence graph, then artists they inspired speak about them as an
influence. The format is the two-movement structure: upstream (what made them),
then downstream (what they made possible), with the influence graph as the
narrative spine.

### Candidate B — the deterministic verification pipeline

The anti-hallucination architecture, whose load-bearing rules are in the decision
log:

- **Model proposes, machine disposes** (V3-03, V3-18): a generative model proposes
  influence claims, each as a typed assertion with an artifact (URL + exact quote,
  or a catalog identity). Verification is *exclusively* deterministic code —
  normalize-and-string-match for quotes, exact structured-catalog lookups
  (MusicBrainz, Wikidata, TMDb, Open Library) for attributions. No model ever sits
  in the verification path.
- **Machine-assigned confidence** (V3-02): confidence tiers (`verified` / `sourced`
  / `inferred`) are derived from provenance records by deterministic rules, encoded
  in the database itself (the `claim_state` view). Models never self-assign
  confidence — designed after the canonical failure where a model stamped its own
  wrong attribution "verified."
- **Two provenance layers per claim** (V3-13): *attribution* (does this creator
  have this work? — catalog lookup) and *connection* (is the influence documented?
  — deterministic Wikipedia cross-mention with the actual sentence extracted and
  displayed).
- **Asymmetric verifier authority** (V3-13, V3-48, V3-50): weak verifiers
  (description matches) may *award* "verified" but never convict — a miss maps to
  "unchecked," not "failed." Strong verifiers (exact catalog matches) may convict,
  and conviction requires the catalog to name a genuinely *different* creator,
  gated by a same-medium candidate check. A near-name variant (Latinization
  tolerance, alias matching) is never a conviction (V3-59).
- **Bounded multi-hop verification** (V3-16): when a direct check fails but the
  model names an intermediate (`via`), the machine verifies each hop of the chain
  deterministically, capped at one intermediate.
- **Symmetric ingestion** (V3-26, V3-35): fan-contributed evidence passes the same
  deterministic gate as agent findings — the pipeline is source-agnostic.

### Candidate C — the influence-graph data structure

- Typed, directional claims between creative entities: influence, anti-influence,
  contemporary, collaborator, successor, covers, plus institutional lineage
  (`studied_under`, `taught_at`, `founded`) and creatorship (`created_by`) edges —
  with the structural axioms that influence attaches to the most specific
  documented locus, aggregation is a view and never a claim (V3-49), and an artist
  cannot influence themselves (V3-63, enforced as a graph constraint).
- **Edge-level verified provenance**: every edge can carry, as first-class records,
  verbatim source quotes + URLs that were themselves mechanically verified against
  the source at ingest, with speaker attribution and a source-degree ladder
  (artist's own words > critical > fan, attached to the speaker, not the venue —
  V3-21).
- **Evidence-weighted computation over the graph**: candidate ranking and shortest-
  path traversal (V3-19, V3-41) weight edges by provenance class deterministically
  (quote-confirmed 1, db-confirmed 1.2, bare synthesis 3), so a longer documented
  path beats a shorter undocumented leap by construction; node size and default
  carousel position are recomputed from evidence on every serve.

---

## 2. Honest §101 assessment (Alice and after)

Framework: *Alice Corp. v. CLS Bank* (2014) — step 1: is the claim directed to an
abstract idea (math, organizing human activity, mental processes)? step 2: if so,
is there an inventive concept beyond generic-computer implementation? What survives
in current Federal Circuit practice is claims reciting a *specific technical
mechanism* that improves computing or a technological process (*Enfish*, *McRO*,
*KPN v. Gemalto*); what dies is data-collection-analysis-display on generic
hardware (*Electric Power Group*) and business/content logic with a computer
overlay.

Two 2024–2026 developments cut in opposite directions and both matter here:

- **The USPTO is currently friendlier than the courts.** The July 2024 AI
  eligibility guidance (Examples 47–49) rewards claims that integrate an AI step
  into a concrete technical pipeline; *Ex parte Desjardins* (precedential, Nov.
  2025) held improvements to an ML training process eligible; Dec. 2025 memoranda
  let applicants rebut §101 rejections with technical-evidence declarations, and
  §101 rejection rates dropped sharply in late 2025.
- **The Federal Circuit did not move.** *Recentive v. Fox* (Apr. 2025, cert denied
  Dec. 2025): applying generic ML to a new data environment is ineligible absent an
  improvement to the ML itself. Commentators describe the PTO and the court as
  operating under materially different §101 frameworks — **a patent allowed under
  current PTO practice still carries real litigation-invalidation risk.**

### Candidate A: not patentable — plan around it, not through it

A narrative/documentary format is unpatentable on three independent grounds: it is
an abstract idea (organizing human activity / the content of information — cf.
*Ultramercial v. Hulu*, an 11-step media method, ineligible); the printed-matter
doctrine gives no patentable weight to communicative content (*Praxair*, *In re
Distefano*); and copyright's idea/expression dichotomy (§102(b), *Baker v. Selden*)
independently confirms formats-as-such are ideas. TV-format copyright suits have
repeatedly failed (*CBS v. ABC*, the Survivor case).

What actually protects it:

- **Copyright** in everything fixed: the pilot episode, script, treatment, format
  bible, graphics. Register the pilot with the Copyright Office (cheap, fast, and a
  prerequisite for a US infringement suit).
- **Trademark** on the series title and marks, as entertainment services.
- **Format-rights trade practice**: a written format bible, NDAs before pitching,
  option/license agreements — how the television industry actually transacts
  formats, contractually rather than by statute.
- Any *software* that drives the format (the engine selecting who appears, from the
  graph) is Candidate B/C territory, analyzed separately.

**Recommendation to bring to counsel: spend zero patent dollars on the format
itself; spend a few hundred on copyright registration and keep the bible under
NDA.**

### Candidate B: the strongest candidate — and still a genuine fight

The abstract-idea characterization writes itself: "fact-checking a statement
against reference sources" sounds like a mental process a librarian performs. The
Myslinski fact-checking family and IBM's assertion-verification patent (below) show
examiners have allowed claims in the neighborhood, but the Federal Circuit's
verification cases split exactly on specificity: *KPN v. Gemalto* (specific
mechanism improving a data-check process) survived; "verify/validate the data" at
result level (*Content Extraction*, *Universal Secure Registry*) did not.

What gives B a real §101 story, if the claims are drafted on the mechanism:

- The claimed improvement is *to the computing process itself*: a generative
  system's outputs are made trustworthy by an architecture in which the generative
  component is structurally excluded from verification — a specific, articulable
  solution to a problem (LLM confabulation) that exists only in computing.
  Post-*Desjardins*, "an improvement to the reliability of an ML pipeline" is a
  recognized eligibility frame at the PTO.
- The distinctive mechanics are concrete and claimable: the deterministic
  normalization + exact-match gate; tier derivation as a pure function of
  provenance records; the two-layer attribution/connection check; the bounded
  `via`-chain verification; and above all the **asymmetric verifier authority
  lattice** (award-only vs. convict-capable, same-medium conviction gate,
  near-name never convicts) — the prior-art scan found *nothing* like it.
- Drafting tension to flag for counsel: "no model in the verification path" is a
  negative limitation. The application should carry it on the back of positive,
  specific mechanics (normalization pipeline, catalog-key resolution, quote-offset
  recording, the tier function) rather than as the naked absence of a model.
- The eval harness matters as evidence: measured badge rates, the trap-attribution
  golden set, and the conviction-safety cases are exactly the kind of
  technical-improvement evidence the Dec. 2025 SMED practice invites.

**Risk, honestly: moderate.** Allowance under current PTO practice is plausible if
claimed at the mechanism level; surviving a district-court §101 challenge under the
Federal Circuit's current case law is genuinely uncertain. Counsel should also
weigh the trade-secret alternative — post-*Recentive* commentary (WilmerHale)
explicitly pushes AI pipelines toward secrecy — though most of this pipeline is
observable from the product's own honesty (badges, receipts, displayed quotes), so
secrecy is a poor fit for the parts that face users.

### Candidate C: middle risk — *Enfish* is the anchor, *Erie* is the ditch

A data-structure claim survives when the structure itself is a specific improvement
to how the computer works (*Enfish*, self-referential table: faster search, less
memory) and fails when it is "use a database to organize information" (*IV v. Erie
Indemnity*, tag-based index; *BSG Tech*, self-evolving index). A bare "graph of
influence edges" claim is on the wrong side of that line — influence charts predate
computers. The claimable substance is the composition: typed directional edges
whose *provenance is a first-class, mechanically verified record*, with
deterministic evidence-weighting driving traversal and ranking. The scan found no
patent claiming edge-level verified provenance (verbatim quote + URL, verified at
ingest) as a graph primitive. Best treated not as a standalone filing but as the
structural half of the Candidate B application — the claims recite the pipeline
writing into, and computing over, this structure.

### The framing to avoid everywhere

**Do not claim this as a recommendation engine.** "Collect signals → match →
recommend" is the Federal Circuit's most consistently killed genre (*Broadband iTV
v. Amazon* 2024, *Affinity Labs*, *IV v. Capital One*, *Free Stream Media*,
*Trinity Info Media*) — and with ML added, *Recentive* closes the loop. The
recommendation surface is where Kynda's *commercial* value lives, but the
*patentable* value lives in the verification pipeline and the evidence-bearing
graph. The spec can note that recommendation is one application; the claims should
never lead with it.

---

## 3. Prior-art scan

Run 2026-08-06 via web search over Google Patents, USPTO full-text, Justia, and
secondary coverage. Status labels unverified; not an FTO search.

### Most relevant patents found

| Patent | Assignee | Filed | What it claims | Status |
|---|---|---|---|---|
| [US 7,750,909](https://patents.google.com/patent/US7750909B2/en) — Ordering artists by overall degree of influence | Sony | 2006 | Directed artist-influence graph; recursive influence propagation to rank artists | **Active to ~Dec 2027** |
| [US 7,961,189](https://patents.google.com/patent/US7961189B2/en) — Displaying artists related to an artist of interest | Sony | 2006 | Influence-graph visualization, node size = influence weight | Lapsed (fee) |
| [US 8,260,787](https://patents.google.com/patent/US8260787B2/en) — Multiple integrated recommenders | Amazon | 2007 | Recommenders emit item + reason pairs ("because you purchased…") | **Active to ~2028** |
| [US 12,353,469](https://patents.google.com/patent/US12353469) — Verification and citation for language model outputs | Amazon | 2024 | RAG pipeline; *numerical* outputs verified by DB queries; auto-generated citations | **Granted Jul 2025, active** |
| [US 11,620,441](https://patents.google.com/patent/US11620441B1) — Inserting citations into a textual document | Clearbrief | 2022 | Quote-to-source matching; exact match earns top confidence, model scores the rest | **Active** |
| [US 8,229,795](https://patents.google.com/patent/US8229795B1/en) — Fact checking methods (+ ~24-member family) | Myslinski → Microsoft | 2011 | Compare statements against sources, indicate validity in real time | Head expired; **family has live members** |
| [US 10,606,849](https://patents.google.com/patent/US20180060733A1/en) — Confidence scores for knowledge-graph relationships | IBM | 2016 | ML-learned confidence scoring of extracted relation tuples from provenance-ish features | Lapsed (fee) — still §103 art |
| [US 9,483,582](https://patents.google.com/patent/US9483582B2/en) — Verification of factual assertions in natural language | IBM | 2014 | Parse assertion → search corpus → aggregate evidence → true/false/inconclusive | Active to ~2034 |
| [US 8,682,913](https://patents.google.com/patent/US8682913) — Corroborating facts from multiple sources | Google | 2005 | Cross-source statistical corroboration of extracted facts (Knowledge Vault lineage) | Active per Google Patents |
| [US 10,607,273](https://patents.google.com/patent/US10607273) — Explanations for recommended content | Google | 2016 | Generates justification strings displayed with recommendations | Active to ~2037 |
| [US 7,003,515](https://patents.google.com/patent/US7003515B1/en) — Music Genome / consumer item matching (+ family) | Pandora | 2001 | Songs as analyst-scored gene vectors; weighted-distance matching | **Entire family expired** |
| [US 6,266,649](https://patents.google.com/patent/US6266649B1/en) — Item-to-item collaborative filtering | Amazon | 1998 | The foundational CF patent | Expired |
| [US 10,540,385](https://patents.google.com/patent/US10540385B2/en) — Taste profile attributes (+ Echo Nest family) | Spotify | 2013 | Higher-order taste attributes from play/affinity statistics | Active to ~2035 |
| [US 8,626,711](https://patents.google.com/patent/US8626711B2/en) — Correlating objects by typed relationships incl. "influenced by" | Mooney (indiv.) | 2011 | Weight propagation over typed connection DB, narrative-form output chains | Lapsed 2018 |

Also noted: expired "recommendation rationalization" patents (Emigh, US 9,189,740 /
9,330,360 — plausible explanations *decoupled* from ground truth, the philosophical
opposite of V3-02); Microsoft's pending LLM score-and-revise application
(18/140,658) and grounded-generation family — all keep a model in the verification
loop; the social-influence-scoring thicket (Klout/Topsy/Xerox) is behavioral
engagement, not cultural influence claims; Rhapsody's "graph-based music
recommendation" grant is user-co-occurrence edges, not influence. Non-patent art
that counsel should have: Saleh et al., *Toward Automated Discovery of Artistic
Influence* (arXiv 1408.3218, 2014) and the AllMusic/Rovi influence-dataset
literature — §102/§103 art for influence-edge *inference*, without the
verification apparatus.

### Gap assessment (what the scan did *not* find)

1. **No patent claims the proposer/verifier split** — a generative model proposing
   relationship claims that are then adjudicated *only* by deterministic code
   against structured catalogs. Every located verification patent keeps a model or
   statistical scorer in the loop. Amazon US 12,353,469 is the nearest neighbor and
   is scoped to numeric verification inside a vector-retrieval RAG claim.
2. **No deterministic, rule-derived confidence *tiers* from provenance records** —
   located art scores confidence with learned weights (IBM) or corroboration counts
   (Google), never as a reproducible pure function of provenance.
3. **No asymmetric verifier authority** — the award-only vs. convict-capable
   lattice, same-medium conviction gate, and near-name protection surfaced nowhere.
   Per the scan, this is the most distinctive claimable element.
4. **No knowledge graph with edge-level mechanically-verified quote+URL provenance
   as a first-class primitive** — the pieces (facts-with-snippets, quote-verified
   citations, corroboration) exist separately, never composed.
5. **No recommendation grounded in documented influence relations with per-claim
   evidence** — Sony computes over a given influence graph; Amazon's "reasons" are
   behavioral, not documentary.

### Watch list for counsel

- **Sony US 7,750,909** — the one live patent squarely on artist-influence graphs.
  Claims are influence-*ordering* computations, so overlap looks narrow (Kynda's
  evidence-weighting is not recursive influence propagation), but it merits a
  formal claim chart. Expires ~Dec 2027 regardless.
- **Amazon US 12,353,469** (2025 grant) and **Clearbrief US 11,620,441** — read
  closely against any citation-generation and quote-verification claims.
- **Myslinski/Microsoft fact-checking family** — broad early art on
  "compare-and-badge"; live members need enumeration.
- **The unpublished window**: 2024–2026 LLM-grounding filings won't be visible
  until 18 months post-filing. A professional search close to filing, including
  classification-based sweeps (G06F16/36, G06F40/226, G06N5/022), is necessary.

---

## 4. Practical next steps

### Strategy: one provisional, pipeline-first

1. **Scope**: a single provisional covering Candidate B with Candidate C as its
   structural half (the pipeline writes into, and computes over, the
   evidence-bearing graph). Candidate A gets copyright registration and a
   format-bible/NDA practice instead — no patent filing.
2. **Timing — the clocks that are already running.** US law gives a one-year grace
   period after the inventor's own public disclosure (35 U.S.C. §102(b)(1)); most
   foreign systems give none. Counsel must be handed the full disclosure timeline
   so *they* can determine what has started which clock: influenced.it (2013), the
   UCLA course and prototype (Fall 2022–Winter 2023), the 2024 deck shown to
   Steven Johnson, kynda2's public deployment, v3's password gate (V3-58) and the
   three publicly reachable demo pages (live since ~Aug 2026), the alumni-board
   demo (July 2026), and the September meeting at Brown. Note that much of the
   *pipeline's internals* (the decision log's mechanisms) has not been publicly
   disclosed even where the product surface has — that distinction is exactly the
   kind counsel needs to draw, not us. **Practical implication: file the
   provisional before the September demo if feasible, and disclose no pipeline
   internals publicly before filing.**
3. **A provisional is only as good as its spec.** No claims are required, but the
   later non-provisional gets the priority date only for what the provisional
   actually describes and enables (§112(a)). For a §101-sensitive filing the
   provisional should already contain the technical-improvement narrative and the
   implementation specifics — which is largely written: the decision log entries
   V3-02, V3-03, V3-13, V3-16, V3-18, V3-48, V3-50, V3-59, the schema, the
   verifier code, and the eval harness are the raw material of an invention
   disclosure. A thin cover-sheet provisional would be false comfort.
4. **The 12-month clock**: the provisional lapses at 12 months, non-extendable in
   practice; the non-provisional (and any foreign/PCT filing) must land inside it.
   Filing the provisional starts a real spending commitment one year out — budget
   for the non-provisional decision at month ~9.

### Costs (2025 USPTO fee schedule; verify at filing)

| Item | Cost |
|---|---|
| USPTO provisional filing fee | $65 micro / $130 small / $325 large entity |
| Attorney: provisional (software, done properly) | ~$2,000–5,000 |
| USPTO non-provisional filing+search+exam | ~$400 micro / $800 small / $2,000 large |
| Attorney: non-provisional (software) | ~$7,000–15,000+ |
| Through prosecution to grant | typically several tens of thousands, multi-year |

Entity status: The O&O / The Influence Project likely qualifies for **small** and
plausibly **micro** entity status (micro requires, roughly, <5 prior applications
and gross income under the USPTO threshold) — counsel confirms. The 2025 AIPLA
Economic Survey (published Feb 2026) is the authoritative fee benchmark; the ranges
above are from practitioner fee guides and prior surveys.

### What to hand the attorney at the first meeting

1. **The disclosure timeline** above, with dates as precise as recoverable — this
   is the first thing they will ask for and the one item with a hard deadline
   attached.
2. **An invention-disclosure write-up** distilled from the decision log: the
   proposer/verifier architecture, the tier function, the two provenance layers,
   the authority lattice, the `via`-chain check, the graph schema, and the measured
   results (badge rates, trap catches, the $0.007/citation economics as evidence
   the pipeline is a working system, not a concept).
3. **This memo's prior-art list**, flagged as an informal scan — everything found
   must eventually be cited to the USPTO in an IDS if a non-provisional is filed
   (the duty of candor covers known prior art).
4. **Inventorship and ownership facts**: who conceived which elements (Tony;
   any co-developers whose contributions rise to conception), and the intended
   assignee (The O&O as shell, or a new entity under The Influence Project
   umbrella) — assignment should be papered at filing.
5. **The commercial context**: the Brown conversation, the September demo, and the
   bootstrap constraint (V3-24) — counsel should shape scope and spend to a
   solo-founder budget, and will likely raise the trade-secret and
   defensive-publication alternatives for the pieces with the weakest §101
   posture. Worth hearing out; the decision is a business call, not a legal one.

### What this memo deliberately does not do

No claim drafting, no formal patentability opinion, no FTO conclusion, no foreign
strategy beyond noting the absolute-novelty problem, and no contact with counsel or
the USPTO. Next concrete action when Tony is ready: pick a patent attorney
(software/AI prosecution experience, ideally with §101-heavy art units) and book
the initial consultation with items 1–5 in hand.
