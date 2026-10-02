# 2026-06-01 — concept-db upkeep loop (eight-property maintenance)

> **Authorship origin:** Operator-authored. This file should have been
> emitted by a substrate-side `detect-concept-db-upkeep-gaps` activity
> in response to a `conceptDbUpkeepReport` impulse. It wasn't, for two
> reasons: (a) that detection activity does not exist yet — it is one
> of the eight introduced below; and (b) even if `draft-spec-from-gap`
> existed in its current form, it would not require the recursive
> substrate-citizen lens this proposal is structured around. That gap
> is the responsibility of the sibling spec's I.1 task
> (`2026-06-01-concept-db-supersession-and-chunker-hygiene` §I.1).
> Until I.1 lands, every proposal touching the substrate inherits the
> obligation to manifest the lens by hand. This is one of the last
> proposals that should be authored that way.

## Motivation

The sibling supersession spec
(`2026-06-01-concept-db-supersession-and-chunker-hygiene`) fixes the
accumulated symptom: 33 stale concepts, 1.5 MB of JSON-escape runaway
content, heading slugs polluting the `shape` field, and a chunker that
re-creates the mess on every re-ingest. That spec is reactive — it
stops the bleeding from one audit. It does not establish a standing
discipline that keeps concept-db's 604 (and growing) concepts true and
current between audits.

The same audit surfaced quieter problems the supersession spec does
not address:

- **Provenance:** zero concepts carry a `source_uri`. The schema has
  fields for it; nothing writes them. Every concept's origin is
  reconstructable only by manual inspection.
- **Currency:** when `CLAUDE.md` changes a section the chunker
  previously ingested, no concept knows it is now stale. The 20
  pre-Phase-26 CLAUDE.md chunks demoted in Route 1 are the same class
  of bug: silent stale.
- **Convergence:** two distinct `failure_mode_taxonomy` concepts
  coexist because no resolver checks whether a write collides with an
  existing `(shape, source_type, source_uri)` triple.
- **Coverage:** large portions of CLAUDE.md (the Phase-26 substrate
  bootstrap, the IAL §27.S.4 lift criterion, the eight foundational
  design principles) have no concept representation. The substrate
  doesn't know what it doesn't have indexed.
- **Calibration:** `times_loaded`, `times_succeeded`, `times_failed`
  exist on the schema and are written by the read path, but no
  resolver consumes them to adjust `relevance`. Concepts that have
  never been read have the same prior as concepts that fire on every
  goal.
- **Retrievability:** there is no probe that asks "given the canon
  terms this concept claims to represent, would BM25 actually return
  it?" Concepts can exist in storage and be unreachable in practice.
- **Decay:** `updated_at` (once the sibling spec wires it) will tell
  us when a concept was last touched, but no policy converts age into
  relevance pressure. A 2025-vintage concept and a 2026-06-01 concept
  rank identically.
- **Verdict capture:** when Route 1 demoted 33 concepts, the
  supersession verdicts existed only as `[SUPERSEDED]` string
  prefixes. Operator and agent corrections must be first-class
  impulses, not embedded markup.

The pattern across all eight: the substrate stores concepts but has
no loop that **maintains** their truth and currency. Supersession
fixes; upkeep prevents recurrence.

## Eight properties of truth-and-currency

### 1. Provenance

Every concept must declare `source_uri` (file path + commit hash, or
vessel id + impulse id) at write time. Concepts whose origin cannot
be reconstructed get `provenance_unknown: true` so the gap is
visible. The substrate-citizen activity is
`extract-concept-with-provenance`, a write-side resolver upgrade that
requires the field be populated or the flag set. Emits no new
impulses on the read path; this is purely a write-time invariant.

### 2. Currency

When a pinned source changes (a tracked CLAUDE.md commit hash advances,
a vessel emits a new version impulse), every concept that depends on
the old source receives a `conceptSourceChanged` impulse. The
substrate-citizen activity is `watch-concept-sources`: periodic scan
of `source_uri` commit hashes against current repo state, emits one
impulse per drifted concept. No automatic supersession — currency
flags inform `draft-spec-from-gap`, which decides whether to author a
follow-up.

### 3. Convergence

Multiple concepts claiming the same `(shape, source_type, source_uri)`
triple are duplicates or near-duplicates. The two
`failure_mode_taxonomy` concepts in today's corpus are exhibit A.
Activity: `detect-concept-duplicates`. Server-side query groups
concepts by the triple; emits one `conceptDuplicateCluster` impulse
per group with ≥2 members. Judgment call: I chose the
`(shape, source_type, source_uri)` triple as the duplicate key rather
than embedding-cosine similarity. Embedding-based dedup is more
powerful but requires LLM/vector budget and risks false positives;
the triple is cheap, deterministic, and catches the actual observed
failure mode. Embedding-based clustering is a follow-up if
deterministic dedup misses material cases.

### 4. Coverage

What canon material (CLAUDE.md sections, vessel READMEs, openspec
change directories under `openspec/changes/`) has zero concept
representation? Activity: `detect-concept-coverage-gap`. Server-side
walk of canon source paths cross-referenced against
`source_uri` values in concept-db; emits one `conceptCoverageGap`
impulse per source path with no covering concept. Judgment call: I
scoped "canon" to three roots — `CLAUDE.md`, every `repos/*/README.md`,
and `openspec/changes/*/proposal.md`. Broader scopes (every `.md`
under `docs/`, every TypeScript file in every vessel) are tractable
extensions once the baseline works; starting narrow keeps the
baseline measurement meaningful.

### 5. Calibration

`times_loaded`, `times_succeeded`, `times_failed` are written but
never read by any policy. Activity: `recalibrate-concept-relevance`.
Periodic resolver that re-derives `relevance` from a Thompson-style
posterior over `times_succeeded` / `(times_succeeded + times_failed)`,
gated on a minimum sample size. Concepts below the sample threshold
keep their prior; concepts above it move toward their observed rate.
No LLM. Treats reads as observations of usefulness only when paired
with a downstream success/failure signal — bare loads do not move
relevance.

### 6. Retrievability

Adversarial probe: pick a random concept, search BM25 (and dense, if
enabled) for the canon terms that concept claims to represent, verify
it appears in the top-N results. Misses → emit
`conceptRetrievalMiss` impulse with `{concept_id, query_terms,
actual_top_n_ids}`. Activity: `probe-concept-retrievability`. Runs
on a sampled subset each tick to bound cost. This is the activity
that catches concepts that exist but are unreachable — the corpus
ground truth for whether the index is doing its job.

### 7. Decay

Time since last validation pulls relevance down unless a
re-validation event re-pins it. Activity: `decay-stale-concepts`.
Judgment call: I am proposing the policy be **linear with a floor**,
not exponential. Linear (e.g. -0.01 per week since `updated_at`,
floor at 0.05) is interpretable, easy to audit, and slow enough that
operators can intervene before a useful concept is demoted past the
visibility threshold. Exponential decay sounds principled but
front-loads the demotion in a way that makes "which concepts did the
decay kill" harder to reason about. The floor is non-zero so decayed
concepts remain discoverable via `include_superseded`-style escape
hatches. The shape of the function should be re-evaluated after one
upkeep cycle's measurement; this is the explicit follow-up.

### 8. Verdict capture

When an operator or agent issues a correction ("this concept is
wrong", "this concept supersedes that one", "this concept's relevance
should be 0.05 not 0.9"), the correction must persist as a first-class
impulse, not as a string prefix or a one-shot PATCH. Activity:
`record-concept-verdict` + `conceptVerdict_write` resolver. The
verdict impulse carries `{concept_id, verdict_type, rationale,
verdict_source: operator | agent | substrate, evidence_impulse_ids}`.
Downstream consumers (calibration §5, supersession edges via the
sibling spec) read verdicts as input. Today's Route 1 corrections,
which lived only as `[SUPERSEDED]` markup, are the canonical missing
case.

## Dependency on sibling specs

This proposal depends on
`2026-06-01-concept-db-supersession-and-chunker-hygiene`:

- **§A.2 + §A.3**: `superseded_by`, `supersedes`, and `updated_at`
  field migrations. Upkeep activities §5 and §7 cannot calibrate or
  decay without `updated_at` populated. Upkeep §3 (convergence)
  cooperates with sibling §B.4 (supersession edge) — convergence
  detects, supersession resolves.
- **§I.1**: `draft-spec-from-gap` template extension to require the
  `## How the substrate should do this itself` reflection. This
  proposal is itself a forcing function for I.1 — once I.1 lands,
  this is one of the last proposals authored without it.

Sibling §H.1 (`detect-concept-db-drift`) and this proposal's eight
detection activities overlap conceptually but address different
strata: sibling §H.1 surfaces structural malformation (shape-slugs,
template-variable leaks, oversize content); the eight here surface
truth-and-currency drift over a maintained corpus. Both run.

## Success criteria

1. All eight properties have a measurable substrate-emitted report
   impulse with non-trivial population. The eight reports run on a
   substrate timer (hourly or daily depending on cost) without
   operator dispatch.
2. The next concept-db audit (the operational class, not a one-off
   debug session) is initiated by `detect-concept-db-upkeep-gaps`
   firing on its schedule, with the operator's role reduced to
   reviewing the substrate-authored follow-up spec.
3. `interventionRefused` impulses fire when an operator attempts to
   PATCH-supersede a concept that none of the eight upkeep activities
   has flagged. This is the active-push-away signal per IAL §27.S.6:
   the substrate refuses operator interventions that bypass its own
   maintenance loop, citing the absence of an upstream
   `conceptDuplicateCluster` / `conceptSourceChanged` /
   `conceptRetrievalMiss` / `conceptCoverageGap` impulse as evidence.
4. Coverage gap count trends downward over a sustained window
   (operator-measured; no fixed numerical target — the right floor is
   itself a follow-up measurement).
5. After one full upkeep cycle, the linear-decay function shape (§7)
   is either confirmed or replaced with measured justification.

## Non-goals

- **Hard deletion of any concept.** Soft demote, decay, and
  supersession-with-edge are the only mutations. Tombstones outlast
  graphs.
- **Chain supersession.** Sibling spec is single-hop; upkeep §3
  inherits that constraint. A concept flagged as duplicate of a
  duplicate is a follow-up.
- **Re-ingesting CLAUDE.md.** That belongs after the sibling chunker
  hygiene work lands; running it before would re-pollute via the same
  bugs.
- **Embedding or vector store upgrades.** Convergence §3 deliberately
  uses a deterministic key; retrievability §6 probes whatever index
  is live. Index quality is orthogonal.
- **LLM-driven detection.** The canonical immunity pattern from
  `feedback_substrate_self_detection_recursive` rules it out: every
  upkeep activity is `inputShapes: []`, `variables: []`, single
  server-side resolver, no LLM, no iteration.

## How this proposal closes its own recursion

Three-level check per `feedback_substrate_recursion_in_authoring`.
Level 1: the thing being fixed (concept-db drift) has its
substrate-citizen counterpart — the eight activities below. Level 2:
the act of writing this proposal would not have been produced by the
current `draft-spec-from-gap` because no `detect-concept-db-upkeep-
gaps` activity exists yet; that gap is sibling I.1 and §I.1 in this
spec's tasks. Level 3: even with I.1, would the substrate's
authoring activity have remembered to include this very paragraph?
Not unless I.4 ships. The fixed point of the recursion lives in
sibling I.4, not here. Treat the operator authorship of this proposal
as the second-to-last instance of the gap, and the operator
authorship of the spec that finally tests I.4 as the last.
