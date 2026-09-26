# Graded acceptance run 6 — 2026-09-24T21:03:42Z

## R  commit=``
- [ ] R landed
## restore  commit=``
- [ ] restore landed
## C  commit=``
- [ ] C landed
U ledger wait: 1 poll(s), missing=0
- [ ] 6 idempotency (R=0 C=0)
## U  dispatch=`eb2c73f3-839b-4074-aef8-022604138669`
U dispatch: status= completed reached= True tpl= satisfier:shellResult
- [x] 7 U: all 3 commit(s) since dispatch recorded, linked to eb2c73f3-839b-4074-aef8-022604138669, gap open — b2bdf3bf6f5d:exec=eb2c73f3-839b-4074-aef8-022604138669,link=dispatch,gap=open 81f00632aad3:exec=eb2c73f3-839b-4074-aef8-022604138669,link=dispatch,gap=open 67fcf2e90f78:exec=eb2c73f3-839b-4074-aef8-022604138669,link=dispatch,gap=open
- [x] 3' no mint path ran (single-satisfier reach, executionId=walk-satisfier-1-1790284774960; goal-host skips mintReachedTrace for satisfierOnly by design); no extraction
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 3 passed, 4 failed**

## Diagnosis
R, restore and C never landed, so items 1–6 could not be graded; U, 3' and 8 passed.
R's compose (`route-edit-75fb8c91`) passed every gate, then the cutover's freshness check refused it at 21:07:49Z and
again on resume at 21:14:46Z: `staged_base_sha=43fbb36e2343` (the committed canary) vs `current_live_sha=16bb007eed4f`
(the canary *with R's edit*, already live-synced into `/vessels`). The parked edit stayed in the super-repo worktree
(GAPS_OBSERVED #45), so the harness GUARD then stopped R's retry and the restore and C landings. Cause: GAPS_OBSERVED #51.
Harness defect found and fixed after the run: the item-7 ledger wait had been inserted into item 6's section (it ran
before U existed); moved into the U section. Item 7 passed this run without it.
