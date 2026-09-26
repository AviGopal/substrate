# Graded acceptance run 10 — 2026-09-26T03:06:35Z

## R  commit=`3aaf924`
attempt=`att-muhtb1k4-90rt4mq`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-muhtb1k6-mnjgju at 2026-09-26T03:10:29.311Z, commit 2026-09-26T03:12:16+00:00, intents=1)
- [x] 1b authoring_execution_id exec_1790392466429_j7dcbhzo3x → execution row present (direct)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`609e268`
restore settled: held
## C  commit=`8fe5f51`
- [x] 5 C no flips, settled held
- [x] 6 two extra sweeps: exactly one settlement each (R=1 C=1)
## U  dispatch=`2e8e6d93-4702-44af-851e-0ebd54f796a6`
U dispatch: status= completed reached= True tpl= universal-tool-fallback
U ledger wait: 1 poll(s), missing=0
- [x] 7 U: all 2 commit(s) since dispatch recorded, linked to 2e8e6d93-4702-44af-851e-0ebd54f796a6, gap open — 3c08a0808461:exec=2e8e6d93-4702-44af-851e-0ebd54f796a6,link=dispatch,gap=open e7d6ab1f6338:exec=2e8e6d93-4702-44af-851e-0ebd54f796a6,link=dispatch,gap=open
- [x] 3' no mint path ran (universal-tool-fallback reach; floor reaches only call recordGoalPath), and recordGoalPath withheld U's path (lines=2); no extraction
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 10 passed, 0 failed**
