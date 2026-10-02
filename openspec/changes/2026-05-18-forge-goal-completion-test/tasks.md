# Tasks: forge-goal-completion-test

## T1. Prompt authoring

- [x] T1.1 Create `validation/prompts/40-forge-required-shape.md`. Done: exists at `validation/prompts/40-forge-required-shape.md`.
- [x] T1.2 Goal text uses `{{target_shape}}` placeholder; motivates downstream consumer; no mention of forge/slot-binding. Done.
- [x] T1.3 Variant block: single-step vs two-step variants per perturbation row. Done: `VARIANT=single-step-depth-0|two-step-depth-0` env var.
- [x] T1.4 Depth-1 variant wraps goal in sub-goal trigger. Done: `VARIANT=...-depth-1` variants.

## T2. Runner script

- [x] T2.1 `validation/scripts/test-forge-goal-completion.ts` created (1291 lines). Supports `FORGE_RUNTIME=ias-executor|minibob`. Done 2026-05-21.
- [x] T2.2 Pre-flight discovery probe. Done: `runPreflightProbe()` emits `test_report` with `verifier_negative/precondition_violated` on failure.
- [x] T2.3 Pass 1 invocation (minibob or GoalHost); captures execution id from stdout. Done.
- [x] T2.4 Trace fetch via `executionTraceWithSignatures`. Done.
- [x] T2.5 Assertions C1–C8. Done: `runAssertionBlock("pass1", ...)`.
- [x] T2.6 Pass 2 + assertions D1–D4. Done.
- [x] T2.7 Witness harvesting: 9 witness records per successful run. Done: `harvestWitnesses()`.
- [x] T2.8 `test_report_write` emission. Done: `emitTestReport()`.
- [x] T2.9 Exit 0 iff both passes green. Done.

## T3. test_registration emission

- [x] T3.1 `test_registration` POST with 12 perturbation rows + witness types. Done: `emitTestRegistration()` in script.
- [x] T3.2 Idempotent re-emission with `supersedes` on schedule drift. Done.

## T4. Benchmark entry

- [x] T4.1 `validation/forge-goal-benchmark.json` created. Done.

## T5. cycle.sh forge category

- [x] T5.1 `forge` case added to `validation/cycle.sh`. Done.
- [x] T5.2 Help block updated. Done.

## T6. Weekly harness invocation

- [x] T6.1 Step added to `validation/scripts/run-weekly-harness.sh`. Done.
- [x] T6.2 stdout/stderr captured to `{date}-forge-goal.log`, report id to `{date}-forge-goal-report.json`. Done.

## T7. Smoke run on canary

- [x] T7.1 Run the test against canary with target_shape = `webhook_signature_verifier` (row 1) end-to-end. Done 2026-05-21: exec_y2pvojk5, all 8 forge tasks completed, vessel deployed + registered in discovery (count 0→1). Two bugs fixed: F-V60 (deploymentWorkdir priority, commit 5f01e58) and F-V61 (legacy table union in executionTraceWithSignatures, deployed 1.20.9-004d287). Structural assertions C1/C2/C3/C7 fail because test bypasses slot-binding pipeline; C4+C5 pass. Open: F-V62 (impulses_by_id missing from legacy rows, blocking C6/C8 body fields).
- [x] T7.2 Capture the baseline test_report and store at `validation/results/{date}-forge-goal-baseline.json` for diff against future runs. Done 2026-05-21: saved at `validation/results/2026-05-21-forge-goal-baseline.json` (baseline_version=2, post F-V60+F-V61 fix). Prior v1 run (fgc-1779391771341) was pre-fix with trace_tree_size=0; v2 (fgc-1779399889346) confirms trace_tree_size=1, forge pipeline end-to-end working.
- [ ] T7.3 If concurrency lock becomes necessary per `design.md` §i, file a follow-up against this spec's `tasks.md` rather than introducing the lock here.

## T8. Acceptance

- [ ] T8.1 Both Pass 1 and Pass 2 green for ≥ 3 consecutive weekly runs across the three candidate shapes.
- [ ] T8.2 The sibling `audit-test-report` activity (once shipped per `2026-05-18-test-audit-loop`) consumes the `test_report` impulse without errors — verified by observing one `test_audit_report` impulse per weekly run linking back to this test's `run_id`.
- [ ] T8.3 At least one assertion-failure mode (C3 or D2 forced) has been exercised manually and the resulting `test_report.passed = false` plus `failure_mode` propagated to the audit loop, confirming the failure path is wired end-to-end.
- [ ] T8.4 The forged-vessel rotation assumption (§h) verified: at least one forged vessel from this test reached `prune-activity`'s 30-day cutoff and was rotated, OR a documented `audit_misaligned` finding records that the assumption is wrong and proposes a fix.
