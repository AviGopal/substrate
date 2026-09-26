# Graded acceptance run 9 — 2026-09-25T04:28:47Z

## R  commit=`54db2f4`
attempt=`att-muggtnkk-kpy6zvd`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-muggtnkk-8oslas at 2026-09-25T04:33:16.601Z, commit 2026-09-25T04:34:13+00:00, intents=1)
- [x] 1b authoring_execution_id exec_1790310898292_kpb98y7he3e → execution row present (direct)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`93e74f8`
restore settled: held
## C  commit=`04a25e4`
- [x] 5 C no flips, settled held
- [x] 6 two extra sweeps: exactly one settlement each (R=1 C=1)
## U  dispatch=`0760e1e4-e842-4931-a258-61f8737e1024`
U dispatch: status= failed reached= False tpl= satisfier:activity_metrics
U ledger wait: 1 poll(s), missing=0
- [ ] 7 U (8 commit(s): fe5b66e0c379:exec=0760e1e4-e842-4931-a258-61f8737e1024,link=dispatch,gap=open 6a71262ff624:exec=null,link=no,gap=open 73d396206ef2:exec=0760e1e4-e842-4931-a258-61f8737e1024,link=dispatch,gap=open 45c20d983ffc:exec=null,link=no,gap=open 1fd68b89b8dd:exec=exec_g27umsdv,link=trace,gap=open 8c1bf9cf4e27:exec=exec_nzd5qw4n,link=trace,gap=open bd648aec2d7e:exec=0760e1e4-e842-4931-a258-61f8737e1024,link=dispatch,gap=open 2ab6922bbc97:exec=0760e1e4-e842-4931-a258-61f8737e1024,link=dispatch,gap=open)
- [x] 3' no mint path ran (single-satisfier reach, executionId=walk-satisfier-1-1790314301751; goal-host skips mintReachedTrace for satisfierOnly by design); no extraction
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 9 passed, 1 failed**

## Diagnosis
9 of 10: every R, restore and C item passes, including 1b through the direct compose-execution join (#53's fix, first run live),
and 3' passes as a single-satisfier reach. Item 7 fails on 2 of 8 U commits: `45c20d9` (05:31:52) and `6a71262` (05:32:11) carry
`execution_id=null`, so a commit path still spawns git without the dispatch id (an eighth hop; the seven fixed ones held for the other six
commits, four by dispatch id and two through the dispatch tag). U also did not reach and kept committing: 8 commits between 05:27
and 05:32. The retry cap (`ba0fcd3`) looks up the dispatch's landings through `unaccounted_landing_scan`, which only sees a commit after
the hook spool is ingested, so a retry that starts within that lag is not capped.
