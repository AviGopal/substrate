# Graded acceptance run 2 — 2026-09-24T04:50:45Z

## R  commit=`a42ffdb`
attempt=`att-muf289mc-zyxi8yr`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-muf289md-1pur3k at 2026-09-24T04:56:58.212Z, commit 2026-09-24T04:57:29+00:00, intents=1)
- [ ] 1b authoring execution join (dispatch=4d0b0ee6-c01a-471d-a057-d2928fa17833 executionId=null rows=0)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`cd702a7`
restore settled: held
## C  commit=`be45fe8`
- [ ] 5 C (flips=[] verdict=unresolved)
- [x] 6 two extra sweeps: exactly one settlement each (R=1 C=1)
## U  dispatch=`ebbb272a-e7a2-4c00-92a3-9bffae3590a0`
U dispatch: status= completed reached= True tpl= satisfier:shellResult
- [ ] 7 U (sha=1ab50e18f3d634e80ac3acb2ac97cc3bb6ec648d event_exec=null gap=open)
- [ ] 3' U extraction deferral (log lines=0)
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 6 passed, 4 failed**

## Diagnosis (operator, after the run)
- **1b: grader race, not a ledger defect.** The grader read the dispatch record the moment the
  commit appeared, while the dispatch was still running. Read after completion, dispatch
  4d0b0ee6 carries `executionId exec_1790225881932_0u1lp2egzcqa` and the execution row exists
  (count 1). The goal-host timeout fix (`13bed9e`) removed the synthetic id. The grader now waits for
  the dispatch to finish before the join.
- **5 (C): ledger defect plus harness overlap.** (a) The outcome and settle snapshots re-evaluate
  the pre-snapshot's *result* ids (`unit:*`, `gate:*`), which `evaluateChecks` does not know, so 61 of
  62 came back `not_applicable` and only the canary was compared (GAPS #31). (b) A goal-host restart
  interrupted C's authoring dispatch, whose compose landed anyway. The runner re-dispatched,
  that walk fell through to the satisfier, and it wrote unparseable content into the live
  canary through `fs_write` a minute after logging that it refused `fs_write` (GAPS #33). The canary
  was unparseable from 05:39 to about 05:46, until pull-sync re-mirrored the tree.
- **7 and 3' (U): execution id not threaded.** The walk resolved `shellResult` through `rawResolve`,
  which does not add `execution_id`; only the tool-fallback path does. The commit event has
  `execution_id: null`, and the mint guard matches by that id, so it could not defer (GAPS #32).
