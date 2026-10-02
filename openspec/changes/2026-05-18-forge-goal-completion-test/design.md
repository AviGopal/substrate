# Design: forge-goal-completion-test

This document expands on the proposal and fixes the operational details the runner must implement.

## a. Target-shape selection

The 22.7.x acceptance test already forged `json_schema_validator` and registered it (`validation/scripts/test-22-forge-and-paths.ts:31`). That shape now has a producer in canary discovery and is therefore unusable as a Pass 1 target — `check_discovery_for_producer` would return `count >= 1` on the very first call, falsifying the test's precondition.

Candidate shapes for rotation, each chosen so the goal text plausibly motivates a real downstream consumer (not a synthetic existence check) and so the LLM that runs `compose_vessel_spec` (`forge-vessel-for-shape.json`) has enough surface to produce a non-trivial spec:

| Shape | Goal complexity | Why it's useful |
|---|---|---|
| `webhook_signature_verifier` | single-step | Verify an HMAC over a payload + secret; output `{valid: bool, reason?: string}`. Plausible downstream consumer in any vessel that accepts webhooks. |
| `pdf_text_extractor` | two-step (extract + summarise) | Take a PDF byte-buffer pointer, return per-page text. Downstream goal can then summarise. Exercises a non-trivial third-party library dependency through `docker_build_push`. |
| `csv_dialect_detector` | single-step | Given a CSV sample, return `{delimiter, quote_char, has_header}`. Cheap to forge, exercises pure-parsing path with no I/O. |

**Rotation policy.** Three-week cycle, one shape per week. `validation/scripts/run-weekly-harness.sh` reads the week number from `date +%V`, takes `week_number % 3` as the index into the candidate list, and runs that week's row. The runner asserts that the chosen shape has `count === 0` at pre-flight (§b); if a prior run forged it and the vessel is still healthy in canary, the pre-flight fails with `failure_mode: { type: "verifier_negative", reason: "precondition_violated: shape already has producer count=<N>" }` and the row is rotated to the next candidate. After three rotations without a viable target, the run aborts with `failure_mode: { type: "verifier_negative", reason: "no_viable_target_shape" }` and the test emits a `test_report` with `passed: false` so the audit loop sees it. No new candidate added in this change — rotation extension is a follow-up.

**Justification for picking these three.** They are unforged at spec-landing time (verified by querying discovery `/registry/shapes` for each before commit), they are conceptually independent of one another (one HMAC, one extraction, one parsing) so a forge bug correlated with one shape's tooling does not silently mask the loop's failure on another, and they map to three different docker-image complexities (pure Node, Node + native PDF lib, pure Node) so the `docker_build_push` retry path is exercised non-trivially over the rotation.

## b. Pre-flight protocol

Before submitting the goal, the runner:

1. Issues `GET <DISCOVERY_URL>/registry/shapes?shape=<target>` with the canary `METABOB_API_KEY`. Discovery returns `{count, vessels}`.
2. If `count !== 0`, emit `test_report` with `passed: false`, `failure_mode: { type: "verifier_negative", reason: "precondition_violated", context: { failed_evidence: [{ source: "discovery_registration_probe", expected: 0, actual: count, vessel_ids: vessels.map(v => v.id) }] } }`. Exit non-zero. Audit-loop picks up the report.
3. If `count === 0`, capture the timestamp and the probe response as the **pre-flight witness** (one of the four `discovery_registration_probe` instances; the other three are post-Pass-1 and pre/post-Pass-2 probes).

Pre-flight is the **only** point where the runner is allowed to short-circuit before invoking minibob. Any failure after this point is observed through the trace, not through a wrapper assertion.

## c. Pass 1 protocol

The runner shells out to the minibob CLI exactly the way a user would per `repos/minibob/CLAUDE.md:31`:

```
miniBob --single "<goal text from validation/prompts/40-forge-required-shape.md, with {{target_shape}} substituted>"
```

No `--idle`, no `--caffeine`, no env-var backdoor that flags this as a test. The runner sets `MINIBOB_SKIP_STARTUP=true` (per `repos/minibob/CLAUDE.md` "Startup Behaviour") only to suppress waking activities that would race the test — that is the same flag any Docker/CI `--single` run uses and is not test-specific.

The CLI exits when the activity completes (or the budget expires). The runner records the `executionId` printed by minibob (today the CLI logs it at end-of-run; if that surface ever changes the runner falls back to the most recent root execution for the vessel-id `minibob-test-forge-<host>` over a five-minute window — failure to find one is `failure_mode: { type: "cascading", reason: "no_execution_id_in_window" }`).

The runner then issues `POST <ACTIVITY_API>/v2/impulses/resolve` with pointer `{type: "executionTraceWithSignatures", execution_id: "<exec>"}`. The response carries the full trace + per-impulse pointer/shape signatures + the `impulses_by_id` map (the same surface `repos/workbench` uses; documented in root `CLAUDE.md` §"Read resolvers"). Each assertion below names the trace field it inspects.

| # | Assertion | Trace field inspected | Failure mode on miss |
|---|---|---|---|
| C1 | slot-binding ran as a hook | `composition_chain[]` contains an entry whose `template_id === "slot-binding"` | `verifier_negative` with `failed_evidence.source = "trace_signature"` |
| C2 | discovery producer check ran with count=0 | impulse with `shape: "shape_producer_inventory"` produced by task id `check_discovery_for_producer` inside the slot-binding child execution; body parses as JSON with `count === 0` | `verifier_negative` |
| C3 | forge_missing_shape fired | tasks list of the slot-binding child execution contains a task `forge_missing_shape` with `success: true` and a non-empty `output_impulse_ids` | `verifier_negative` |
| C4 | escalate_unbindable did NOT fire (forge took precedence) | same tasks list shows `escalate_unbindable` with either `success: null` (skipped by conditional) or absent | `verifier_negative` |
| C5 | forge-vessel-for-shape was dispatched | `composition_chain` contains an entry whose `template_id === "forge-vessel-for-shape"` and whose `parent_execution_id` matches the slot-binding child execution | `verifier_negative` |
| C6 | three-invariants probe passed | impulse of shape `vesselVerified` exists in the forge child execution; body has `discovery: ok, observation: ok, auth: ok` (per `repos/ias-executor-ts/src/resolvers/verify-three-invariants.ts` output shape, `tasks.md:1206`) | `verifier_negative` |
| C7 | downstream task bound to the forged vessel | in the user-goal root execution, the task that consumes shape `<target_shape>` has its corresponding entry in `impulse_resolutions[]` with `vessel_id` matching the forged vessel's id (recovered from C6's `vesselVerified.vessel_id`) | `verifier_negative` with `failed_evidence.source = "binding_layer_record"` |
| C8 | goal-verifier said yes | a `validation_result` impulse exists in the root execution with `passed: true` and the validator id matches the goal-verifier resolver id (`repos/minibob/src/resolvers/` goal-verifier) | `verifier_negative` with `failed_evidence.source = "goal_verifier_result"` |

The eight items are the **decision record**. A test_report with `passed: true` requires all eight green; any miss flips `passed: false` and the report carries the typed `failure_mode` per the failure-mode taxonomy (`openspec/changes/archive/2026-04-26-validators-and-failure-modes/specs/failure-mode-taxonomy/spec.md:4`).

## d. Pass 2 protocol

Immediately after Pass 1 succeeds, the runner submits the **same goal text** through the same CLI surface, captures the new execution id, fetches the trace, and asserts:

| # | Assertion | Trace field | Failure mode on miss |
|---|---|---|---|
| D1 | discovery producer check ran with count ≥ 1 | `shape_producer_inventory` impulse body parses with `count >= 1` | `verifier_negative` |
| D2 | forge_missing_shape did NOT fire | slot-binding child execution tasks list shows `forge_missing_shape` with `success: null` or absent | `verifier_negative` |
| D3 | downstream task bound to the SAME vessel as Pass 1 | `impulse_resolutions[].vessel_id` for the target-shape consumer === Pass 1 C7's vessel id | `verifier_negative` with `failed_evidence.source = "binding_layer_record"` |
| D4 | goal completed | `validation_result.passed === true` in the root execution | `verifier_negative` with `failed_evidence.source = "goal_verifier_result"` |

If D1 fails (count is still 0 in Pass 2), Phase 22's dedup-via-registry is broken; this is the most informative failure mode the test can surface and the audit-loop's `audit-test-report` should treat it as a high-priority finding.

## e. test_report emission shape

The runner POSTs a `test_report` impulse to activity-api via `POST /v2/impulses/resolve` with pointer `{type: "test_report_write", body: { ... }}`. The body conforms to the contract drafted at `2026-05-18-test-audit-loop/proposal.md:34-39`:

```json
{
  "test_id": "forge-goal-completion",
  "run_id": "fgc-<unix_timestamp_ms>",
  "registration_id": "forge-goal-completion",
  "perturbation_row": { "shape": "<target>", "complexity": "single-step|two-step", "depth": 0 },
  "passed": true,
  "passes": [
    { "label": "pass1", "executionId": "<exec1>", "assertions": [ "C1..C8 with green/red and inspected_field excerpt" ] },
    { "label": "pass2", "executionId": "<exec2>", "assertions": [ "D1..D4 with green/red and inspected_field excerpt" ] }
  ],
  "witnesses": [
    { "type": "trace_signature", "executionId": "<exec1>", "signature": "<sha256 of executionTraceWithSignatures.impulse_signatures, root-first>" },
    { "type": "trace_signature", "executionId": "<exec2>", "signature": "<sha256 ...>" },
    { "type": "discovery_registration_probe", "phase": "pre_flight", "shape": "<target>", "count": 0, "ts": "..." },
    { "type": "discovery_registration_probe", "phase": "post_pass1", "shape": "<target>", "count": 1, "vessel_ids": ["..."], "ts": "..." },
    { "type": "discovery_registration_probe", "phase": "pre_pass2", "shape": "<target>", "count": 1, "vessel_ids": ["..."], "ts": "..." },
    { "type": "binding_layer_record", "executionId": "<exec1>", "task_id": "<downstream user-goal task>", "bound_vessel_id": "<forged vessel id>" },
    { "type": "binding_layer_record", "executionId": "<exec2>", "task_id": "<...>", "bound_vessel_id": "<same forged vessel id>" },
    { "type": "goal_verifier_result", "executionId": "<exec1>", "passed": true, "validator_id": "goal-verifier", "confidence": 0.NN },
    { "type": "goal_verifier_result", "executionId": "<exec2>", "passed": true, "validator_id": "goal-verifier", "confidence": 0.NN }
  ],
  "failure_mode": null,
  "duration_ms": <total>,
  "cost_usd": <minibob-reported total>
}
```

On any failure: `passed: false`, the failing assertion appears with `red: true` and an `inspected_field` excerpt, `failure_mode` populated per the taxonomy, and witnesses present up to the point of failure (a Pass 1 C3 failure still records the pre-flight and post-pass1 discovery probes that ran successfully — the audit loop needs the partial witness set to classify the failure).

## f. test_registration content

Published once at first run (and re-published when the perturbation_schedule changes). Body:

```json
{
  "id": "forge-goal-completion",
  "inputs_schema": {
    "goal_text": "string (prompt 40 with {{target_shape}} substituted)",
    "target_shape": "enum [webhook_signature_verifier | pdf_text_extractor | csv_dialect_detector]",
    "canary_endpoint": "https://activity.metabob.com",
    "discovery_endpoint": "https://discovery.metabob.com"
  },
  "perturbation_schedule": [
    { "row": 1,  "shape": "webhook_signature_verifier", "complexity": "single-step", "depth": 0 },
    { "row": 2,  "shape": "webhook_signature_verifier", "complexity": "single-step", "depth": 1 },
    { "row": 3,  "shape": "webhook_signature_verifier", "complexity": "two-step",    "depth": 0 },
    { "row": 4,  "shape": "webhook_signature_verifier", "complexity": "two-step",    "depth": 1 },
    { "row": 5,  "shape": "pdf_text_extractor",         "complexity": "single-step", "depth": 0 },
    { "row": 6,  "shape": "pdf_text_extractor",         "complexity": "single-step", "depth": 1 },
    { "row": 7,  "shape": "pdf_text_extractor",         "complexity": "two-step",    "depth": 0 },
    { "row": 8,  "shape": "pdf_text_extractor",         "complexity": "two-step",    "depth": 1 },
    { "row": 9,  "shape": "csv_dialect_detector",       "complexity": "single-step", "depth": 0 },
    { "row": 10, "shape": "csv_dialect_detector",       "complexity": "single-step", "depth": 1 },
    { "row": 11, "shape": "csv_dialect_detector",       "complexity": "two-step",    "depth": 0 },
    { "row": 12, "shape": "csv_dialect_detector",       "complexity": "two-step",    "depth": 1 }
  ],
  "cadence": "weekly",
  "rotation": "week_number % 12 -> row index; restart at row 1 every 12 weeks",
  "goal_alignment": [
    "#3-MiniBob-connected-vessels (proposal.md:24-31)",
    "#5-activities-compose-all-features (proposal.md:24-31)"
  ],
  "discrimination_claim": "This test passes only when slot-binding's escalation branch correctly routes count=0 cases to forge_missing_shape AND downstream tasks bind to the just-forged vessel. It discriminates a working forge path from one that succeeds on isolated VesselForgeHost calls but fails inside the goal-processing pipeline: a regression in slot-binding's condition strings, in the shape_producer_inventory resolver, in lifecycle:task:preBinding payloads, in the binding layer's producer-selection, or in goal-verifier's enrichment gate would each independently flip at least one of C1..C8 or D1..D4 to red while leaving validation/scripts/test-22-forge-and-paths.ts green.",
  "witness_types": ["trace_signature", "discovery_registration_probe", "binding_layer_record", "goal_verifier_result"]
}
```

Twelve rows is the **target**; six is the **minimum** required by spec R4. Depth 0 = goal text directly triggers slot-binding's missing-shape branch; depth 1 = goal text first triggers `create-shape-provider-goal`, which in turn surfaces the missing shape one level down (exercised by goal-text variants in prompt 40 that explicitly require a sub-goal before the forge-eligible shape becomes the bottleneck — see prompt 40's "variant block").

## g. Witness type definitions

Each witness type is a tuple consumed by the audit loop:

- **`trace_signature`** — `{type: "trace_signature", executionId, signature}`. `signature` is the SHA-256 of the deterministic concatenation of `executionTraceWithSignatures.impulse_signatures` ordered root-first (impulse pointer + shape + producer-task-id, no body content). The audit loop uses it to detect trace-hash collisions across runs (a sign of a memoised mock).
- **`discovery_registration_probe`** — `{type, phase: "pre_flight|post_pass1|pre_pass2", shape, count, vessel_ids?, ts}`. Direct HTTP probe of `GET <DISCOVERY_URL>/registry/shapes?shape=<target>`. Distinct from a trace inspection: the audit loop trusts an out-of-band probe more than an in-trace impulse for the registry-state witness.
- **`binding_layer_record`** — `{type, executionId, task_id, bound_vessel_id}`. Extracted from `executionTraceWithSignatures` via the task's `impulse_resolutions[].vessel_id` for the input matching `shape === target_shape`. The audit loop uses this to verify C7/D3 without re-fetching the trace.
- **`goal_verifier_result`** — `{type, executionId, passed, validator_id, confidence}`. Extracted from the `validation_result` impulse in the root execution. The audit loop uses this to confirm the goal-verifier's enrichment-gated verification (`repos/minibob/src/resolvers/`) ran and produced a positive verdict.

No new witness machinery: each definition reuses existing impulse / probe surfaces.

## h. Cleanup policy

Forged vessels accumulate at one per week per shape under the chosen rotation. The existing `prune-activity` (`repos/minibob/src/embedded-templates/prune-activity.json`, default `dryRun: true` per super-repo `CLAUDE.md`) handles 30-day rotation of zero-consumption templates. Forged vessels register their template the same way any other vessel does — they are not special. The test verifies this assumption on first run by querying activity-api `templateAuditReport` after Pass 1 and asserting the forged vessel's template appears in the audit corpus (one informational assertion, not a hard gate — failure logged as a warning in the test_report, not a `passed: false`).

No forge-specific deregistration. If `prune-activity`'s rotation does not in fact reach forged vessels (e.g. because the test_report keeps them in the "recently consumed" set), that is itself a `audit_misaligned` finding the audit loop should surface — not a problem this spec solves.

## i. Concurrency

Two concurrent test invocations against the same shape would race the forge dedup. Phase 22 documents the dedup window at 24 hours via discovery registry (`tasks.md:1219`, second-concurrent-forge sees `count >= 1` and falls through to `escalate_unbindable`). The runner does NOT add a mutex. Instead it asserts the dedup behavior is correct:

- If the runner detects (via the post-pass1 discovery probe) that the forged vessel's id differs from the one that finished, the test treats it as an **observation, not a failure**: another instance of the test (or another forge consumer) won the race, and the dedup mechanism still functioned correctly. The test_report records both vessel ids in the `binding_layer_record` witness and proceeds with Pass 2 against whichever vessel discovery now resolves.
- The weekly cadence makes concurrent invocation unlikely in practice. If it becomes a recurring source of false negatives, gate the runner on a discovery-registry advisory lock (out of scope here; tracked in tasks T7).

## j. Interaction with the test-audit-loop sibling spec

This spec produces `test_report` and `test_registration` impulses in the shapes the parallel `2026-05-18-test-audit-loop` spec drafts. The sibling spec defines `audit-test-report` (consumes `test_report` + `test_registration`, emits `test_audit_report`), `run-sensitivity-probe` (consumes `test_registration`, perturbs through the schedule, emits `sensitivity_evidence`), and `debug-failing-audit` (consumes a failing `test_audit_report`).

No tight coupling beyond the impulse-shape contract. If the sibling spec evolves the contract before either ships, this spec's emission shape (§e) updates accordingly — a `test_report` schema bump is a one-line change in `test-forge-goal-completion.ts`. The runner does NOT call the audit activity itself; it relies on the audit's `lifecycle:execution:succeeded` subscription on shape `test_report` (per `2026-05-18-test-audit-loop/proposal.md:42-43`) to dispatch automatically.

If the sibling spec slips, this test is still useful in isolation: a failed assertion surfaces in the test_report's `passed: false` field and the run's exit code, observable from `validation/scripts/run-weekly-harness.sh` logs. The audit loop adds classification and proposal generation on top of the same signal.
