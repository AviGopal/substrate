# Graded acceptance run 1 — 2026-09-24T01:01:31Z

## R  commit=`b06126b`
attempt=`att-muetz6it-x79viq9`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-muetz6iu-7b16yb at 2026-09-24T01:05:57.062Z, commit 2026-09-24T01:06:28+00:00, intents=1)
- [ ] 1b authoring execution join (dispatch=99deba0c-f16c-4897-8843-2563e59c903f executionId=null rows=0)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`5142b6e`
restore settled: held
## C  interrupted
The `substrate-live` container was removed at 2026-09-24T02:10:37Z (podman events: `died`, `remove`),
while C was dispatching. The removal came from another session's install-interface verification work.
C's runner retried 227 times against the missing container. Run 1 is aborted here; C, 6, U, 3' and 8
were not graded. Outcome: not a passing run (1b failed before the interruption).
