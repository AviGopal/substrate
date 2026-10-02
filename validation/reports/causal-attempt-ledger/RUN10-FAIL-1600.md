# Graded acceptance run 10 — 2026-09-25T16:00:03Z

## R  commit=`d17595b`
attempt=`att-muh5jnw7-pmy671r`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-muh5jnw8-pr4ag8 at 2026-09-25T16:05:20.720Z, commit 2026-09-25T16:07:51+00:00, intents=1)
- [x] 1b authoring_execution_id exec_1790352562526_jr9ni4ebh8r → execution row present (direct)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`0cbbb32`
restore settled: held
## C  commit=`45bc01a`
- [x] 5 C no flips, settled held
- [x] 6 two extra sweeps: exactly one settlement each (R=1 C=1)
## U  dispatch=`34226cbe-ad15-4bb7-b51d-eea33ab38efe`
U dispatch: status= completed reached= True tpl= universal-tool-fallback
U ledger wait: 1 poll(s), missing=0
- [ ] 7 U (19 commit(s): 67017bbd3307:exec=34226cbe-ad15-4bb7-b51d-eea33ab38efe,link=dispatch,gap=open 455c865c14e6:exec=34226cbe-ad15-4bb7-b51d-eea33ab38efe,link=dispatch,gap=open be27bfed4e7b:exec=null,link=no,gap=open 8ba1810b5b3d:exec=null,link=no,gap=open cc14442fa540:exec=34226cbe-ad15-4bb7-b51d-eea33ab38efe,link=dispatch,gap=open 9a051828ebd3:exec=null,link=no,gap=open 0fa2303fa46f:exec=null,link=no,gap=open 6ceae10647c6:exec=null,link=no,gap=open 134b47795042:exec=34226cbe-ad15-4bb7-b51d-eea33ab38efe,link=dispatch,gap=open 38d293f9d86a:exec=34226cbe-ad15-4bb7-b51d-eea33ab38efe,link=dispatch,gap=open 989026d63fff:exec=null,link=no,gap=open 032ab7f88ebf:exec=null,link=no,gap=open 51b2509cac54:exec=null,link=no,gap=open 3aa2df66d34a:exec=34226cbe-ad15-4bb7-b51d-eea33ab38efe,link=dispatch,gap=open e4394caabc05:exec=34226cbe-ad15-4bb7-b51d-eea33ab38efe,link=dispatch,gap=open 501219ca0dc3:exec=null,link=no,gap=open 5091ab8b9282:exec=null,link=no,gap=open 07e89079fe94:exec=null,link=no,gap=open 46e7df571848:exec=34226cbe-ad15-4bb7-b51d-eea33ab38efe,link=dispatch,gap=open)
- [x] 3' no mint path ran (universal-tool-fallback reach; floor reaches only call recordGoalPath), and recordGoalPath withheld U's path (lines=1); no extraction
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 9 passed, 1 failed**

## Diagnosis
- Item 7 failed: U's walk reached through the floor (`universal-tool-fallback-f0122638-…`) and made 19 commits in
  /workspace/git/ledger-u-probe between 16:58:17 and 17:02:08. They arrive in bursts: one commit carrying the dispatch id (34226cbe),
  then 2–3 commits a few seconds apart with `execution_id: null`, repeated five times.
- The new committer attribution (commit hook, this change) names the source of every unlinked commit: `committer_unit =
  local-tools-vessel.service`, `committer_cmd = bash -c set -m ( … git -C /workspace/git/ledger-u-probe … ) … __killtree`, i.e.
  local-tools' process-group shell wrapper. Linked commits come from the same wrapper, so the id is present on some local-tools
  requests and absent on others. The dropping hop is upstream of local-tools.
- Refuted in this session: goal-host's walk path (every shell-shape resolve goes through `rawResolve`, which stamps
  shell/bounded_shell/bash/git shapes), and llm-resolver's two `dispatchTool` sites (both forward `body.execution_id`). No
  llm-resolver or development-vessel log lines fall inside the unlinked bursts; local-tools logs nothing per request.
- Next: instrument rather than infer. local-tools logs, for each shell-family request without an execution_id, the pointer type
  and the caller (headers/remote), so the next unlinked commit names its hop.
- Confound: development-vessel 03d98c1 (autonomous startup pick, 16:20:51; gap-escalation dedupe) landed in the window; it's not
  on the graded path.
- Located (Documentation session, 17:3xZ): the id-less commits are development-vessel `author_producer` validation probes. goal-host's
  BRIDGE-AUTHOR (index.ts ~10302) posts `author_producer` with no execution_id; `validateProducesShape` (author-producer.ts ~678)
  runs the candidate against the real producer (local-tools) with a test pointer built from U's goal, up to max_attempts=3 times,
  so each validation really commits in the probe repo, untraced. Bursts of 3 line up with the reach-gap updates filed after each
  failed bridge author (16:58:50, 16:59:43, 17:01:07, 17:01:50). Fix: carry the dispatch id into the author_producer pointer (goal-host)
  and into the test pointer (author-producer.ts). Separate gap: validation probes have unrestored side effects (git commits); also a
  likely contributor to #46.
