# Graded acceptance run 10 — 2026-09-25T21:05:08Z

## R  commit=`e3656c6`
attempt=`att-muhgh6hd-ohl0hn9`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-muhgh6he-s5faor at 2026-09-25T21:11:20.613Z, commit 2026-09-25T21:13:39+00:00, intents=1)
- [x] 1b authoring_execution_id exec_1790370933840_ftf51vlx3np → execution row present (direct)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`f36ff77`
restore settled: held
## C  commit=`67302ae`
- [x] 5 C no flips, settled held
- [x] 6 two extra sweeps: exactly one settlement each (R=1 C=1)
## U  dispatch=`ca1e7cdc-db0b-47ad-b8b6-1d61638905bd`
U dispatch: status= completed reached= True tpl= satisfier:shellResult
U ledger wait: 1 poll(s), missing=0
- [x] 7 U: all 2 commit(s) since dispatch recorded, linked to ca1e7cdc-db0b-47ad-b8b6-1d61638905bd, gap open — 7d13dd68e7cb:exec=ca1e7cdc-db0b-47ad-b8b6-1d61638905bd,link=dispatch,gap=open 2ec82d2ab7c9:exec=ca1e7cdc-db0b-47ad-b8b6-1d61638905bd,link=dispatch,gap=open
- [x] 3' no mint path ran (single-satisfier reach, executionId=walk-satisfier-1-1790373180656; goal-host skips mintReachedTrace for satisfierOnly by design); no extraction
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 10 passed, 0 failed**
