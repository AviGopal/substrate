## Why

Thompson posteriors today are keyed on `(template_id, variant_id)` in `variant_performance_metrics` and — when goal/shape context is supplied — on a coarse 8-character `context_bucket` in `context_thompson_scores` (computed by `computeContextBucket(taskDescription, impulseShapes, orgId)` in `repos/metabob-activity-api/src/utils/session-context.ts:115-129`). The bucket already exists, but it is **not load-bearing** in the read path: `applyCompatibilityFilter` in `repos/metabob-activity-api/src/services/recommendation.ts:74-131` multiplies raw template `alpha`/`beta` by a compatibility discount; it does not look up a conditional posterior. Phase 11 surfaced the state space (`impulse_state_space`, `pointer_state_space`, `blocking_shapes`); Phase 20 added provenance predicates (`producedBy` on shape refs, via `repos/minibob/src/shape-resolver.ts:20-27`). The remaining gap is that the *learning signal* still aggregates across heterogeneous binding contexts. We're learning "template X has α=15, β=3" when we should be learning "template X under state signature S₁ has α=15, β=0; under S₂ has α=0, β=3" — i.e., the difference between memorising identity and learning behaviour.

A bucket exists, the substrate to write it exists (`writeAncestorDelta` already updates `context_thompson_scores` when a `context_bucket` is passed — `repos/metabob-activity-api/src/lib/posterior-update.ts:220-286`), but the recommendation read path never queries it, the signature is coarse (8 hex chars, no provenance, no missing-shape awareness), and there is no acceptance test that conditional keying *helps*. This change makes the state-space signature the load-bearing key for Thompson reads and writes, falls back to the template-level aggregate when the conditional bucket is undersampled, and instruments the harness from `2026-05-06-recommendation-validation-v2` to measure discrimination.

## What Changes

- Define **`state_space_signature`** as a versioned, deterministic hash over `(sorted shape multiset, sorted (shape, producedBy?) tuples, sorted missing-shape set, signature_version)` — supersedes the goal-cluster-byte component of today's `context_bucket` with a structurally-justified composition.
- Extend `context_thompson_scores` (migration adds `signature_version`, `n_observations` already present) so the table can host both legacy 8-hex buckets and new versioned signatures during the migration window.
- **Read path**: `applyCompatibilityFilter` and the recommend handler at `repos/metabob-activity-api/src/routes/activities.ts:4397-4400` look up `(template_id, signature)` first; when `n_observations < SIGNATURE_SAMPLING_FLOOR` (default 5) the lookup falls through to the template-level `variant_performance_metrics` row.
- **Write path**: `applyOutcomeToPosteriors` (`repos/metabob-activity-api/src/lib/posterior-update.ts`) derives the signature at write time from `presentShapesPre` / `currentImpulseShapes` / per-task `input_impulse_ids` already on the trace, and emits α/β increments to the conditional bucket *in addition to* the template-level row.
- **Failure-mode stratification (Phase 18.3)** applies per-bucket the same way it applies globally — verifier_negative writes β=1, budget_exhausted β=0.5, etc., to the conditional bucket.
- **Chain-credit (Phase 18.4)** updates each ancestor's conditional bucket using the **ancestor's** state-space signature at its own binding time, not the leaf's. Today `writeAncestorDelta` is called with the *leaf's* `context_bucket` (`posterior-update.ts:308`, `369`); the spec corrects this.
- **Cardinality control**: low-count signatures (`n_observations < SIGNATURE_SAMPLING_FLOOR` after 30 days) collapse to a coarser bucket (shape-multiset-only, dropping provenance and missing-shape components); the coarser bucket itself collapses to the template-level row.
- **Harness instrumentation**: extend `validation/scripts/reuse-harness.ts` to emit a per-template discrimination statistic — for any template with `total_observations ≥ 50`, find the two highest-population signature buckets and Welch-t-test their empirical success rates. The aggregate count of templates with `p < 0.05` is the load-bearing acceptance number.

## Capabilities

### New Capabilities

- `state-space-signature` — deterministic, versioned hash over impulse-pool shape+provenance+missing context; computed identically on minibob (write path) and activity-api (read path); stable across pod restarts.
- `conditional-thompson-keying` — recommend handler reads `context_thompson_scores` by `(template_id, signature)` with a sampling-floor fallback to `variant_performance_metrics`; write path emits α/β to both rows.

## Success Criteria

The change is complete when, against canary at `activity.metabob.com`:

1. **Signature derivation is reproducible** — given the same `presentShapesPre` + per-task `input_impulse_ids` + signature version, minibob and activity-api compute byte-identical signatures. Verified by a property test in `repos/metabob-activity-api/test/state-space-signature.test.ts` and a cross-vessel round-trip integration test.
2. **Conditional rows accumulate** — 7 days after deploy, ≥ 80 % of execution traces with non-empty `presentShapesPre` have produced a `context_thompson_scores` row with `n_observations ≥ 1`. Measured by SurrealQL count.
3. **Discrimination is measurable** — for templates with `total_observations ≥ 50` across all buckets, at least 25 % exhibit two signature buckets whose empirical success rates differ at `p < 0.05` (Welch t-test, n₁,n₂ ≥ 5 each). This is the load-bearing test: it proves the conditional keying captures real heterogeneity, not noise.
4. **Recommendation quality does not regress** — the `2026-05-06-recommendation-validation-v2` harness shows `recommend_mrr` post-deploy ≥ post-deploy MRR pre-change minus 0.02 (no regression band). Ideally it improves on the templates flagged in (3).
5. **Backward compatibility** — when no `presentShapesPre` is supplied (legacy traces, browser-initiated recommend without `impulse_state_space`), the system falls through to template-level posteriors. Existing harness entries unchanged.
6. **No runaway cardinality** — after 30 days, no template has > 200 distinct signatures with `n_observations ≥ 1`. Coarse-bucket collapse keeps the long tail bounded.

## Impact

- `repos/metabob-activity-api/sql/migrations/` — one new migration adds `signature_version: int DEFAULT 0` to `context_thompson_scores` and an index on `(org_id, template_id, signature_version, context_bucket)`.
- `repos/metabob-activity-api/src/utils/session-context.ts` — new `computeStateSpaceSignature(input)` alongside legacy `computeContextBucket`; the latter becomes a thin adaptor that returns a v0 signature for back-compat.
- `repos/metabob-activity-api/src/services/recommendation.ts` — `applyCompatibilityFilter` reads conditional posteriors; new helper `lookupConditionalPosterior(templateId, signature, orgId, db)`.
- `repos/metabob-activity-api/src/lib/posterior-update.ts` — write path emits to both `variant_performance_metrics` and `context_thompson_scores`; `propagateCreditAlongChain` updates each ancestor's *own* signature.
- `repos/minibob/src/impulse.ts` + activity executor — derive signature at trace-write time and embed it in the trace `metadata.state_space_signature`.
- `validation/scripts/reuse-harness.ts` — discrimination instrumentation; new report section.

## Dependencies

- **Phase 11** (`2026-04-26-impulse-activity-loop/tasks.md:348-378`) — DONE 2026-05-16. State-space surfaces `impulse_state_space` and `blocking_shapes`. Required: signature derivation reuses `presentShapesPre`. **Hard dependency.**
- **Phase 18.3** (`2026-04-26-impulse-activity-loop/tasks.md:941-953`) — DONE. `applyOutcomeToPosteriors` is the single write entry point; this change extends it. **Hard dependency.**
- **Phase 18.4** (`2026-04-26-impulse-activity-loop/tasks.md:955-968`) — DONE 2026-05-15. `propagateCreditAlongChain` exists and writes to `context_thompson_scores` when given a `context_bucket`. This change corrects the leaf-vs-ancestor signature bug (currently propagates the leaf's bucket). **Hard dependency.**
- **Phase 20** (`2026-04-26-impulse-activity-loop/tasks.md:1086-1156`) — predicate-aware binding. The provenance component (`(shape, producedBy)` tuples) requires the `producedBy` field on `BindableSlot` and on `impulse.metadata` (`repos/minibob/src/shape-resolver.ts:20-27`). **Soft dependency**: a v1 signature without the provenance component still works under Phase 11 alone; v2 requires Phase 20 (already shipped).
- **Phase 19** (`2026-05-06-recommendation-validation-v2`) — the harness extension lives here, and the discrimination metric is the acceptance gate. **Hard dependency on the harness; soft on the regression gate** (Phase 19's weekly-validation workflow is the natural home for the new metric).

No new sibling spec required; this change is self-contained.
