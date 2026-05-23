# validation/failure-modes — Autonomous Failure-Mode & False-Positive Harness

This directory drives the **lift validation loop**: at any moment, the system
should look at its own impulse/pointer state, identify what's broken or
ambiguous, and have the activity-impulse machinery propose-and-ship the
activity that closes the gap — without human intervention.

We have lift when the system keeps spinning **on its own** through:

- **Activity-recommendation mode**: given a goal derived from a failure-mode
  scenario, the system surfaces the correct (or a viable new) activity.
- **Boredom-operation mode**: when idle, the system scans observational state
  for unhandled failure-mode patterns and proposes hypotheses.

## Matrix Origins

Scenarios are drawn from the **63-mode failure matrix** developed in
conversation on 2026-05-22, organized by:

| Axis 1: Execution Stage | Axis 2: Information State | Axis 3: Outcome Class |
|---|---|---|
| Pre-Discovery / Discovery / Binding / Execution / Validation / Composition / Learning | Known-Known / Known-Unknown | True Negative (TN) / True Positive (TP) / False Negative (FN) / False Positive (FP) |

- **45 base failure modes** (FM-01..FM-45): the canonical taxonomy aligned
  with `FailureModeSchema` (`verifier_negative`, `budget_exhausted`,
  `safety_breach`, `cascading`, `user_abort`) plus stage-specific
  refinements.
- **18 false-positive modes** (FP-01..FP-18): system declares failure when it
  succeeded, blames wrong component, or records success when output is wrong.
  These are the **corrosive** modes — silent corruption of the Thompson
  posterior — and the matrix prioritizes them.

See `MATRIX.md` for the full mode catalog. Each scenario file declares
which mode it instantiates.

## Why False Positives Get Top Billing

False negatives (miss a real failure) are recoverable: the next execution
will re-expose the issue. False positives (record success when output is
wrong, or fail a working component) **corrupt the learning signal**:

- Thompson α drifts toward an incorrect activity → recommendation degrades
- Template library bloats with hypotheses chasing phantom gaps
- Cascade blame attribution misroutes optimization effort

Detection of FPs requires **post-hoc evidence** (downstream task outcome,
human verdict, idempotency replay) that the live trace alone cannot supply.
The harness manufactures that evidence by replay, contradiction-check, and
witness-correlation.

## Scenario Lifecycle

```
1. scenario.json declares trigger + expected goal + detection signal
2. harness dispatches goal_text to POST /v2/activities/recommend
3. system either:
   (a) surfaces an existing activity that handles the case → record reuse
   (b) creates a new activity via make-activity / improvise → record emergence
   (c) returns no viable activity → record gap
4. harness queries activity-api traces window for emergence signal
5. harness scores: did the system self-heal without intervention?
```

The crucial bit: **we do not write the recovery activity ourselves**. The
harness only asserts the scenario and observes whether the activity-impulse
loop generates one. If it does, we have lift on that mode. If not, that
mode is a known gap and feeds the next round of make-activity hypotheses.

## Layout

```
validation/failure-modes/
├── README.md             # this file
├── MATRIX.md             # full 63-mode catalog with stage × info-state × outcome
├── schema.json           # JSON schema for scenario files
└── scenarios/
    ├── fp-11-silent-semantic-failure.json
    ├── fp-12-partial-success.json
    ├── fp-15-missing-producer.json
    ├── fm-17-resolver-budget-noncompliance.json
    ├── fm-43-attribution-error.json
    └── …
```

## Running

```bash
# Run a single scenario:
METABOB_API_KEY=<key> bun run validation/scripts/failure-mode-harness.ts \
  --scenario validation/failure-modes/scenarios/fp-11-silent-semantic-failure.json

# Run all scenarios; emit aggregate report:
METABOB_API_KEY=<key> bun run validation/scripts/failure-mode-harness.ts \
  --scenarios validation/failure-modes/scenarios/ \
  --label "2026-05-22 baseline" \
  --out validation/results/2026-05-22-failure-mode-report.json
```

Reports record per-scenario:

- **emergence_class**: `reuse` (existing activity matched), `new` (system created
  one), `gap` (no viable response).
- **self_heal_seconds**: time from goal-dispatch to emergent activity-trace
  appearing in `activity_execution_traces`.
- **detection_signal_present**: whether the failure mode was detectable from
  the trace alone (TP) vs required external witness (FN→TP escalation).
- **false_positive_flagged**: for FP scenarios, whether the system noticed the
  contradiction (e.g., trace says success but replay diverges).

## Relationship to Existing Harnesses

- **reuse-harness.ts** — measures MRR/Hit@k for known goal→activity mappings.
  Failure-mode harness inverts this: goals are constructed to expose unknown
  modes, and emergence (not reuse) is the success signal.
- **stratified-harness.ts** — coverage matrix for shape × novelty × depth.
  Failure-mode harness extends to a coverage matrix for **stage × outcome
  class**.
- **test-audit-loop** — audits whether tests are representative and aligned
  with the six IAL success criteria. Failure-mode scenarios register via
  the same `ensureTestRegistration` mechanism so every scenario gets audited
  for representativeness and goal-alignment.

## Migration to Activity-Driven Harness

As of 2026-05-23, the harness is no longer triggered exclusively by a human operator
running `failure-mode-harness.ts` by hand. The `development-vessel` lifecycle observer
now fires `harness-run-matrix` automatically whenever a qualifying
`execution_completed` WS event arrives (template ids: `draft-gap-closing-activity`,
`prune-activity`, `replace-activity`, or any output carrying `activityRegistryChange`).

**Current state (transitional):**
- `validation/scripts/failure-mode-harness.ts` — original script; still runnable manually
  and by CI.
- `harness-run-matrix` activity (development-vessel seed) — the new automated path.
  Calls the same `failure_mode_matrix_score` resolver. Writes an `out_path` shim file
  so the existing `progression-driver.ts` can consume it without modification.
- `validation/scripts/progression-driver.ts` — reads the shim file; unchanged.

**Migration path (follow-up work, out of scope for harness-as-lifecycle-participant):**
When the system reaches Phase 27+, the progression-driver will be updated to read
the `failureModeReport` directly from activity-api (via impulse pointer), eliminating
the disk-file shim entirely.

## Continuous Operation

Once seeded, scenarios run on the weekly harness schedule. The system's
boredom-operation mode is expected to:

1. Read the previous report's `gap` entries
2. Generate hypothesis activities via `make-activity`
3. Validate hypotheses against the trace corpus
4. Ship winners (template registration via `activityTemplate_update`)
5. Re-run the same scenarios next week and watch the gap close

Lift is proven when the report's `gap` count strictly decreases week-over-week
**without anyone writing the recovery code by hand**.
