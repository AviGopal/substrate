# Graded acceptance run 11 — 2026-09-25T21:53:50Z

## R  commit=`b0fb899`
attempt=`att-muhi4s0t-wnzqslp`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-muhi4s0u-koluw4 at 2026-09-25T21:57:41.231Z, commit 2026-09-25T21:58:52+00:00, intents=1)
- [x] 1b authoring_execution_id exec_1790373616654_se2z5jqihp → execution row present (direct)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`cef3df4`
restore settled: held
## C  commit=`763305b`
- [x] 5 C no flips, settled held
- [x] 6 two extra sweeps: exactly one settlement each (R=1 C=1)
## U  dispatch=`1fed8cc5-a9f9-49b7-8b37-0401d8cc5d80`
U dispatch: status= completed reached= True tpl= satisfier:shellResult
U ledger wait: 1 poll(s), missing=0
- [x] 7 U: all 2 commit(s) since dispatch recorded, linked to 1fed8cc5-a9f9-49b7-8b37-0401d8cc5d80, gap open — 49206068d41e:exec=1fed8cc5-a9f9-49b7-8b37-0401d8cc5d80,link=dispatch,gap=open 8c3851d843fb:exec=1fed8cc5-a9f9-49b7-8b37-0401d8cc5d80,link=dispatch,gap=open
- [x] 3' no mint path ran (single-satisfier reach, executionId=walk-satisfier-1-1790375321158; goal-host skips mintReachedTrace for satisfierOnly by design); no extraction
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 10 passed, 0 failed**
