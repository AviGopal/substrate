## Why

`propagateCreditAlongChain` in `repos/metabob-activity-api/src/lib/posterior-update.ts:303-371` destructures a single `context_bucket` off the leaf execution (line 308) and passes that same value to `writeAncestorDelta` for every ancestor in the loop (line 369). The bucket is the leaf's binding-time signature, not the ancestor's. Any conditional `context_thompson_scores` row written through this path is keyed against the wrong context.

The bug is **latent in production today** — `applyOutcomeToPosteriors` hardcodes `context_bucket: null` when it fires chain propagation (`posterior-update.ts:464`), so no conditional rows are actually being written via chain credit at the moment. But: (a) test cases at `repos/metabob-activity-api/test/posterior-update.test.ts:493-513` already exercise the non-null path with the wrong semantics baked in, (b) the larger spec `2026-05-17-state-space-signature-thompson-keying` will activate the path in a few weeks and would compound the bug across thousands of ancestor rows, and (c) any external/test caller passing a non-null bucket today silently writes wrong rows. Fix the wiring now, while the data-corruption window is empty.

## What Changes

- Replace the single `context_bucket` parameter on `ExecutionForChainCredit` with a per-ancestor lookup: for each ancestor about to receive a write, fetch that ancestor's own `input_impulse_shapes` (and task description) from its `activity_execution_traces` row and recompute its bucket via the existing `computeContextBucket` in `repos/metabob-activity-api/src/utils/session-context.ts:115-129`.
- When an ancestor trace lacks the context fields (legacy rows pre-Phase 11, or non-shape-aware writes), skip the conditional `context_thompson_scores` write for that ancestor only and still write the template-level `variant_performance_metrics` row. Emit a counter so the skip rate is observable.
- Fix the two test cases at `posterior-update.test.ts:493-513` that currently bake in the leaf-bucket assumption; add a new test that asserts each ancestor receives its **own** computed bucket given heterogeneous chain context.
- No new signature scheme. No new migration. `computeContextBucket` stays the source of truth until `2026-05-17-state-space-signature-thompson-keying` lands.

## Capabilities

No new capabilities. This is a bug fix in an existing code path.

## Success Criteria

1. **Correct keying** — given a 4-deep chain where each ancestor has distinct `input_impulse_shapes` in its trace row, the four resulting conditional writes target four distinct `context_bucket` values, each matching `computeContextBucket(ancestor.task_description, ancestor.input_impulse_shapes, org_id)`. Verified by a new unit test in `repos/metabob-activity-api/test/posterior-update.test.ts`.
2. **Production correctness gate** — on canary, ≥ 99 % of conditional rows written via `propagateCreditAlongChain` in a 24-hour window match the bucket recomputed from the producing ancestor's trace row. Measured by a one-shot SurrealQL audit script.
3. **Skip-rate observable** — a `chain_credit_legacy_skip` debug counter increments whenever an ancestor's trace row lacks the context fields; emitted from `writeAncestorDelta`'s caller. Captured in canary logs.
4. **No regression of existing tests** — all currently-passing tests in `repos/metabob-activity-api/test/posterior-update.test.ts` (16 cases at last count) remain green after the call-site update.

## Impact

- `repos/metabob-activity-api/src/lib/posterior-update.ts` — `ExecutionForChainCredit` loses its `context_bucket` field; `propagateCreditAlongChain` gains a per-ancestor bucket recomputation (one extra SELECT on `activity_execution_traces` to grab `task_description` + `input_impulse_shapes`; can piggyback on the existing exec→variant lookup at `posterior-update.ts:325-341`).
- `repos/metabob-activity-api/src/lib/posterior-update.ts:464` — `applyOutcomeToPosteriors` removes the hardcoded `context_bucket: null` (it's no longer threaded that way).
- `repos/metabob-activity-api/test/posterior-update.test.ts` — two existing cases corrected, one new heterogeneous-chain case added.

## Dependencies

None beyond what is already deployed. `computeContextBucket` is shipped. `activity_execution_traces.input_impulse_shapes` is populated (added 2026-05 alongside Phase 11). This change ships independently of `2026-05-17-state-space-signature-thompson-keying` and will be cleanly subsumed by it: the per-ancestor recomputation pattern introduced here is the same shape the larger spec needs, just with the v1 signature swapped in for the v0 bucket.
