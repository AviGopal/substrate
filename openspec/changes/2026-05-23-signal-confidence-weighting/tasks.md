# Tasks: Signal Confidence Weighting on Learning-Loop Writes

## Phase 1 — Schema migration

- [ ] 1.1 Add a new SurrealDB migration under
  `repos/metabob-activity-api/sql/migrations/` defining
  `signal_confidence_weight: number` on `activity_execution_traces`
  with default 1.0 and range constraint [0, 1].
- [ ] 1.2 Backfill existing rows: the migration sets
  `signal_confidence_weight = 1.0` on every row that lacks the field.
  Idempotent — re-running is a no-op.
- [ ] 1.3 Update `init_migrations` tracking so the migration applies
  once per substrate per IAL §27.3.a.2 invariant.
- [ ] 1.4 Update SchemaFull schemas in `src/models/schemas.ts`
  (`ExecutionTraceSchema` + variants) to include the field.

## Phase 2 — Update path

- [ ] 2.1 In `repos/metabob-activity-api/src/lib/posterior-update.ts`,
  `applyOutcomeToPosteriors` multiplies each α and β increment by
  the trace's `signal_confidence_weight`. Default 1.0 keeps current
  behaviour identical.
- [ ] 2.2 In the same file, `propagateCreditAlongChain` multiplies
  each ancestor's α/β update by `leaf.signal_confidence_weight × γ^depth`.
  The composition-chain walk is unchanged; only the magnitude
  computation changes.
- [ ] 2.3 The stratified failure-mode weighting table (Phase 18:
  verifier_negative full β, budget_exhausted half β, cascading no
  double-count, user_abort neutral) composes multiplicatively with
  `signal_confidence_weight`. Order: failure-mode multiplier first,
  then confidence weight.
- [ ] 2.4 Unit test: a confidence weight of 0 produces no α/β change
  regardless of failure mode. A confidence weight of 0.5 with
  verifier_negative produces half the standard β increment. A weight
  of 0.5 with budget_exhausted produces a quarter (0.5 × 0.5).

## Phase 3 — Trace write contract

- [ ] 3.1 Add `signal_confidence_weight?: number` to the
  `activity_execution_trace_write` impulse body schema in
  `repos/metabob-activity-api/src/routes/impulses.ts`. Optional;
  default 1.0 when omitted.
- [ ] 3.2 Range validation: 0 ≤ weight ≤ 1, finite number. Out of
  range → 400 with `verifier_negative` self-trace, body
  `{ reason: "signal_confidence_weight out of range", value }`.
- [ ] 3.3 Update `activity_execution_trace_write` advertisement in
  `repos/metabob-activity-api/src/config.ts` `discovery.shapes` with
  the new optional field in its contract metadata.
- [ ] 3.4 Update the equivalent REST endpoint
  (`POST /v2/activities/execution-traces`) to accept the field
  symmetrically.

## Phase 4 — Chain credit invariant test

- [ ] 4.1 Port integration test `18.4.7` to a non-unit weight
  scenario. A trace with leaf `signal_confidence_weight = 0.5`
  produces ancestor α increments equal to
  `0.5 × γ^depth × baseline`.
- [ ] 4.2 Add a second test exercising a multi-source chain where
  different traces carry different weights. Each ancestor's
  accumulated α is the sum of per-leaf
  `signal_confidence_weight × γ^depth_to_leaf`.
- [ ] 4.3 Negative test: a weight of 0 propagates as 0 — ancestors
  receive no credit. This is the federation-rejection path's
  behaviour-under-aggregation guarantee.

## Phase 5 — Workbench observability

- [ ] 5.1 `ExecutionHistoryPanel` (`repos/workbench/src/components/`)
  renders `signal_confidence_weight` as a small badge per row.
  Default 1.0 styled as neutral; non-1.0 styled with a confidence
  bar.
- [ ] 5.2 `ExecutionFlameGraph` tooltip includes the field.
- [ ] 5.3 Visual regression test (Playwright) captures the panel
  with all-1.0 rows; confirms layout unchanged from pre-deployment
  baseline.

## Phase 6 — Reuse harness telemetry

- [ ] 6.1 `activity-reuse-validation-harness` (Phase 19) weekly run
  emits a new column: mean and p5/p95 of
  `signal_confidence_weight` across the benchmark window.
- [ ] 6.2 First post-deployment run records baseline: mean=1.0,
  p5=p95=1.0. Future drift detectable as a deviation.

## Phase 7 — Documentation

- [ ] 7.1 CLAUDE.md "Execution Trace Model" section gains a line
  for `signal_confidence_weight` with cross-references to H6,
  robust Thompson aggregation, and verifier multiplicity work.
- [ ] 7.2 Foundation doc
  (`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`) "Record
  Everything" principle gains a note that confidence is part of
  what is recorded.
- [ ] 7.3 IAL `tasks.md` Phase 27.3 gains §27.3.g.6 — the field is
  present with zero behavioural drift on the benchmark.

## Phase 8 — Canary validation

- [ ] 8.1 Deploy to canary. Run the Phase 19 reuse-validation
  harness pre- and post-deployment. Drift in search-MRR,
  recommend-MRR, improvise_share, reuse_rate must be within ±2%
  of the prior baseline (post-F-V58 MRR=0.2361,
  improvise_share=1.5%, post-F-V57 reuse trajectory).
- [ ] 8.2 Run the 18.4.7 chain-credit integration test on canary
  with the original unit-weight path. Same result as pre-deployment
  proves no regression.
- [ ] 8.3 Probe a deliberate weight=0 write: confirm posteriors
  unchanged.

## Order rationale

Phase 1 lands the schema. Phase 2 lands the multiplication that's
provably a no-op under default 1.0. Phase 3 opens the write
contract. Phase 4 proves the math under non-trivial weights via
test. Phases 5–6 surface the field. Phase 7 documents. Phase 8
validates on canary. Each phase is independently reversible; the
schema migration is the only piece that can't be cleanly rolled
back, which is why it lands while migrations are still operator-driven
per IAL §27.3.a.2.
