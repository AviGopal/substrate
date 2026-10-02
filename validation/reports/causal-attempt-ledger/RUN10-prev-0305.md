# Graded acceptance run 10 — 2026-09-26T00:50:16Z

## R  commit=`0da9ee8`
attempt=`att-muhorscz-4ubn6fw`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-muhorsd1-evfp3r at 2026-09-26T01:03:32.463Z, commit 2026-09-26T01:04:37+00:00, intents=1)
- [x] 1b authoring_execution_id exec_1790384733940_6dvb0y73p5w → execution row present (direct)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`bd703b0`
restore settled: held
## C  commit=`d0a087b`
- [x] 5 C no flips, settled held
- [x] 6 two extra sweeps: exactly one settlement each (R=1 C=1)
## U  dispatch=`e24344b7-eafa-49b8-aa02-ee0290d26c68`
U dispatch: status= completed reached= True tpl= universal-tool-fallback
U ledger wait: 1 poll(s), missing=0
- [x] 7 U: all 2 commit(s) since dispatch recorded, linked to e24344b7-eafa-49b8-aa02-ee0290d26c68, gap open — c95cc0e4db13:exec=e24344b7-eafa-49b8-aa02-ee0290d26c68,link=dispatch,gap=open 552ac3e16a99:exec=e24344b7-eafa-49b8-aa02-ee0290d26c68,link=dispatch,gap=open
- [x] 3' no mint path ran (universal-tool-fallback reach; floor reaches only call recordGoalPath), and recordGoalPath withheld U's path (lines=2); no extraction
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 10 passed, 0 failed**
