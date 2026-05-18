# Tasks — Chain-Credit Ancestor Signature Fix

**Status:** Draft, not started.

**Dependencies:** none beyond deployed code. `computeContextBucket` (`repos/metabob-activity-api/src/utils/session-context.ts:115-129`) and `activity_execution_traces.input_impulse_shapes` (column populated since 2026-05) are already on canary.

**Sequencing principle.** Test-first: write the failing test that proves the bug, then fix the call sites with the minimum diff, then deploy and audit. This is a surgical correction; no migration, no schema change, no new capability.

---

## 1. Reproduce the bug in test

- [ ] 1.1 Add a new case to `repos/metabob-activity-api/test/posterior-update.test.ts` describing a 3-deep chain `[A, B, C]` where each ancestor's mocked `activity_execution_traces` row carries distinct `input_impulse_shapes`. Drive `propagateCreditAlongChain` and assert each ancestor's conditional write targets the bucket recomputed from its **own** trace row. The test must fail against the current implementation. (`repos/metabob-activity-api`)
- [ ] 1.2 Mark the two existing cases at `test/posterior-update.test.ts:493-513` as encoding the bug (xfail or skip with a TODO referencing this change) until §2 lands. (`repos/metabob-activity-api`)

## 2. Fix the call sites

- [ ] 2.1 In `repos/metabob-activity-api/src/lib/posterior-update.ts:70-82`, remove `context_bucket?: string | null` from `ExecutionForChainCredit`. Update the type-level docstring at lines 66-69 to explain that buckets are now derived per-ancestor inside the function. (`repos/metabob-activity-api`)
- [ ] 2.2 Extend the ancestor-metadata SELECT at `posterior-update.ts:325-341` to also fetch `task_description` and `input_impulse_shapes`. Map into `ancestorMetaByExecId: Map<string, { variant_id: string, task_description?: string, input_impulse_shapes?: string[] }>`. (`repos/metabob-activity-api`)
- [ ] 2.3 Inside the ancestor loop at `posterior-update.ts:343-370`, after resolving `ancestorId`, compute the per-ancestor bucket via `computeContextBucket(row.task_description ?? '', row.input_impulse_shapes, orgId)` when `input_impulse_shapes` is non-empty; otherwise set `bucket = null` and increment a `legacySkips` counter. Pass the computed `bucket` to `writeAncestorDelta`. Import `computeContextBucket` from `../utils/session-context`. (`repos/metabob-activity-api`)
- [ ] 2.4 Drop the `context_bucket: null` literal at `posterior-update.ts:464` (no longer a field on the type). Confirm `applyOutcomeToPosteriors` still typechecks. (`repos/metabob-activity-api`)
- [ ] 2.5 Rewrite the two existing test cases unstuck in §1.2 to reflect the corrected contract — each ancestor's bucket is computed from that ancestor's mocked trace row, not the leaf's. Confirm §1.1 now passes. (`repos/metabob-activity-api`)
- [ ] 2.6 Run `bun test src/lib/posterior-update.test.ts` and `bun run lint` (which includes `scripts/check-shape-dispatch.ts` per `repos/metabob-activity-api/CLAUDE.md`); both must be green. (`repos/metabob-activity-api`)

## 3. Observability

- [ ] 3.1 Emit the `legacySkips` counter via `logger.info` at the end of `propagateCreditAlongChain`, structured as `{ event: 'chain_credit_legacy_skip', org_id, total_ancestors, skipped, leaf_activity_id }`. One log line per propagation, not per skip. (`repos/metabob-activity-api`)
- [ ] 3.2 Smoke-test the log in dev: run an execution against a synthetic chain with one legacy ancestor (mock `input_impulse_shapes` as undefined) and grep for `chain_credit_legacy_skip` in stdout. (`repos/metabob-activity-api`)

## 4. Deploy to canary and verify

- [ ] 4.1 Commit + push to `dev`; CI deploys to canary at `activity.metabob.com` per `repos/deployment/DEPLOYMENT_WORKFLOW.md`. Confirm new pod is `1.20.x-<sha>` and `/health` is green. (`repos/deployment`)
- [ ] 4.2 Drive a small handful of nested executions via `minibob --single` (at least 3 composed activities) to populate `composition_chain` rows on canary. (`repos/minibob`)
- [ ] 4.3 Audit script: write a one-shot SurrealQL query in `validation/scripts/audit-chain-credit-buckets.ts` that joins `context_thompson_scores` written in the 24 h since deploy against `activity_execution_traces` and asserts ≥ 99 % of rows match `computeContextBucket(trace.task_description, trace.input_impulse_shapes, trace.org_id)`. Persist the result to `validation/results/2026-05-18-chain-credit-bucket-audit.json`. (`repos/metabob-devbob`)
- [ ] 4.4 Inspect canary logs for `chain_credit_legacy_skip` lines; record the distribution of `skipped / total_ancestors` ratios in `validation/baselines/2026-05-18-chain-credit-hotfix.json` alongside the deploy timestamp. (`repos/metabob-devbob`)

## 5. Document the data-quality boundary

- [ ] 5.1 Write `validation/baselines/2026-05-18-chain-credit-hotfix.json` with shape `{ "hotfix_deployed_at": "<ISO>", "pre_fix_window": { "start": "2026-05-15T00:00:00Z", "end": "<deploy-ISO>" }, "affected_row_count": 0, "note": "Preventive fix. In-tree caller hardcoded context_bucket=null at posterior-update.ts:464 so no production rows were mis-keyed; bug fixed before larger 2026-05-17-state-space-signature-thompson-keying spec activates the path." }`. (`repos/metabob-devbob`)
- [ ] 5.2 Add a one-line back-pointer from `openspec/changes/2026-05-17-state-space-signature-thompson-keying/proposal.md:14` (the existing call-out of this bug) to this change once it archives. Non-blocking; can be done during archive. (`repos/metabob-devbob`)
