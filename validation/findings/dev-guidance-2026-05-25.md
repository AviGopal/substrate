# Dev guidance — minibob removed, substrate rebuild required

**Date**: 2026-05-25  
**Audience**: validation + audit agents  
**Status**: SUBSTRATE OFFLINE — rebuild required before resuming

---

## What changed (commit 57d74520)

minibob has been **removed from the substrate container** entirely:

- `Dockerfile.substrate`: minibob COPY/install block deleted
- `scripts/substrate/units/minibob.service` deleted
- `scripts/substrate/units/minibob-boredom.service` deleted  
- `scripts/substrate/units/minibob-boredom.timer` deleted
- `systemctl enable` list: `minibob.service` removed
- `Makefile`: port 8200 removed, `logs-minibob` target removed

**Why**: The substrate-explicit-vessels arc (Phases 0–8) is complete. All execution now flows through:

```
boredom-vessel.timer → boredom-vessel → goal-host-vessel:8210 → GoalHost (ias-executor-ts) → activity-api
```

minibob remains as a thin CLI tool (`repos/minibob/`) for local development use, but it is no longer a substrate unit.

---

## Container restart instructions (operator)

The substrate-live container exited with `JWT_SECRET: JWT_SECRET is required` (not a crash — missing env var at restart). The image must be rebuilt to incorporate the minibob removal before restarting.

```bash
# 1. Build new image (from repo root)
docker build -f Dockerfile.substrate -t metabob/substrate:dev .

# 2. Start substrate-live
JWT_SECRET=<secret> SURREAL_PASS=<pass> METABOB_API_KEY=<key> ANTHROPIC_API_KEY=<key> \
  docker run -d --name substrate-live \
    -e JWT_SECRET -e SURREAL_PASS -e METABOB_API_KEY -e ANTHROPIC_API_KEY \
    -p 18080:8080 -p 18090:8090 -p 18100:8100 \
    -v $(pwd)/scripts/substrate/workspace:/workspace \
    --tmpfs /run --tmpfs /run/lock \
    metabob/substrate:dev

# 3. Seed identity
docker exec substrate-live bun /vessels/seed-identity.ts

# 4. Verify health
make -C scripts/substrate health
```

---

## Impact on previously-observed symptoms

### Symptoms 1 + 2 (composition_chain empty, Thompson flat) — LIKELY RESOLVED

The prior observations were based on minibob's synthetic `_goal_resolve` / `_activity_execute` meta-traces which had known chain-propagation issues.

The new execution path uses GoalHost (ias-executor-ts) which correctly propagates chains:
- `engine.ts:dispatchCompose` extends `compositionChain` with current `executionId`
- `activity-api-trace-sink.ts` writes `composition_chain` + `parent_execution_id` on each trace

**Verify after restart**:
```bash
KEY=$(docker exec substrate-live env | grep '^METABOB_API_KEY=' | cut -d= -f2)

# Check goal-host traces for boredom-triggered goals (NOT _goal_resolve anymore)
curl -s -H "Authorization: ApiKey $KEY" \
  "http://localhost:18080/v2/activities/execution-traces?limit=20" | \
  jq '.executions[] | {id: .execution_id, activity_id, composition_chain, parent: .parent_execution_id}'
```

Expected: boredom-triggered goals appear as ROOT traces (`composition_chain: []`). Their child activities (coverage-tick etc.) should have `composition_chain: [root-id]` and `parent_execution_id: root-id`.

### Symptom 3 (gap-003 — failure_mode null on _goal_resolve failures) — MOOT

`_goal_resolve` traces are gone. goal-host-vessel's traces are written by ias-executor-ts which populates `failure_mode` via `activity-api-trace-sink.ts:146`.

### F-037 (Thompson posteriors flat) — RE-VERIFY needed

If composition chains now populate correctly, Thompson selections should propagate and posteriors should move. Re-run F-037 check after first boredom cycle completes.

### gap-008 (No monitoring on substrate crashes) — STILL OPEN

Substrate restart was detected by validation via polling (iter-17). This gap remains. The `development-vessel:substrate-health-tick` activity addresses it partially but the external monitoring surface is not yet wired.

---

## New verification queries (post-restart)

```bash
KEY=$(docker exec substrate-live env | grep '^METABOB_API_KEY=' | cut -d= -f2)

# 1. Are all vessels healthy?
make -C scripts/substrate health

# 2. Did boredom-vessel fire after restart?
docker exec substrate-live journalctl -u boredom-vessel.service --no-pager -n 20

# 3. Did goal-host-vessel execute the goal?
docker exec substrate-live journalctl -fu goal-host-vessel.service -n 30

# 4. Check the most recent traces - verify no _goal_resolve / _activity_execute
curl -s -H "Authorization: ApiKey $KEY" \
  "http://localhost:18080/v2/activities/execution-traces?limit=10" | \
  jq '.executions[] | .activity_id' | sort | uniq -c | sort -rn

# 5. Thompson posteriors - should start moving after first full execution cycle
curl -s -H "Authorization: ApiKey $KEY" \
  "http://localhost:18080/v2/activities/templates?limit=10" | \
  jq '.activities[] | select(.name == "coverage-tick") | .metrics'
```

---

## What the validation + audit loops should focus on next

1. **Verify composition_chain propagation works** in the new architecture (first boredom firing)
2. **Verify Thompson posteriors move** after a successful goal-host execution
3. **File new gap findings** if goal-host-vessel execution path has issues analogous to the old minibob symptoms (different trace format, different failure modes)
4. **gap-008** (substrate crash alerting) — remains an open architectural gap

The old `dev-guidance-2026-05-24.md` proposed adding `GOAL_RUNTIME=ias-executor` to `minibob.service` as an interim fix. This is now **superseded** — minibob is removed from the substrate; the fix is the architecture itself.
