# Graded acceptance run 12 — 2026-09-25T23:04:05Z

## R  commit=`61e35c3`
attempt=`att-muhkm5wy-k2v9hr6`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-muhkm5wz-a66zjh at 2026-09-25T23:07:11.627Z, commit 2026-09-25T23:07:42+00:00, intents=1)
- [x] 1b authoring_execution_id exec_1790377695058_t9izy5saw1p → execution row present (direct)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`e7301b2`
restore settled: held
## C  commit=`00fff48`
- [x] 5 C no flips, settled held
- [x] 6 two extra sweeps: exactly one settlement each (R=1 C=1)
## U  dispatch=`148a9f3d-2b28-4634-98a1-e7cc65ccf4cb`
U dispatch: status= failed reached= False tpl= activity:⟨learned-satisfier-bash⟩
U ledger wait: 1 poll(s), missing=0
- [ ] 7 U (21 commit(s): a7bb8403b535:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open 0be685f9dc55:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open 982c72386179:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open 25a938ae4c46:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open c2470137f60e:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open 5afd9592f438:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open 94d4402e0a3a:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open aa76305657fb:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open d5cd804a0576:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open 7b31f525ea30:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open f50230dc4951:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open 64a76324dea5:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open c621bbf3e021:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open a22ba7d3a2d9:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open 5a0d780e55d4:exec=null,link=no,gap=open 182dcc25a429:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open 42f43794ab7e:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open 74f5b635986d:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open 9b7d03b2dfd6:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open ec15b3aa0817:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open 3161e859cae8:exec=148a9f3d-2b28-4634-98a1-e7cc65ccf4cb,link=dispatch,gap=open)
- [ ] 3' no mint line and not a single-satisfier reach (executionId=exec_a9apx09u): the guard was silent on a walk reach
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 8 passed, 2 failed**

## Diagnosis
- Context: the first run after a cold boot (22:34:46). Runs 10 (21:05) and 11 (21:53) passed 10/10 before it.
- Item 7: 20 of U's 21 commits link to dispatch 148a9f3d; one, `5a0d780e` (23:40:23), has `execution_id: null`. The commit hook
  names local-tools-vessel.service. local-tools' new instrumentation logged the matching request: `shell request WITHOUT
  execution_id — body keys=["impulse"] pointer keys=["type","command"]` at 23:40:23, a pointer shape (no cwd) not seen from the
  two paths fixed today (bridge-author validation, test_suite). No goal-host, development-vessel or llm-resolver log lines fall in
  23:40:18–23:40:24, so the caller is still unnamed. U did not reach (status failed; template `activity:⟨learned-satisfier-bash⟩` failed
  "bash resolver requires task.config.command"), and it looped 21 commits in ~2.5 min (#46).
- Item 3': U did not reach, so no mint ran. The grader classed it as "guard silent on a walk reach" because U's executionId was an
  exec_ id. Whether an UNREACHED U satisfies 3' is a rubric question; the grader was not changed after the fact.
- Cold boot: goal-host again failed to register the development-vessel proxies (22:35:17), deliberately not repaired. There's no
  evidence it touched either failing item.
- Harness: master26 left HOLD after the cold boot (removed by hand at 23:03:43, before any dispatch).
- Caller narrowing (Documentation session, read-only): rawResolve and author-producer are excluded (dispatch context was live, the
  fixes are in the runtime, and the key order differs). Best fit: development-vessel `author-composed-capability.ts` (~411/425) builds
  `{type: task.resolver, ...task.config}` (type first, no cwd, no id) and POSTs it untraced; it's reached from feature-compose's delegation
  when a decompose yields no file-edit ops. Not proven by a log line. Fix (b) dispatched: forward the dispatch id through that
  delegation and probe.
- Competing candidate (coordinator): goal-host's floor `ufExecuteTool` (~4363) POSTs `{type: name, ...args}` and adds the execution_id
  only when the AsyncLocalStorage dispatch context is populated. The context is set with `enterWith` in runGoalWithRecovery, so the
  retry/floor continuation after U went HOLLOW (23:40:07; floor at 23:40:13) can run with an empty store. That gives the same
  type-first, no-cwd, no-id request at 23:40:23. The floor's ReAct iterations also explain U's 21 repeated commits. Both fixes are being
  landed (goal-host explicit id plus a log line when missing; development-vessel author-composed-capability id forwarding); the next
  run's logs name which one mattered.
