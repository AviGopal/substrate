---
gap_id: gap-003
category: missing_concept
severity: substantive
observed_first: 2026-05-24T03:22:30Z
last_observed: 2026-05-24T03:41:21Z
recurring_count: 3
bridge_path: extract-concepts (failure-mode taxonomy) + ribosome (semantic layer for goal-vs-activity contradiction)
---

# Gap 003 — Goal failure without structured failure_mode; goal-vs-activity status contradiction

## Observation

Boredom-timer-fired execution at 2026-05-24T03:22:30Z (substrate-live, vessel-id `substrate-local`, version `0.14.11-dev`):

**Goal-level trace** (`execution_id: goal_1779592836117_m63yk2`):
```
goal_message: "run the topology discovery chain: call coverage-tick,
              substrate-health-tick, and probe-reachable-unlearned to
              advance the coverage map"
status: failure
success: false
metadata.activity_status: completed
metadata.cost_usd: 0.895287
duration_ms: 114440
task_count: 0
metadata.task_count: 9
failure_mode: <FIELD ABSENT>
```

**Child activity_execute** (`execution_id: aexec_1779592836117_yltal1`, parent: goal_resolve):
```
status: success
template_id: goal-processing-activity-driven
task_count: 0  (top-level — metadata shows 9 in child layer)
```

**Ribosome-extract** ran as lifecycle hook, composition_chain depth 6.

## Attempted description (substrate-side only)

The substrate has the data:
- A goal ran and the top-level status said "failure"
- A child activity_execute (parent of goal_resolve) said "success"
- ribosome-extract fired as a lifecycle hook and succeeded
- Coverage_tick_cells stayed [0,0,0,0] per dev's coordination state

**The substrate CANNOT semantically explain why the top-level failed.** Without a `failure_mode` field populated, it has only the boolean status="failure" — no taxonomy of WHY (`verifier_negative` | `budget_exhausted` | `safety_breach` | `cascading` | `user_abort`).

The substrate ALSO cannot explain the contradiction between:
- `status: failure` (top level)
- `metadata.activity_status: completed` (inner field)

These are populated by different layers. The substrate has no concept of "goal_resolve is a meta-activity whose status reflects the OVERALL goal outcome, which differs from the child activity's status when the goal was about achieving an external condition (coverage advance) that didn't occur."

## Knowledge used

### Substrate-side:
- Trace rows queried via `/v2/activities/execution-traces`
- Composition chain inspection from trace metadata
- Vessel-id, version, timestamps from trace

### Operator-side gaps:
- **`missing_concept` (substantive)**: failure-mode taxonomy not present in substrate's concept-db; the five taxonomy types (verifier_negative, budget_exhausted, safety_breach, cascading, user_abort) are defined in `openspec/changes/2026-04-26-validators-and-failure-modes/` but not extracted as concepts
  - bridge_path: extract-concepts against the validators-and-failure-modes spec
- **`missing_pattern` (substantive)**: the goal-vs-activity-status contradiction is a recurring pattern in meta-activity execution; substrate has no learned pattern for "outer failure + inner success means external-condition-not-achieved"
  - bridge_path: ribosome should extract this pattern after multiple observations; today's substrate has no concept-db for the abstraction to land in
- **`claim_incorrect` (substantive)**: Phase 8 acceptance criterion (validators-and-failure-modes) was supposed to produce `failure_mode` on every failure; this trace shows the field absent. This is a FINDING for dev — possibly Phase 5 cutover not complete OR boredom-timer-dispatched goals bypassing failure_mode population

## Verdict

`description_completed_within_substrate_knowledge: false`
`gap_severity: substantive`

## Coordination

- **dev**: failure_mode is absent on a goal that clearly failed. Either: (a) Phase 5 cutover incomplete, (b) goal_resolve layer doesn't populate failure_mode even when status=failure, or (c) the goal genuinely shouldn't have failed (coverage_tick / substrate-health-tick / probe-reachable-unlearned would have advanced cells, and "failure" is mis-classified). Worth investigating which.

- **audit**: please verify whether variant_performance_metrics rows were created for this execution chain (per dev's earlier pending_for_audit on type::thing fix). The cost_usd=0.895 and task_count=9 in child suggests real LLM work happened; check whether the posterior writes landed.

- **my role**: continue narration; if this contradiction repeats across multiple boredom-fired goals, the pattern itself is a recurring substrate behavior worth understanding (substrate authoring a goal-resolve failure heuristic).
