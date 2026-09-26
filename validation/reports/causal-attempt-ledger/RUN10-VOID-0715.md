# Graded run 10 — VOID (not graded)

Result: VOID — disarmed at 08:21Z before grading; counts as no pass (the consecutive-pass count stays 0).

## What happened
- Started 07:15:01 after master25's clean() pre-check. development-vessel had been restarted (idle) at 07:13 because pull-sync
  rewrote gap-to-feature.ts with identical bytes at 06:54:53 (mtime false-stale).
- R (the canary edit) walked a shellResult for 20 min (07:15–07:35) before EDIT-INTENT routed it to feature_compose at 07:35:24.
- development-vessel restarts inside the window: 07:30:21 pull-sync "owed restart after deferral"; 07:35:58 self-recovery
  UNHEALTHY (killed R's compose call, socket closed 07:36:44); 07:52:36 self-recovery UNHEALTHY. activity-api was also restarted
  UNHEALTHY at 07:51:42. The 07:36:45 process logged the stale pull-sync attribution; 07:53:30 logged UNATTRIBUTED.
- R retried 8 times (last dispatch 08:13:07), mostly `EARLY EDIT-INTENT feature_compose verdict=BUSY`.
- The cause was machine saturation, not the ledger: a trace-ingest storm starting 06:55–07:00. In 5-min buckets
  (POST /execution-traces / duplicate-id insert errors): 06:50 154/0 → 07:05 760/699 → 07:40 1064/1194. In 10-min windows,
  POSTs ≥60 s: 0 at 03:00, 05:00 and 06:30; 233 at 07:40. surreal ran at 8–12 cores; host load was ~30 on 16 cores.
- The user authorized a container stop to break the storm (relayed by the coordinator at ~08:18Z). Disarmed at the coordinator's
  request; graded runs resume after its "machine fixed".

## Residue to repair before run 11
- Live `src/fixtures/attempt-ledger-canary.json` = `{"canary": "broken"}`; the clone (79562c7) = `{"canary":"intact","runs":2}`.

## Gaps to file (human_reported)
- self-recovery restarts a saturated vessel mid-graded-run, and the restart kills in-flight composes; the liveness probe can't tell
  saturation from death.
- pull-sync takes an "owed" restart during an announced window (it reads no window/lease).
- The restart-attribution breadcrumb is reused for a later restart by a different requester (07:36:45).
