# Graded acceptance run 11 — 2026-09-25T13:52:04Z

## R  commit=`52006b6`
attempt=`att-muh11gy5-b6mm2a8`
- [x] 1a pre-snapshot before the commit, canary pass (pre=snap-muh11gy6-paxmjd at 2026-09-25T13:59:13.444Z, commit 2026-09-25T13:59:48+00:00, intents=1)
- [x] 1b authoring_execution_id exec_1790344853117_8jiuwhowr35 → execution row present (direct)
- [x] 2 outcome flips=[ledger_canary] surprise=true
- [x] 3 R settled regressed (["ledger_canary"])
- [x] 4 lesson in gap failure_lessons (1) and file lessons (1)
## restore  commit=`f4052c0`
restore settled: held
## C  commit=`1e62949`
- [x] 5 C no flips, settled held
- [x] 6 two extra sweeps: exactly one settlement each (R=1 C=1)
## U  dispatch=`e9790418-9092-49bc-8092-8d3355f32cb1`
U dispatch: status= completed reached= True tpl= satisfier:shellResult
U ledger wait: 1 poll(s), missing=0
- [x] 7 U: all 3 commit(s) since dispatch recorded, linked to e9790418-9092-49bc-8092-8d3355f32cb1, gap open — bae93d7a0a1b:exec=e9790418-9092-49bc-8092-8d3355f32cb1,link=dispatch,gap=open 99940f258acb:exec=e9790418-9092-49bc-8092-8d3355f32cb1,link=dispatch,gap=open 1036f7f163c1:exec=e9790418-9092-49bc-8092-8d3355f32cb1,link=dispatch,gap=open
- [ ] 3' mint path ran for U without a DEFER line naming e9790418-9092-49bc-8092-8d3355f32cb1 and bae93d7 (mint lines=1)
- [x] 8 all snapshot verdicts five-valued; no pass with an error detail

**Result: 9 passed, 1 failed**

## Diagnosis
- Item 3' failed on a real ledger defect. U's walk took the mint path. That's new compared with runs 9–10, where it was a
  single-satisfier reach; it is plausibly caused by goal-host 91c042b (terminal-write satisfiers no longer short-circuit), which
  landed inside this window. goal-host's mint deferral fired
  (`reach->mint: DEFER landing — dispatch e9790418… landed ledger-unreachable: The operation timed out.`, 14:49:05), and
  extraction was withheld (fail-closed). But the line doesn't name U's sha, because its `unaccounted_landing_scan` call hit the
  30 s timeout. recordGoalPath's call 8 s earlier did get the sha (1036f7f).
- Root cause: the scan is quadratic. Every call re-reads all 5,471 spool files, and `appendRecord` re-parses the whole 2.3 MB
  `landingEvent.jsonl` per file to dedupe (~30M synchronous JSON.parse), then re-reads `attemptIntent.jsonl` per commit.
  Measured at 13.0–14.0 s idle (15:00Z); it runs past 30 s with concurrent callers (goal-host mint + recordGoalPath + the grader's
  ledger wait). It grows with every commit and blocks development-vessel's event loop while it runs.
- Fix dispatched: build the landingEvent and attemptIntent key sets once per scan (one file, same result).
- Confounds in this run: goal-host 91c042b and 4f1d3e8 landed inside the window (see FINISH_LINE.md).
- Fix landed: development-vessel 429c8bd (15:06:14), live 15:09:27. The scan went from 13.0–14.0 s to 0.028–0.033 s, and the
  output matches the ledger (ingested 5482 = spool files = landingEvent lines, bad 0, commits_seen 336, accounted 189,
  unaccounted 147).
- A second 3' mismatch (found by the Documentation session): the DEFER/WITHHELD lines named only `.find`'s first (oldest) unaccounted
  sha, while the grader expects U's newest, so any multi-commit U through the mint path would still fail. Fixed in goal-host 7c70178
  (lists every unaccounted sha of the dispatch). The rubric is unchanged.
