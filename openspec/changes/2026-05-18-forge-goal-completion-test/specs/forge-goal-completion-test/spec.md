# Spec: forge-goal-completion-test

## Purpose

Define requirements for the end-to-end test that proves vessel forge is exercised as a consequence of slot-binding escalation triggered by a user-level goal — not in isolation via `VesselForgeHost`. This test is the proving ground for the test-audit-loop contract drafted in `openspec/changes/2026-05-18-test-audit-loop/proposal.md:34-43`.

The test is itself an activity-shaped run: it consumes a goal, produces a `test_report` impulse, and emits a `test_registration` impulse on first run. It does NOT define audit behaviour; that lives in the sibling spec.

## Requirements

### R1. Pass 1 MUST verify slot-binding escalation to forge_missing_shape

The test SHALL invoke the minibob CLI with a goal text whose target shape has `count === 0` in canary discovery at submission time. After the run, the test SHALL fetch the resulting execution trace via `executionTraceWithSignatures` and SHALL assert all eight items C1–C8 from `design.md` §c. In particular:

- C1: `composition_chain` contains an entry with `template_id === "slot-binding"`.
- C2: inside the slot-binding child execution, an impulse of shape `shape_producer_inventory` was produced by task `check_discovery_for_producer` with body parsing as JSON containing `count === 0`.
- C3: task `forge_missing_shape` ran with `success: true` inside the slot-binding child execution.
- C4: task `escalate_unbindable` did NOT run (skipped via conditional, `success: null` or absent).
- C5: `composition_chain` contains an entry with `template_id === "forge-vessel-for-shape"` whose `parent_execution_id` matches the slot-binding child execution.
- C6: an impulse of shape `vesselVerified` was emitted inside the forge child execution with `discovery: ok, observation: ok, auth: ok`.
- C7: in the root user-goal execution, the task consuming `target_shape` has `impulse_resolutions[].vessel_id` equal to C6's `vesselVerified.vessel_id`.
- C8: a `validation_result` impulse in the root execution has `passed: true` and `validator_id` matching the goal-verifier resolver.

A failure on any item flips `passed: false` and the assertion is recorded with `red: true` and the `inspected_field` excerpt that motivated the verdict.

The test MUST NOT call `VesselForgeHost.forge_vessel_for_shape` directly. The test MUST NOT bypass the standard minibob CLI surface (no env-var backdoors flagging the run as a test, no direct dispatch via internal APIs). The goal text MUST be the same surface a real user would type.

### R2. Pass 2 MUST verify forge is NOT re-executed within the dedup window

Immediately after Pass 1 succeeds, the test SHALL submit the same goal text through the same CLI surface and SHALL assert all four items D1–D4 from `design.md` §d:

- D1: `shape_producer_inventory` impulse body parses with `count >= 1`.
- D2: `forge_missing_shape` did NOT fire (`success: null` or absent in the slot-binding child execution's task list).
- D3: the downstream user-goal task bound to the SAME `vessel_id` as Pass 1's C7 record.
- D4: `validation_result.passed === true` in the root execution.

The Phase 22 dedup window is 24 hours via discovery registry (`openspec/changes/2026-04-26-impulse-activity-loop/tasks.md:1219`); Pass 2 SHALL occur within that window (within minutes of Pass 1 in practice). The test does NOT add a separate mutex; if a race occurs, the test SHALL observe both vessel ids and proceed with whichever vessel discovery resolves, per `design.md` §i.

### R3. test_report MUST carry all four witness types

Each successful run SHALL emit a `test_report` impulse whose `witnesses[]` array contains at least one record of each of the four witness types defined in `design.md` §g:

- `trace_signature` (one per pass, two total on a successful run)
- `discovery_registration_probe` (three: pre-flight, post-pass1, pre-pass2)
- `binding_layer_record` (one per pass, two total)
- `goal_verifier_result` (one per pass, two total)

A failed run SHALL emit witnesses present up to the point of failure. A run that fails at pre-flight SHALL still emit one `discovery_registration_probe` witness with `count !== 0` so the audit loop can classify the precondition violation.

### R4. test_registration MUST publish perturbation_schedule with ≥ 6 rows

On first run (and on any subsequent run whose schedule diverges from the stored registration), the test SHALL publish a `test_registration` impulse with a `perturbation_schedule[]` array of at least six rows. The target schedule is 12 rows: 3 candidate shapes × 2 complexity tiers × 2 depths, per `design.md` §f. The registration SHALL include:

- `id: "forge-goal-completion"`
- `inputs_schema` per §f
- `perturbation_schedule[]` (≥ 6 rows; target 12)
- `cadence: "weekly"`
- `rotation` policy
- `goal_alignment` referencing IAL success criteria #3 and #5
- `discrimination_claim` (text per §f)
- `witness_types[]` listing the four types from R3

### R5. All test activity runs in canary alongside production traffic

The test SHALL run against `https://activity.metabob.com`, `https://discovery.metabob.com`, and `https://identity.metabob.com`. The test SHALL NOT use a separate test cluster, test database, or test-only authentication credentials. Forged vessels SHALL register in the production canary discovery registry the same way any other vessel registers. Cleanup SHALL be handled by the existing `prune-activity` 30-day rotation, not by forge-specific deregistration logic in this test (per `design.md` §h).

### R6. Test failures MUST surface as test_report.passed = false with typed failure_mode

A failed run SHALL emit a `test_report` impulse with `passed: false` and a `failure_mode` field conforming to the closed five-type enumeration at `openspec/changes/archive/2026-04-26-validators-and-failure-modes/specs/failure-mode-taxonomy/spec.md:4`. Mapping:

- Assertion miss in C1–C8 or D1–D4 → `failure_mode.type = "verifier_negative"` with `context.failed_evidence[]` naming the witness source that drove the verdict.
- Pre-flight precondition violation (`count !== 0` before Pass 1) → `verifier_negative` with `reason: "precondition_violated"`.
- minibob CLI execution missing within the 5-minute fallback window → `cascading` with `context.upstream_task_id: "<minibob_invocation>"`.
- Forge or downstream task budget exceeded → `budget_exhausted` with the budget detail.
- Three-invariants probe registers a depth or cycle breach → `safety_breach`.
- Operator interrupts the test via Ctrl-C → `user_abort`.

The test MUST NOT invent new failure-mode types. The closed enumeration is preserved.

### R7. Test MUST NOT define audit logic

This spec defines emission contracts only. The test SHALL NOT classify its own failures beyond the typed `failure_mode`. Classification (`audit_insensitive`, `audit_noisy`, `audit_misaligned`, `audit_record_incomplete` per `2026-05-18-test-audit-loop/proposal.md:50-54`) and modification-proposal generation are out of scope. The `audit-test-report` activity in the sibling spec consumes this test's `test_report` via its `lifecycle:execution:succeeded` subscription on shape `test_report`.

### R8. Goal text MUST exercise the user-facing CLI surface

The runner SHALL invoke minibob via `miniBob --single "<goal>"` (the surface documented at `repos/minibob/CLAUDE.md:31`). The goal text SHALL NOT name the target shape verbatim in a way that would make the system trivially shortcut to forge — it SHALL motivate a real downstream consumer that needs the shape. The runner MAY set `MINIBOB_SKIP_STARTUP=true` (a flag that any Docker/CI `--single` run sets) but MUST NOT set any flag that selects activities, vessels, or resolvers specifically for the test.
