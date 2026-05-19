# Tasks: forge-goal-completion-test

## T1. Prompt authoring

- [ ] T1.1 Create `validation/prompts/40-forge-required-shape.md` following the format of `validation/prompts/22-selection-and-score-update.md` (header, "What to verify" block, numbered steps, "Acceptance criteria" block).
- [ ] T1.2 Goal text MUST name a target shape via a `{{target_shape}}` placeholder (substituted by the runner per the week's perturbation row), motivate a downstream consumer that genuinely needs the shape, and not mention forge or slot-binding directly — the user-facing goal must read like any other user goal.
- [ ] T1.3 Include a "variant block" that the runner can select per perturbation row: single-step (goal directly needs the shape) vs two-step (goal needs an intermediate shape that the LLM-of-last-resort would map to the target).
- [ ] T1.4 Include a "depth-1 variant" that wraps the goal text in a sub-goal trigger (a phrasing that exercises `create-shape-provider-goal` once before the forge-eligible shape surfaces).

## T2. Runner script

- [ ] T2.1 Create `validation/scripts/test-forge-goal-completion.ts` modelled on `validation/scripts/test-22-forge-and-paths.ts` for env-var handling and Anthropic / METABOB key plumbing, but distinct in that the runner shells out to the minibob CLI rather than calling `VesselForgeHost` directly.
- [ ] T2.2 Pre-flight discovery probe per `design.md` §b. Failure here emits `test_report` with `passed: false`, `failure_mode: { type: "verifier_negative", reason: "precondition_violated" }` and exits non-zero.
- [ ] T2.3 Pass 1 invocation via `miniBob --single "<goal>"` with `MINIBOB_SKIP_STARTUP=true`. Capture stdout for the execution id; on miss, fall back to most-recent root execution within 5 min.
- [ ] T2.4 Trace fetch via `POST /v2/impulses/resolve` with pointer `{type: "executionTraceWithSignatures", execution_id: ...}` against `https://activity.metabob.com`.
- [ ] T2.5 Implement assertions C1–C8 from `design.md` §c, each with the `inspected_field` excerpt recorded in the report whether green or red.
- [ ] T2.6 Pass 2 invocation (same CLI surface, same goal text) and assertions D1–D4 from `design.md` §d.
- [ ] T2.7 Witness harvesting per `design.md` §g — four witness types, total of 9 witness records on a successful run (2 trace signatures + 3 discovery probes + 2 binding records + 2 goal-verifier results).
- [ ] T2.8 `test_report` emission per `design.md` §e via `POST /v2/impulses/resolve` with pointer `{type: "test_report_write", ...}`.
- [ ] T2.9 Exit code 0 only if both passes green; exit code 1 otherwise (the audit-loop reads the impulse, not the exit code, but the harness uses the code for at-a-glance dashboard color).

## T3. test_registration emission

- [ ] T3.1 On first run, POST `test_registration` impulse to activity-api with the body from `design.md` §f (12 perturbation rows, witness types, discrimination claim).
- [ ] T3.2 Idempotent re-emission: subsequent runs check whether a `test_registration` with `id: "forge-goal-completion"` already exists in the registry; if it does and the perturbation schedule hash matches, skip. If the schedule diverges (perturbation rows changed), emit a new registration with `supersedes: <prior_id>` per the sibling spec's grandfathering rule.

## T4. Benchmark entry

- [ ] T4.1 Create `validation/forge-goal-benchmark.json` parallel to `validation/activity-reuse-benchmark-v2.json`. One row: `{id: "forge-goal-completion", prompt: "validation/prompts/40-forge-required-shape.md", runner: "validation/scripts/test-forge-goal-completion.ts", cadence: "weekly"}`.

## T5. cycle.sh forge category

- [ ] T5.1 Add a `forge` case to `validation/cycle.sh:121-141`: `forge) [[ "$base" =~ ^4[0-9]- ]] ;;` so prompts 40–49 are reachable via `--category forge`.
- [ ] T5.2 Document the new category in `validation/cycle.sh:14` help block ("Recognized: general, bugfix, feature, refactor, analysis, upkeep, forge").

## T6. Weekly harness invocation

- [ ] T6.1 Add a step to `validation/scripts/run-weekly-harness.sh` that runs `bun run validation/scripts/test-forge-goal-completion.ts` with the perturbation row selected from `date +%V`.
- [ ] T6.2 Capture stdout/stderr to `validation/results/{date}-forge-goal.log` and the `test_report` impulse id to `validation/results/{date}-forge-goal-report.json` for cross-reference with the audit loop's outputs.

## T7. Smoke run on canary

- [ ] T7.1 Run the test against canary with target_shape = `webhook_signature_verifier` (row 1) end-to-end.
- [ ] T7.2 Capture the baseline test_report and store at `validation/results/{date}-forge-goal-baseline.json` for diff against future runs.
- [ ] T7.3 If concurrency lock becomes necessary per `design.md` §i, file a follow-up against this spec's `tasks.md` rather than introducing the lock here.

## T8. Acceptance

- [ ] T8.1 Both Pass 1 and Pass 2 green for ≥ 3 consecutive weekly runs across the three candidate shapes.
- [ ] T8.2 The sibling `audit-test-report` activity (once shipped per `2026-05-18-test-audit-loop`) consumes the `test_report` impulse without errors — verified by observing one `test_audit_report` impulse per weekly run linking back to this test's `run_id`.
- [ ] T8.3 At least one assertion-failure mode (C3 or D2 forced) has been exercised manually and the resulting `test_report.passed = false` plus `failure_mode` propagated to the audit loop, confirming the failure path is wired end-to-end.
- [ ] T8.4 The forged-vessel rotation assumption (§h) verified: at least one forged vessel from this test reached `prune-activity`'s 30-day cutoff and was rotated, OR a documented `audit_misaligned` finding records that the assumption is wrong and proposes a fix.
