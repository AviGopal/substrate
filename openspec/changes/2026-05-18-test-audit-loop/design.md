# Design: Test-Audit Loop

## Context

The validation harness in `validation/scripts/` runs as a thin shell over
`POST /v2/activities/recommend` and `GET /v2/activities/execution-traces/...`, writing
JSON to `validation/results/`. The harness has no audit step. The system that learns
from execution traces (Thompson Sampling on activities, validator-dispatch on tasks,
failure-mode stratification on traces) has no analogue for harness output. A test that
silently became insensitive — every run passes regardless of system state — looks
identical in `validation/results/` to a test that is correctly tracking a meaningful
property.

The fix is structural, not procedural: tests are activities, their outputs are
impulses, and the same loop that already audits the system audits the harness. The
two-criterion contract (representativeness, goal alignment) is the audit's
`inputShapes → outputShapes` contract, not a side process.

This design lays out the four new activities, the registration contract, the
loop wiring, the recursive-audit safety cap, and a worked example.

---

## A. The Two-Criterion Contract as Activity I/O

### A.1 Representativeness

A `test_report` passes representativeness iff:

1. **True-outcome witnessed.** The report's pass/fail is corroborated by at least one
   independent witness drawn from `multi-witness-verification/spec.md:58-122` — one of
   `differential_solve`, `oracle_label`, or `validator_consensus`. Single-witness
   "passed" is tagged `passed_with_caveat` and surfaces in the audit report's
   `caveats[]` field.
2. **Sensitivity demonstrated.** The test publishes a `perturbation_schedule` at
   registration. The historical record (≥ 7 days, ≥ 3 perturbation runs) shows
   outputs vary as predicted under each declared input perturbation. An
   insensitive test fails (`audit_insensitive`); a noisy test fails differently
   (`audit_noisy`).
3. **Decision record complete.** Every assertion in the report references the
   trace event or impulse id it inspected — the same field shape required by
   `multi-witness-verification/spec.md:18-29` for system-side recommend calls. No
   bare "passed."

### A.2 Goal alignment

A `test_report` passes alignment iff:

1. It declares `goal_alignment: string[]` where each entry maps to one of the six
   IAL success criteria in
   `openspec/changes/2026-04-26-impulse-activity-loop/proposal.md:24-31`. Mapping
   is by short id: `"#1-goals-succeed"`, `"#2-failed-goals-recover"`,
   `"#3-vessel-resolvers-only"`, `"#4-improved-activities"`,
   `"#5-composition-via-features"`, `"#6-reuse-up-improvise-down"`.
2. The mapping carries a `discrimination_claim`: free-text explaining why the
   test discriminates system states satisfying that criterion vs states not.
   Reviewed by an LLM resolver at audit time for **plausibility**, not for truth.
   Truth comes from the historical discrimination record built up by
   `run-sensitivity-probe` over time. The LLM verdict is one boolean
   (`plausible: true|false`) plus a one-sentence rationale; it is not a witness
   for purposes of the multi-witness contract.

### A.3 Why these two criteria, no third

Coverage (which subregion of goal-space the test reaches) is already measured at
the harness level via the stratification cells of
`2026-05-17-stratified-goal-generator-harness`. Audit-level coverage on individual
tests would double-count the same signal. Two criteria, applied per test, are
sufficient.

---

## B. The `audit-test-report` Activity

### B.1 Shape contract

```
inputShapes:  ["test_report", "test_registration"]
outputShapes: ["test_audit_report"]
```

The `test_registration` is fetched by id from the activity-api registry; the
`test_report` is the impulse emitted by the test's most recent run.

### B.2 Resolver chain

Four tasks, dispatched in order:

| # | Task                            | Resolver                          | Tier            |
|---|---------------------------------|-----------------------------------|-----------------|
| 1 | check_decision_record_complete  | deterministic (schema validator)  | deterministic   |
| 2 | check_witness_presence          | deterministic (witness-type set)  | deterministic   |
| 3 | check_sensitivity_evidence      | deterministic (history query)     | deterministic   |
| 4 | review_alignment_claim          | llm                               | llm             |

Tasks 1–3 emit `validation_result` impulses per the existing
`validator-activity-convention` (archive at
`openspec/changes/archive/2026-04-26-validators-and-failure-modes/specs/validator-activity-convention/spec.md`).
Task 4 emits a `validation_result` with `passed: true|false` and a
`plausibility_rationale` field; the LLM call is a single Haiku-tier completion
budgeted at `≤ $0.05`.

### B.3 Audit-report output

`test_audit_report` carries:

```
{
  test_registration_id: string,
  test_report_id: string,
  passed: boolean,
  caveats: ("single_witness" | "missing_sensitivity_history")[],
  validation_results: ValidationResult[],   // four entries, one per task above
  failed_evidence?: {                       // present iff !passed
    audit_subtype: "audit_insensitive" | "audit_noisy"
                 | "audit_misaligned" | "audit_record_incomplete",
    detail: string,
    trace_ids: string[]
  }
}
```

`failed_evidence.audit_subtype` is the discriminator the downstream
`debug-failing-audit` activity branches on (§D.2).

---

## C. The `run-sensitivity-probe` Activity

### C.1 Shape contract

```
inputShapes:  ["test_registration"]
outputShapes: ["sensitivity_evidence"]
```

### C.2 Behaviour

For each entry in `test_registration.perturbation_schedule`:

1. Apply the perturbation to the test's declared inputs.
2. Execute the test as an activity.
3. Capture the `test_report` impulse.
4. Compare to the unperturbed baseline.

The probe emits one `sensitivity_evidence` impulse per (test, perturbation, run)
triple. Aggregated over time it gives the historical discrimination record that
`audit-test-report` consults for criterion A.1.2.

### C.3 Cadence

Dispatched weekly by default (the existing weekly cron at
`validation/scripts/run-weekly-harness.sh`). A test may publish
`perturbation_cadence: "daily" | "weekly" | "monthly"` to override. Also
triggered on a `lifecycle:test_registration:updated` event so a modified test
is re-probed immediately rather than waiting for the next weekly cycle.

---

## D. The `debug-failing-audit` Activity

### D.1 Shape contract

```
inputShapes:  ["test_audit_report"]   (filtered to passed: false)
outputShapes: ["code_modification_proposal"
              | "system_modification_proposal"
              | "human_review_request"]
```

The output shape is selected per run; the activity declares all three in its
template `output_shapes` array (see `openspec/specs/.../activity_template`
schema notes in CLAUDE.md "Activities" → Structure).

### D.2 Failure classification + proposal

A single LLM resolver reads the `test_audit_report` and:

| Subtype                    | Default proposal path                              |
|----------------------------|----------------------------------------------------|
| `audit_insensitive`        | `code_modification_proposal` against the test     |
| `audit_noisy`              | `code_modification_proposal` against the test     |
| `audit_misaligned`         | `code_modification_proposal` against the test     |
| `audit_record_incomplete`  | `code_modification_proposal` against the test     |

When the proposed change touches **system** code (not the test itself), the
resolver emits a `system_modification_proposal` instead. When the resolver's
`verification_confidence` falls below the threshold configured on the activity
(same mechanism as any other activity — there is no audit-specific escalation
path), it emits `human_review_request`. This is the human-as-validator tier;
it is one resolver tier, not a separate workflow.

### D.3 Auto-merge handoff

`code_modification_proposal` impulses with `risk_tier: "test_only"` (changes
confined to `validation/scripts/`) are picked up by a downstream
auto-merge activity (out of scope here; tracked separately). Higher-risk
modifications fall through to `human_review_request`.

---

## E. Test Registration Contract

### E.1 Storage

Every test publishes a `test_registration` impulse at first run, stored in the
existing `activity_template` table. Tests are specialised activities — they have
`tags: ["test", ...]` and an `output_shapes: ["test_report"]` contract. No new
table.

### E.2 Required fields

```
{
  id: string,                          // e.g. "validation/scripts/test-22-forge-and-paths"
  inputs_schema: JSONSchema,           // declared inputs of the test
  perturbation_schedule: Perturbation[],
  perturbation_cadence?: "daily" | "weekly" | "monthly",   // default weekly
  goal_alignment: GoalAlignmentEntry[],
  witness_types: ("differential_solve" | "oracle_label" | "validator_consensus")[]
}

Perturbation = {
  id: string,
  description: string,
  apply: { input_path: string, transform: string },
  expected_effect: "pass→fail" | "fail→pass" | "metric_shift",
  expected_delta?: number
}

GoalAlignmentEntry = {
  criterion: "#1-goals-succeed" | "#2-failed-goals-recover"
           | "#3-vessel-resolvers-only" | "#4-improved-activities"
           | "#5-composition-via-features" | "#6-reuse-up-improvise-down",
  discrimination_claim: string
}
```

### E.3 Grandfathering

Tests without a `test_registration` at the time this spec lands are auto-tagged
`passed_with_caveat: ["unregistered"]` on every `test_report`. A migration
backlog (`validation/scripts/registration-backlog.json`) tracks them; the
backlog is itself an artifact the audit loop consumes.

---

## F. Failure-Mode Extension

The closed five-type enumeration in
`archive/2026-04-26-validators-and-failure-modes/specs/failure-mode-taxonomy/spec.md:4`
is preserved. Audit-specific failures are modelled as
`verifier_negative` subtypes:

```
failure_mode = {
  type: "verifier_negative",
  reason: "audit_failed",
  context: {
    validator_id: "audit-test-report",
    failed_evidence: [{
      audit_subtype: "audit_insensitive" | "audit_noisy"
                   | "audit_misaligned" | "audit_record_incomplete",
      ...
    }]
  }
}
```

This avoids adding a sixth top-level `failure_mode.type` value and keeps the
schema validator's discriminated union unchanged. Discussion of the alternative
(adding `audit_negative` as a sixth type) was rejected because (a) the audit *is*
a verifier, and (b) the spec for the five-type enumeration explicitly says "no
other type values SHALL be accepted."

---

## G. Loop Wiring

```
   test runs as activity
        │
        ▼
   emits test_report impulse  ──────────────►  lifecycle:execution:succeeded
                                                          │
                                                          │ (shape == test_report)
                                                          ▼
                                              audit-test-report activity
                                                          │
                                  ┌───────────────────────┴────────────────────────┐
                                  ▼                                                ▼
                          passed: true                                     passed: false
                                  │                                                │
                                  ▼                                                ▼
                       sensitivity_evidence                          debug-failing-audit activity
                        (next weekly probe)                                        │
                                                              ┌────────────────────┼────────────────────┐
                                                              ▼                    ▼                    ▼
                                              code_modification_proposal  system_mod_proposal  human_review_request
                                                              │                                        │
                                                              ▼                                        ▼
                                                        auto-merge                            HumanResolver tier
                                                       (test-only)                            (standard gate)
```

Subscription wiring: `audit-test-report` registers on
`lifecycle:execution:succeeded` filtered by `output_shapes ∋ "test_report"`, same
pattern as the slot-binding meta-activity registers on
`lifecycle:task:preBinding`. `debug-failing-audit` registers on the same lifecycle
event filtered by `output_shapes ∋ "test_audit_report" AND passed == false`.

---

## H. Concurrency

Multiple failing audits for the same test can fire in parallel (e.g. weekly
sensitivity probe + ad-hoc run). To prevent racing modification proposals on
the same test:

- Each `debug-failing-audit` dispatch uses a lifecycle dedupe key of
  `(test_registration_id, audit_subtype)`. The lifecycle subscription layer
  serialises events with the same key.
- A `code_modification_proposal` carries `supersedes: string[]` listing prior
  proposal ids for the same test that have not yet merged. Auto-merge picks the
  newest non-superseded proposal.

This is the same lifecycle-dedupe pattern documented for slot-binding event
fan-out; nothing audit-specific.

---

## I. Worked Example: `forge-goal-completion-test`

The sibling spec `2026-05-18-forge-goal-completion-test` defines a test that
exercises the forge → goal-completion path end-to-end. Its registration would
look like:

```
{
  id: "validation/scripts/forge-goal-completion-test",
  inputs_schema: { missing_shape: "string", goal_text: "string" },
  perturbation_schedule: [
    { id: "P1", description: "swap missing_shape for a shape that already exists",
      apply: { input_path: "missing_shape", transform: "set_to_existing" },
      expected_effect: "pass→fail",
      expected_delta: 1.0 },
    { id: "P2", description: "remove anthropic credentials",
      apply: { input_path: "env.ANTHROPIC_API_KEY", transform: "unset" },
      expected_effect: "pass→fail" },
    { id: "P3", description: "reduce budget below forge minimum",
      apply: { input_path: "budget_usd", transform: "set:0.10" },
      expected_effect: "pass→fail" }
  ],
  perturbation_cadence: "weekly",
  goal_alignment: [
    { criterion: "#2-failed-goals-recover",
      discrimination_claim: "A system that cannot forge missing vessels would
        fail to recover from a goal whose required output shape is unowned;
        this test exercises exactly that recovery path." },
    { criterion: "#5-composition-via-features",
      discrimination_claim: "The test traces composition through forge → registry
        → dispatch, three of MiniBob's features in sequence." }
  ],
  witness_types: ["validator_consensus", "differential_solve"]
}
```

If `run-sensitivity-probe` finds that P1 stopped flipping the outcome (the test
now passes even when `missing_shape` is set to an existing shape), the
`sensitivity_evidence` accumulates `expected_delta=1.0, observed_delta=0.0` for
P1. The next `audit-test-report` flags `audit_insensitive` with
`detail: "P1 expected pass→fail, observed pass→pass over last 3 probes"`.
`debug-failing-audit` then proposes (most likely) a test modification: tighten
the assertion to read from the forge-trace `vessel_id` and verify the new
vessel was *actually used*, rather than checking only that the goal completed.

---

## J. Interaction with Multi-Witness Verification (Phase 25)

The witnesses defined in
`2026-05-17-stratified-goal-generator-harness/specs/multi-witness-verification/spec.md:58-122`
are the **only** witness types referenced by `test_registration.witness_types`.
Specifically:

- `differential_solve` — the test runs twice with different Thompson-elected
  variants; outputs are normalised per the shape normaliser registry. Reused
  verbatim. No test-specific normaliser registry.
- `oracle_label` — for tests with a `goal_verification_labels` oracle entry
  (migration 101).
- `validator_consensus` — the test's trace is checked against `validation_result`
  impulses from validator-dispatch.

No parallel "test witness" infrastructure is introduced. If a witness type is
ever extended in the Phase 25 spec, this spec inherits the extension without
edit.

---

## K. Recursive Audit Safety Cap

`audit-test-report` is itself an activity producing a `test_audit_report`
impulse, which a meta-audit could in principle audit. To bound recursion:

- A depth counter is carried in `composition_chain` (already tracked per
  `CLAUDE.md` "Execution Trace Model"). The safety guard at
  `failure-mode-taxonomy/spec.md:14` (`safety_breach.context: { breach_type:
  "depth" | "cycle", limit, ancestor_chain }`) is reused.
- Default cap: **2**. So a test → audit → meta-audit chain runs, but a
  meta-audit's own audit (depth 3) is rejected with
  `failure_mode = safety_breach { breach_type: "depth", limit: 2 }`.
- The cap is configurable per `test_registration` for cases where a deeper
  chain is justified, but the default is non-negotiable.
