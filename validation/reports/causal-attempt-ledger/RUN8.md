# Graded acceptance run 8 — 2026-09-25T02:06:00Z

## R  commit=`86f23c3`
attempt=`att-mugbs989-1zpmm9w`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-mugbs98a-waehh7 at 2026-09-25T02:12:13.250Z, commit 2026-09-25T02:14:44+00:00, intents=1)
- [ ] 1b authoring execution join (dispatch=22489866-8bb3-48b5-ab66-5a138cd1e7b7 executionId=feature_compose:rejected:8ab54380 rows=0)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`759ddc0`
restore settled: held
## C  commit=``
- [ ] C landed
- [ ] 6 idempotency (R=1 C=0)
## U  dispatch=`a613630e-8676-4681-88da-3951080637a0`
U dispatch: status= completed reached= True tpl= universal-tool-fallback
U ledger wait: 1 poll(s), missing=0
- [x] 7 U: all 2 commit(s) since dispatch recorded, linked to a613630e-8676-4681-88da-3951080637a0, gap open — 0aa1d936a855:exec=a613630e-8676-4681-88da-3951080637a0,link=dispatch,gap=open 87759855a957:exec=a613630e-8676-4681-88da-3951080637a0,link=dispatch,gap=open
- [ ] 3' no mint line and not a single-satisfier reach (executionId=universal-tool-fallback-d275d7ce-1790305857756): the guard was silent on a walk reach
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 6 passed, 4 failed**

## Diagnosis
- 1b: GAPS_OBSERVED #53. An autonomous cutover restarted development-vessel 30 s before R's dispatch, the dispatch was recorded as a
  rejected placeholder, and the lane later landed R (`86f23c3`) under that dispatch's attempt, so the dispatch hop found no row.
- C, 6: C was routed to feature_compose twice (early and post-walk); the second call was cut off and fell through to a
  walk; the walk graded hollow three times and the dispatch completed, which the harness does not retry (GAPS_OBSERVED #54: the dispatch routed the same edit twice, and the second call was cut off after about 6 min).
- 3': U reached through the universal-tool-fallback floor, which Amendment 2 does not cover (Amendment 3 applies from run 9).
- 7 and 8 passed; U terminated in about a minute with 2 commits, both linked to the dispatch.
