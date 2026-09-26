# Graded acceptance run 3 — 2026-09-24T05:46:53Z

## R  commit=`f369bb6`
attempt=`att-muf47hru-53seq6e`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-muf47hrv-0jp2vy at 2026-09-24T05:52:21.198Z, commit 2026-09-24T05:52:52+00:00, intents=1)
- [ ] 1b authoring execution join (dispatch=05c1a44e-d663-4444-b66d-dda96b50eff9 executionId=null rows=0)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
Run aborted at 07:09:37: four failures in run 2 were diagnosed as grader race (1b), post-snapshot id defect (C), and U; see RUN2.md diagnosis.
