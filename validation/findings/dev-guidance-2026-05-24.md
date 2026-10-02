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

---

## 2026-05-24T22:30Z UPDATE — The <10-LOC fix

A subagent readiness audit of substrate-explicit-vessels + ias-executor-ts uncovered a much simpler closure path for Symptoms 1 + 2 than the in-place minibob fix I described above.

### The actual state

The ias-executor → GoalHost bridge IS ALREADY WIRED in minibob:

- `repos/minibob/src/vessel-bootstrap.ts:241` — gates on `GOAL_RUNTIME=ias-executor`
- `repos/minibob/src/cli/goal.ts:111` — same gate
- `repos/minibob/src/cli/processor.ts:712, 1193-1222` — full GoalHost path when gate is on
- `repos/minibob/src/goal-host-bridge.ts` exists and provides AnthropicLLMAdapter + buildGoalHost/runGoal against `@avigopal/ias-executor-ts`

But the substrate is NOT using it. Verification:

```bash
# scripts/substrate/units/minibob.service has NO GOAL_RUNTIME env var:
grep -i "goal_runtime\|ias" scripts/substrate/units/minibob.service
# (returns nothing)

# Confirmed at runtime:
docker exec substrate-live env | grep -i "GOAL_RUNTIME\|IAS_"
# (returns nothing)
```

### What ias-executor-ts has that minibob's dispatch path doesn't

`repos/ias-executor-ts/src/engine.ts:396` in `dispatchCompose`:
```typescript
const childChain = [...opts.compositionChain, opts.executionId];
```

`repos/ias-executor-ts/src/resolvers/activity.ts:92-96` in the activity resolver:
```typescript
compositionChain: [...(context.compositionChain ?? []), context.executionId]
```

Both correctly extend the chain. The wire-format serialization is pinned by `engine-composition.test.ts` and `translating-trace-sink.test.ts`.

### The proposed change

Add one line to `scripts/substrate/units/minibob.service`:

```diff
 [Service]
 Type=simple
 EnvironmentFile=/etc/substrate/env
 Environment=MINIBOB_PORT=8200
 Environment=HOST=127.0.0.1
 Environment=MINIBOB_PROVIDER=anthropic
+Environment=GOAL_RUNTIME=ias-executor
 WorkingDirectory=/vessels/minibob
 ExecStart=/root/.bun/bin/bun /vessels/minibob/index.ts --daemon
```

Then `systemctl daemon-reload && systemctl restart minibob.service` in the substrate container.

### Expected outcome

All subsequent goal_resolve dispatches route through GoalHost → ActivityExecutor (ias-executor-ts). New traces should have:
- `parent_execution_id` populated on coverage-tick and substrate-health-tick traces
- `composition_chain` non-empty
- Thompson posterior updates landing (alpha/beta moving from 1/1)
- success_rate computing correctly (was 0 with 60/68 successes)

Symptom 3 (gap-003 failure_mode null) remains independent — needs the separate goal_resolve emit-site fix in minibob/src/mcp.ts:3193 OR may also resolve if GoalHost's failure handling populates failure_mode where minibob's doesn't (worth checking).

### Why this works without full vessel replacement

The substrate-explicit-vessels Phase 0-8 cutover (6 greenfield vessels + VesselDaemon toolkit) is months of work. The bridge approach is a parallel-runnable interim:
- Minibob remains the host process (HTTP server, REPL, bootstrap)
- Execution path delegates to ias-executor-ts's GoalHost
- composition_chain works because GoalHost's dispatch is correct
- Tests cover this path (engine-composition.test.ts:207-316)

The full vessel replacement still has value (architectural cleanness, true vessel-isolation, federation-ready) but isn't required to close the linchpin bug.

### Risk and rollback

Risk: GoalHost's goal→template binding is less rich than minibob's goal-processor (no enrichment-gated verification, no HumanResolver fallback). For the boredom-fired topology-discovery goal text, this should be acceptable — slot-binding handles the dispatch. For broader goal types it may regress.

Rollback: remove the env var line, restart minibob. Zero schema change. Zero state migration.

### Recommended order

1. **First**: add `GOAL_RUNTIME=ias-executor` to minibob.service. Restart. Watch the next 1-2 boredom firings via narrator + audit. If composition_chain populates and posteriors move, Symptoms 1+2 close together as predicted.

2. **Then**: address Symptom 3 (failure_mode classification in goal_resolve emit site) — independent fix.

3. **Defer**: full substrate-explicit-vessels Phase 0-8 implementation. Track separately as the architectural-cleanness initiative.

