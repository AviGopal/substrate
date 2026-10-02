# Tasks — concept-db upkeep loop

Each section corresponds to one of the eight truth-and-currency
properties. Each property has BOTH operator-implementation tasks
(today's reality) AND substrate-author tasks (what the substrate
would itself need to produce, post-sibling-I.1, to make this proposal
unnecessary). The property-as-section structure is the
substrate-citizen lens made structural.

All detection activities follow the canonical immunity pattern from
`feedback_substrate_self_detection_recursive`: `inputShapes: []`,
`variables: []`, single server-side resolver, no LLM, no iteration.

## A. Provenance

- [ ] A.1  Add `source_uri: z.string().nullable().optional()` and `provenance_unknown: z.boolean().optional()` to the concept schema in `repos/concept-db/src/models/schemas.ts`. SurrealQL `DEFINE FIELD OVERWRITE` migration mirrored on sibling §A.3.
  ```sql
  DEFINE FIELD OVERWRITE source_uri ON concept TYPE option<string>;
  DEFINE FIELD OVERWRITE provenance_unknown ON concept TYPE option<bool> DEFAULT false;
  ```
- [ ] A.2  In `repos/concept-db/src/resolvers/concept.ts` `createConcept`, require either `source_uri` or `provenance_unknown: true`. Reject writes that supply neither with 422.
- [ ] A.3  Backfill: mark all 604 existing concepts `provenance_unknown: true`. One-shot migration; idempotent.
- [ ] A.4  Author `extract-concept-with-provenance` activity (immunity: inputShapes:[], single resolver, no LLM, no iteration). The activity's resolver is the write-side enforcement layer added in A.2 — the activity exists so the substrate's own authoring loop can reference it.

## B. Currency

- [ ] B.1  Add a `pinned_commit_hash: z.string().nullable().optional()` field to the concept schema; SurrealQL migration alongside A.1.
- [ ] B.2  Implement `watch-concept-sources` activity (immunity: inputShapes:[], single resolver, no LLM, no iteration). Resolver: for each concept with non-null `source_uri` + `pinned_commit_hash`, compare against current repo HEAD; emit one `conceptSourceChanged` impulse per drift.
- [ ] B.3  Schedule `watch-concept-sources` daily via substrate timer (file under `scripts/substrate/units/`).
- [ ] B.4  Confirm `draft-spec-from-gap` subscribes to `conceptSourceChanged`. If not, file follow-up gap.

## C. Convergence

- [ ] C.1  Implement `detect-concept-duplicates` activity (immunity: inputShapes:[], single resolver, no LLM, no iteration). Resolver: SurrealQL `SELECT shape, source_type, source_uri, count() AS n, array::group(id) AS ids FROM concept GROUP BY shape, source_type, source_uri HAVING n > 1`. One `conceptDuplicateCluster` impulse per cluster. **Scope boundary:** duplicate clustering only. Structural malformation (heading-slug shapes, runaway content, template literals) is delegated to sibling supersession spec §H.1 (`detect-concept-db-drift`). The two scans are complementary; do not merge.
- [ ] C.2  Schedule hourly.
- [ ] C.3  Wire `conceptDuplicateCluster` consumer: emit a `supersessionCandidate` (per sibling §H.2 schema) for the lower-relevance member of each pair, suggesting the higher-relevance one as replacement.

## D. Coverage

- [ ] D.1  Implement `detect-concept-coverage-gap` activity (immunity: inputShapes:[], single resolver, no LLM, no iteration). Resolver enumerates canon source paths: `CLAUDE.md`, every `repos/*/README.md`, every `openspec/changes/*/proposal.md`. For each path, query concept-db for any concept whose `source_uri` matches. Emit one `conceptCoverageGap` impulse per uncovered path.
- [ ] D.2  Schedule daily.
- [ ] D.3  Confirm `draft-spec-from-gap` subscribes to `conceptCoverageGap`. The substrate authoring its own ingestion follow-ups closes this loop.

## E. Calibration

- [ ] E.1  Implement `recalibrate-concept-relevance` activity (immunity: inputShapes:[], single resolver, no LLM, no iteration). Resolver: for each concept with `times_succeeded + times_failed >= 5`, compute Thompson-style posterior mean `(α + s) / (α + β + s + f)` with α=β=1, set `relevance` to that value clamped to `[0.05, 1.0]`. No update for concepts below the sample threshold.
- [ ] E.2  Schedule daily.
- [ ] E.3  Confirm `times_loaded` / `times_succeeded` / `times_failed` are being written. If not, the calibration activity is a no-op — file a write-path gap.

## F. Retrievability

- [ ] F.1  Add a `canon_terms: z.array(z.string()).nullable().optional()` field to the concept schema. This is the explicit list of terms the concept claims to be findable by; populated at write time by the ingestion pipeline (see sibling supersession-spec §D.2.1 which patches the chunker to write this field; without that, the probe runs only against newly-extracted concepts).
- [ ] F.1.1  One-shot backfill activity `backfill-canon-terms-from-shape` (immunity: inputShapes:[], single resolver, no LLM, no iteration). For every concept with `canon_terms IS NONE`, derive a minimal term list from `shape` (snake-case split) + `summary` (first 5 tokens). Emits `canonTermsBackfilled` impulse with count. Runs once, gated on `provenance_unknown != true` to avoid blessing un-provenanced concepts with synthetic terms. Concepts that fail the gate emit `canonTermsBackfillSkipped` instead.
- [ ] F.2  Implement `probe-retrievability-by-name` activity (immunity: inputShapes:[], single resolver, no LLM, no iteration). Resolver: writes a concept with a unique nonce string in its content + canon_terms, then probes `/concepts/search` using **every documented-and-discovered query-parameter spelling** (`q`, `query`, `text`, `search`, …). If the nonce surfaces under some spellings but not others, emit a `paramContractDrift` substrate gap with `{handler_route, accepted_param_names, caller_param_names_in_use, missing_spelling}`. After probing, sample N=20 existing concepts and run `concept_search` for each one's `canon_terms` via the canonical route — if absent from top-10, emit `conceptRetrievalMiss` as before. **Rationale (2026-06-01 finding):** a narrower probe that hits only one spelling would pass while real-world callers using a different spelling silently get wrong results (today's bug at `repos/concept-db/src/routes/concepts.ts:119` is exhibit A — the route reads `query`, dev-vessel's `convergent-validity-check.ts:109` sends `q`, ghost-shape detection silently false-negatives). The probe and the buggy caller must share the failure mode for the probe to catch it; testing every spelling is the cheapest way to share all of them.
- [ ] F.3  Schedule hourly.
- [ ] F.4  Confirm `draft-spec-from-gap` subscribes to both `conceptRetrievalMiss` and `paramContractDrift`. Misses are the substrate noticing its own index is failing; param-contract drift is the substrate noticing its own callers and handlers have disagreed on a wire format.
- [ ] F.5  Extend probe scope beyond concept-db search: any HTTP route a substrate vessel exposes with optional query parameters is a `paramContractDrift` candidate. Phase 1 covers concept-db only; phase 2 generalises by scanning `c.req.query(...)` calls across all vessels and pairing with caller URL-construction sites. Out of scope for this spec; tracked as a follow-up.

## G. Decay

- [ ] G.1  Implement `decay-stale-concepts` activity (immunity: inputShapes:[], single resolver, no LLM, no iteration). Resolver applies linear decay: `relevance := max(0.05, relevance - 0.01 * weeks_since_updated_at)`. Depends on sibling §A.4 wiring `updated_at`.
- [ ] G.1.1  **Precondition assertion** at the head of every G.1 invocation: query `SELECT count() FROM concept WHERE updated_at IS NONE` and the total concept count. If null-`updated_at` ratio > 1%, the resolver MUST abort with a `decayPreconditionFailed` impulse carrying `{null_ratio, total_count, threshold: 0.01}` instead of silently running with bad data. This is the guard against sibling §A.4 slipping unnoticed: a no-op decay run is invisible without it, and the proposal's success criteria would falsely report green.
- [ ] G.2  Schedule weekly.
- [ ] G.3  After one full upkeep cycle, audit which concepts were demoted and whether the demotion was warranted. Re-evaluate the decay function shape; if linear floors out too many useful concepts, switch to a slower constant or piecewise.

## H. Verdict capture

- [ ] H.1  Add `concept_verdict` table to concept-db schema: `{id, concept_id, verdict_type, rationale, verdict_source, evidence_impulse_ids, created_at}`. SurrealQL migration alongside A.1.
- [ ] H.2  Implement `conceptVerdict_write` resolver in `repos/concept-db/src/resolvers/concept.ts`. Whitelist: `verdict_type ∈ {wrong, superseded, demote, repin, recalibrate}`.
- [ ] H.3  Implement `record-concept-verdict` activity (immunity: inputShapes:[], single resolver, no LLM, no iteration). Activity wraps the resolver so the substrate's own authoring loop can dispatch verdicts uniformly.
- [ ] H.4  Migrate Route 1's 33 `[SUPERSEDED]` prefixes into proper verdict rows. Once H.1–H.3 ship, write one `verdict_type: superseded` row per Route-1 entry referencing the original rationale.

## I. Self-application

Operator must run the loop against the current concept-db state and
confirm that, post-this-spec, the substrate would (a) emit baselines
for each property and (b) trigger the I.2/I.3 push-away on a
deliberately-malformed test concept.

- [ ] I.1  Run all 8 detection activities (A.4, B.2, C.1, D.1, E.1, F.2, G.1, H.3) against the current concept-db state. Capture each emitted report as a baseline `*_baseline_2026-06-01.json` artifact under `validation/findings/concept-db-upkeep/`.
- [ ] I.2  Feed each baseline report into `draft-spec-from-gap` (once sibling I.1 lands). Confirm the spec it authors would meaningfully address the gap. If not, the authoring template is incomplete — file a follow-up.
- [ ] I.3  Inject a deliberately-malformed test concept (e.g. shape = `{{template_leak}}`, source_uri unset, content 100 KB). Confirm that an operator PATCH attempting to demote it WITHOUT a prior detection impulse triggers `interventionRefused` per sibling I.3 push-away wiring.
- [ ] I.4  Measure how many of the 8 properties' detection activities had at least one report impulse in the first 7 days post-deploy. Below 6/8 = the loop has not fully engaged; identify the silent activity and check its trigger path.
- [ ] I.5  Recursive: would the substrate's `draft-spec-from-gap`, once I.1 lands, have included §I (this section) in the proposal it authored? If the answer is "only if sibling I.4 ships," log a `historicalSpecGap` impulse referencing this proposal as the canonical example. The recursion's fixed point lives in sibling I.4; this task makes the dependency explicit.

## Out of scope

- Hard delete of any concept (covered by sibling non-goals).
- Chain supersession (single-hop only per sibling).
- Re-ingesting CLAUDE.md (sequenced after sibling D.* chunker fixes).
- Embedding-cosine duplicate detection (deterministic triple-key first; revisit after measurement).
- LLM-driven anomaly detection on concept content (immunity pattern rules it out).
