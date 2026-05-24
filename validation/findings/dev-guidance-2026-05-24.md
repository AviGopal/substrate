# Validation-side guidance for dev — composition_chain + Thompson + failure_mode

**Validation finding bundle**: gap-003 (×25), gap-007 (×18), audit F-037, audit F-038
**Convergent observation**: 5+ hours of diagnosed-but-untreated state
**Audience**: development operator
**Goal**: provide file:line evidence and suggested investigation order

---

## The three observable symptoms (one root cause)

### Symptom 1 — `composition_chain: []` on named template traces

**Evidence**: Direct trace queries at 2026-05-24T17:16:52Z (coverage-tick ×3), 19:56:50Z (substrate-health-tick ×3), 20:46:50Z (substrate-health-tick ×3), 21:06:54Z (coverage-tick ×3). ALL 12 invocations show `composition_chain: []`.

**Where to look** (activity-api):
- `repos/metabob-activity-api/src/routes/execution-traces.ts` — `denormalizeCompositionChain(body.parent_execution_id)` is called only if `body.parent_execution_id` is set. Empty chain → EITHER parent_execution_id is null at POST time OR parent's chain is itself empty.

**Where to look** (minibob):
- `repos/minibob/src/activity.ts` — multiple `parentExecutionId` propagation sites (lines 769, 1304, 1396, 1405, 1513, 2022, 2327, 2372)
- `repos/minibob/src/mcp.ts:3167-3193` — `emitMetaTrace` for synthetic `_goal_resolve`/`_activity_execute` DOES set parentExecutionId
- **Gap candidate**: the dispatch path that reaches coverage-tick (via slot-binding/improvise/shape-based dispatch) likely doesn't route through these propagation sites

**Closure criterion**: a coverage-tick trace query should return `parent_execution_id` populated and `composition_chain` non-empty.

### Symptom 2 — Thompson posteriors flat (audit F-037)

**Evidence**: 
- coverage-tick: 89/81/8 → success_rate=0, alpha=beta=1, total_selections=0
- substrate-health-tick: 84/78/6 → same pattern
- 159 successful executions, zero posterior updates

**Where to look** (activity-api):
- `repos/metabob-activity-api/src/lib/posterior-update.ts` lines 246, 447 — alpha/beta updates require being called

**Likely cause** (audit F-038 linchpin hypothesis):
- Thompson update path looks for "selections" — evidence that parent dispatched this template
- composition_chain empty → no selection link → posterior-update sees these as orphan executions and skips
- **Symptom 2 likely cascade-closes when Symptom 1 is fixed**

**Closure criterion**: success_rate=0.91 (not 0), thompson_alpha>1, total_selections>0.

### Symptom 3 — `failure_mode: null` on goal_resolve failures (gap-003)

**Evidence**: 25 goal_resolve failures, all with failure_mode=null. Spec defines 5 types: verifier_negative, budget_exhausted, safety_breach, cascading, user_abort.

**Where to look** (minibob — goal_resolve is minibob-side):
- `repos/minibob/src/mcp.ts:3193` — `emitMetaTrace` with `level: "goal_resolve"` and templateId `_goal_resolve`
- Search the goal-resolve completion path for where `status: "failure"` is set without `failure_mode` classification

Inner goal-processing-activity-driven succeeds but substrate didn't achieve stated outcome → should classify as `verifier_negative` with `context.failed_evidence`.

**Closure criterion**: a goal_resolve trace with status="failure" MUST have failure_mode.type populated.

---

## Suggested investigation order

1. **Start with Symptom 1 (composition_chain)** — most likely the linchpin. Fix chain propagation on the activity-dispatch path reaching coverage-tick.
2. **Verify Symptom 2 cascade** — Thompson posteriors should begin updating once chains are populated.
3. **Then Symptom 3** — independent. Add failure_mode classification at goal_resolve emit site.

---

## Verification queries (post-fix)

```bash
KEY=$(docker exec substrate-live env | grep '^METABOB_API_KEY=' | cut -d= -f2)

# Symptom 1
curl -s -H "Authorization: ApiKey $KEY" "http://localhost:18080/v2/activities/execution-traces?limit=20" | \
  jq '.executions[] | select(.activity_id | contains("coverage-tick")) | {composition_chain, parent: .parent_execution_id}'

# Symptom 2
curl -s -H "Authorization: ApiKey $KEY" "http://localhost:18080/v2/activities/templates?limit=50" | \
  jq '.activities[] | select(.name == "coverage-tick") | .metrics | {success_rate, thompson_alpha, thompson_beta, total_selections}'

# Symptom 3
curl -s -H "Authorization: ApiKey $KEY" "http://localhost:18080/v2/activities/execution-traces?limit=20" | \
  jq '.executions[] | select(.activity_id == "_goal_resolve" and .status == "failure") | {execution_id, failure_mode}'
```

---

## Out of scope for this guidance

- probe-reachable-unlearned never invoked (separate gap; likely Thompson-uniform-prior + no name match)
- boredom systemd still POSTs goal-text payload (audit F-024)
- lift-criterion-hardening anchor curation status

---

Validation will detect changes within ~30 min via the narration loop. Audit independently verifies at runtime.
