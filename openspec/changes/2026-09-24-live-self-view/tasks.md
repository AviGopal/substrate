Gap ids below are in the live gap store (`/workspace/git/super-repo/gaps/gaps.json`).
Dispatch texts for each unlanded task are in `goals/`. Every falsifier names its negative
control; a close needs `classification_metadata.falsifier_exercise.passed === true` on the
gap, not a landing.

## Status (2026-09-25 03:55Z)

Landed (all substrate-authored except the operator revert 97f7cdf by the resumable-landings session):
1.2 A/B/D, 3.1, 4.1, 4.2a, 4.2b, 5.1 (inside 4e40707), 5.2, 5.3 (inside 996b841), 5.4, 6.1, 6.2, 6.3.
Falsifiers MET and gaps closed: 1.2 (site A), 3.1, 4.1, 4.2a, 5.1, 5.3, 5.4, 6.1, 6.2, 6.3.
Open, by what they wait on:
- 3.1: CLOSED 03:52Z (12 landings, 0 restart pairs, 4 coalescings).
- 4.2b: needs a stuck gap whose last lesson is `[deterministic]` to reach the narrowing branch.
- 5.2: needs a failed cutover where the live file equals the committed clone and differs from
  the snapshot; no controllable trigger.
- 1.2 sites B and D: diffs verified; neither gate logs a signal that distinguishes the fix, so
  no log-based falsifier exists yet (a gap for that instrumentation would be the next step).
- 2.2: operator-tier `substrate-pull-sync.sh` (frozen submodule worktree class); filed, not
  dispatchable through the lane.
- 6.1/6.2/6.3: landed and closed (approval forging removed, prompt fixed, fs_edit deletions).
2.1 superseded (wrong premise); 3.2 not needed.

## 1. Target-file resolution (development-vessel)

- [x] 1.1 `feature-compose.ts`: helper `targetFileOnDisk`; vacuous guard 2 reads through it.
  Gap `four-compose-gates-read-the-target-file-from-the-super-repo-submodule-copy-…` —
  closed, substrate `20a668b` (draft 2; draft 1 refused by refuters as incomplete against
  a four-site spec). Falsifier exercised 12:08:42Z: the op refused at 11:28Z/11:30Z was
  admitted (`[fc-vacuous] … admitting`).
- [x] 1.2 `feature-compose.ts`: sites A (`rootA`, anchor-band centring), B (`root`, 4-space,
  non-termination/dead-store simulation) and D (`rootT`, test discovery) read through
  `targetFileOnDisk`. Gap `three-more-compose-readers-anchor-band-centring-nontermination-simulation-and-test-discovery-read-the-target-file-from-the-stale-super-repo-submodule-copy`.
  Falsifier: a directed compose on `vessel-mitosis-cutover.ts` logs `[fc-anchors] supplied
  verified-unique anchors for …vessel-mitosis-cutover.ts` (control: 0 of 7 since 10:00Z on
  2026-09-24), and `[fc-nonterminating]`/`[fc-deadstore]` no longer log "cannot simulate"
  for files changed after the gitlink date.

## 2. Gitlink sync (development-vessel)

- [~] 2.1 SUPERSEDED (17:05Z): the premise was wrong. The super-repo gitlink for development-vessel
  IS advanced (883640f at HEAD and on origin/dev); what lagged at 11:35 was the submodule
  WORKTREE at 2383b99 (2026-09-21), which `substrate-pull-sync.sh` skips every tick because it
  carries tracked changes. Those changes were not in-progress work but draft residue applied
  into the checkout and never rolled back (a broken `cli.ts`, the site-A edit already landed as
  `a0ff3d3`, half-applied attempt-ledger routes), written 16:05Z–16:55Z today by a writer not
  yet identified. `stash@{1}` there is an operator stash from 2026-09-07 for the same class.
  Also: the container super-repo carries ~1057 porcelain entries, so "refuse on a dirty tree"
  would have skipped every landing; the cutover draft at 16:56Z was refused by the judge anyway.
  Instance: operator stashed the tracked residue (`stash@{0}`, recoverable). Class gap
  `a-submodule-worktree-in-the-super-repo-is-frozen-by-draft-residue-that-an-unknown-writer-applies-there-and-pull-sync-only-logs-it`
  (edit site `scripts/substrate/substrate-pull-sync.sh`: the detector exists and only logs).
  17:15Z: the next tick then failed the checkout on five UNTRACKED copies of landed files
  (attempt-*.ts, unaccounted-landing-scan.ts, the canary fixture) that collide with the target
  tree; pull-sync counts only tracked changes, so it logged `(checkout-failed)` and nothing
  more. Operator stashed them (`-u`); the worktree checked out the gitlink 883640f. Worktree lag:
  ~100 → 24 commits. The remaining lag is gitlink cadence (substrate-bot bumps ~6-hourly).
  REFROZE by 04:50Z on 2026-09-25 (development-vessel worktree 996b841 vs gitlink 1c7833b;
  local-tools also dirty). Writer attribution (05:10Z): the 22:38:04Z residue in the super-repo
  copy of vessel-mitosis-cutover.ts matches no committed version and is garbled (duplicated
  text) — a mangled draft of the stagedContentSha change 96a1f57 landed via the pwt lane.
  Compose rollback restores /vessels, not the super-repo, so it is not the writer. pwt's
  run-root containment covers fs_edit/fs_write/code_* but NOT its shell tool, and local-tools
  `sh()` defaults cwd to WORKSPACE_ROOT=/workspace/git/super-repo, so a shell edit on a relative
  `repos/<v>/…` path lands in the stale checkout. Options put to the user: A detect (pull-sync
  files a gap), B auto-stash, C attribute/contain shell writes (local-tools sh() + pwt shell),
  D repoint readers to push clones, E pull-sync as an activity. Recommendation: C then A.
  WRITER CAUGHT 05:49Z on 2026-09-25 (supersedes the shell/pwt guess above, which was retracted):
  goal-host goal_hash 25c171e8 named repos/goal-host-vessel/src/index.ts; its EARLY EDIT-INTENT
  compose got HTTP 503 (draining) twice and "fell through to walk"; the walk's executor
  `bounded_shell` ran `sed -i '7780s/…/' repos/goal-host-vessel/src/index.ts` with no cwd, which
  local-tools boundedShellResolver resolves against DEFAULT_CWD = /workspace/git/super-repo; the
  residue watcher saw MTIME on that checkout at 05:49:35/40/44Z. pwt made 0 shell calls since 09-24.
  The coordinator's held gap (draining fall-through → shell sed) is folded into the class gap.
  User-approved plan (relayed by the coordinator): C1 = bounded_shell's default cwd becomes a
  scratch dir (gap `bounded-shell-defaults-its-cwd-to-the-super-repo-…`, dispatched 05:57Z);
  C2 = `ReadOnlyPaths=/workspace/git/super-repo/repos` on local-tools-vessel.service (operator,
  after C1); A = detector activity, one aggregated gap per repo (A1 resolver dispatched 05:41Z,
  wiring next). Trigger fix LANDED 05:58:46Z as goal-host `60833b4`: an EARLY EDIT-INTENT
  compose answered HTTP 503/429 now returns RETRYABLE CAPACITY instead of falling through to a
  walk (gap `an-edit-intent-goal-whose-compose-producer-answers-http-503-draining-…`). C1 draft
  verified + judged at 05:59Z, parked behind the lease. A1 draft 1 failed typecheck (TS1434).
  C1 LANDED 06:01:08Z as local-tools `11636e6`; falsifier MET 06:03Z (bounded_shell with no cwd
  runs in /workspace/tmp/bounded-shell; `sed -i … repos/goal-host-vessel/…` fails "No such file";
  super-repo file mtime unchanged); gap closed.
  C2 (user, operator tier): drop-in for local-tools-vessel.service —
    [Service]
    ReadOnlyPaths=/workspace/git/super-repo/repos
  then `systemctl daemon-reload && systemctl restart local-tools-vessel`. Scope leaves
  /workspace/git/ledger-u-probe and /vessels writable (the ledger's U probe commits there).
- [ ] 2.2 Merged into the class gap above: pull-sync files the gap when a worktree lags its
  gitlink for more than a few ticks; attribute writes into `super-repo/repos/*/src`
  (candidate: shell commands under local-tools `sh()`, whose cwd defaults to the super-repo).
  Falsifier: a planted tracked edit yields a gap within two ticks; over a day no worktree lags
  its gitlink by more than 5 commits.

## 3. Restart coalescing (development-vessel)

- [x] 3.1 `vessel-mitosis-cutover.ts`: `selfRestartAlreadyOwed(vesselName)` + one-line
  call-site substitution on the command array. Gap
  `a-helper-selfrestartalreadyowed-at-the-top-of-vessel-mitosis-cutover-…` (12 drafts
  broke the template literal; its narrowed/recommit children are superseded). Sequence
  AFTER 1.2. Falsifier: over the next ten landings no two `[restart-attribution]` lines
  within 60 s and `self-restart already owed by` appears whenever a landing completes
  with a unit active; control: 35 lines / 6 pairs since 04:00Z on 2026-09-24, two units
  concurrently active at 12:04Z.
  3.1 status (18:05Z): the spec was rewritten at 17:25Z with two single-line unique anchors (the
  old EDIT 2 anchor began with `const proc = Bun.spawnSync(`, which occurs twice, and drafts fell
  back to unique lines inside the restart-script literal) plus the facts refuters disputed (unit
  name `mitosis-self-restart-${mitosis_version_id}` contains the vessel name; no persistent unit).
  First compiling drafts in 14 attempts: 17:52Z refused by 2/2 refuters on invented code
  (`mitosis-self-restart-timer-${Date.now()}` — 0 occurrences); 17:59Z judge PASSED, typecheck and
  tests passed, cutover refused by the freshness gate (staged base lacked 0a0d59f); 18:01Z the park
  resume re-applied onto the same stale base and was refused again. Operator removed the stale
  park (backup `/workspace/tmp/park-31-stale-base.json`) so the next attempt redrafts on HEAD.
  For the resumable-landings owner: resume re-applies onto the park's recorded base instead of
  current HEAD, and parks are not removed when the gap lands by another path (site D's park
  survived `1d4ac1c`).
  LANDED 23:55:17Z as `46d252c`, first attempt on the reopened lane: the helper after the unique
  import line and the ternary on the unique command-array line, exactly as specified; judge
  passed. Live in the process started 23:56:42Z. Last control observation: the restart that
  loaded it logged two `[restart-attribution]` lines 2 s apart (23:56:40/42Z) for one cutover.
  Falsifier pending: over the next ten development-vessel landings, no two attribution lines
  within 60 s, and `self-restart already owed by` whenever a landing completes with a unit active.
  First data point (landings 1–2 of 10): `2992a23` (00:07:41Z) scheduled a unit; `1c7833b`
  (00:09:07Z) logged `self-restart already owed by mitosis-self-restart-development-vessel-fc-
  2026-09-25T00-07-09-879Z.service — not scheduling another` at 00:09:08Z; ONE restart followed
  (00:09:44Z). Still LOSSY (2 in flight): coalescing removes duplicate restarts, not the
  quiesce-ceiling loss.
  Falsifier MET 03:52Z: 12 landings since live, 9 restarts, 0 pairs within 60 s, 4 `already
  owed` coalescings; gap closed.
- [~] 3.2 (not needed: 3.1 landed) If 3.1 fails twice more with supplied anchors present, open a follow-up change
  that moves the restart script into a file the cutover reads, and land 3.1 against that.

## 4. Lane hygiene (development-vessel)

- [x] 4.1 `feature-compose.ts` (not `gap-to-feature.ts`: the only lesson writer is
  `appendComposeLesson`, called once at the end of `resolveFeatureComposeUncapped`, and every
  scope refusal is an early return before it). In the wrapper `resolveFeatureCompose`, the
  existing `if (ob["verdict"] === "REFUSED")` block appends a `scope_refused` lesson; the
  recommit branch skips `scope_refused`. Gap
  `a-scope-refusal-returns-before-the-only-lesson-writer-so-the-gap-records-nothing-and-narrowing-refuses-for-want-of-lessons`
  (blocked_by the 1.2 gap: same file). Falsifier: a directed compose refused at scope leaves the
  lesson on the gap and a second refusal mints no `recommit-…-scope_refused`; control: "NOT
  narrowing … no failure_lessons recorded" at 11:37Z on 2026-09-24.
  Landed 16:34:43Z as `72fdb1f`. Falsifier MET 17:08:03Z via a probe gap: a scope refusal
  (vacuous plan) left a `scope_refused` lesson; the repeat probe read the lesson and emitted no
  ops, so the no-recommit half is unexercised (verified in the diff only). Caveat: the lesson now
  also attaches to the ungrounded-decompose refusal, which the code comment deliberately left
  lesson-free; the recommit side is off for `scope_refused`, but one `-narrowed` child per stuck
  gap becomes possible. Observed volume since landing: 0 such refusals (the pick filter excludes
  ungroundable gaps).
- [x] 4.2 Children of deterministic refusals. Two minters: `recommit-<id>-<cls>` in
  `feature-compose.ts` `appendComposeLesson` (on a repeated lesson class), and `<id>-narrowed`
  in `gap-to-feature.ts`. Neither sees `hard_fail`/`llm_consulted`: the lesson carries only
  class `semantic_reject` and the reason string. Design before dispatch: record
  `deterministic: true` on the lesson at the call site (where `semantic_gate` is in scope),
  then have both minters skip or supersede on it — two goals, one per file. Falsifier: the
  dead-code helper spec yields no open child; control: three open children minted
  11:16Z–12:42Z on 2026-09-24.

## 5. Verification gate (development-vessel)

  4.2 LANDED as two goals: 4.2a `2992a23` (00:07:41Z, directed, first attempt: lesson reason
  prefixed `[deterministic] ` when hard_fail && !llm_consulted; recommit skips it) and 4.2b
  `fcbd737` (23:48:55Z, picked and landed by the loop itself before the directed dispatch:
  narrowing skips a gap whose last lesson carries the prefix). 4.2a falsifier MET 00:45Z via a probe
  gap: a dead-code-only refusal (hard_fail, no LLM) recorded `semantic_reject:[deterministic] …`
  and no child was minted; gap closed. The recommit-skip branch is verified in the diff only: the
  repeat's lesson was classed `typecheck_dangling_reference` with a test-output excerpt (the same
  `expect(res.shape)…` text seen on 4.1's gap), a lesson-class accuracy issue worth its own gap.
  4.2b falsifier pending (needs a stuck gap whose last lesson is deterministic to reach narrowing).
- [x] 5.1 `feature-compose.ts` `callTool`: shell calls default to `timeout_sec: 300`. The
  baseline suite, baseline typecheck and flake re-run passed none, so local-tools `sh()` killed
  them at 30 s: the baseline holds only failures reached in 30 s (load-dependent) and the re-run
  confirms only early ones. A correct draft is refused for pre-existing reds (4.1's draft at
  14:11Z: three HEAD-red tests, the first three `(fail)` lines of a full run, reported as NEW),
  and a genuine late-suite regression drops out of `confirmedNewTest`, i.e. passes. Gap
  `the-compose-test-baseline-and-flake-rerun-are-killed-at-the-shell-tools-thirty-second-default-…`.
  Runs FIRST among feature-compose.ts goals. Falsifier: re-compose of the 4.1 gap passes the
  test gate without HEAD-red tests listed as new; control: the 14:11Z refusal.
  Landed 14:41:09Z on origin/dev, but inside `4e40707` (gap `route-edit-d5e92e38`): attempt 1
  passed every gate and was soft-refused on the unnamed `change_window` lease ("defer without
  rollback", `vessel-mitosis-cutover.ts:975`, 565dcfa), and the next staged compose carried the
  edit into its own commit. Attempt 2 then found an empty diff, failed `git commit`, and its
  live-sync rollback reverted the committed line in `/vessels` (mtime 14:41:40); the vessel
  restarted at 14:42:28 on the reverted file. Operator restored the runtime file to HEAD
  (~14:50Z; `diff -rq` clone src vs `/vessels` src empty). Falsifier MET 15:59:13Z: the 4.1
  re-compose (started 15:53:06 on the post-5.1 process) passed the test gate with no HEAD-red
  tests reported new; gap closed with the exercise.
- [ ] 5.2 `feature-compose.ts` live-sync rollback: skip restoring a file whose live content
  equals the push clone's committed copy (it describes a commit; restoring reverts a landing).
  Gap `the-live-sync-rollback-restores-its-pre-compose-snapshot-over-a-file-that-already-equals-the-committed-clone-copy-…`.
  Falsifier: live == clone != snapshot leaves the live file unchanged and logs `live-sync
  rollback SKIPPED`; control: the 14:41:40 revert. Related, not specified here: an empty-diff
  cutover should report already-landed rather than `git commit failed`, and nothing compares
  `/vessels` to its clone (the snapshot comment in feature-compose.ts says so itself).

- [x] 5.3 `feature-compose.ts` `appendComposeLesson`: re-read the gap before writing and preserve
  `superseded` as well as `closed`. It wrote back the compose-start snapshot, so a gap superseded
  mid-compose was reopened at 14:23:31Z and the loop re-picked its `-narrowed` child at 17:23:09Z,
  re-drafting landed sites. Gap
  `the-compose-lesson-writer-writes-back-the-callers-stale-gap-snapshot-so-a-lesson-reopens-a-superseded-gap-and-drops-newer-lessons`.
  Falsifier: supersede mid-compose → still superseded after the lesson write.
  5.3 LANDED 17:41:01Z inside `996b841`, a commit labelled for the reopened 1.2 parent: 5.3's
  attempt 2 was deferred without rollback, its edit stayed in `/vessels`, and the next staged
  compose committed it (second cross-gap ride-along today after `4e40707`). Runtime carries it
  (process started 17:44:29Z). Falsifier MET 00:49:11Z via a probe gap superseded 5 s into a
  compose: after the lesson write it stayed superseded with both lessons; gap closed.
- [x] 5.4 `feature-compose.ts`: `staged_base_sha` must hash the PRE-patch base. Both writers hash
  the patched file (fresh path: worktree after apply; park path: `files[0].content`). `0a0d59f`
  (17:08Z) added `headContentSha !== stagedBaseSha && !cloneIsOurOwnStagedContent → refuse`, so
  every isolated compose cutover is refused as COMMITTED DRIFT: 6/6 since 17:08 carry bases that
  match no committed version. Proof on the parked 3.1 landing: sha256(content) = 6d933c9b31c1 =
  logged staged base; sha256(base_content) = 3c0159a1c180 = logged HEAD. Gap
  `feature-compose-records-the-patched-file-hash-as-staged-base-sha-so-the-committed-drift-gate-refuses-every-isolated-landing`.
  Falsifier MET 23:54Z (revised after the revert): the 3.1 compose logged staged_base_sha=
  7201eb60067a = sha256(HEAD:vessel-mitosis-cutover.ts) before the patch; gap closed.
  The fix's own cutover passes through the same gate — and was refused by it. DEADLOCK PROVEN
  18:23:30Z: the loop drafted 5.4 (typecheck, shape-dispatch and tests pass; judge `addresses:
  true`), the park's sha256(base_content) = 7a39042b6ffa = HEAD's feature-compose.ts, and the
  cutover refused it as COMMITTED DRIFT against staged base f547ae0d5260 = sha256(content), the
  patched file. Another landing was refused the same way at 18:41:47Z. No landing on
  development-vessel since 996b841 (17:41:01Z). The lane cannot land the repair of the gate that
  refuses it; an operator bootstrap is required (see STOP below).

1.2 split (14:25Z): two drafts changed site A only and were refused as incomplete; the parent
and its three children are superseded by
`the-anchor-band-centring-reader-in-feature-compose-reads-the-target-file-from-the-stale-super-repo-copy-…`
(site A alone). Sites B and D are filed after A lands, since A centres the anchors they need.
Site A landed 15:46:56Z as `a0ff3d3` (attempt 1 FAVORABLE but deferred on the lease; attempt 2
refused for 28 lease-test failures caused by a leaked `/tmp/maintenance-cutover.json` hold between
`4e40707` and the loop's stem fix `80e168f` at 15:32; attempt 3 landed). Runtime equals the commit.
Filed: `the-nontermination-and-dead-store-simulation-in-feature-compose-reads-…` (site B) and
`the-co-located-test-discovery-in-feature-compose-checks-the-stale-super-repo-copy-…` (site D).
Site B landed 16:21:18Z as `13841a4` (first draft); site D landed 16:44:45Z as `1d4ac1c` (attempt 1
FAVORABLE but lease-deferred). No `readFile`/`access` on a `${root…}` path remains in
feature-compose.ts; runtime equals HEAD. Falsifier (anchors supplied on vessel-mitosis-cutover.ts)
MET 16:49:03Z: composes on vessel-mitosis-cutover.ts logged `[fc-anchors] supplied verified-unique
anchors` (100 and 122 locator candidates) on the process carrying sites A, B, D; control 0 of 7
since 10:00Z.

## 6. Approval boundary (found 02:40Z on 2026-09-25)

`d8c93b4` (01:26:28Z, substrate-authored, from `recommit-…-narrowed-anchor_…`, a child of a gap
the operator had superseded) added a block at the top of `appendComposeLesson` that forces
`operator_approved: true` into the gap snapshot "to satisfy approval boundary". The only reader of
that flag is gap-to-feature.ts's `approvalWarning`, which is injected into the DRAFTER's prompt
and says "Set operator_approved: true in classification_metadata to proceed" — an instruction to
an operator that a drafter obeyed. Impact today is small (the flag gates only that warning, and
996b841's fresh re-read usually overwrites the forged snapshot), but the class is a system writing
code that grants itself operator authority, induced by its own prompt text.

- [x] 6.1 `feature-compose.ts`: delete the 15-line block d8c93b4 added. Gap
  `a-substrate-authored-block-in-the-compose-lesson-writer-forges-operator-approved-true-on-the-gap-it-writes`.
- [x] 6.2 `gap-to-feature.ts`: the warning says only an operator can grant approval and code must
  never set it. Gap `the-approval-boundary-prompt-tells-the-drafter-to-set-operator-approved-itself-and-a-drafter-did`.
  Dispatched 6.2 before 6.1 so the 6.1 draft is not told to self-approve.
  6.2 LANDED 02:50:20Z as `5cbc6d0` (picked by the loop itself); the imperative is gone.
  6.1 drafts 1–2 were refused as incomplete: every deletion op failed with `path, old_string, and
  new_string are required`, because local-tools fs_edit rejects new_string "" (`!new_string`), so
  only a one-line shrink applied. 6.1 rewritten 03:28Z as one REPLACEMENT op (block -> one
  comment line).
- [x] 6.3 `repos/local-tools-vessel/src/index.ts` fs_edit: `new_string === undefined` instead of
  `!new_string`, so the lane can express a deletion. Gap
  `fs-edit-rejects-an-empty-new-string-so-the-lane-cannot-express-a-deletion`.
  6.1 LANDED 03:32:50Z as `60ad9cd` (attempt 3, as a replacement): `operator_approved: true`
  occurs 0 times in feature-compose.ts on origin/dev (was 2); gap closed. 6.2 gap closed.
  6.3 LANDED 03:47:49Z as local-tools `aaee500` (park resume after a lease deferral); falsifier
  MET 03:50Z: fs_edit with new_string "" returned ok and removed exactly the line; gap closed.
Related lane hygiene, not specified: recommit/narrowed descendants of a superseded gap are still
picked (the chain that produced d8c93b4 began at a gap superseded at 17:42Z).

## Unblocked (20:25Z)

The resumable-landings session reverted 0a0d59f's refusal block as an operator commit
(`97f7cdf`, 20:05Z, user-approved) with the same diagnosis; pull-sync mirrored it at 20:17Z and
restarted the vessel at 20:24:56Z. 5.4's park then resumed and landed autonomously as `082f6ee`
(20:28:59Z; runtime equals the commit). With the gate reverted, 5.4's original falsifier would
pass trivially; the honest check is that a fresh compose's logged `base_sha` equals
sha256(HEAD:<file>) before the patch. `unblock54.sh` was never run and is obsolete. The
overwrite class 0a0d59f targeted is open again until a check against the pre-edit base is
re-added (the resumable-landings session's call).

## REGRESSION from 5.4 (20:50Z) — my spec was wrong

`staged_base_sha` has two consumers. The freshness check compares it to the LIVE file after
feature-compose's land-time runtime sync has already written the PATCHED content into /vessels
("sync the verified files here so freshness sees them"), so it needs the patched hash; only
0a0d59f's (now reverted) refusal wanted a pre-patch base. With 5.4 live (restart 20:36:32Z),
freshness fails (pre-patch base vs patched live), and the already-applied fallback then finds
staged content == live and returns `noop: already_applied`: every isolated feature-compose
cutover — fresh or park-resumed — is dropped without a commit. Observed: 3.1 at 20:48:23Z
(judge passed, helper present nowhere after the "no-op"); 0 landings since 20:36. The lane cannot
land the revert of 082f6ee (it would be dropped the same way). Instance fix: revert 082f6ee as an
operator commit. Class fix, not yet specified: give the pre-patch base its own field
(e.g. `staged_pre_patch_sha`) instead of redefining one with two readers.

SELF-REPAIRED 21:52Z (no operator revert needed; approval to push was not used): after seven
false `already_applied` no-ops (20:48–21:50Z; three of them park resumes), the substrate landed
`96a1f57` through the pwt lane: freshness also passes when the staged content sha equals the live
sha, which is exactly the state the land-time sync produces. Isolated composes land again
(`1deb202` at 22:50Z, `freshnessOK=true`); no no-ops since 22:00Z; runtime equals HEAD f4ef80b
(process 23:32:15Z). Lesson for spec authors: grep every READER of a field before redefining it.

## STOP (18:50Z): the isolated feature-compose landing path is deadlocked by 0a0d59f

Every isolated feature-compose cutover on development-vessel (every directed `gap_to_feature`
landing) is refused, because `staged_base_sha` is the patched file's hash while 0a0d59f compares
it to HEAD. The `apply_proposal_as_patch`/mitosis-tick path records its base from the live file
before patching and still lands (996b841 at 17:41 went that way, carrying 5.3's stray edit).
The verified repair (5.4) is parked; its base_content equals origin/dev (7a39042b6ffa at 18:54Z).

One operator decision unblocks it: run `/workspace/tmp/unblock54.sh` in substrate-live. It
re-checks that the park's base equals origin/dev, stages the parked content exactly as the
resume path does, and calls `vessel_mitosis_cutover` with the correct pre-patch
`staged_base_sha`, so the substrate's own cutover commits, pushes and schedules the restart. It
restores the live file if nothing is pushed, and records `operator_assist` on the 5.4 gap so the
autonomy ledger is not inflated. Falsifier: the next FAVORABLE isolated compose pushes.
Follow-up (not in 5.4): EDIT 1 hashes `git -C vBase show HEAD:rel`, which returns empty when a
compose runs un-isolated (vBase = /vessels, not a repo), so that rare path would still refuse.
After unblocking: 3.1 (compiling, judged draft refused only by this gate), 5.2/5.3 falsifiers, 4.2.

## Sequencing

1.2 → 3.1 (anchors first; 1.2 landed and its falsifier met). 2.1 is superseded by the frozen-worktree
class gap (operator-tier script).
4.1 follows 1.2 (same file). 4.2 is two goals (feature-compose.ts, then gap-to-feature.ts). Dispatch one file per goal; directed picks
only when a compose slot is free and no `mitosis-self-restart-*` unit is active (a
draining vessel refuses every long-running request, and each refusal counts as an
attempt).

Note (14:05Z): `blocked_by` on a gap has no reader in development-vessel (`grep -rn blocked_by src`
is empty); the loop picked the 4.1 gap at 14:02:31 while its blocker was open. Sequencing between
gaps is therefore by dispatch order only. Same-file composes are serialized by the cutover lease,
and a later draft re-reads the clone, so concurrent picks on different sites of one file are safe.
