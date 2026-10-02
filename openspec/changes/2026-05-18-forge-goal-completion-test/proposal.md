## Why

Phase 22 of the impulse-activity loop landed a vessel-forge pipeline plus an acceptance test suite (`validation/scripts/test-22-forge-and-paths.ts:1`) that drives `VesselForgeHost` directly. `openspec/changes/2026-04-26-impulse-activity-loop/tasks.md:1195-1242` records 22.2 through 22.7.9 as DONE: forge resolvers, `forge-vessel-for-shape.json`, slot-binding's `check_discovery_for_producer` + `forge_missing_shape` branches (22.4.1–22.4.4 at `tasks.md:1217-1220`), and the six dispatch paths A–F (22.7.1–22.7.7 at `tasks.md:1235-1241`). All of that exercises forge as a standalone capability.

Nothing exercises forge **as a consequence of slot-binding escalation triggered by a real user-level goal**. The 22.7.x suite calls `VesselForgeHost.forge_vessel_for_shape("json_schema_validator")` (`test-22-forge-and-paths.ts:31-33`) and asserts the resulting vessel answers dispatch paths. It bypasses `repos/minibob/index.ts`'s CLI entry; it bypasses `goal-processing-activity-driven.json`; it bypasses slot-binding's `check_discovery_for_producer` task entirely. A regression in any of those — a slot-binding template that emits the wrong condition string, a lifecycle payload missing `currentImpulseShapes`, a `shape_producer_inventory` resolver returning `count:1` when discovery is empty, a binding-layer that fails to bind the downstream user-goal task to the just-forged vessel — would leave Phase 22 acceptance green while breaking the very promise Phase 22 was supposed to keep.

That promise is recorded as success criteria #3 and #5 of `openspec/changes/2026-04-26-impulse-activity-loop/proposal.md:24-31`: "MiniBob operates solely off connected-vessel resolvers" and "activities compose using all MiniBob features end-to-end". Both are claims about the goal-processing pipeline, not about `VesselForgeHost` in isolation. They are currently untested.

The parallel spec `openspec/changes/2026-05-18-test-audit-loop/proposal.md:34-43` defines the `test_registration` and `test_report` impulse contracts and the `audit-test-report` activity that consumes them. That spec needs a non-trivial first consumer — a test that emits a properly-shaped `test_report` with all four witness types so the audit machinery has something to audit. This change provides that consumer.

## What Changes

- **Prompt `40-forge-required-shape.md`** in `validation/prompts/`. Goal text names a shape with zero registered producers on canary. Single prompt today; rotated weekly across three candidate shapes (see `design.md` §a).
- **Runner `test-forge-goal-completion.ts`** in `validation/scripts/`. Performs a pre-flight `count === 0` check against discovery, submits the goal via the standard minibob CLI surface (`miniBob --single "<goal>"` per `repos/minibob/CLAUDE.md:31`), waits for completion, fetches the resulting trace via `executionTraceWithSignatures`, and asserts the eight decision-record items in `design.md` §c. Re-submits the same goal as Pass 2 and asserts forge dedup (§d).
- **`test_report` emission** at end-of-run with four witnesses (`trace_signature`, `discovery_registration_probe`, `binding_layer_record`, `goal_verifier_result`) and a typed `failure_mode` on Pass 1 / Pass 2 / pre-flight failure.
- **`test_registration` publication** at first run with the perturbation schedule (3 candidate shapes × 2 goal-complexity tiers × 2 depths = 12 rows; see `design.md` §f), `goal_alignment: ["#3-MiniBob-connected-vessels", "#5-activities-compose-all-features"]`, witness-type list, and discrimination claim.
- **`forge-goal-benchmark.json`** in `validation/`, parallel to `activity-reuse-benchmark-v2.json`. One initial benchmark row (the json-schema-validator already-forged baseline is excluded; see §a for candidate-rotation policy).
- **`cycle.sh` forge category** at `validation/cycle.sh:121-141` matching `^40-` (and future 41–49 if added).
- **Weekly invocation** wired into `validation/scripts/run-weekly-harness.sh`, one perturbation row per week.

This change emits `test_report` in the shape the parallel `test-audit-loop` spec contracts; it does NOT define audit logic, perturbation-runner logic, or failure-classification logic. Those live in `2026-05-18-test-audit-loop`.

## Success Criteria

1. **Pass 1 fires forge through slot-binding.** Trace shows `slot-binding` in `composition_chain`, `check_discovery_for_producer` with `count === 0` in its output impulse, `forge_missing_shape` fired (not `escalate_unbindable`), `forge-vessel-for-shape` dispatched, `verify_three_invariants` green, downstream user-goal task bound to the forged vessel, `goal-verifier` `validation_result.passed = true`.
2. **Pass 2 reuses, does not re-forge.** Within the Phase 22 24-hour dedup window (`openspec/changes/2026-04-26-impulse-activity-loop/tasks.md:1219` documents dedup-via-discovery), `check_discovery_for_producer` returns `count >= 1`, `forge_missing_shape` skipped, downstream task binds to the same vessel id as Pass 1.
3. **`test_report` carries all four witness types** in the contracted shape (`design.md` §e), retrievable by `audit-test-report`.
4. **`test_registration` publishes ≥ 6 perturbation rows.** Minimum: 3 shapes × 2 complexity × 1 depth = 6; target: 12.
5. **Both passes succeed for ≥ 3 consecutive weekly runs** across the three candidate shapes before the test is marked stable. Failures route to `audit-test-report` via the sibling spec; this spec does not handle them.
6. **All runs land in canary** alongside production traffic — no isolation, no separate environment, no test-only auth credentials. Forged vessels handed off to existing prune-activity rotation (no forge-specific cleanup).

## Capabilities

### New Capabilities

- `forge-goal-completion-test` — end-to-end test exercising vessel forge through slot-binding escalation triggered by a user goal. Emits `test_report` per the parallel-spec contract; publishes `test_registration` with a 12-row perturbation schedule.

## Impact

- `validation/prompts/` — one new prompt (`40-forge-required-shape.md`).
- `validation/scripts/` — one new runner (`test-forge-goal-completion.ts`).
- `validation/` — one new benchmark file (`forge-goal-benchmark.json`).
- `validation/cycle.sh` — one new category entry at line 134-136 region.
- `validation/scripts/run-weekly-harness.sh` — one new invocation.
- No vessel changes. No schema changes. No new endpoints.
- Forged vessels accumulate at one per week per shape; existing `prune-activity` 30-day rotation absorbs them (`design.md` §h).
- Cost per run: one minibob `--single` invocation per pass, two passes per week, weekly cadence — bounded.

## Dependencies

- **Phase 22 deployed.** `2026-04-26-impulse-activity-loop/tasks.md` 22.2–22.7.9 marked DONE (commits `d8b344a`, `f36d013`, `16aa365`, `44561a2`, `defc19b`, `750f6be`, `015b6ed`, `958dcc8` between 2026-05-16 and 2026-05-17).
- **`2026-05-18-test-audit-loop`** — provides the `test_report` / `test_registration` contracts this test emits against. Currently stubbed (only `proposal.md` exists). This change consumes the contract as proposed at `2026-05-18-test-audit-loop/proposal.md:34-39`; if that contract evolves, this test's emission shape (`design.md` §e) follows.
- **Existing `prune-activity`** — already handles forged-vessel rotation; no new dependency.
