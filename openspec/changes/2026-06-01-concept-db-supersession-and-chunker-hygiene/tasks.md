# Tasks — concept-db supersession + chunker hygiene

## A. Schema additions (concept-db)

- [ ] A.1  Add `supersedes` to `EdgeTypeSchema` in `repos/concept-db/src/models/schemas.ts:38`. Update the Zod union and any switch/match over edge types.
- [ ] A.2  Add `superseded_by: z.string().nullable().optional()` to the concept schema. Add `supersedes: z.array(z.string()).nullable().optional()`.
- [ ] A.3  Add a SurrealQL migration file under `repos/concept-db/sql/migrations/` that runs `DEFINE FIELD OVERWRITE` for the three new/touched fields plus `DEFINE INDEX` on `superseded_by`. Use the next sequential migration number.
- [ ] A.4  Wire `updated_at = time::now()` into the SET clauses of `updateConcept` (L814), `resolveConcept` (L190), `linkConcepts`, and `upsertBySignature`. Confirm via SurrealQL probe that `updated_at` shifts after a PATCH.

## B. Resolver + route additions (concept-db)

- [ ] B.1  Add `superseded_by` to the `updateConcept` whitelist.
- [ ] B.2  Add `concept_update` to the MCP tool handler in `repos/concept-db/src/tools/handler.ts`. Schema: `{concept_id, summary?, content?, priority?, relevance?, budget?, superseded_by?}`.
- [ ] B.3  In `searchConcepts`, append `AND superseded_by IS NONE` to the WHERE clause unless `include_superseded === true` is passed. Apply to both BM25 and dense paths.
- [ ] B.4  Extend `linkConcepts` so `edge_type === "supersedes"` triggers an atomic transaction that writes `superseded_by` on the FROM concept and appends the FROM id to `supersedes[]` on the TO concept. Reject the edge if either side is already superseded (no chains for now).
- [ ] B.5  Log a one-line warning (`[supersession-filter] pruned N results`) on each search call where the filter removes ≥1 hit, for the first 24h post-deploy.

## C. Chunker write-path hygiene (concept-db side)

- [ ] C.1  In `createConcept` and `updateConcept`, reject any payload whose `shape`, `content`, or `summary` matches `/\{\{[^}]+\}\}/`. Return 422 with `{error: "unsubstituted template variable", field: "<which>"}`.
- [ ] C.2  In `createConcept` and `updateConcept`, reject `content.length > 65536` with HTTP 413 + `{error: "content_too_large", limit: 65536, received: <n>}`.
- [ ] C.3  On every C.1/C.2 reject, emit a `chunkerWriteRejection` impulse via the substrate bus (not just a log line). The impulse carries `{rejected_field, rejection_reason, sample_offender, write_caller_vessel_id, timestamp}`. This makes the upstream bug visible to `draft-spec-from-gap` and to operator review surfaces.

## D. Chunker source fix (locate + patch)

- [ ] D.1  Identify the ingestion path that wrote the 2026-05-30 CLAUDE.md batch. Suspects: an activity template in the substrate registry, ribosome-vessel's extraction pipeline, or a manual one-shot script. Grep substrate for templates with `extract_learning_shape` or `claude_md` in their id/description.
- [ ] D.2  Patch the heading-slug-as-shape bug. The fix is upstream of C.1: shape values for documentation chunks should default to `documentation_chunk` (or a content-derived shape), not the markdown anchor. Heading anchors belong in a `source_anchor` metadata field.
- [ ] D.2.1  While in the chunker write path, also populate `canon_terms` (the field defined in upkeep-loop §F.1) with the chunk's heading + first-sentence noun-phrases + any explicitly-named identifiers. This closes a latent dependency: upkeep §F (retrievability probe) needs `canon_terms` to know what queries to test; without ingestion writing it, the probe is a no-op on legacy concepts. If upkeep §F.1 hasn't merged yet, this task is a stub-emit that writes `canon_terms: []` so the field at least exists.
- [ ] D.3  Patch the unsubstituted-template-variable bug. Find where `{{extract_learning_shape_value}}` originates; either substitute before write or treat as a parse failure that doesn't emit a concept.
- [ ] D.4  Patch the JSON-escape runaway. The 1+ MB backslash payloads indicate either a JSON-stringify-of-already-stringified loop or a string-escape applied iteratively. Likely candidate: a resolver that JSON.stringifies content, then a downstream caller JSON.stringifies the wrapped object, then a third caller does it again. Fix by tracking serialisation at the boundary — content should be stored as a raw string, not a JSON-stringified string.

## E. Replay Route 1 with proper edges

- [ ] E.1  Write `scripts/concept-db-replay-route1.ts` reading the 33-concept supersession list (preserve from Route 1's manifest). For each entry, search concept-db for the canonical replacement using the mapping agent 2 produced.
- [ ] E.2  For each (old, new) pair with a found replacement, call `concept_link {edge_type: "supersedes", from: new, to: old}`. Verify both fields update.
- [ ] E.3  For entries with no replacement (e.g. `concept_20Sn72l2IlvB`), leave them as-is. They remain content-prefix-superseded and rank-demoted; the schema can express this as `superseded_by = null` once a follow-up spec adds a `deprecated_at` field.
- [ ] E.4  Run the replay against substrate. Verify post-replay that `concept_search` excludes all 33 by default and `include_superseded: true` recovers them.

## F. Verification gates

- [ ] F.1  Unit: edge-type enum accepts `supersedes`; rejects `deprecated_by`, `replaces` (typos), and other non-enum values.
- [ ] F.2  Integration: PATCH concept → `updated_at` shifts to within 1s of wall-clock.
- [ ] F.3  Integration: `concept_link` supersedes edge sets `superseded_by` AND `supersedes[]` atomically. Force a mid-transaction failure (e.g. invalid target id) and confirm rollback leaves both endpoints untouched.
- [ ] F.4  Integration: `concept_search` default excludes superseded; `include_superseded: true` recovers them; the warning log fires on default calls that prune.
- [ ] F.5  Integration: POST with `{{template}}` in any field returns 422.
- [ ] F.6  Integration: POST with 100 KB content returns 413; POST with 64 KB content succeeds.
- [ ] F.7  Substrate: after replay (E.4), `concept_search?q=kubectl` returns no Route-1-superseded results by default. With `include_superseded: true` it returns them all.

## H. Substrate-citizen activities (the missing detection capabilities)

These seed three detection templates the substrate currently lacks.
Each follows the canonical immunity pattern from
`feedback_substrate_self_detection_recursive`: `inputShapes: []`,
`variables: []`, single server-side resolver, no LLM, no iteration.
The activities are seeded in `repos/development-vessel/src/seed/` and
the resolvers in `repos/development-vessel/src/resolvers/`.

- [ ] H.1  Author `detect-concept-db-drift` activity. Resolver scans concept-db with the same logic the audit agents used: bucket by `source_type`, list field-shape variants, count concepts whose `shape` looks like a heading slug (regex), count concepts with `content` length > 50 KB, count concepts whose `shape` or `content` contains `{{...}}`. Emits a single `conceptDbDriftReport` impulse. Schedule: hourly via substrate timer. **Scope boundary:** structural malformation only (shape patterns, content size, template literals). Duplicate detection is delegated to upkeep-loop §C (`detect-concept-duplicates`) — H.1 must NOT include `GROUP BY shape, source_type` counts or any cluster-detection logic. If a future scan needs both, run both activities and merge upstream.
- [ ] H.2  Author `detect-superseded-concept-candidate` activity. Resolver takes a list of `retirementMarker` impulses (operator-supplied or extracted from CLAUDE.md deltas) and runs `concept_search` for each. Emits one `supersessionCandidate` impulse per matching concept with `{old_id, retirement_marker, suggested_replacement_id?}`. Input shape: `retirementMarker[]` from operator memory or from a substrate-side delta-extraction activity.
- [ ] H.3  Author `apply-supersession` activity. Resolver consumes a `supersessionCandidate` impulse and calls `concept_link {edge_type: "supersedes", from: replacement, to: candidate.old_id}`. No-op if `suggested_replacement_id` is absent. Emits `supersessionApplied` or `supersessionSkipped`.
- [ ] H.4  Author `detect-write-path-capability` activity. Resolver round-trips a synthetic probe through every known write primitive (`createConcept`, `updateConcept` via PATCH, `linkConcepts` for each edge type, etc.) and emits a `writePathCapability` impulse describing what works. Run once per concept-db restart. This is what the operator agent did manually in Route-1's mechanics audit; making it an activity means the substrate notices when a write primitive disappears or changes shape.
- [ ] H.5  Confirm `draft-spec-from-gap` subscribes to `conceptDbDriftReport` impulses. If it doesn't, file a follow-up gap — the loop is incomplete without that subscription.
- [ ] H.6  Confirm `draft-spec-from-gap` subscribes to `chunkerWriteRejection` impulses (from C.3). Same follow-up if absent. This is the loop that closes D.* — the substrate authoring its own chunker fix in response to its own emitted rejections.

## G. Documentation

- [ ] G.1  Update `repos/concept-db/README.md` with the new `supersedes` edge type, the `superseded_by`/`supersedes` fields, and the default-exclude search behaviour.
- [ ] G.2  Update `CLAUDE.md` §6 (concept-db) with the supersession protocol: prefer `concept_link supersedes` over PATCH-with-prefix going forward.
- [ ] G.3  After D.1 lands, add a note in CLAUDE.md identifying the corrected chunker path so future re-ingest doesn't regress.

## I. Recursive: substrate authoring must require this lens

H.* makes the substrate detect drift, identify supersession
candidates, and apply them. But H.* alone does not make the
substrate's future proposals self-aware of the substrate-citizen
lens. Without I.*, the next `draft-spec-from-gap` invocation
produces another operator-pattern spec (motivation + tasks + done)
and an operator has to add the H-equivalent section again. Same
class of gap as today, one recursion shallower.

- [ ] I.1  Extend `draft-spec-from-gap` template so every emitted proposal contains a mandatory `## How the substrate should do this itself` section, populated by the template — not by a downstream reviewer. The section is empty-but-present if no substrate counterpart is known, with `<gap>` markers. An empty-but-present section is fine; a missing section is the failure mode.
- [ ] I.2  Author `review-spec-substrate-coverage` activity. Single-resolver, server-side: scans any new file under `openspec/changes/*/proposal.md`, regex-checks for the `## How the substrate should do this itself` header, regex-checks that each operator-authored task in `tasks.md` has a substrate-citizen counterpart in the same change directory. Emits `specSubstrateCoverageReport` impulse. No LLM, no iteration — canonical immunity pattern.
- [ ] I.3  Wire `review-spec-substrate-coverage` to fire on every commit that touches `openspec/changes/`. The substrate refuses to merge (or flags `interventionRefused` per IAL §27.S.6 push-away) a proposal that fails the coverage check. This is the active-push-away signal that distinguishes S3 from "operator just got better at remembering."
- [ ] I.4  After I.1 ships: the `draft-spec-from-gap` template must include in EVERY proposal it authors a third-level reflection: "would this proposal's authoring activity have remembered to include this reflection?" If the template can't answer yes by self-reference, the template is incomplete. This is the recursion's fixed point.
- [ ] I.5  Audit existing proposals under `openspec/changes/` for the same missing reflection. Each one is a retro-gap. Don't backfill — log them as `historicalSpecGap` impulses so the magnitude of the drift is visible.

## Recursive substrate-self-detection note

The very gap this proposal opened — "concept-db has accumulated drift
and there's no substrate-citizen way to notice or fix it" — was found
by an operator running a manual three-agent audit. That operator
action is itself a missed substrate-citizen activity, per
`feedback_substrate_self_detection_recursive`. The lift criterion
(IAL §27.S.4) is satisfied when audits like this run substrate-side
on schedule and `draft-spec-from-gap` authors the follow-up
proposals without operator dispatch. H.* exists to close that
specific loop; the next audit-class gap (e.g. "no one noticed
discovery-vessel registry stale entries for 3 weeks") will surface
the next missing detection, and so on.

This proposal MUST land H.* alongside A–G, not as a follow-up. If
A–G ship without the detection activities, the substrate gets fixed
plumbing but no closed loop, and the next drift episode requires
another operator-side audit. The substrate-citizen counterparts are
the load-bearing piece for S2 → S3.

## Out of scope

- Hard delete of superseded concepts. Tracking only.
- Chain supersession (A supersedes B supersedes C). Single-hop only; chains land in a follow-up if usage warrants.
- Re-ingesting CLAUDE.md. Natural follow-up once D.* lands.
- A separate `deprecated` field. Supersession-with-null-target IS deprecation.
