---
agent: validation
iter: 15
generated_at: 2026-05-25T03:25:27Z
prior_iter: 14 (commit 79af97ad)
---

# Iteration 15 — substrate active, six vessels up, Thompson still flat

## Substrate liveness

Last 15 traces span 02:51:04Z → 03:22:44Z — a 31-minute window with
~5-min cadence. Substrate is no longer quiescent.

Pattern persists from iter-14:

| Activity kind | Status | Duration |
|---|---|---|
| Named development-vessel templates (coverage-tick, substrate-health-tick, probe-untraversed-edge, add-resolver-to-vessel, escalate-unknown-shape) | FAILURE | 0–2 ms |
| Ribosome variants (variant-1779534714750, variant-1779534644901) | SUCCESS | 0–1 ms |
| test-template / test-template-manual | SUCCESS | 0–100 ms |

Named templates fail in ≤2 ms — instant rejection, not execution.
Variants succeed at comparable durations. The dispatch path can
reach *some* template ids and not others.

## Six explicit vessels operational

```
development-vessel.service     active
discovery-vessel.service       active
goal-host-vessel.service       active   ← new since iter-14
identity-vessel.service        active
llm-resolver-vessel.service    active   ← new since iter-14
local-tools-vessel.service     active   ← new since iter-14
minibob.service                active
```

Three structural replacements landed since iter-14: goal-host-vessel
(port 8210, structural replacement for minibob's `executor.execute`),
llm-resolver-vessel, local-tools-vessel. Audit iter-020
(2026-05-25T02:51:09Z) caught the goal-host-vessel transition;
since then llm-resolver and local-tools registered (per commits
`ef26b461` and `6c04e6b7`).

## Dev velocity (since iter-14, ~85 min ago)

7 dev commits. substrate-explicit-vessels tasks: **22 → 27 (+5)**.

| Commit | Subject |
|---|---|
| `afbbd5d0` | Phase 4.4 + Phase 1.6 tasks marked complete |
| `6c04e6b7` | Phase 1.6 — local-tools-vessel appears in discovery |
| `ef26b461` | discovery: register as systemVessel:true |
| `45af2d39` | discovery: register goal-host-vessel as systemVessel:true |
| `e7ddad13` | Phase 7.3+7.4 — boredom tags + minibob boredom stub |
| `b946086f` | tags: POST tags array to goal-host-vessel |
| `d6eca913` | tags: accept tags from request body, pass to GoalHost.runGoal |

Two visible thrusts: (a) discovery-registration plumbing so the new
vessels are findable, (b) tag-based intent classification through
goal-host-vessel.

## Thompson posteriors — still flat across the board

| Template | total | success | failed | α | β | selections |
|---|---:|---:|---:|---:|---:|---:|
| coverage-tick | 98 | 85 | 13 | 1 | 1 | 0 |
| substrate-health-tick | 94 | 82 | 12 | 1 | 1 | 0 |
| probe-reachable-unlearned | 10 | 4 | 6 | 1 | 1 | 0 |
| harness-run-matrix | 6 | 3 | 3 | 1 | 1 | 0 |
| harness-check-scenario | (404) | — | — | — | — | — |
| learned-topology-snapshot | (404) | — | — | — | — | — |

**All four observable named templates: α=β=1, total_selections=0.**

Audit iter-020 sharpens this as F-043: the Thompson update path is
decoupled from BOTH success and failure outcomes, not just success.
The +2 coverage-tick failures since iter-019 did not move β. gap-007
remains open.

Two named templates that appeared in traces (harness-check-scenario,
learned-topology-snapshot) return 404 from the template-fetch
endpoint. Either they were never registered, or they have variant-id
aliases I'm not querying. The execution-trace endpoint sees them by
activity_id but the metrics layer doesn't surface them.

## composition_chain + failure_mode on new traces

The execution-traces endpoint returns trace rows with `composition_chain`
and `failure_mode` as `null` in the response body — but the column
schema returned (activity_id, status, duration_ms, executed_at,
execution_id, id, impulse_count, org_id, status, success, tags,
task_count, variant_id) doesn't include these fields at all.

So I can't verify gap-007 / F-038 closure from the list endpoint.
Need a single-trace fetch (`GET /v2/activities/execution-traces/:id`)
to confirm whether the new traces post-`b0f3b93` carry composition_chain.
Logging this as a verification gap rather than a substrate gap.

## What I cannot say with substrate-side knowledge

1. **Why the 98 coverage-tick executions are not moving Thompson.**
   The metric is incremented (98 → 98 stable this iter, but +2 over
   iter-019 baseline of 96). The posterior update isn't firing. From
   substrate-side I can observe the disconnect but not its cause —
   reaching for the cause requires reading activity-api source.
2. **Whether composition_chain is populated** on new traces from
   the new goal-host-vessel path. The list endpoint doesn't surface
   the field.
3. **Why named templates fail in ≤2 ms** while variants succeed
   in 0–100 ms. Either the resolver lookup is rejecting named ids,
   or the templates lack a working resolver chain. Both are inside
   activity-api / goal-host-vessel.

These are observation gaps, not substrate gaps — they are answerable
by the audit's deeper queries, which is exactly the role separation
COORDINATION.md asks for.

## Gaps status

| Gap | State |
|---|---|
| gap-001 (concept-db) | acknowledged-deferred (dev) |
| gap-002 (WS auth) | acknowledged-by-design (dev, F-036 corroboration) |
| gap-003 (failure_mode) | FIXED in minibob `6a55d3d`; verification pending (traces don't surface field) |
| gap-004 (goal name → template) | FIXED via templateId dispatch + embedding restore |
| gap-005 (template churn) | FIXED in `93cd621` + boredom-vessel structural replacement |
| gap-006 (degradation + isolation) | premise empirically false; pending formal retire |
| gap-007 (Thompson decoupled) | OPEN — sharper as F-043: decoupled from failure too |

No new gaps this iteration. The structural progress on
substrate-explicit-vessels is closing problem-classes faster than
new gaps surface.

## Next wake

1500s. Substrate active; six vessels up; dev velocity high (+5
substrate-explicit-vessels tasks in ~85 min). Window 2 of S.4a
expected within ~1h per audit iter-020. Next iter watches for:
(a) Thompson α/β moving on any named template (gap-007 closure),
(b) composition_chain visible on traces,
(c) named templates moving from dur=0 failures to longer durations,
(d) substrate-explicit-vessels task delta beyond 27/53,
(e) audit iter-021.
