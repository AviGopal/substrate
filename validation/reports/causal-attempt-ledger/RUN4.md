# Graded acceptance run 4 — 2026-09-24T10:34:01Z

## R  commit=`a3433f9`
attempt=`att-mufeelvq-mnjc5gm`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-mufeelvq-22cdmy at 2026-09-24T10:37:49.396Z, commit 2026-09-24T10:38:23+00:00, intents=1)
- [x] 1b authoring_execution_id 157b49eb-301c-4421-b772-26067f25cc96 → executionId exec_1790246355375_88cg6zb58tv → execution row present
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [ ] 4 lessons (gap=0 file=1)
## restore  commit=`04610b3`
restore settled: unresolved
## C  commit=`cbdac74`
- [x] 5 C no flips, settled held
- [x] 6 two extra sweeps: exactly one settlement each (R=1 C=1)
## U  dispatch=`0fc262f3-7fed-4dca-858e-2cfbd56a29c1`
U dispatch: status= completed reached= True tpl= satisfier:shellResult
- [ ] 7 U (sha=b8cc5239ec0c168009dd11241f8db9060f4d3dee event_exec=null gap=open)
- [ ] 3' U extraction deferral (log lines=0)
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 7 passed, 3 failed**
