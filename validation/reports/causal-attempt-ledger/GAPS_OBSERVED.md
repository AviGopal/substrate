# Gaps observed while building the causal attempt ledger

Each is filed as a `human_reported` gap at task 7.2 unless the substrate already holds one
for the same class (noted). Re-derivation commands are in the change's `sources.md` or
inline.

1. **feature_compose cannot create a net-new file from a goal.** The basename grounding
   check inside `if (verifyVessels.length > 0)` in `feature-compose.ts` refuses every
   target whose basename is absent from the window; a file that does not exist yet can
   never be present. The later NET-NEW CREATE EXEMPTION gate already exempts creates; the
   earlier gate duplicates it without the exemption. Symptom:
   `Grounding window (…) does not contain basenames of all target files`.
2. **The semantic region judge rejects a patch that edits inside the region but leaves
   the literal-bearing line unchanged.** `semantic_gate.reason = "patch does not edit the
   region '<literal>'"` for a diff that replaced the predicate on the line after the
   literal. Evidence: `/workspace/proposals/route-edit-acb4704e-compose-report.json`.
3. **A transient verify instance registers under a live vessel id.** A process claiming
   `local-tools-vessel` registered `http://127.0.0.1:24892` into live discovery, replacing
   the real `:8230` row; nothing listened there, so every compose grounding window came
   back 0 bytes. The real vessel registers only at boot, so the row never healed until a
   restart. The substrate already holds a gap for this class
   (`a-transient-verify-instance-registers-an-ephemeral-endpoint-under-the-live-vessel-id…`).
4. **The walk's tool fallback attempts raw `sed -i` edits on vessel source** after
   feature_compose declines an edit goal. None applied here, but the route is ungated.
5. **The compose checkout's baseline is missing `@avigopal/ias-executor-ts`**, so
   development-vessel's untouched baseline shows 107 tsc errors and 26 failing tests there
   (`baseline-typecheck-broken-repos-development-vessel`, already filed by the substrate).
6. **goal-host consumes `ias-executor-ts` as a copied directory in `node_modules`**
   (dated before the last ias-executor landing), so a landing in `repos/ias-executor-ts`
   never reaches goal-host — task 2.4 would be a hollow write.
7. **The operator had to add `in the region "<literal>"` to a goal** before the drafter
   could see the code it had to change (law 13: an operator rewriting a goal is the gap).
8. **The LLM plane ran dry with no gap**: OpenRouter and Chutes both returned 402 while
   the resolver de-advertised `llm_completion`; every compose then failed as
   `endpoint discovery failed (llm=false)`.
9. **`bootstrap-seeder` fails permanently**: its 19 templates are refused because
   `activity.learning_track` is required and the templates do not set it.
10. **`development-vessel-seed.service` was not ordered after `identity-seeder`** (fixed
    in `scripts/substrate/units/development-vessel-seed.service`; takes effect on the
    next image build).
11. Credit-binding prerequisites from `design.md`: the unbound `$activity_id` in the
    `/reach` pre-read; no idempotency key on `propagateCreditAlongChain`; `regressed_by:
    null` arming the reader; the non-merging gap writer in `typecheck-scenario-gen.ts`.
12. **An edit goal that LANDED is graded `reached:false`.** Dispatch `37dfb3aa` reported
    `failed` ("no template produces [shellResult]") while its compose landed `b99b877`
    FAVORABLE and pushed: the early edit-intent route stopped waiting on a long compose,
    fell through to the walk, and graded the walk. A landing graded unreached is exactly the
    attribution break this change exists to fix.
13. **Every new resolver must land with its registration in one compose** (the semantic
    judge rejects a module whose functions have no callers). Correct, but the
    one-file-per-goal guidance in CLAUDE.md contradicts it for new resolvers.
14. **Ribosome extraction crystallized a broken lease release, starving every cutover.**
    Two `learned-*` variants of `trace-store-reconcile` stored the release step's token as
    the literal `"[redacted]"` (the `{{extract_lease_token_text}}` placeholder was redacted
    at extraction), and all four stored variants kept `ttl_ms: 900000` after the seed source
    moved to 300000 (the seeder skips a populated catalogue). The fleet-wide `change_window`
    lease was held 15 min per run and never released; cutovers wait 90 s then discard their
    FAVORABLE draft (task 1.4 was drafted, judged addresses:true, and discarded twice).
    Intervention (user-approved, recorded here per law 12): `activityTemplate_update` on the
    four variants restoring `ttl_ms: 300000` and the placeholder; backups in
    `backup-trace-store-reconcile/`. This is the class the attempt ledger's extraction
    deferral exists to prevent.
15. **A deferred cutover discards its FAVORABLE draft** instead of queueing it
    ("no edit will land this run"), so lease contention converts directly into lost work.
16. **Container git hooks recorded transient `/tmp` checkouts** (~900 events/hour from
    reland-verdict fixtures); fixed at the source in `_record.sh`.
17. **Drafting is capped by the routable model set, and Claude-via-OpenRouter is
    unreachable.** `isModelWilling`/`pickProvider` in llm-resolver send any `claude*` or
    `anthropic/*` slug to the Anthropic lane (no key here), and OpenRouter models must be in
    a hardcoded list (gemini-2.5-flash, gpt-4o-mini, deepseek-chat-v3). A funded OpenRouter
    key could serve strong models (gemini-2.5-pro, gpt-5, claude-sonnet-4.5 all answered 200)
    but selection could never reach them; drafts from the weak arms repeatedly failed
    typecheck. A pinned model is silently dropped when its lane looks dry. The routable set
    should come from the provider's live model list, not a literal.
18. **Seed templates drift from source without detection** (the reconcile TTL fix never
    reached the stored templates because the seeder skips a populated catalogue).
19. **`trace-store-reconcile` fails every run and leaks the fleet-wide lease.** Each run
    (≈10 min cadence) fails at the reconcile step with "`lease_token` is required": the
    `extract_lease_token` step reads `{{acquire_lease_text}}`, which does not carry the raw
    token JSON, so `{{extract_lease_token_text}}` renders empty and the run dies before
    `release_lease`. With the TTL restored to 300000 ms each run still blocks all cutovers
    for 5 minutes; a cutover waits 90 s and discards its FAVORABLE draft. Interim operator
    setting: `CUTOVER_LEASE_WAIT_MS=330000` on development-vessel (unit file updated; live
    drop-in pending operator approval).
20. **A rolled-back draft wrote into the live gap store.** A rejected draft of
    `unaccounted_landing_scan` executed during compose verification and upserted gap
    `unaccounted-landing-scan` (category `unaccounted_landing`, generic summary, no sha) into
    `/workspace/git/super-repo/gaps/gaps.json`; the gap lane then picked it up. Verify
    instances must run against an isolated gap store. Retracted by the operator.
21. **Refuters rejected a draft on a false runtime claim** ("Bun APIs will throw in the
    Node runtime"); development-vessel runs under Bun.
22. **Typecheck + semantic judge + refuters passed a resolver whose core path could never
    run.** `c89861b` (attempt_register) read snapshots under kind "attemptSnapshot" while
    attempt-checks writes "stateSnapshot", and tested the scan's shape as
    'unaccountedLandings' while it returns 'unaccountedLandingReport' — two string-key
    mismatches that make the sweep dead code, invisible to every gate that reads a diff.
    compose itself logged "TARGET HAS NO TEST FILE … only a test RUNS it". A new resolver
    should not land without a per-resolver test that executes its main path.
23. **A cutover stages files into the live tree minutes before committing** (live files
    at 12:59:25, commit 13:01:50), so "file present in /vessels" is not landing evidence.
24. **feature_compose cannot edit non-TypeScript source files.** `groundVesselFiles` lists
    only `src/**/*.ts(x)` plus three configs, so a spec-named `.json`/`.surql` target never
    gets a content window and (existing on disk) is refused by the basename gate. Found when
    the acceptance fixture `src/fixtures/attempt-ledger-canary.json` could not be landed.
    Repair dispatched (targets of any extension added to the listing).
25. **The ephemeral-endpoint hijack recurs** (#3): local-tools' discovery row pointed at
    `:25677` during a local-tools compose. Operator mitigation for the acceptance window: a
    host watchdog restarts local-tools only when the row is already wrong, logging each repair.
26. **feature_compose writes staged drafts into the live runtime tree before the cutover**
    (`preLiveSync`), so anything that snapshots "pre-state" at cutover time sees the change
    already applied. Found by the ledger's own dry run (see RUN0_DRYRUN.md).
27. **A rolled-back compose leaves a newly CREATED file in the live runtime tree.** The
    staging loop copies drafts into `/vessels/<v>` (`preLiveSync`); on rollback a file that
    was absent before is not removed, so the next attempt sees it as existing and drafts an
    edit (`src/fixtures/README.md`, "Run counter: 0", left at 23:51 by a rejected draft). The
    runtime tree then diverges from git. Operator removed the orphan (not tracked anywhere).
28. **Three sessions share one live container with no lease on it.** `substrate-live` was
    removed at 2026-09-24T02:10:37Z by a concurrent install-interface verification run (its
    deploy step does `docker rm -f substrate-live`, then a recreate that died within seconds). The
    live substrate stayed down for about two hours: two sessions waited, and neither would restart
    shared infrastructure it did not own. Nothing in the substrate observes that it no longer
    exists, because the observers run inside it. Recovery: back up both volumes, rebuild the image,
    recreate on the same volumes.
29. **`make run-live` cannot recreate onto preserved volumes under podman.** `docker volume
    create <existing>` succeeds on Docker and fails on podman ("volume already exists"), so
    `run-live` exited 125 before `docker run`. This likely explains why the 02:10 recreate
    (#28) never came back. Fixed in `scripts/substrate/Makefile` (three sites): inspect first,
    create only when absent.
30. **`substrate-ready.sh` reports `fleet ready` for a container that is not running.** Against
    a `Created` (never started) container every unit reads `skipped` and the script prints
    `[ready] fleet ready` with exit 0. A silent skip read as a pass; `make up` then proceeds
    to the doctor on that verdict. Also, a `docker run` refused on a port conflict leaves a
    `Created` container holding the name, so the next launch fails on the name.
31. **Outcome and settle snapshots compare nothing but the canary.** `attempt-register.ts` passes
    the pre-snapshot's result ids (`unit:<name>`, `gate:<name>`) as check ids, and
    `evaluateChecks` answers `not_applicable` for ids it does not know. A pass → not_applicable
    counts as neither a flip nor unknown, so a landing that stopped a unit would settle `held`.
    Item 8 (five-valued verdicts) cannot see this, because `not_applicable` is a valid verdict. Fix dispatched.
32. **Walk shell steps do not carry the execution id.** `rawResolve` builds the resolver pointer
    without `execution_id`; only `ufExecuteTool` adds it. Shell commits made by a walk's satisfier
    are recorded with `execution_id: null`, and the mint deferral guard cannot match them. Fix
    dispatched (shell executors only).
33. **The satisfier's filesystem-write refusal is not enforced.** Dispatch 583fe760 logged
    `satisfier REFUSED filesystem-write shapes ["fs_write"]` at 05:38:02, then `write "fs_write"
    claimed success` at 05:39:09, and the live canary became unparseable. A walk's direct write to
    `/vessels` is not a commit, so neither the git hooks nor the ledger see it; the post-landing
    snapshot then recorded the damage against an unrelated attempt.
34. **A restart interrupts a dispatch whose compose still lands.** Dispatch f37e247d was graded
    `interrupted:` by a goal-host restart while its compose on development-vessel ran on and landed
    `be45fe8`. The landing's `authoring_execution_id` names a dispatch with no execution row.
35. **A walk fallback on an edit goal edits source through the shell, repeatedly, and nothing
    records it.** When feature_compose was busy or timed out, dispatches of operator edit goals
    fell through to a walk whose tool steps ran `sed -i '/<anchor>/a\ <line>'` against the
    super-repo worktree copy (`/workspace/git/super-repo/repos/<vessel>/…`). Across retries this
    appended the line 658,893 times to goal-host `index.ts` (170 MB, 09:00Z) and 21 copies of a
    block into `feature-compose.ts` (95 MB, since Sep 23 22:54Z). No commit was made, so neither the
    git hooks nor the ledger saw it; the satisfier's "REFUSED filesystem-write shapes" does not cover
    shell executors. The operator backed up both files (`/workspace/backups/sed-bloat-2026-09-24/`)
    and restored them from HEAD. The retry harness that produced the fall-through dispatches is stopped.
    A worktree scan found the same class in two more files: `gap-to-feature.ts` (the import line
    repeated 94 times, since Sep 23 14:20Z) and `patch-with-tools.ts` (a `// TODO` line repeated 5
    times). Both were backed up and restored. The root operator cause: `dispatch.sh` carried the operator only as a
    tag, not the `operator` body field, so every operator edit competed as autonomous work, was
    refused BUSY, and was retried into walks that fell through to shell edits.
36. **Settlement charges any in-window flip to whichever landing is open.** After fix #31 made
    unit checks real, two autonomous landings (att-mufabbh1-r14gi16 on
    `trace-store-health-observer.ts`, att-mufamqfr-wcaw1gy on ias-executor-ts
    `activity-api-provider.ts`) settled `regressed` on `unit:gap-store-census`. That unit failed
    at 08:54Z because the gap store was unreachable during an operator restart of
    development-vessel, not because of either change. The first slice records surprise, not
    blame (design D7), but the settlement verdict reads as blame and feeds the lessons. Needs a
    discriminator: a flip whose failure detail names an unreachable dependency, or that
    coincides with a recorded restart, should settle `unresolved`, not `regressed`.
37. **Late-landing detection credits a dispatch with an old commit of the same goal.** The
    edit-intent gap id is a hash of the goal text (`route-edit-6d8d0a60` for the canary restore), and
    goal-host's LATE-LANDING check looks for any commit on origin/dev carrying that id. A restore
    dispatch at 09:28Z, whose compose was UNFAVORABLE and whose patch_with_tools escalation refused, was
    graded `reached:true` on `cd702a7`, which landed at 05:13Z for an earlier dispatch. A repeated
    goal can be credited with a landing it did not make.
38. **Operator harness (not substrate): "live file shows the change" is not landing evidence.**
    The pre-run check grepped the live canary for `intact`; a restore draft staged into `/vessels` before
    rollback satisfied it. The same trap was recorded in run 0 (#26). The pre-run check now reads the
    push clone's HEAD.
39. **The consequence lesson is silently dropped when the attempt's gap was never recorded.** An
    edit-intent goal that lands on its first compose never persists its synthesized
    `route-edit-*` gap, so `writeLesson`'s `if (gap)` skips the drafter-facing `failure_lessons`
    lesson and writes only the file-keyed one (run 4 R: gap=0 file=1). Runs 1 and 2 passed item 4
    only because their goal text hashed to gaps that earlier failed attempts had created. Fix
    queued: file the missing gap as open, carrying the lesson.
40. **Transient cutover units make settlements `unresolved`.** Once fix #31 made unit checks real,
    one-shot `mitosis-self-restart-*` / `mitosis-goalhost-restart-*` units (created per cutover,
    gone by the next snapshot) read as unknown. Run 4's restore settled `unresolved` on one;
    four other settlements since 09:30Z name them. Fix queued: exclude `mitosis-*` units from the check.
41. **The dispatch context is read but never set (hollow write).** Commit `5c1c7d2` declared
    `dispatchContext` and added its readers; the `enterWith` in `runGoalWithRecovery` that the goal
    asked for was dropped from the landing, and the operator recorded it as landed without checking for
    the writer. Every reader (tool fallback, rawResolve's shell `execution_id`, the mint deferral guard)
    has read `undefined` since. Run 4's U item failed on it even after fix #32. Fix queued: one `enterWith` line.
42. **A non-live writer created a consequence gap with literal template placeholders.** At 11:46:30Z,
    after fix #39 landed (11:44) but before development-vessel restarted onto it (11:51), a
    `substrateGap_write` created `route-edit-f0019094` with `edit_site: "<intent.touched_files[0]>"`,
    `attempt_id: "<attempt_id>"` and a placeholder lesson. That is the goal text's code with its
    template expressions rendered as prose, so it was an LLM-driven writer (draft verification or a
    walk step), not the landed code. The live sweep then appended the real lesson at 11:52. Operator corrected the
    fields through `substrateGap_write`. Same class as the "phantom gaps written by drafts" seen in run 0.

## 43. The floor's server-side tool calls drop the dispatch id (run 5, items 7 and 3')
The U walk ran out of pathway steps and fell to `universalToolFallback`, which sends `llm_completion_dispatch` with `tools`. llm-resolver runs the model's tool calls itself (`dispatchTool`) and builds each pointer from the model's input alone, so local-tools' `shell` got no `execution_id`. The git hook then recorded `execution_id=null`. Fixes #32 (rawResolve stamp) and #41 (`enterWith`) were correct but never on this path. Item 3' fails for the same reason: the extraction deferral matches unaccounted landings by `execution_id === dispatchId`. Fix: forward the id in the goal-host pointer and in llm-resolver `dispatchTool` (dispatched as two one-file goals). Root cause found by the forked session and confirmed against the code.

## 44. A landing swept in another compose's staged edit, and the attempt did not record it
Commit `4e40707` (development-vessel, gap `route-edit-d5e92e38`) changed `maintenance-lease.ts` as intended and
also `feature-compose.ts` (`callTool` now sends `timeout_sec: 300` to `shell`), an edit from a different compose that
was staged in the live tree when this cutover committed. Its `attemptIntent` (`att-mufn2it8-k5x9290`) lists
`touched_files: ["src/resolvers/maintenance-lease.ts"]` only. The ledger therefore attributes any consequence of the
`feature-compose.ts` change to the wrong attempt, and the check set chosen from `touched_files` never covers it.
Class: the intent is registered from the compose's plan, not from the commit's diff. Detection: compare
`git show --name-only <sha>` with the intent's `touched_files` at landing-event time and flag a surplus file.
Owner of the swept-in edit: the autonomous gap `the-compose-test-baseline-and-flake-rerun-are-killed-at-the-shell-tools-thirty-second-default…`
(its compose staged at 14:41:01Z; the unrelated cutover committed at 14:41:09Z). That gap still read open with no landing, so
the lane would have redrafted an edit already in the file; the resumable-landings session stamped
`pending_outcome_verification=4e40707` on it by hand. A second consequence of the same class: the staging compose's own gap
is never told its edit landed.
Second instance (17:37–17:41Z): the lesson-writer compose staged `feature-compose.ts` with base `7a39042b6ffa` and was
refused by the lease; four minutes later `996b841`, committed under a different gap (`three-more-compose-readers-…`),
landed exactly that content (`sha256(996b841:feature-compose.ts)` = `7a39042b6ffa`).
    Addendum: the id is dropped at three hops, not two. goal-host → development-vessel `llm_completion_dispatch` (`resolvers/llm-completion-dispatch.ts` rebuilds `requestBody` from named fields, dropping `execution_id`) → llm-resolver `dispatchTool` → local-tools `shell`. goal-host (`6b4da46`) and llm-resolver (`324f7f1`) landed; the development-vessel hop is dispatched separately. Class lesson: a context field threaded through a resolver chain is lost at every hop that rebuilds its pointer from an allow-list, so trace the full chain through discovery before dispatching per-hop fixes.

## 45. A deferred cutover leaves its draft staged in a non-isolated worktree
At 15:12Z a verified local-tools compose (`route-edit-d53b7f58`) was refused at cutover ("maintenance change_window lease
held — defer without rollback") and parked, but its edit stayed staged in the super-repo local-tools worktree: the
live-tree rollback covers isolated vessels only. A staged edit that outlives its compose is exactly what gap #44's
unrelated cutover swept into its commit, so the two compose into mis-attributed landings. Detection: after any refused
or deferred cutover, `git status --porcelain` on every non-isolated worktree the compose touched must be clean.

## 44. A parked landing leaves its draft in the stale super-repo copy, and the next draft of the same change is planned against it
At 15:12 a verified local-tools draft was refused at cutover because `change_window` was held (trace-store-reconcile still takes the global lease) and was parked (`/workspace/parked-landings/`, "defer without rollback"). Nothing resumes parked landings yet. The draft stayed staged in `/workspace/git/super-repo/repos/local-tools-vessel/src/index.ts`. feature_compose builds the model's window from that stale copy, so the redraft saw the change already present; its anchors were not in the real file (`anchor_not_from_window`), and every retry ended "plan had no ops". Operator restored the one orphaned line in the super-repo copy to the clone's line (backup in `/workspace/backups/`) and redispatched. The substrate already has an open gap for the stale-copy reader ("the anchor-band centring reader in feature-compose reads the target file from the stale super-repo copy…").

## 46. A hollow-judged walk retries with side effects, so one goal lands several commits
Pre-check U dispatch `45196b00` (scratch repo, outside the graded runs): the four-hop execution-id fix works — commit
`8fac0e75` is the first U commit to carry the dispatch id — but the reach judge called the attempt hollow and the walk
retried, committing again. A later commit, `7c41ff86`, came from the engine template `auto-bridge-source_code` and carries
the engine's own execution id (`exec_4efr9oxo`), not the dispatch's. One goal therefore produced several landings, not all
attributed to the dispatch. Two classes: a retry that is not idempotent over side effects (a commit is not undone before the
retry), and an engine execution that does not inherit the dispatch context. The grader reading only HEAD hid the first commit.

## 47. The ledger settled `held` on the commit that stopped every landing
`0a0d59f` (development-vessel, `vessel-mitosis-cutover.ts`, 17:08:41Z, Substrate Autonomous) makes the cutover refuse when
the file's HEAD content sha differs from `staged_base_sha`, but feature-compose sends the sha of the *edited* staged file,
so the two never match on that route. Measured 17:08–17:45Z: 2 cutovers refused "COMMITTED DRIFT" (staged bases
`9e6670189e69`, `18eae44d5601` match no committed version of their files), 6 refused by the `change_window` lease, and 1
landed (`996b841`, 17:41, whose base equalled HEAD's content sha). Over the whole time it was live (17:08:41 to its operator revert `97f7cdf` at
20:05:24Z): 14 COMMITTED DRIFT refusals and one substrate landing (`996b841`) on any vessel in three hours, so in practice it
stopped the autonomous lane. The block hits feature_compose cutovers whose staged base is not a committed sha. (Corrected: an earlier note here said every cutover was refused; that was
relayed, not measured.) Its attempt `att-mufsd9u0-85p4g06` settled **`held`** at 17:17:12Z with no
flips; the snapshot after it reads every unit, gate probe and the canary `pass`. The baseline check set observes whether
units run and gates refuse known-bad inputs, but not whether a known-good landing still lands, so the ledger's worst
possible regression (the landing path itself) is invisible to it. Needed: a `landing_liveness` check — the gate self-probe
extended with a known-good positive case that must be *accepted* by the cutover's refusal predicates, plus a
count of cutover verdicts vs refusals over the settle window.

## 48. An attempt registered on the resume path carries no check set
The same attempt's intent reads `checks: null` (mitosis id `development-vessel-resume-…`, the parked-landing resume added
by resumable-landings 1.1). Fix #31 (`2cdc90f`) put `invariantSelect(...)` on the two registration sites that existed then;
the resume path registers through a third site without it, so its settlement compares against an unrecorded set.

## 49. A parked (verified, deferred) landing is reported to its dispatcher as UNFAVORABLE with no detail
Dispatch `2c5087ea` (goal-host bash-host fix) passed every gate, was refused at cutover by the global `change_window`
lease (trace-store-reconcile, 20:37–20:42Z) and parked; the dispatch record reads `completed`, `reached:false`,
"verdict=UNFAVORABLE (op_count=?: no failure detail in compose report)". A caller cannot tell a verified patch waiting to
resume from a rejected draft, so it either gives up on work that is one resume away or retries blindly. It landed only because
the same goal text was redispatched (`ed81a69`, 20:46:15Z). The compose report does carry `parked: true`; goal-host's reach reason drops it, so the gap is in goal-host's
edit-intent result mapping, which should surface `parked` and the refusal reason.
Harness consequence: `run-task.sh` now treats that text as retryable (same goal text resumes the park).

## 50. A redraft of an already-landed goal staged a duplicate edit into the live tree, and the vessel restarted onto it
After the goal-host bash-host fix landed (`ed81a69`, 20:46:15Z), a further compose of the same goal kept drafting (plans at
20:49:48 and 20:55:55Z) while its gap still read open. At 20:54:46Z a draft was staged into `/vessels/goal-host-vessel/src/index.ts`
that inserts a second copy of the `proc.run` env wrap, and goal-host restarted at 20:55:23Z onto that uncommitted file (runtime ≠
clone; two occurrences of the marker, the commit has one). The same class as the anchor-pair double insert: the drafter's
anchor still matches after the landing, so a re-apply duplicates rather than no-ops, and staging into the live tree lets an
unlanded draft become the running code. The harness's runtime = clone check caught it; nothing in the substrate did.

## 51. Fixing the drift gate's base sha broke the freshness check, which relied on the old meaning
`082f6ee` (development-vessel, 20:28:59Z, Substrate Autonomous) makes feature-compose record the *pre-edit* file hash as
`staged_base_sha`, which is right for the committed-drift guard (#47). But the cutover's freshness check compares
`staged_base_sha` with the hash of the live file in `/vessels`, into which live-sync has already written the edit, so it
now refuses whenever the edit is live-synced before the check: 4 of 7 development-vessel freshness checks since 18:00
failed (20:48 `vessel-mitosis-cutover.ts`, 20:51 `cli.ts`, 21:07 and 21:14 the canary), all after `082f6ee`. Before it,
`staged_base_sha` was the patched hash and matched the live-synced file by accident. Two checks read one field with
two meanings. Fix direction: freshness passes when the live file equals either the recorded base or the patched content this
cutover staged. The ledger's view of `082f6ee` should be checked: a check that a known-good landing still lands (#47) would
have caught it.

## 52. The per-commit unaccounted-landing detector out-files every closure path
`sweepAttempts` files `unaccounted-landing-<sha12>` for every commit without a registered attempt. Between 00:11 and 01:03Z on
09-25 it opened 112 of 158 new gaps (5 closed); over 24 h 469 opened, 36 closed. Of the 113 open at 01:05Z, 69 are the U probe's
own scratch repo, from run 7's non-terminating U walk (#46), 26 are development-vessel, and the rest are spread over 8 repos. One gap per
commit makes the detector's own backlog the dominant gap-store signal, the measure law 7 reads. Change requested by the user
(via the resumable-landings session): one aggregate gap per repo (`unaccounted-landings-<repo>`) listing the shas, legacy
per-commit gaps folded into it as `superseded` with `duplicate_of`, and a close predicate (the repo's next landing carries an
attempt). Item 7 still requires "a gap naming U's sha"; the grader accepts the aggregate listing the sha.

## 53. A landing whose dispatch already gave up is attributed to a placeholder execution id
Run 8, item 1b. An autonomous cutover (`development-vessel-fc-2026-09-25T02-00-06`) restarted development-vessel at 02:05:32Z;
R's dispatch `22489866` arrived at 02:06:01 while the vessel was draining, and goal-host recorded it `failed` with
`executionId=feature_compose:rejected:8ab54380` ("verdict=unknown (op_count=?: draining)"). The lane then re-picked the edit's
gap and landed it (`86f23c3`, 02:14:44, `Attempt-Id att-mugbs989-1zpmm9w`, authored by that dispatch). The attempt's
`authoring_execution_id` names the dispatch, and the dispatch names a rejected placeholder, not an execution row, so the causal join
from a landing to the execution that produced it breaks exactly when a compose outlives its dispatch (#34). Fix direction: the attempt
registered at landing records the compose's own execution as `authoring_execution_id` and keeps the dispatch as a separate field,
so the join does not depend on the dispatch record's final state.

## 54. One edit dispatch is routed to feature_compose twice, and the second call is cut off early
Run 8, fixture C (corrected after a read of the code: an earlier note here blamed a missing timeout, but both edit-intent fetches carry
the 900 s `EDIT_INTENT_COMPOSE_TIMEOUT_MS` signal, index.ts early and post-walk routes). Timeline: EARLY EDIT-INTENT at 02:48:07 →
development-vessel fc-plan 02:49:24 (`route-edit-2e3e1970`) → the post-walk route fires again for the same goal at 02:53:28 →
development-vessel `[compose-cap] REFUSING compose for route-edit-2e3e1970: already in flight` → a second canary fc-plan 02:54:14 →
the post-walk call reports "The operation timed out" at 02:59:20, about 6 minutes in, well under 900 s, and the dispatch falls through
to a walk graded hollow three times. Two defects: an edit goal whose early route is in flight is re-routed post-walk, and something
shorter than the 900 s signal (a server idle timeout or an intermediate hop, not yet located) kills the second call. Harness: the next
grader retries this outcome with the same goal text.

## 55. self-recovery restarts a saturated vessel, killing its in-flight work
Run 10. Under a trace-ingest storm (surreal 8–12 cores, host load ~30 on 16 cores), `/health` on development-vessel timed out
intermittently. self-recovery marked it UNHEALTHY and restarted it at 07:35:58 and 07:52:36, and activity-api at 07:51:42. The first
restart closed R's in-flight feature_compose socket (07:36:44). A slow-but-alive vessel and a dead one look the same to the probe,
and a restart under load adds a replay burst to the storm that caused it. Fix direction: tell saturation from death (process
state, event-loop lag, in-flight count) before restarting, and back off while the DB is under pressure (its `db_pressure_backoff`
counter read 0).

## 56. pull-sync takes an owed restart inside an announced graded window
Run 10. pull-sync deferred development-vessel's restart at 07:29:31 (3 in flight), then took it at 07:30:04 ("OWED restart for
already-mirrored content"), 15 min into a graded run. The trees already matched the runtime, so the restart bought nothing.
Windows are announced to sessions, not to the substrate, so no reader exists. Fix direction: a change-window/lease shape that
pull-sync and self-recovery read before a non-urgent restart; skip an owed restart whose content already matches the runtime.

## 57. restart-attribution reuses a stale breadcrumb
The 07:36:45 development-vessel process logged "restarted by pull-sync: owed restart after deferral", but self-recovery made that
restart (the breadcrumb was from 07:30:04). The 07:53:30 process correctly logged "UNATTRIBUTED START — the only breadcrumb is
stale". The first reuse went through because it fell inside the staleness window. Fix direction: the restarter writes a breadcrumb
naming the target PID it stops, and the reader accepts it only when that PID matches its predecessor.

## 58. Trace-ingest storm: slow trace POSTs are re-sent, and each duplicate adds load
09-25, 06:55–08:26Z. In 5-min buckets of POST /execution-traces with duplicate-id insert errors: 06:50 154/0, 07:05 760/699,
07:40 1064/1194. In 10-min windows, POSTs ≥60 s: 0 at 03:00, 05:00 and 06:30; 233 at 07:40. The duplicate ids are goal-host walk
ids (walk-satisfier-*, universal-tool-fallback-*), each ~2×, which is a client re-send after its own timeout while the first insert
is still in flight (Documentation-session attribution). It ended with the user-authorized container stop at ~08:26 (0 posts / 0
duplicates in the first 4 min after). The 30-min FTS REBUILD (mean 833 s on 4,003 rows; 22/36 timed out on 09-24) was already running
at 03:00, when surreal used ~4 cores, so it isn't the delta. The onset trigger is not identified.

## 59. Autonomous landings don't read the graded-run window, and a landing gate passed a process-global fetch patch
09-25. goal-host 8c31cdb landed autonomously at 12:05:50, inside run 11's announced window, and replaced `globalThis.fetch`: every
POST to `/resolve` was redirected to discovery with only `{type}`. Every feature_compose call then reached development-vessel with an
empty pointer, and run 11 was voided. The gate's tsc and tests passed, and the pre-run clean check passed because the process had
started after its source. This is the third window-blind actor, after self-recovery (#55) and pull-sync (#56); the fix has the same
shape: one shared window/lease shape that the landing, restart and sync paths all read. Separately, nothing checks a draft for
process-global side effects (monkey-patching fetch/globalThis). The revert was goal-host 6ce1446, a traced compose called directly on
development-vessel because goal-host's own routing was broken.
**#59 addendum (15:10Z):** four window-blind dispatchers so far: (1) gap-compose.service (timer + unit start on gap write);
(2) the boredom selector running development-vessel activities in-process (91c042b, and dispatch-latest-auto-draft → 4f1d3e8);
(3) funnel-drain.timer; (4) substrate-gap.ts's event-driven in-process nudge (`fetch self gap_to_feature`, gated only on
autonomous slot capacity; dde475e at 14:40 via "lost-reached-verdict-walk-satisfier-…"). There's no shaped control for (4). The only
lease the lane reads is the cutover `change_window` lease, which would also block the graded fixtures' own landings. So the operator
stopgap pauses (1)–(3); (4) stays live and graded runs rely on a diff review of every graded-vessel landing inside the window.

## 60. Bridge-author validation probes run the goal's real command, untraced, with no execution id
09-25, run 10 (fourth attempt), item 7: 11 of U's 19 commits carried `execution_id=null`. All 11 had `committer_unit=local-tools-vessel.service`
and the bounded-shell `set -m`/`__killtree` wrapper. The caller is not local-tools. When the walk has no producer for a target shape,
goal-host BRIDGE-AUTHOR (`src/index.ts`, the `author_producer` POST in the missing-target branch) asks development-vessel
`resolvers/author-producer.ts` to author one with `max_attempts: 3`. Each attempt VALIDATES its candidate by invoking the shape's
resolver for real (`validateProducesShape` → local-tools :8230). The test pointer is built from the goal text, so for U every
validation ran U's own `git commit`. Neither hop carried the dispatch's execution id. The execution table has no rows for these
shells, so they are untraced.
Evidence: bursts of 3 null commits (= max_attempts) end within 1 s of the reach-gap update that follows a failed bridge author:
16:58:42/48/50 → `reach-gap-shell` 16:58:50.66; 16:59:30/36/42 → 16:59:43.38; 17:00:46/53, 17:01:07 → 17:01:07.64;
17:01:41/50 → `reach-gap-bash` 17:01:50.95.
Fix (attribution): goal-host passes `execution_id` from `dispatchContext` in the author_producer pointer; author-producer.ts copies
`pointer.execution_id` onto the test pointer. Linking is honest: U's dispatch really caused these commits.
Separate defect, linked to #46: validation probes have real side effects. author-producer snapshots and restores probe *file* writes
(the probeSnapshot loop after `buildTestPointer`), but a probe that runs `git commit` lands a real commit nothing reverts. So every
bridge-author attempt adds commits, which is likely a large share of #46's many-commit U walks. A validation probe should run in a
sandbox (scratch clone or worktree) or be refused for side-effecting commands.

## 61. A remaining id-less shell sender: bare `{type, command}` pointers, most likely the engine's HTTP resolver tasks
09-25/26. After the bridge-author (#60), composed-capability (d4456d9, 829f613) and floor ufExecuteTool fixes, local-tools'
id-less instrumentation still logs requests whose pointer keys are exactly `["type","command"]`: type first, no `cwd`, no
`timeout_sec`, no `execution_id`. Every fixed or excluded sender has a different shape. rawResolve always adds poolVars (which carry
`dispatch_id`) and is stamped. author-producer's test pointer puts `type` LAST. feature_compose staging calls carry
`timeout_sec` and `cwd`.
Evidence: (1) run 12, `5a0d780e` (23:40:23): the one id-less U commit, 6 s after the walk's engine template step
`activity:⟨learned-satisfier-bash⟩` (exec_o5bmrcj3) failed. It ran U's exact command, untraced, with only 2 execution rows in 23:40:10–40.
(2) Fresh streak run 10, during C (01:34:16–19): four read-only one-liners (python3, python, node, node) parsing the canary JSON,
right after a canary-edit walk that ran engine templates `auto-bridge-fileWriteResult` and `auto-bridge-fs_edit`. No commit.
Hypothesis (not proven by a log line): goal-host's IAS engine (`host.runTemplate`) dispatches a template's HTTP resolver tasks to
local-tools as `{type: task.resolver, ...task.config}` without the dispatch id. ed81a69 covers only the bash host's `proc.run` path.
Follow-up: thread `dispatchContext`'s dispatch id (or the engine execution id) into the engine's HTTP task dispatch, as ed81a69 did
for `proc.run`. Falsifier: local-tools logs no `["type","command"]` id-less request during a template execution.
Side note: the one-liners used python and node, which the executor prompt says are absent. Whatever synthesised them did not read that
constraint (law 8).
