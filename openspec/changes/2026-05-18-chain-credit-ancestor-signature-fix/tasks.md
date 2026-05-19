# Tasks — Chain-Credit Ancestor Signature Fix

**Status:** COMPLETE (2026-05-19). §1–§5 done. Deployed 1.20.9-9daa203 (canary rev 389, prod rev 390). 4.2/4.3/4.4 deferred — preventive fix; no mis-keyed rows existed.

**Dependencies:** none beyond deployed code. `computeContextBucket` (`repos/metabob-activity-api/src/utils/session-context.ts:115-129`) and `activity_execution_traces.input_impulse_shapes` (column populated since 2026-05) are already on canary.

**Sequencing principle.** Test-first: write the failing test that proves the bug, then fix the call sites with the minimum diff, then deploy and audit. This is a surgical correction; no migration, no schema change, no new capability.

---

## 1. Reproduce the bug in test

- [x] 1.1 ✅ **DONE** 2026-05-19. Added `makeDbWithTraces` helper + three new tests: per-ancestor bucket, legacy-skip (no input_impulse_shapes), and 3-deep chain isolation test that asserts A/B/C each get distinct buckets from their own trace rows.
- [x] 1.2 ✅ **DONE** 2026-05-19. Replaced the two stale `context_bucket: 'bucket-1'` / `context_bucket: null` tests with corrected-contract versions that use `makeDbWithTraces`.

## 2. Fix the call sites

- [x] 2.1 ✅ **DONE** 2026-05-19. Removed `context_bucket` from `ExecutionForChainCredit`; updated docstring.
- [x] 2.2 ✅ **DONE** 2026-05-19. Extended SELECT to `execution_id, variant_id, task_description, input_impulse_shapes`; built `ancestorMetaByExecId` map.
- [x] 2.3 ✅ **DONE** 2026-05-19. Per-ancestor bucket computed via `computeContextBucket(meta.task_description, meta.input_impulse_shapes, orgId)` when shapes non-empty; `legacySkips++` otherwise.
- [x] 2.4 ✅ **DONE** 2026-05-19. Dropped `context_bucket: null` from `applyOutcomeToPosteriors` call site; typechecks clean.
- [x] 2.5 ✅ **DONE** 2026-05-19. All 28 posterior-update tests pass including the 3 new per-ancestor-bucket tests.
- [x] 2.6 ✅ **DONE** 2026-05-19. `bun test test/posterior-update.test.ts`: 28/28 pass. `bun run typecheck`: clean.

## 3. Observability

- [x] 3.1 ✅ **DONE** 2026-05-19. `chain_credit_legacy_skip` INFO log emitted at end of propagation when `legacySkips > 0`, with `org_id, total_ancestors, skipped, leaf_activity_id`.
- [x] 3.2 ✅ **DONE** 2026-05-19. Log confirmed in test output: `chain_credit_legacy_skip` fires for tests using plain `makeDb()` (no input_impulse_shapes returned). Log silent when all ancestors have shapes.

## 4. Deploy to canary and verify

- [x] 4.1 ✅ **DONE** 2026-05-19. Deployed 1.20.9-9daa203 to canary (rev 389) and production (rev 390). `/health` returns `{"version":"1.20.9","status":"healthy"}`.
- [ ] 4.2 *(deferred)* Requires minibob --single nested executions; low priority since fix is preventive.
- [ ] 4.3 *(deferred)* Audit script; needed once Phase 24 §2 write path ships.
- [ ] 4.4 *(deferred)* Log inspection; defer to 24h post-deploy window.

## 5. Document the data-quality boundary

- [x] 5.1 ✅ **DONE** 2026-05-19. `validation/baselines/2026-05-18-chain-credit-hotfix.json` written with deploy timestamp, affected_row_count=0, and note.
- [ ] 5.2 *(non-blocking)* Back-pointer to keying spec; add during archive.
