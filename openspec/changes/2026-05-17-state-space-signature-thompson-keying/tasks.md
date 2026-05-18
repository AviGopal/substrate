# Tasks — State-Space-Signature Thompson Keying

**Status:** §1 substrate complete (2026-05-18). §2 write path next.

**Dependencies (all hard except where noted):**

- Phase 11 (state-space-aware recommendations) — DONE 2026-05-16 (`2026-04-26-impulse-activity-loop/tasks.md:348-378`)
- Phase 18.3 (failure-mode-stratified updates) — DONE (`2026-04-26-impulse-activity-loop/tasks.md:941-953`)
- Phase 18.4 (composition-chain credit propagation) — DONE 2026-05-15 (`2026-04-26-impulse-activity-loop/tasks.md:955-968`)
- Phase 20 (predicate-aware binding) — provides `producedBy` plumbing on `BindableSlot` and `impulse.metadata` (`repos/minibob/src/shape-resolver.ts:20-27`). Soft: v1 signature still works without provenance under Phase 11 alone.
- Phase 19 (`2026-05-06-recommendation-validation-v2`) — harness extension home; hard dependency for §5 discrimination instrumentation.

**Sequencing principle.** Schema first (§1), then symmetric write paths so both v0 and v1 rows accumulate (§2-3), then the read path (§4) once enough v1 rows exist for the sampling floor to mean anything (~7 days of canary traffic), then the harness gate (§5), then the cardinality job (§6). Each sub-phase is independently reversible.

---

## 1. Signature substrate (schema + utility)

- [x] 1.1 ✅ **DONE** 2026-05-18. Added `sql/migrations/130-state-space-signature.surql`. (`repos/metabob-activity-api`)
- [x] 1.2 ✅ **DONE** 2026-05-18. Auto-discovered by `readdir` in `init-database.ts` — no manual roster change needed. (`repos/metabob-activity-api`)
- [x] 1.3 ✅ **DONE** 2026-05-18. Added `computeStateSpaceSignature` + `ProvenanceTuple` + `StateSpaceSignatureInput` to `session-context.ts`. Canonical ordering documented inline. (`repos/metabob-activity-api`)
- [x] 1.4 ✅ **DONE** 2026-05-18. 17 tests passing in `test/state-space-signature.test.ts`. (`repos/metabob-activity-api`)
- [x] 1.5 ✅ **DONE** 2026-05-18. Mirrored in `src/state-space-signature.ts`; 15 tests passing in `test/state-space-signature.test.ts`. Byte-identical output confirmed live. (`repos/minibob`)
- [x] 1.6 ✅ **DONE** 2026-05-18. Static fixture parity test `validation/scripts/test-state-space-signature-roundtrip.ts`; 6 fixtures pass (both vessels). (`repos/metabob-devbob`)

---

## 2. Write path — activity-api

- [ ] 2.1 In `repos/metabob-activity-api/src/routes/execution-traces.ts:2403-2533`, extend the context-bucketed write block. Read `body.metadata.state_space_signature` and `body.metadata.signature_version`. When present, write to `context_thompson_scores` with `signature_version = $version, context_bucket = $signature`. When absent, derive v1 server-side from `body.input_impulse_shapes` + `body.metadata.provenance` + `body.metadata.missing_shapes`. Keep the existing v0 write for one release cycle (parallel write). (`repos/metabob-activity-api`)
- [ ] 2.2 Extend the LET/IF/CREATE block (`execution-traces.ts:2421-2445`) to include `signature_version` in the WHERE filter and in the CREATE payload. The CREATE clause grows one new column. (`repos/metabob-activity-api`)
- [ ] 2.3 In `repos/metabob-activity-api/src/lib/posterior-update.ts:388-475`, `applyOutcomeToPosteriors` accepts an optional `signature` + `signature_version` in addition to `context_bucket`. When the signature pair is set, route the conditional write through it; otherwise preserve the existing `context_bucket` path. Failure-mode stratification (§Phase 18.3 spec) applies identically — `verifier_negative` writes β=1 to both `variant_performance_metrics` and the conditional row, etc. (`repos/metabob-activity-api`)
- [ ] 2.4 Update `repos/metabob-activity-api/test/posterior-update.test.ts` (currently 16 tests passing per `tasks.md:948`) with three new cases: (a) conditional write fires when signature present, (b) signature-absent path equivalent to today, (c) failure-mode rules apply per-bucket identically to global. (`repos/metabob-activity-api`)

---

## 3. Write path — minibob

- [ ] 3.1 In `repos/minibob/src/activity.ts` (where `lifecycle:task:preBinding` payload is constructed, search for `presentShapesPre` / `missingShapesPre`), capture provenance tuples from the current `impulseStore`: `Array<{ shape: string, producedBy?: string }>`. Use `impulse.metadata.producedBy ?? impulse.metadata.produced_at_task_id`. (`repos/minibob`)
- [ ] 3.2 At trace-write time (search for the POST to `/v2/activities/execution-traces`), compute `state_space_signature` via the minibob-side `computeStateSpaceSignature` and attach it to `body.metadata.state_space_signature` + `body.metadata.signature_version = 1`. Also attach the raw `provenance` and `missing_shapes` arrays under `body.metadata` for server-side re-derivation as a safety net. (`repos/minibob`)
- [ ] 3.3 For composition chains, attach `body.metadata.ancestor_signatures: Record<execution_id, { signature, signature_version }>` — one entry per ancestor in `composition_chain`. Each ancestor's signature is captured when its own `lifecycle:task:preBinding` fired (i.e., the ancestor's binding-time signature, not the leaf's). Capped at 16 entries by the existing Phase 18.4 cycle guard. (`repos/minibob`)
- [ ] 3.4 Add integration test `repos/minibob/test/state-space-signature-trace-write.test.ts`: run a fixture execution, intercept the POST body, assert the signature matches `computeStateSpaceSignature(presentShapesPre, provenance, missingShapesPre)`. (`repos/minibob`)

---

## 4. Read path — recommend handler

- [ ] 4.1 In `repos/metabob-activity-api/src/services/recommendation.ts`, add `lookupConditionalPosterior(templateIds: string[], signature: string, signatureVersion: number, orgId: string, db: DBQueryable): Promise<Map<string, { alpha: number, beta: number, n_observations: number } | null>>`. One SurrealQL query, joins `context_thompson_scores` against the candidate template list. Returns `null` for templates with no conditional row. (`repos/metabob-activity-api`)
- [ ] 4.2 Extend `applyCompatibilityFilter` (`recommendation.ts:74-131`) signature with optional `conditionalPosteriors?: Map<string, { alpha, beta, n_observations } | null>`. When a template has a conditional row with `n_observations >= SIGNATURE_SAMPLING_FLOOR` (default 5, env `RECOMMEND_SIGNATURE_SAMPLING_FLOOR`), use those α/β instead of the template-level fields. Annotate `_posterior_source: 'conditional' | 'template'` on the returned record for harness instrumentation. (`repos/metabob-activity-api`)
- [ ] 4.3 In `repos/metabob-activity-api/src/routes/activities.ts:4397-4400`, replace the call to `computeContextBucket` with `computeStateSpaceSignature({ shapes: impulse_state_space.map(e => e.shape), provenance: impulse_state_space.flatMap(...), missing: blocking_shapes.map(b => b.shape) })`. Pass to `lookupConditionalPosterior`; thread the result into `applyCompatibilityFilter`. (`repos/metabob-activity-api`)
- [ ] 4.4 Add 5-second per-request LRU cache for `lookupConditionalPosterior` results, keyed on `(org_id, signature, signature_version, hash-of-templateIds)`. Modeled on `CompositionChainCache` referenced in CLAUDE.md. Skip the cache when the recommend handler is in a debug/trace mode (env `RECOMMEND_DISABLE_CACHE`). (`repos/metabob-activity-api`)
- [ ] 4.5 Extend recommend response with `_posterior_source` per template entry (top-level, not per-task). Optional field, present only when `impulse_state_space` is in the request. (`repos/metabob-activity-api`)
- [ ] 4.6 Unit tests `repos/metabob-activity-api/test/recommendation-conditional.test.ts`: (a) below-floor conditional → fall through to template, (b) above-floor conditional → use conditional α/β, (c) no conditional row at all → fall through, (d) `_posterior_source` annotation correct in all three cases. (`repos/metabob-activity-api`)

---

## 5. Chain-credit signature correction

- [ ] 5.1 In `repos/metabob-activity-api/src/lib/posterior-update.ts:303-371`, extend `ExecutionForChainCredit` with `ancestor_signatures?: Map<string, { signature: string, signature_version: number }>`. Default empty. (`repos/metabob-activity-api`)
- [ ] 5.2 In `propagateCreditAlongChain`, when an ancestor's exec_id has an entry in `ancestor_signatures`, pass *that ancestor's signature* into `writeAncestorDelta` instead of the leaf's `context_bucket`. When absent, skip the conditional write for that ancestor (template-level write only). Log at `debug` level — common during the transition; never `warn`. (`repos/metabob-activity-api`)
- [ ] 5.3 Update `writeAncestorDelta` (`posterior-update.ts:220-286`) signature: accept `signature: string | null` and `signature_version: number` in place of `contextBucket: string | null`. The UPDATE/CREATE WHERE clauses gain the `signature_version` filter. (`repos/metabob-activity-api`)
- [ ] 5.4 Extend `repos/metabob-activity-api/test/posterior-update.test.ts` with the per-ancestor-signature case: 3-deep chain `A→B→C→D(leaf)`; A, B, C each carry their own signature; assert α-deltas land on the correct conditional rows, not all on the leaf's signature row. (`repos/metabob-activity-api`)

---

## 6. Harness instrumentation (the discrimination gate)

- [ ] 6.1 Expose `context_thompson_scores` as a read shape on activity-api. Add `contextThompsonScores` to the impulse-resolver dispatch in `src/routes/impulses.ts` (model after `case 'shape_gap_resolution'` referenced in `2026-04-26-impulse-activity-loop/tasks.md:331`). Returns `{ template_id, signature_version, context_bucket, alpha, beta, n_observations }` rows, paged. Advertise via `src/config.ts:227-233` shape list. (`repos/metabob-activity-api`)
- [ ] 6.2 In `validation/scripts/reuse-harness.ts`, add `computeDiscriminationStat()`: pull all conditional rows via the new shape, bucket by template_id, filter to templates with `Σ n_observations >= 50`, run Welch t-test on top-two buckets, count templates with `p < 0.05`. Emit `discrimination_report` section in the JSON output. (`repos/metabob-devbob`)
- [ ] 6.3 Add `conditional_coverage` section to the harness report: for each benchmark entry, record `_posterior_source` from the recommend response; aggregate `conditional_coverage_fraction = conditional / (conditional + template)`. (`repos/metabob-devbob`)
- [ ] 6.4 Split `recommend_mrr` into `recommend_mrr_overall`, `recommend_mrr_conditional_only`, `recommend_mrr_template_only` (subsets by `_posterior_source`). The conditional-only subset's MRR being lower than template-only MRR is the flag for "signature is hurting ranking" — recorded but not gated until ≥ 14 days of data. (`repos/metabob-devbob`)
- [ ] 6.5 Extend `.github/workflows/weekly-recommendation-validation.yml` (created in Phase 18.2.9, tasks.md:937) with one new soft-gate: after the conditional path has been live for ≥ 14 days, regression on `discriminating_fraction` of more than 0.05 week-over-week → fail the workflow. Hard-gate stays on `recommend_mrr` non-regression. (`repos/metabob-devbob`)
- [ ] 6.6 First baseline run after 7 days of v1 writes: capture `conditional_coverage_fraction`, `discriminating_fraction`, and per-source MRRs. Document in `validation/baselines/YYYY-MM-DD-signature-conditional.json`. (`repos/metabob-devbob`)

---

## 7. Cardinality control (background job)

- [ ] 7.1 Add `scripts/collapse-stale-signatures.ts` in `repos/metabob-activity-api`. Reads `context_thompson_scores` rows with `signature_version = 1, n_observations < SIGNATURE_SAMPLING_FLOOR, last_updated_at < time::now() - 30d`. For each, sums α/β into a v1c (coarse) row keyed on the shape-multiset-only hash; deletes the v1 row. Bounded by row count; pages 1000 at a time. (`repos/metabob-activity-api`)
- [ ] 7.2 Define the v1c signature: `computeStateSpaceSignature({ shapes, version: '1c' })` — same algorithm, no provenance, no missing-shapes, version token `1c`. Add to `session-context.ts` alongside v1. (`repos/metabob-activity-api`)
- [ ] 7.3 Schedule the collapse job daily via a CronJob in the helm chart `repos/deployment/charts/metabob-activity-api/templates/`. Cron expression `0 4 * * *` (04:00 UTC, off-peak). Idempotent — running it multiple times in the same day is safe. (`repos/deployment`)
- [ ] 7.4 Read-path fallback order: v1 conditional with `n >= floor` → v1c coarse with `n >= floor` → `variant_performance_metrics`. Implemented as two lookups in `lookupConditionalPosterior` with the v1c lookup gated on the v1 miss. (`repos/metabob-activity-api`)
- [ ] 7.5 Cardinality safety cap: hard limit of 200 distinct `context_bucket` values per `(org_id, template_id, signature_version=1)`. Enforced at write time in `execution-traces.ts`: before the LET/IF/CREATE block, count existing buckets for this template; if ≥ 200, skip the conditional write (template-level write proceeds). Log at `warn` once per template per day (de-duplicated). (`repos/metabob-activity-api`)
- [ ] 7.6 Unit test for v1c collapse: seed 10 v1 rows with n=1..4 each, run collapse, assert single v1c row with α/β = sum of inputs and v1 rows deleted. (`repos/metabob-activity-api`)

---

## 8. Legacy v0 deprecation

- [ ] 8.1 After two weeks of v1 traffic (~2026-06-01 if deployed around 2026-05-20), remove the parallel v0 write in `execution-traces.ts`. The legacy `computeContextBucket` function remains in `session-context.ts` as a no-op wrapper that returns the v1 signature, for any caller that still imports it. (`repos/metabob-activity-api`)
- [ ] 8.2 Extend the daily collapse job (7.1) with a v0 reaper: rows with `signature_version = 0, last_updated_at < time::now() - 60d` are deleted. No collapse-to-v1 — the equivalence classes differ; v0 rows just age out. (`repos/metabob-activity-api`)
- [ ] 8.3 After v0 is fully reaped, drop `idx_ctx_ts_bucket` (the unversioned index from migration 088, now redundant given `idx_ctx_ts_versioned`). New migration. (`repos/metabob-activity-api`)

---

## Success criteria

The change is complete when, against canary:

- [ ] **S1**: 1.4, 1.5, 1.6 all pass — byte-identical signatures across vessels.
- [ ] **S2**: 7 days after deploy, ≥ 80 % of execution traces with non-empty `presentShapesPre` have produced a `context_thompson_scores` row with `signature_version = 1` and `n_observations ≥ 1`. (Measured by SurrealQL count.)
- [ ] **S3**: ≥ 25 % of templates with `Σ n_observations ≥ 50` show top-two-bucket success-rate discrimination at `p < 0.05` (Welch t-test). Emitted in `discrimination_report` per 6.2.
- [ ] **S4**: `recommend_mrr_overall` post-deploy ≥ pre-deploy MRR − 0.02 (no regression band). Emitted in the weekly harness per 6.4.
- [ ] **S5**: No template has > 200 distinct conditional signatures after 30 days. Cardinality cap (7.5) and collapse job (7.1) hold the long tail.
- [ ] **S6**: Backward compat — recommend POSTs without `impulse_state_space` produce identical responses to pre-change (verified by harness diff on legacy benchmark entries).

---

## Out of scope (deferred)

- Goal-cluster as a secondary axis on `context_thompson_scores`. Listed as design D1.Q1; revisit if S3 undershoots 25 %.
- Cross-org signature priors. Listed as D1.Q3.
- Per-task signature (one signature per task within a multi-task activity, rather than one per execution). Today's signature is per-execution; per-task would be strictly more discriminating but the trace schema does not expose per-task `presentShapesPre` snapshots. Would require minibob plumbing extension.
- Migrating v0 rows to v1 by replay. Discarded — the two encodings represent different equivalence classes; mixing them would corrupt the prior. v0 rows age out.
