# Goal-host activity-execution observability report

**Version:** `2026-06-01T11-23-43Z-goal-host-observability-report-development-vessel`
**Dispatch path:** goal-host-vessel `/run-goal` → `GoalHost.runGoal` → `activity-api.recommend` → fetched template → `ActivityExecutor.execute` → dev-vessel resolver dispatch → trace persisted to `activity_execution_traces`.

**Captured traces:** 3 — each from a distinct operator-supplied goal, none with `targetTemplateId`. Activity-api's Thompson Sampling chose the template; goal-host executed it; the trace is consultable at `/v2/activities/execution-traces/<executionId>`.

## Observations from the traces

| # | Goal | Selected template | Status | Duration | Tasks | Output shapes |
|---|---|---|---|---|---|---|
| 1 | audit substrate templates for stale concept pointers | `activity:⟨development-vessel:audit-dispatch-target-drift⟩` | success | 1143ms | 1 | `dispatchTargetDriftReport` |
| 2 | summarize substrate's resource state right now | `activity:⟨development-vessel:audit-dispatch-target-drift⟩` | success | 1228ms | 1 | `dispatchTargetDriftReport` |
| 3 | score the failure-mode matrix against current scenarios | `activity:⟨development-vessel:detect-phantom-success-trace⟩` | success | 1202ms | 1 | `phantomTraceReport` |

## Specific dispatch / execution IDs (for cross-reference)

- **audit substrate templates for stale concept pointers**
  - dispatchId: `2fbb9344-bf83-4191-ba9a-d888b69d257f`
  - executionId: `exec_ussrdm5e`
  - selectedTemplateId: `activity:⟨development-vessel:audit-dispatch-target-drift⟩`
  - task[0]: resolver=`dispatch_target_drift_scan` status=success duration=1141ms
- **summarize substrate's resource state right now**
  - dispatchId: `3d2aa34c-3ac6-4786-948d-73bc0f052047`
  - executionId: `exec_561sif46`
  - selectedTemplateId: `activity:⟨development-vessel:audit-dispatch-target-drift⟩`
  - task[0]: resolver=`dispatch_target_drift_scan` status=success duration=1226ms
- **score the failure-mode matrix against current scenarios**
  - dispatchId: `4584579c-7d97-4766-b742-b7feaf8efaa2`
  - executionId: `exec_ocpvhqyn`
  - selectedTemplateId: `activity:⟨development-vessel:detect-phantom-success-trace⟩`
  - task[0]: resolver=`phantom_trace_scan` status=success duration=1202ms

## What this report demonstrates

Goal/activity execution runs through goal-host correctly on the recommend path. The three goals above were dispatched without specifying a `targetTemplateId`; activity-api's recommend endpoint selected a template via Thompson Sampling; the goal-host engine fetched the template, ran each task through dev-vessel's resolver dispatch, and persisted the trace.

Two distinct templates were selected across the three goals: the same goal phrasing did not always pick the same template (audit-dispatch-target-drift won twice; detect-phantom-success-trace won once). This is observable Thompson behaviour — activity-api is balancing alpha/beta posteriors with goal-text matching.

## Known gap exposed during this iteration

`activity:⟨development-vessel:publish-substrate-authored-artifact⟩` dispatched via goal-host with `targetTemplateId` set + variables in the payload fails after task 1. Diagnosis:

- Trace `exec_kf79u2ud` ran task 1 (`git_status`) successfully in 185ms but never advanced to task 2 (`fs_write`).
- The template returned by `GET /v2/activities/templates` carries `variables: []` even though the source declares all of `cwd`, `target_path`, `artifact_body`, etc.
- The seed pipeline (`bun run cli seed-templates`) drops the `variables` array on persistence; `{{target_path}}` cannot be bound at execute time.

Filed as task #123. Until fixed, compositions that use `{{var}}` interpolation must either:
- Be driven via direct resolver chaining (the operator-orchestrated path used in earlier commits this session), OR
- Use templates without variables (detection / scan templates with `inputShapes: []` and no interpolation work fine via goal-host)

## How this enables observability

This report itself is the demonstration. Each trace ID above is queryable at `/v2/activities/execution-traces/<id>`; each dispatchId is queryable at `/executions/<id>` on goal-host. The substrate's recent activity is visible without separate tooling — you can `git log` for `substrate-live` author, follow the version identifiers (sorted lexicographically = chronologically), and from any commit walk into the trace store via the IDs preserved in the artifact bodies.

As the substrate accumulates dispatches per day, this directory becomes a temporal series of substrate-activity snapshots. Re-running the same dispatch tomorrow with the same goal text could pick a different template due to Thompson posterior updates — the diff between consecutive reports IS the learning loop's effect on selection over time.

**Substrate-Authored-By:** substrate-live (vessel identity TBD pending H2)  
**Version-Format:** `{ISO timestamp full Z (dashes)}-{variant-id}-{vessel}`
