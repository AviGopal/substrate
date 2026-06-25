# 2026-06-01 — concept-db supersession edges + chunker hygiene

> **Authorship origin:** Operator-authored. This file should have been
> emitted by the substrate's `draft-spec-from-gap` activity in response
> to a `conceptDbDriftReport` impulse. It wasn't, because (a) the
> drift-detection activity doesn't exist yet, and (b) even if it did,
> the spec the substrate authored would not have contained the
> recursive substrate-citizen reflection that follows in
> §"How the substrate should do this itself" — because
> `draft-spec-from-gap` does not currently require that reflection.
> Both gaps are tracked in tasks H.* and I.*. Treat the operator
> origin of this document as the first finding it must close.

## Motivation

A three-agent audit of the live concept-db on 2026-06-01 (604 concepts,
all minted 2026-05-30 → 2026-06-01) surfaced two compounding problems:

1. **The substrate has no way to mark concepts stale.** The schema has
   no `supersedes`/`superseded_by` field, `EdgeTypeSchema` is a closed
   8-value enum that does not include `supersedes`, and `updated_at`
   exists in the Zod schema but is never written by any UPDATE SET
   clause. The only available supersession path today is
   `PATCH /concepts/:id` to overwrite `summary`/`content` with a
   `[SUPERSEDED]` prefix and demote `relevance`. Route 1 of this audit
   used that path for 33 concepts (20 pre-Phase-26 CLAUDE.md chunks,
   5 unsubstituted template literals, 7 multi-megabyte JSON-escape
   runaway payloads, 1 duplicate `failure_mode_taxonomy`). That works
   to bury concepts in BM25 and dense rankings, but it is not
   machine-readable supersession: graph traversal cannot follow a
   "use this newer concept instead" edge.

2. **The chunker that ingested CLAUDE.md is producing malformed
   concepts** that will keep regenerating drift on every re-ingest:
   - CLAUDE.md heading-anchor slugs are being written into the
     `shape` field (`8_llms_are_tools_not_controllers`,
     `3_metabob_activity_api_repos_metabob_activity_api`,
     `2_search_for_matching_activity`, `before_push`, `key_files`).
     Shape is the impulse-type contract per
     `IMPULSE_ACTIVITY_FOUNDATION.md`; heading slugs are not shapes.
   - The literal string `{{extract_learning_shape_value}}` shipped
     into the `shape` field of 5 concepts — a Mustache variable that
     was never substituted before write.
   - 7 concepts shipped with 1+ MB `content` consisting of thousands
     of escaped backslashes (`\\\\\\\\…`). Re-serialisation runaway
     somewhere in the write path; affected shapes include
     `substrate_self_detection_principle` and
     `vessel_resolve_partial_parse_drift`, which are real concept
     names whose actual content is now lost.
   - The string `vessel_construction_pattern` serves at three
     ontological levels simultaneously: `source_type`, impulse
     `pointer.type`, and concept `shape`. 257 concepts have it as
     `source_type`, 71 as `pointer.type`, 10 as `shape`. These should
     not be the same field value.

Without (1), Route 1's content-only supersession is the ceiling: every
future audit costs another raw-HTTP batch and the supersession
relationship lives only inside a markdown prefix. Without (2),
re-ingesting CLAUDE.md to refresh stale chunks just regenerates the
same heading-slug pollution and (worse) re-creates the runaway-content
payloads.

## Approach

Five surgical changes, each small enough to ship independently.

### A. Schema additions in `repos/concept-db`

1. **Extend `EdgeTypeSchema`** (`src/models/schemas.ts:38`) to include
   `supersedes`. Existing 8 values unchanged.
2. **Add two optional fields to the concept schema**:
   `superseded_by: string | null` (newer concept id) and
   `supersedes: string[] | null` (older concept ids). Both nullable,
   default null. Index `superseded_by` so `WHERE superseded_by IS NONE`
   filters cheaply.
3. **Maintain `updated_at`**. Add `SET updated_at = time::now()` to
   every UPDATE clause in `updateConcept`, `resolveConcept`, and
   `linkConcepts`. Currently the field is dead.

### B. Resolver + route additions

1. **Expose `concept_update` as an MCP tool** wrapping the existing
   `updateConcept` resolver. The whitelist (`summary`, `content`,
   `priority`, `relevance`, `budget`) carries forward; add
   `superseded_by` to it.
2. **Search filters honour supersession by default**: BM25 and dense
   searches add `AND superseded_by IS NONE` unless the caller passes
   `include_superseded: true`. This makes supersession act as a soft
   delete without losing history.
3. **`concept_link` validates supersession edges**: when
   `edge_type = "supersedes"`, the resolver also writes
   `superseded_by` on the source concept and appends to `supersedes`
   on the target. Single source of truth: the edge.

### C. Chunker write-path bug fixes

The chunker lives in the path that ingested CLAUDE.md on 2026-05-30.
Identify it first (likely a CLAUDE.md-ingest activity template or a
ribosome-vessel pathway). Three bugs to fix at source:

1. **Heading slugs must not become `shape` values.** Shape is the
   impulse-type contract. Heading slugs belong in `summary` or a new
   `source_anchor` field, not in `shape`. Either fix the chunker to
   leave `shape` unset (fall back to a `documentation_chunk` default)
   or compute shape from content analysis, not from the markdown
   heading.
2. **Substitute Mustache variables before write.** The 5
   `{{extract_learning_shape_value}}` concepts indicate a template
   pipeline that wrote raw template output. Add a validator that
   rejects any concept whose `shape`, `content`, or `summary`
   contains an unsubstituted `{{...}}` pattern.
3. **Cap content size at write.** The 1+ MB backslash-runaway payloads
   are unbounded JSON-escape recursion. Add a hard cap (e.g. 64 KB)
   on `content` length in `createConcept` and `updateConcept`;
   payloads over the cap are rejected with a 413 and logged.
   This is a backstop — fixing the actual re-serialisation bug is
   the real fix, but a cap prevents future MB-scale pollution.

### D. Migration for existing rows

One-shot migration that adds the new fields with safe defaults:

```sql
DEFINE FIELD OVERWRITE superseded_by ON concept TYPE option<string>;
DEFINE FIELD OVERWRITE supersedes ON concept TYPE option<array<string>>;
DEFINE FIELD OVERWRITE updated_at ON concept TYPE option<datetime>
  DEFAULT time::now();
DEFINE INDEX OVERWRITE concept_superseded_by_idx ON concept
  COLUMNS superseded_by;
```

### E. Replay Route 1 supersessions as proper edges

Once A–D ship, replay the 33 already-superseded concepts:

1. For each, attempt to find a replacement concept by searching for
   current-canon terms. Agent 2 identified candidates for most
   (e.g. `concept_QZoLiNrE2NkC` substrate_vessel_dev_loop replaces
   the kubectl/Helm cluster of 10).
2. For each (old, new) pair, emit `concept_link {edge_type:
   "supersedes", from: new, to: old}`. The resolver writes the
   bookkeeping fields atomically.
3. For superseded concepts with no extant replacement (e.g.
   `concept_20Sn72l2IlvB` Phase-26-as-upcoming), set
   `superseded_by = null` but leave the `[SUPERSEDED]` content
   prefix from Route 1. These remain demoted in ranking via existing
   relevance=0.05; the schema cannot yet express "stale with no
   replacement", which is a known gap to address in a follow-up.

## How the substrate should do this itself

The audit that produced this proposal was operator-authored: three
Claude subagents dispatched in parallel, reading concept-db, identifying
33 supersession targets, then a raw-HTTP PATCH script. Every step of
that should have been a substrate-citizen activity. The fact that it
wasn't is the recursive substrate-self-detection finding — the missing
detection capability IS a `substrateGap`, and recording it that way
matters more than the one-shot fix.

Map of operator step → substrate-citizen counterpart:

| Operator step today | Substrate-citizen activity (target) |
|---|---|
| Three agents read concept-db, bucket by source_type, sample field shapes | `detect-concept-db-drift` activity: periodic scan, emits `conceptDbDriftReport` impulse with bucket counts, field-shape variants, outlier shapes |
| Agent 2 finds concepts referencing retired code paths | `detect-superseded-concept-candidate` activity: takes a list of retired terms (sourced from `CLAUDE.md` deltas or operator-supplied `retirementMarker` impulses) and emits `supersessionCandidate` impulses with old-id + reason |
| Agent 3 audits the write path; runs a one-concept probe | `detect-write-path-capability` activity: server-side probe that round-trips through every available write primitive and emits `writePathCapability` impulse describing what's supported |
| Route-1 PATCH script | `apply-supersession` activity: takes a `supersessionCandidate` + optional replacement id, calls `concept_link supersedes` (post-A.1), updates `superseded_by` |
| This openspec proposal | `draft-spec-from-gap` (already exists in the substrate) — invoked on the `conceptDbDriftReport` impulse |

Three of the five activities don't exist yet. Their absence is the
substrateGap this proposal must surface, not just patch around. Tasks
H.* below seed them — even as `inputShapes: []`, single-resolver,
no-LLM detection templates so they cannot themselves cause cascades
(the canonical immunity pattern from
`feedback_substrate_self_detection_recursive`).

The chunker bugs (C.* + D.*) are the clearest case. C.1 and C.2 are
substrate-self-detection at the write boundary: the substrate refuses
a malformed write with a structured error AND emits a
`chunkerWriteRejection` impulse. That impulse is the substrate
**telling itself** about an upstream bug — exactly the kind of signal
`draft-spec-from-gap` should pick up to author D.* without operator
intervention. The substrate authoring its own chunker fix is closer
to S3 push-away than 33 PATCHes.

Two implications for the design:

1. **Validators must emit impulses, not just return HTTP errors.**
   C.3 is upgraded from "log to a channel" to "emit
   `chunkerWriteRejection` impulse on every C.1/C.2 reject". The
   impulse is what makes the rejection observable to the substrate's
   own authoring loop.
2. **The replay (E.*) should be a substrate-run activity, not a
   script.** E.1's `scripts/concept-db-replay-route1.ts` becomes the
   inline body of an `apply-supersession-batch` template that the
   substrate dispatches. If the substrate cannot execute it today
   (e.g. the manifest format isn't a recognised input shape), THAT
   is another `substrateGap` to record.

## Non-goals

- Hard-deleting concepts. SurrealDB's relate-graph is corrupted if
  we delete nodes; soft supersession is the correct primitive.
- Migrating concept ids. The legacy `concept:concept_<nano>` (with
  the doubled prefix) and `concept:⟨concept_<nano>⟩` (with angle
  brackets) forms both exist in the wild from prior write-path bugs;
  this change accepts both and does not normalise.
- A general-purpose "deprecated" flag separate from `superseded_by`.
  Supersession with a `null` target IS the deprecation primitive;
  adding a second flag invites drift between the two.
- Re-ingesting CLAUDE.md. That is the natural follow-up once the
  chunker is fixed, but it is out of scope here.

## Success criteria

1. `concept_link {edge_type: "supersedes"}` is accepted by the
   resolver and persists `superseded_by` + `supersedes` on both
   endpoints.
2. Default `concept_search` results exclude superseded concepts; an
   explicit `include_superseded: true` parameter recovers them.
3. New concepts cannot be written with unsubstituted Mustache
   variables in `shape`, `content`, or `summary`. Existing ones
   remain readable.
4. New concepts cannot be written with `content` larger than 64 KB.
5. The 33 Route-1-superseded concepts have machine-readable
   `superseded_by` edges where a replacement exists.
6. `updated_at` is populated on every UPDATE.
7. **The next concept-db audit is substrate-initiated.** When the
   `detect-concept-db-drift` activity runs on its schedule and finds
   new supersession candidates, `draft-spec-from-gap` authors a
   follow-up openspec without an operator dispatching three agents.
   The operator's role on that pass is review-only.

## Risk

Low. The schema additions are additive (all fields nullable), the
edge type addition is additive (existing edges unchanged), and the
chunker hygiene rules are write-side validators — they cannot break
reads. The migration is idempotent via `DEFINE FIELD OVERWRITE`.

The one risk worth flagging: the search-filter change in B.2
(default-exclude superseded) changes existing query semantics. Any
caller that relied on superseded concepts surfacing must explicitly
opt in. Mitigation: log a warning on the first 24 hours of operation
whenever the supersession filter prunes results, so accidental
exclusions become visible.
