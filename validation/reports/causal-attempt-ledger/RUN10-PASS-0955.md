# Graded acceptance run 10 — 2026-09-25T09:55:02Z

## R  commit=`8f43712`
attempt=`att-mugsgwwz-vdydsjo`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-mugsgwx0-8c1u90 at 2026-09-25T09:59:17.432Z, commit 2026-09-25T10:00:08+00:00, intents=1)
- [x] 1b authoring_execution_id exec_1790330465086_f8jrzh2twrs → execution row present (direct)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`6b6ded7`
restore settled: held
## C  commit=`2ed799e`
- [x] 5 C no flips, settled held
- [x] 6 two extra sweeps: exactly one settlement each (R=1 C=1)
## U  dispatch=`e8b3cc3f-bddd-4b19-a84d-a9761282537a`
U dispatch: status= completed reached= True tpl= satisfier:shellResult
U ledger wait: 1 poll(s), missing=0
- [x] 7 U: all 5 commit(s) since dispatch recorded, linked to e8b3cc3f-bddd-4b19-a84d-a9761282537a, gap open — c6225a43cba7:exec=e8b3cc3f-bddd-4b19-a84d-a9761282537a,link=dispatch,gap=open 5b15799e7fb0:exec=e8b3cc3f-bddd-4b19-a84d-a9761282537a,link=dispatch,gap=open bc0a95075e16:exec=e8b3cc3f-bddd-4b19-a84d-a9761282537a,link=dispatch,gap=open 67049ff49f24:exec=e8b3cc3f-bddd-4b19-a84d-a9761282537a,link=dispatch,gap=open 6d65255ecd60:exec=e8b3cc3f-bddd-4b19-a84d-a9761282537a,link=dispatch,gap=open
- [x] 3' no mint path ran (single-satisfier reach, executionId=walk-satisfier-1-1790333635135; goal-host skips mintReachedTrace for satisfierOnly by design); no extraction
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 10 passed, 0 failed**
