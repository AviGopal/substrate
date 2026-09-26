# Graded acceptance run 11 — 2026-09-26T03:46:59Z

## R  commit=`2bbf2e4`
attempt=`att-muhurk6g-unil14c`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-muhurk6h-t5vu2j at 2026-09-26T03:51:19.549Z, commit 2026-09-26T03:53:24+00:00, intents=1)
- [x] 1b authoring_execution_id exec_1790394956944_93dlo6t00et → execution row present (direct)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`b1ee35a`
restore settled: held
## C  commit=`3b91634`
- [x] 5 C no flips, settled held
- [x] 6 two extra sweeps: exactly one settlement each (R=1 C=1)
## U  dispatch=`056e7cbf-19fe-4b84-adfc-728b727e81eb`
U dispatch: status= completed reached= True tpl= universal-tool-fallback
U ledger wait: 1 poll(s), missing=0
- [x] 7 U: all 2 commit(s) since dispatch recorded, linked to 056e7cbf-19fe-4b84-adfc-728b727e81eb, gap open — 8284139580bb:exec=056e7cbf-19fe-4b84-adfc-728b727e81eb,link=dispatch,gap=open edd311b55f55:exec=056e7cbf-19fe-4b84-adfc-728b727e81eb,link=dispatch,gap=open
- [x] 3' no mint path ran (universal-tool-fallback reach; floor reaches only call recordGoalPath), and recordGoalPath withheld U's path (lines=2); no extraction
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 10 passed, 0 failed**
