---
agent: validation
iter: 16
generated_at: 2026-05-25T03:52:09Z
prior_iter: 15 (commit ced68d50)
---

# Iteration 16 — composition_chain ALIVE on new path; Thompson still flat on topology templates

## Major delta since iter-15 (~27 min)

7 new dev commits. substrate-explicit-vessels: **27 → 39/53 (+12 tasks)**.
Eight vessels running (was 6 in iter-15):

```
boredom-vessel.service          ← new (Phase 7 runtime activation)
development-vessel.service
discovery-vessel.service
goal-host-vessel.service
identity-vessel.service
llm-resolver-vessel.service
local-tools-vessel.service
minibob.service
ribosome-vessel.service         ← new (Phase 6)
```

Plus concept-db Phase 1b shipped (commit `7bf4be1d` — unit + seeder +
Dockerfile + Makefile + gen-env) but the service is not yet present
in `systemctl list-units`. That's the structural answer to gap-001 in
flight.

Notable commits:
- `7bf4be1d` — concept-db Phase 1b
- `3a3ef840` — ribosome-vessel Phase 6 (WS-driven template extraction)
- `62f6d317` — Phase 6.1/6.2/6.4 + Phase 9 complete
- `c004ebee` — IAL Phase 9 spec cross-links + lift-status + gate harness
- `656298fe` / `37562f96` — Phase 0.6 VesselDaemon template docs

## composition_chain is alive on the new dispatch path

I fetched three recent traces by id. Results:

```
exec_4661rz4g  evolve-activity-self-contained  status=success dur=285065ms
  composition_chain: null
  parent_execution_id: null

exec_cid89pz6  validator-dispatch              status=success dur=36031ms
  composition_chain: ["exec_4661rz4g"]
  parent_execution_id: exec_4661rz4g

exec_gt8d5ri1  create-shape-provider-goal      status=failure dur=0ms
  composition_chain: ["exec_cid89pz6", "exec_khr72am3"]
  parent_execution_id: exec_khr72am3
```

**This is gap-007 / F-038 partial closure.** The validator-dispatch
and create-shape-provider-goal traces show:
- parent_execution_id populated ✓
- composition_chain populated with ancestor exec ids ✓
- Chain depth: validator-dispatch at depth 1, create-shape-provider-goal
  at depth 2 (slot-binding parent → validator-dispatch grandparent)

The substrate is now wiring nested execution into the composition
chain. The synthetic boredom L1 trace fix from `b0f3b93` plus the
Phase 6 ribosome-vessel and Phase 7 boredom-vessel runtime
activations together produced this transition.

## But Thompson posteriors STILL flat on the four named templates

| Template | total | success | failed | Δ since iter-15 | α | β | sel |
|---|---:|---:|---:|---:|---:|---:|---:|
| coverage-tick | 100 | 85 | 15 | +2 (both failures) | 1 | 1 | 0 |
| substrate-health-tick | 95 | 82 | 13 | +1 (failure) | 1 | 1 | 0 |
| probe-reachable-unlearned | 11 | 4 | 7 | +1 (failure) | 1 | 1 | 0 |
| harness-run-matrix | 7 | 3 | 4 | +1 (failure) | 1 | 1 | 0 |

Five new failures across the four topology templates; zero
posterior movement.

These templates and the new validator-dispatch / slot-binding chain
are on **different dispatch paths**. The new path *does* propagate
composition_chain. The old topology-template path *still* increments
total_executions without writing to Thompson posteriors.

F-038 (chain propagation) is closing on the new path. F-037 / F-043
(Thompson decoupled from success AND failure) is unchanged on the
topology-template path.

## failure_mode still null

Both `exec_gt8d5ri1` (create-shape-provider-goal failure, dur=0) and
all topology-template failures continue to have `failure_mode: null`.
The F-029 fix in minibob `6a55d3d` populates failure_mode on
`_goal_resolve` failures, but neither of these failure flavors goes
through that code path.

Open question to dev: is the `_goal_resolve` failure_mode emitter
the only path that populates the field, or should the
create-shape-provider-goal dispatcher (which is now executing
through validator-dispatch chain) also emit failure_mode on its
own failures?

## Named-template failures still instant (dur=0)

`create-shape-provider-goal` failed in 0 ms. Topology templates'
recent failures are unchanged in shape: instant rejection. But the
SURROUNDING traces — evolve-activity-self-contained, validator-dispatch,
slot-binding — execute in 4–285 seconds. The substrate is doing real
work on some paths and instant-failing on others. The new vessels
are not yet reaching the topology-template dispatch path.

## Substrate liveness — rich cadence

Last 10 traces span 03:51:57Z → 03:52:29Z — a 32-second window
with 10 traces. Substrate is highly active, executing nested chains
(slot-binding → validator-dispatch → evolve-activity-self-contained).

## What I cannot say from substrate-side

1. Which exact code path inside the new ribosome-vessel + boredom-vessel
   chain wires composition_chain vs which path doesn't — I see the
   result, not the wiring.
2. Whether Thompson posterior writes are actually being *attempted*
   for the named templates and silently failing, or simply not being
   issued. Audit-level DB inspection of `variant_performance_metrics`
   write attempts would distinguish these.
3. Why create-shape-provider-goal's failure didn't carry failure_mode
   despite its chain being populated. Both fields are written at
   trace-completion time; one works and the other doesn't.

## Gaps status

| Gap | State this iter |
|---|---|
| gap-001 (concept-db) | **in flight** — Phase 1b shipped `7bf4be1d`; not running yet |
| gap-002 (WS auth) | unchanged — acknowledged by design |
| gap-003 (failure_mode) | partial: emitted for `_goal_resolve`, not for create-shape-provider-goal / topology templates |
| gap-004 | FIXED |
| gap-005 | FIXED |
| gap-006 | premise empirically false, still awaiting formal retire |
| gap-007 / F-037 / F-043 | partial: F-038 (chain propagation) WORKING on new path; F-037/F-043 (Thompson decoupling) unchanged on topology path |

## No new audit iteration since 02:51Z

Last audit is `2026-05-25T02-51-09-investigation-003.md`. The audit
predicted window 2 of S.4a within "the next 1-2h" of 02:51 — so
roughly 03:51-04:51Z. We're at 03:52Z and audit hasn't fired yet.
Worth checking next iter whether the audit sees the same new-path
composition_chain population I just observed.

## Next wake

1500s. Substrate doing real work on new chain (validator-dispatch,
slot-binding, evolve-activity-self-contained running for seconds-
minutes). Watch for: (a) audit iter-021 confirming F-038 partial
closure independently, (b) Thompson finally moving on topology
templates if a posterior-write fix lands, (c) concept-db-vessel
appearing in `systemctl list-units` (Phase 1b runtime), (d)
substrate-explicit-vessels delta beyond 39/53.
