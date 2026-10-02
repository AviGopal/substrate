# Graded acceptance run 10 — 2026-09-25T18:38:40Z

## R  commit=`a4dbf44`
attempt=`att-muhb6nho-z4blcrf`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-muhb6nhp-dzj5n5 at 2026-09-25T18:43:11.365Z, commit 2026-09-25T18:43:42+00:00, intents=1)
- [x] 1b authoring_execution_id exec_1790361902681_yma97fxody → execution row present (direct)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`be839a4`
restore settled: held
## C  commit=`ab50af1`
- [ ] 5 C (flips=[] verdict=unresolved)
- [x] 6 two extra sweeps: exactly one settlement each (R=1 C=1)
## U  dispatch=`acb0bfd0-d344-4aff-8ed7-1bca1c6ed0a6`
U dispatch: status= completed reached= True tpl= satisfier:shellResult
U ledger wait: 1 poll(s), missing=0
- [x] 7 U: all 2 commit(s) since dispatch recorded, linked to acb0bfd0-d344-4aff-8ed7-1bca1c6ed0a6, gap open — aef2083e8177:exec=acb0bfd0-d344-4aff-8ed7-1bca1c6ed0a6,link=dispatch,gap=open 942ecef50b1c:exec=acb0bfd0-d344-4aff-8ed7-1bca1c6ed0a6,link=dispatch,gap=open
- [x] 3' no mint path ran (single-satisfier reach, executionId=walk-satisfier-1-1790363756115; goal-host skips mintReachedTrace for satisfierOnly by design); no extraction
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 9 passed, 1 failed**

## Diagnosis
- Item 7 passed: both U commits carry the dispatch id (goal-host 2f6436f and development-vessel d72654f work). 3' and 8 passed.
- Item 5 failed, and the ledger was honest about it: C's post-snapshot and settlement show `ledger_canary` as unknown (settled
  `unresolved`), because at 19:10:57 the live canary file was overwritten with `author_producer validation probe content.`. While C's
  dispatch walked after its landing, goal-host BRIDGE-AUTHORED a `fileContent` producer (19:14:45 "validated producer … auto-bridge-fileContent").
  Its author_producer validation wrote to the goal's file path for real.
- Why the probe restore missed: `extractProbeFilePaths` maps `repos/<v>/…` to `/vessels/repos/<v>/…` (never exists, so the snapshot is
  null and the "restore" unlinks nothing), while local-tools' `mapPath` writes `/vessels/<v>/…`. The fix (one line: strip `repos/`) is
  dispatched. The live canary was restored from the clone at 19:18Z (the clobbered content is backed up).
- In-window landings: only the run's own fixture commits (the autonomous_pick lease held).
