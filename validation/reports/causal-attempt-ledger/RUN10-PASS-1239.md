# Graded acceptance run 10 — 2026-09-25T12:39:12Z

## R  commit=`596e74c`
attempt=`att-mugyahw4-930tbb5`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-mugyahw5-p2u4n8 at 2026-09-25T12:42:15.720Z, commit 2026-09-25T12:42:54+00:00, intents=1)
- [x] 1b authoring_execution_id exec_1790340224739_asik7c57vzh → execution row present (direct)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`4d7d4e0`
restore settled: held
## C  commit=`1470a36`
- [x] 5 C no flips, settled held
- [x] 6 two extra sweeps: exactly one settlement each (R=1 C=1)
## U  dispatch=`7a3a60d6-4b15-410b-88b5-defd0efff0a8`
U dispatch: status= completed reached= True tpl= satisfier:shellResult
U ledger wait: 1 poll(s), missing=0
- [x] 7 U: all 5 commit(s) since dispatch recorded, linked to 7a3a60d6-4b15-410b-88b5-defd0efff0a8, gap open — 41c9aa8bc2d8:exec=7a3a60d6-4b15-410b-88b5-defd0efff0a8,link=dispatch,gap=open 1fbfe4f50de5:exec=7a3a60d6-4b15-410b-88b5-defd0efff0a8,link=dispatch,gap=open 2cfab8537eb9:exec=7a3a60d6-4b15-410b-88b5-defd0efff0a8,link=dispatch,gap=open 1568ef7b8f58:exec=7a3a60d6-4b15-410b-88b5-defd0efff0a8,link=dispatch,gap=open 2f43026cfb46:exec=7a3a60d6-4b15-410b-88b5-defd0efff0a8,link=dispatch,gap=open
- [x] 3' no mint path ran (single-satisfier reach, executionId=walk-satisfier-1-1790343309418; goal-host skips mintReachedTrace for satisfierOnly by design); no extraction
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 10 passed, 0 failed**
