# Design — Chain-Credit Ancestor Signature Fix

## The bug, in code

`repos/metabob-activity-api/src/lib/posterior-update.ts`:

- Line 70-82 — `ExecutionForChainCredit` carries a single `context_bucket?: string | null`. The docstring says "When set, writes are also applied to `context_thompson_scores` keyed by this bucket" without specifying *whose* bucket.
- Line 308 — `propagateCreditAlongChain` destructures `context_bucket` from the leaf execution: `const { composition_chain, success, failure_mode, context_bucket } = execution;`
- Line 343-370 — the ancestor loop walks `composition_chain` (reversed: closest ancestor first), resolves each `ancestorExecId` to a `variant_id` via `activity_execution_traces`, computes a decayed (α, β) delta, and calls `writeAncestorDelta(ancestorId, alphaDelta, betaDelta, db, orgId, context_bucket)` — passing the **leaf's** `context_bucket` for every ancestor.
- Line 220-286 — `writeAncestorDelta` does the right thing for the bucket it is given: it writes to `variant_performance_metrics` always, and to `context_thompson_scores WHERE variant_id = $activity_id AND org_id = $org_id AND context_bucket = $context_bucket` when the bucket is non-null. The bug is upstream; this function is a faithful executor.

What "wrong" means concretely: if leaf D was bound in context-shape-set `{file, gitDiff}` (bucket `b_D`), and ancestor B was bound in `{goal, directoryTree}` (bucket `b_B`), then the credit for B's α/β under heterogeneous bindings would be written to row `(B, b_D)` — a context B never actually saw. When read back at recommend time, `b_D` looks up nothing useful for B, and conversely `b_B` (B's true context) accumulates no chain-credit signal.

### Why this is not yet poisoning production

`applyOutcomeToPosteriors` is the only in-tree caller of `propagateCreditAlongChain` and hardcodes `context_bucket: null` at `posterior-update.ts:458-465`. So in the steady state of canary today, every chain-credit invocation skips the conditional-row write entirely (line 257 in `writeAncestorDelta`: `if (contextBucket != null) { ... }`). The bug is a footgun for:

1. Test cases at `test/posterior-update.test.ts:493-513` that exercise non-null buckets and currently encode the wrong behaviour as expected.
2. The next-up `2026-05-17-state-space-signature-thompson-keying` spec, which will start passing a non-null signature/bucket through chain credit and would, without this fix, silently mis-key every ancestor write across the entire posterior table.
3. Any external caller (none today) reaching `propagateCreditAlongChain` with a non-null bucket.

Fixing the wiring now, while the data is still clean, costs one PR; fixing it after the larger spec activates the path would require a backfill scan across tens of thousands of rows.

## The fix

Drop `context_bucket` from `ExecutionForChainCredit`. Inside `propagateCreditAlongChain`, the same SELECT that today resolves execution IDs to variant IDs (`posterior-update.ts:325-341`) grows two columns:

```sql
SELECT execution_id, variant_id, task_description, input_impulse_shapes
FROM activity_execution_traces
WHERE execution_id IN $ids AND org_id = $org_id
```

For each ancestor, the loop body becomes:

```typescript
const row = ancestorMetaByExecId.get(ancestorExecId);
const ancestorId = normalizeActivityId(row?.variant_id ?? ancestorExecId);
let bucket: string | null = null;
if (row?.input_impulse_shapes?.length) {
  bucket = computeContextBucket(
    row.task_description ?? '',
    row.input_impulse_shapes,
    orgId,
  );
} else {
  legacySkips++;  // emitted as `chain_credit_legacy_skip` metric
}
await writeAncestorDelta(ancestorId, alphaDelta, betaDelta, db, orgId, bucket);
```

`computeContextBucket` in `repos/metabob-activity-api/src/utils/session-context.ts:115-129` is used as-is — three string inputs in, an 8-character hex bucket out. No new signature scheme.

`applyOutcomeToPosteriors` at `posterior-update.ts:457-474` drops the `context_bucket: null` field from the literal it passes; the field no longer exists on the type.

### Legacy traces

`activity_execution_traces` rows pre-Phase-11 do not populate `input_impulse_shapes`; we cannot reconstruct their binding-time context after the fact. For those ancestors the design **skips the conditional write only** and still writes the template-level row. This is strictly better than today's behaviour (template row written, no conditional row at all when bucket is null). The skip is counted via a debug metric so we can observe how much of the chain-credit signal is template-level-only and budget the larger-spec rollout accordingly. Expected skip-rate at canary: ~30 % initially (chains that include any pre-2026-05 ancestor), decaying toward zero as legacy traces age out.

`task_description` on the ancestor's trace may be empty even when `input_impulse_shapes` is populated; `computeContextBucket` handles an empty string cleanly (the `tagPrefixes` slice is just empty), so we do not need to skip in that case — the bucket is just slightly coarser, which matches the larger spec's coarse-bucket-collapse behaviour anyway.

## Relationship to `2026-05-17-state-space-signature-thompson-keying`

The larger spec replaces `computeContextBucket` with a versioned `computeStateSpaceSignature` carrying provenance and missing-shape components, and introduces a `signature_version` column on `context_thompson_scores`. Its task §2.3 already calls out *"`propagateCreditAlongChain` updates each ancestor's conditional bucket using the **ancestor's** state-space signature at its own binding time, not the leaf's"* — i.e., this exact fix, layered onto the new signature.

This hotfix and the larger spec compose cleanly:

- **Surface area**: same — the per-ancestor SELECT, the per-ancestor compute, the per-ancestor write. The hotfix introduces the *shape* of the fix using v0 buckets; the larger spec swaps `computeContextBucket(taskDesc, shapes, orgId)` for `computeStateSpaceSignature({ shapes, provenance, missing, version: 1 })` and threads `signature_version` through.
- **Type changes**: the larger spec adds `signature` + `signature_version` to `applyOutcomeToPosteriors`'s input. The hotfix changes `ExecutionForChainCredit` (removes a field). The two diffs touch overlapping lines but in non-conflicting ways — the larger spec will rebase trivially onto this fix.
- **Subsumption**: when the larger spec lands, the v0 `computeContextBucket` call introduced by this hotfix becomes the fallback path for traces without a v1 signature in metadata. The hotfix is not deleted; it degrades to a back-compat shim.

If for any reason this hotfix slips past the larger spec's start of work, the larger spec must absorb the per-ancestor recomputation into its own §2.3 task — but that is strictly more risk and a larger blast radius, since both the signature scheme and the chain-credit wiring would change in one diff.

## Historical data: stop-the-bleed, do not backfill

Because the in-tree call path hardcodes `context_bucket: null`, **no mis-keyed conditional rows exist in production today**. There is no data window to repair. The risk this spec mitigates is forward-looking: it ensures the path is correct *before* any caller (the larger spec, future external callers, tests) supplies a non-null bucket.

If a test environment has accumulated rows from running `test/posterior-update.test.ts` against a real DB (unlikely — tests use a mock `DBQueryable`), drop them via:

```sql
DELETE FROM context_thompson_scores WHERE created_at < d'2026-05-18T00:00:00Z' AND <test-marker filter>;
```

Document the cutoff date in `validation/baselines/2026-05-18-chain-credit-hotfix.json` so the recommendation-validation harness can filter pre-hotfix rows out of its discrimination metric if any leaked from a non-test environment. Expected payload: `{ "hotfix_deployed_at": "<ISO>", "affected_row_count": 0, "note": "preventive; no production data corruption observed" }`.

## Out of scope

- New signature scheme (handled by `2026-05-17-state-space-signature-thompson-keying`).
- Backfilling historical rows (none exist).
- Changing `writeAncestorDelta`'s internals.
- Changing failure-mode stratification (handled by Phase 18.3).
- Changing the recommend read path to consult conditional rows (the larger spec).
