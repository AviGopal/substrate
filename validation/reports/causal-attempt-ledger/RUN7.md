# Graded acceptance run 7 — 2026-09-24T22:56:56Z

## R  commit=`4d728e6`
attempt=`att-mug5c8aj-gm7v0ta`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-mug5c8ak-2o4ero at 2026-09-24T23:11:47.971Z, commit 2026-09-24T23:12:19+00:00, intents=1)
- [x] 1b authoring_execution_id f8d26c75-d455-446a-be46-78b2a1f2199a → executionId exec_1790291582633_ry8whcoyyzs → execution row present
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`f4ef80b`
restore settled: held
## C  commit=`849b1df`
- [x] 5 C no flips, settled held
- [x] 6 two extra sweeps: exactly one settlement each (R=1 C=1)
## U  dispatch=`876c7afd-9c1c-4800-bffc-da0e400c3f31`
U dispatch: status= running reached= None tpl= None
U ledger wait: 1 poll(s), missing=0
- [ ] 7 U (23 commit(s): 4e126d9d4325:exec=876c7afd-9c1c-4800-bffc-da0e400c3f31,link=dispatch,gap=open ba4586a93520:exec=null,link=no,gap=open 440b2484ffc3:exec=null,link=no,gap=open e987701bc8dc:exec=null,link=no,gap=open 3536d31211db:exec=exec_fdehxvbc,link=trace,gap=open ec821e90bdab:exec=exec_lamabnm4,link=trace,gap=open 505c7cadaeb5:exec=876c7afd-9c1c-4800-bffc-da0e400c3f31,link=dispatch,gap=open 91a579cf15f0:exec=876c7afd-9c1c-4800-bffc-da0e400c3f31,link=dispatch,gap=open 31faa35d63b0:exec=null,link=no,gap=open 9638744d59bf:exec=null,link=no,gap=open 97cb3d58a26b:exec=null,link=no,gap=open bfb93579750d:exec=exec_tbcqft5c,link=trace,gap=open 61f157a67e99:exec=exec_k0nwgoq9,link=trace,gap=open bc69aa1649c0:exec=876c7afd-9c1c-4800-bffc-da0e400c3f31,link=dispatch,gap=open e48ffce8c43b:exec=null,link=no,gap=open 29120d0a8dec:exec=876c7afd-9c1c-4800-bffc-da0e400c3f31,link=dispatch,gap=open bfbb339fd5b2:exec=null,link=no,gap=open 7c870d1539c2:exec=null,link=no,gap=open 7822b35fd829:exec=null,link=no,gap=open ee98e32f39dd:exec=exec_khyqsowr,link=trace,gap=open 5a4455243b15:exec=exec_q43739vl,link=trace,gap=open cf5c5e30b106:exec=876c7afd-9c1c-4800-bffc-da0e400c3f31,link=dispatch,gap=open 609ca62ace93:exec=876c7afd-9c1c-4800-bffc-da0e400c3f31,link=dispatch,gap=open)
- [ ] 3' no mint line and not a single-satisfier reach (executionId=): the guard was silent on a walk reach
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 8 passed, 2 failed**
