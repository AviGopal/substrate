# Graded acceptance run 12 — 2026-09-26T04:33:39Z

## R  commit=`281bd41`
attempt=`att-muhwdid9-8lngjjo`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-muhwdida-p9u84x at 2026-09-26T04:36:23.247Z, commit 2026-09-26T04:36:54+00:00, intents=1)
- [x] 1b authoring_execution_id exec_1790397446215_pjxqtggtry → execution row present (direct)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`7bcf314`
restore settled: held
## C  commit=`d58105a`
- [x] 5 C no flips, settled held
- [x] 6 two extra sweeps: exactly one settlement each (R=1 C=1)
## U  dispatch=`bb503d9f-5fac-4006-bef0-ffdf67bedd60`
U dispatch: status= completed reached= True tpl= universal-tool-fallback
U ledger wait: 1 poll(s), missing=0
- [x] 7 U: all 2 commit(s) since dispatch recorded, linked to bb503d9f-5fac-4006-bef0-ffdf67bedd60, gap open — c410578206c9:exec=bb503d9f-5fac-4006-bef0-ffdf67bedd60,link=dispatch,gap=open 7870a28351e9:exec=bb503d9f-5fac-4006-bef0-ffdf67bedd60,link=dispatch,gap=open
- [x] 3' no mint path ran (universal-tool-fallback reach; floor reaches only call recordGoalPath), and recordGoalPath withheld U's path (lines=2); no extraction
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 10 passed, 0 failed**
