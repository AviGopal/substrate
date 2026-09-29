# Mechanism verdicts: chunk 34 (systemd)

Input: `classes/_mech_chunks/34.json`, 13 collector items in area `systemd`.

Verified read-only on 2026-09-29 around 05:18 to 05:25 UTC:

- **Node 1 (`substrate-live`):** `systemctl list-timers --all`, `systemctl show <unit>.timer`, and `journalctl -u <unit>.service` over 24h (self-recovery, rhythm-cadence) and 48h to 72h (pull-sync, runtime-drift).
- **Gap store:** `/workspace/git/super-repo/gaps/gaps.json`, read with `jq`.
- **Node 2 (`compose2-live`):** `systemctl list-timers`, `is-enabled` and `show`.
- **Super-repo:** `git log` for the cited hashes.

Raw context comes from `raw/timers-readers.md` §1 (rows 30, 45, 51, 54, 61, 66) and §4 (node 2).

**Deduplication:** the 13 items reduce to **8 mechanisms**. Collector items are cited as `#n`, 0-based in chunk order.

| # | Mechanism | Items merged |
|---|---|---|
| M1 | self-recovery timer + `self-recovery-tick` | #0, #8, #9, #12 |
| M2 | in-container `substrate-pull-sync` | #1, #10 |
| M3 | rhythm-cadence timer + rhythm conductor | #3, #6 |
| M4 | validator-liveness watchdog | #4 |
| M5 | runtime-drift detector | #7 |
| M6 | gap-compose.timer | #11 |
| M7 | compose-topology timer | #2 |
| M8 | host-pull-sync.timer | #5 |

## Stale collector claims corrected by live evidence

- **#1 "pull-sync broken":** live pull-sync is not broken. In 72h it logged `synced=1` 112 times, `synced=2` 15 times and `synced=3` once.
  - It quiesced development-vessel before converging (09-28 21:16, 21:27; 09-29 00:18).
  - It refused a test regression at `39783b0ddf` (activity-api, 09-28 22:02).
  - What is broken is one sub-seam. Every tick it logs `vessels.manifest.json / vessels.inventory.json was modified locally — leaving it alone (git version NOT applied)`, which means the fleet files are permanently unconverged, and it still prints `failed=0`. That is the same "silent skip reads as pass" shape as the 09-10 and 09-22 untracked-file wedges.
- **#12 "self-recovery timer next_elapse=0":** that was 08-11 and was fixed by `b2ff657b` ("give the immune-system timer a wall-clock anchor"). Today the timer is active, runs every 3 min and next elapses 05:21. The "restarts activity-api every 3 min" claim (09-22/09-23) did not recur in the last 24h. The last 24h saw:
  - 5 restarts: development-vessel at 09:57, 11:57, 12:12 and 15:51; concept-db at 18:57, all on 09-28.
  - 474 ticks that were all healthy.
- **#11 "gap-compose.timer dormant":** gap `self-op-health:repair_unit_dormant`, opened 09-24 and updated 09-28 05:55, says the timer is "loaded but disabled/inactive". The timer is now `active` and next elapses 05:34. Its LastTrigger is 09-28 11:45, 17h old, only because `OnUnitActiveSec=20min` restarts its countdown each time something else starts the service. `substrate-gap.ts:1262/1329` does `systemctl start --no-block gap-compose.service` on every gap write (see timers-readers row 66). The gap's own predicate is now false, but the gap is still `open`.
- **#6 "rhythm conductor considered 11, enqueued 0":** that is still essentially true, but not absolute. In 24h the counts were `enqueued=0` ×84 and `enqueued=1` ×9. The newest line reads: "nothing enqueued and nothing recorded as skipped … The conductor does not report a per-family reason".

## Verdicts

### M1: self-recovery (`/usr/local/bin/self-recovery-tick`, `self-recovery.timer`)

**Verdict:** keep-general. **Used now:** yes, on node 1.

**Evidence:**
- It runs every 3 min. Over 24h the tick summary JSON was:
  - `healthy:13 … uninstalled_skipped:3` ×474
  - `recovered_by_restart:1` ×5
  - `starting_skipped:1` ×1, where it deferred to activity-api's TimeoutStartSec at 11:45, the overload-victim fix
- Every tick it reports `NOT INSTALLED` for metric-collector-vessel :8300, federation-transport-vessel :8401 and **human-surface-vessel :8310**. These are manifest vessels with no rendered unit.
- On node 2, `self-recovery.timer` is **masked**. The binary is present but unscheduled.
- History:
  - It was dead 5 days until `b2ff657b` (08-13).
  - It masked the landing-lane deadlock with green `recovered_by_restart` (reports-8).
  - Escalation ends in a log line, repeated 1,071 times.
  - The open gap `activity-api-recommend-queries-block-the-event-loop-…-self-recovery-restarts-it-every-3-minutes` (09-23), plus its `-narrowed` and `recommit-…-semantic_reject` children, are still open.

**Why keep:** this is a bootstrap-tier liveness watchdog, which CLAUDE.md script retention explicitly exempts, and it is live. Its defects are known and recurring:
- There is no consecutive-outcome predicate: a unit restarted N times in a row is "recovered" N times.
- Escalation is a log line, not a gap.
- Node 2 is unprotected.

**Availability:** it stays a systemd bootstrap unit. It becomes observable to the learning loop only if its tick JSON is emitted as a shaped impulse, for example a `vesselHealthTick`. It currently has zero readers besides journald. The repeated-restart class should be filed against self-recovery's escalation seam, not patched per victim.

### M2: in-container substrate-pull-sync (`/usr/local/bin/substrate-pull-sync`, timer, `c6d2212a`)

**Verdict:** keep-general. **Used now:** yes, on both nodes.

**Evidence:**
- It is live on node 1 every ~10 min (last run 05:14) and on node 2 (last run 05:19).
- The 72h tallies are listed in the corrections above. It quiesced, deferred and refused a regression during 09-28/29.
- Known defects:
  - The fleet-file refusal on every tick, shown above.
  - The content hash is blind to `docker cp` (08-28).
  - It self-updates one tick behind itself.
  - It does `cp -f` into `/workspace/active-scripts` with no prune, which generates fossils (timers-readers §5).
- Open gaps against it:
  - `pull-sync-diverged-super-repo` (09-20)
  - `pull-sync-has-failed-every-tick-since-the-container-clone-left-dev` and its duplicate `substrate-pull-sync-has-failed-every-tick-…`, both from 09-20
  - `pull-sync-defers-an-owed-restart-indefinitely-…` (09-26)
  - `a-submodule-worktree-in-the-super-repo-is-frozen-by-draft-residue-…`

**Why keep:** this is the only convergence path from origin/dev to runtime, and it is bootstrap-tier.

**Recurring class:** "blocked but reports failed=0". It has occurred on 09-10 twice, on 09-22 for 16h, and now on the fleet files every tick. The fix belongs in the summary line: a skip or refusal must count as not-synced. It is not a new watcher.

The two 09-20 "failed every tick" gaps are duplicates of each other. Their stated condition, the clone having left dev, no longer holds: the journal shows successful syncs. They should be falsified and closed, not re-worked.

**Availability:** it stays in the bootstrap tier. Its `done — synced= skipped= failed=` line should become a shaped `pullSyncTick` impulse, so that validator-liveness (M4) and gap detection can read it by shape.

### M3: rhythm-cadence timer + rhythm conductor (`22146522`, `rhythm-conductor-tick.ts`)

**Verdict:** keep-general. **Used now:** yes, as a running scheduler, but it produces almost nothing.

**Evidence:**
- The timer fires every 15 min on both nodes (node 1 last ran 05:18, node 2 05:07).
- The conductor considers 12-13 families and enqueued nothing on 84 of 93 ticks in 24h.
- It does not record a per-family reason, per its own log line.
- Open gap `rhythm-cadence-registry_empty` (09-22, updated 09-28 22:09).
- It only reached the container after pull-sync was unblocked on 09-10 (reports-8).
- Only gap-closing has a staleness driver (memory-8).

**Why keep:** this is the law-5 mechanism itself. It is the right seam, just starved.

Its blocking defect is information, not capability. It does not record why a family was not due or was priced out, so neither the operator nor the selector can learn from its idleness. The recurring class is "rhythm idles; roughly 40 static `OnUnitActiveSec` timers remain the real cadence" (timers-readers §6).

**Availability:** it is already shape-backed, reading pool rhythm impulses. The needed change is to emit per-family disposition as a shaped record. That is not a new mint.

### M4: validator-liveness watchdog (`8a3804ff`)

**Verdict:** keep-general on node 1. On node 2 it is **broken** and masked.

**Used now:** yes, on node 1. It ran at 01:25 and runs every 6h. The latest line reads `SEVERED 10/97 — worst: satisfier:vessel_exercise_scan (4.5d)`.

**Evidence:**
- On node 2, `validator-liveness.timer` has `UnitFileState=masked` and `ActiveState=failed`. Its last trigger was 09-28 04:36.
- It opens SurrealDB directly instead of resolving by shape, so it fails "Unable to connect" on a spoke (timers-readers §4). That was disposed of by masking, which is a node-locality failure.
- Open gap: `service-failure-validator-liveness` (09-26).
- It is structurally blind to demand-driven validators such as the reach oracle (reports-8 §O).

**Why keep:** this is the general "did a validator keep its cadence" detector, and it is a watchdog-tier exception.

**Fix direction:** resolve the execution history by shape through discovery so that it runs on any profile, which satisfies law 11 and the p2p reachability requirement. Add a demand-driven liveness predicate: demand seen but no validator execution.

**Availability:** today it is a systemd unit whose output lands in the gap store. Its read side should become a shape resolve so a spoke reaches the hub's trace store.

### M5: runtime-drift detector (`runtime-drift.timer`)

**Verdict:** keep-specific (detection only). Its env-gated repair arm is a law-1 violation and should be removed. Repair belongs to M2.

**Used now:** yes. It runs every 10 min, last at 05:19.

**Evidence from 48h:**
- `18 vessels checked, runtime matches` ×273.
- `NOT COVERED: demo-vessel, relevance-sink-vessel` ×286. These are live src trees with no clone, which is the same authorability-is-submodule-membership class recorded in memory on 09-22.
- 8 real divergences in development-vessel were "not repaired (repair not armed (pull-sync owns mirroring; set RUNTIME_DRIFT_REPAIR=1 to arm))". They were in `gap-to-feature.ts` ×5, `feature-compose.ts`, `test-suite.ts` and `substrate-gap.ts`.
- Open gaps: `runtime-drift-development-vessel` (09-20, updated 09-28 21:26), plus `runtime-drift-activity-api`, `-boredom-vessel`, `-concept-db`, `-discovery-vessel` and others.
- It is disabled (masked) on node 2.

**Why keep-specific:** it is the only postcondition check on what pull-sync claims. It is a useful oracle, but it has **no reader** besides journald and the gap writer (timers-readers row 45: "detection without disposition").

The `RUNTIME_DRIFT_REPAIR` env gate is frozen behavior invisible to traces. The repair should be deleted in favour of pull-sync owning convergence, as the log line itself says. Detection should be kept and emitted as a shaped verdict that pull-sync reads on its next tick.

### M6: gap-compose.timer

**Verdict:** keep-specific, as a backstop only. The dormancy gap about it is stale.

**Used now:** yes. The timer is active (next run 05:34). The service is started every 1-7 min by gap writes, which the watchdog log shows as 711 `watchdog_restart ok` plus 217 `deferred_lease_held` on 09-28/29.

**Evidence:**
- The unit is `/lib/systemd/system/gap-compose.timer` with `OnActiveSec=8min` and `OnUnitActiveSec=20min`.
- The timer's own trigger is rare because event-starts keep resetting it.
- `self-op-health:repair_unit_dormant` (09-24) asserts that the timer is inactive and that it is "none declared in the fleet inventory". The inventory half may still hold, since pull-sync refuses to converge the inventory file (M2).

**Why keep:** it is a cheap backstop for the event path, and it is shadowed by a drop-in (timers-readers §5: `gap-compose-tick.ts` is never executed).

The real cadence is `substrate-gap.ts`'s `systemctl start` on every write. That is a hardcoded event trigger, not a rhythm (law 5). It belongs in the M3 conductor as a demand family.

**Action:** falsify and close `self-op-health:repair_unit_dormant` against the live `ActiveState=active`.

### M7: compose-topology timer (`06c48140`)

**Verdict:** fossil. **Used now:** no.

**Evidence:**
- It was reverted the same day by `f1348751`.
- `systemctl show compose-topology.timer` returns `ActiveState=inactive` with no LastTrigger.
- `compose-topology-tick.ts` still reads `/workspace/metrics/spectral-gap.jsonl` (timers-readers row 44), but it is driven elsewhere.

**Archive:** it already lives only in git history, so the revert is the archive. Record it in the fossil index as "rejected: a dedicated timer for the edge-former; cadence belongs to the rhythm conductor (M3)".

### M8: host-pull-sync.timer

**Verdict:** fossil. It was superseded by M2. **Used now:** no.

**Evidence:** it was retired permanently on 08-12 (memory-4), when the host-side converge-and-restart was replaced by in-container pull-sync, in line with law 11's "no host workspace". No host timer is referenced in the live container.

**Archive:** git history and the historical memory index. Nothing needs moving.

## Cross-cutting findings for this area

1. **Watchdogs report into journald, which has no reader.**
   - self-recovery, runtime-drift and pull-sync all emit summary lines that no shape carries, and rhythm-cadence records no per-family reason.
   - This is why "masked the deadlock with green" (M1), "failed=0 while blocked" (M2) and "detected but not repaired" (M5) each recurred.
   - The single general fix is to emit each tick verdict as a shaped impulse that validator-liveness (M4) and gap detection read. It does not need four new watchers.
2. **Node 2 is unprotected.**
   - On compose2-live, self-recovery, runtime-drift and validator-liveness are all **masked**. Only pull-sync, rhythm-cadence and gap-compose run there.
   - The masking was a disposition by removal, because the detectors hard-wire SurrealDB and `/workspace/metrics` instead of resolving by shape.
   - Per the decentralization requirement, absence on node 2 should mean "resolved from the hub", not "not run".
3. **Stale or duplicate open gaps in this area can be closed by falsifier:**
   - `self-op-health:repair_unit_dormant` (timer active).
   - `pull-sync-has-failed-every-tick-since-the-container-clone-left-dev` and its duplicate `substrate-pull-sync-has-failed-every-tick-…`, since syncs succeed.
   - Re-check `pull-sync-diverged-super-repo` against the fleet-file refusal, which is the live form of the divergence.
4. **Law-1 residue:** `RUNTIME_DRIFT_REPAIR` (M5), and gap-compose triggered by a hardcoded `systemctl start` in `substrate-gap.ts` (M6).
5. **human-surface-vessel shows NOT INSTALLED on node 1.** self-recovery sees :8310 as a manifest vessel with no rendered unit, so the live human surface is not protected by the immune system. This matches memory: it runs from `/workspace/git/human-surface-release` under a different unit name. The manifest and the unit name disagree.
