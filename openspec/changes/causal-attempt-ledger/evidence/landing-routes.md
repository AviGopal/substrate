# Landing routes: every code path that can create a git commit or push

Read-only research, 2026-09-22. Super-repo `/home/avi/documents/work/substrate` (host), container
`substrate-live`. Line numbers are from the host `repos/*` checkout on `dev`. The running copy is
`/vessels/<v>`, which can differ by a few lines (for example `regressed_by` sits at 1841 on the host
and 1851 in `/vessels`).

Method notes:
- Some sources contain raw NUL bytes, and plain `rg` skips files it thinks are binary. So every
  source sweep was re-run with `rg -a`.
  `rg -a -l -P '\x00' repos/*/src` finds 7 such files (activity-api execution-traces.ts, impulses.ts,
  posterior-aggregator.ts, cluster-posterior.ts; development-vessel schema-assert-drift-scan.ts,
  dead-end-decision-scan.ts, operator-review-patch.ts). None of them contains a commit or push call.
- The container has no `rg`, so container sweeps used `grep -raI`.

## Summary

There are **two live families of landing routes, plus one off-box route**:

1. **The gated route (R1, vessel_mitosis_cutover).** This is the only in-code path that writes a
   provenance trailer. All 682 `substrate-authored: apply … via mitosis cutover` commits of the last 30 days (391+106+97+50+17+8+4+3+3+2+1, by repo) come
   from it.
2. **Ungated, arbitrary-command routes (R2–R4)**: the local-tools `shell`/`bash` resolver, the
   `git_commit`/`git_push` resolvers in development-vessel and local-tools, and the auto-bridge
   templates built on them. An LLM (universal_tool_fallback, or a walk) can call these with any
   cwd and any message.
   - **Every "UNLOCATED" commit came from this family**, including `4e4170a8`, `7dcea685` and the
     09-19 crash-loop commit `84cd2f2`.
   - The goal that drives them is hard-coded in
     `repos/development-vessel/src/resolvers/rhythm-conductor-tick.ts:126` (the `self-maintenance`
     family). The substrate itself authored that line in `a44dc58`.
3. **Off-box route (R6)**: the GitHub Actions `bump-submodules.yml` workflow (`substrate-bot`).

No route records the **originating dispatch or execution_id** in the commit itself.
- R1 records gap, proposal and mitosis ids in the commit body. It also POSTs a *separate*
  landing execution that carries new_git_sha, and stamps `pending_outcome_verification` on the gap.
- R2–R5 record nothing.

## Route table

The **Links commit ↔ execution/gap?** column says what each route records today.

| # | Route | Commit/push call (file:line) | Repos it can write | Trigger | Identity | Links commit ↔ execution/gap? |
|---|---|---|---|---|---|---|
| R1 | **vessel_mitosis_cutover → runGitAwareCutover** (gated lane). Callers: `feature-compose.ts:6298` (route-edit / gap compose), `patch-with-tools.ts:200` (pwt escalation), the `mitosis-tick` seed template step `conditional_cutover` (`src/seed/mitosis-tick.ts:256`), which lands what `apply-proposal-as-patch.ts` stages into `/workspace/mitosis-pending.json` (also used by `doc-drift-fix.ts:254`), and any direct `vessel_mitosis_cutover` impulse (`src/routes/impulses.ts:622`) | `development-vessel/src/resolvers/vessel-mitosis-cutover.ts:2236` `runGit(gitCmd, ["commit","-m",msg], hostRepoRoot)`; push at `:2296` `["push","origin","dev"]`, which retries with `fetch` + `rebase origin/dev` (new SHA) | `hostRepoRoot` = `MITOSIS_PUSH_CLONE_DIR/<vessel>` = `/workspace/git/vessels/<v>` when `MITOSIS_DIRECT_PUSH=1` (`:857`). Only vessels that have a push clone, i.e. the 18 submodules. Branch is hard-coded `dev`. | gap-to-feature pick → feature_compose; goal-host edit-intent (route-edit-*); pwt escalation; mitosis-tick; doc_drift_fix (only when `docFixPolicy.autoland` or `DOC_FIX_AUTOLAND=1`, `doc-drift-fix.ts:179-182`) | Whatever git config applies in the clone. `runGit` (`:165`) sets no identity. System: `Substrate Autonomous <substrate-autonomous@substrate.local>`. The `development-vessel` clone has a local override `@metabob.com`. | **Partial.** Message (`:2229-2235`) has `Gap:`, `Proposal:`, `Mitosis:`, `Base SHA`. No execution_id or dispatch id. For route-edit, gap = `route-edit-<goal_hash>` (a goal hash, not a dispatch). Refuses `unknown-gap` unless `adhoc` (`:2226-2227`), but feature_compose passes `adhoc-spec` (`feature-compose.ts:6319`), which gets past the check. After a push it stamps `pending_outcome_verification=<sha>` on the gap (`:2854` gate, `:2904` write). It POSTs a new landing execution with `gap_id/proposal_id/new_git_sha/route/linked_to_gap` (`emitLandingTrace` `:443`, called `:2971`, `:3101`) that is **not linked to the caller's execution**, with `cited_trace_ids: []`. Appends to `/workspace/mitosis-applied.jsonl` (`:2926`), whose last line is dated 2026-07-23, so it is effectively dead. gap-to-feature separately stamps `pending_outcome_verification` (`gap-to-feature.ts:2145`, `:2166`, `markPendingVerification` `:2529-2560`). |
| R2 | **local-tools `shell` / `bash` / `shellResult` / `bounded_shell`**: arbitrary `bash -c` | `local-tools-vessel/src/index.ts:182` (`sh()`), handler `:198`; `bounded_shell` `:360`. No read-only or git gate. | **Any** repo in the container: `/workspace/git/super-repo` and its submodule checkouts `/workspace/git/super-repo/repos/<v>`, `/workspace/git/vessels/<v>`, any branch or remote. The PAT credential helper is system-wide, so pushes authenticate. | (a) goal-host universal_tool_fallback exposes `shellResult` to the LLM (`goal-host-vessel/src/index.ts:4219`; `ufExecuteTool` `:4278` checks only the tool name). The read-only gate `isReadOnlyShellCommand` is applied only to the recompute/verifier path (`:4480`, `:4523`). (b) Any walk step or DB template with `resolver: 'bash'`. (c) The driving goal is `rhythm-conductor-tick.ts:126` `"self-maintenance": "… run the vessel-code-commit-and-push goal"`. | git config of the cwd. In practice `substrate-autonomous@substrate.local` (system config). | **None.** The subject is LLM-authored free text. The dispatch record (`/workspace/goal-host-dispatches.json`) keeps `answerBody` prose only. |
| R3 | **development-vessel `git_commit` / `git_push` resolvers** | `development-vessel/src/resolvers/git-commit.ts:11` `Bun.spawn(["git","commit","-m",message],{cwd})`; `git-push.ts:28` `git push -u <remote> <branch>`. Routed at `src/routes/impulses.ts:268`, `:564`. | Any cwd. The push **refuses only** branch names `main/dev/master/trunk/release` (`git-push.ts:11`), so `development-vessel`, `feat/*`, `temp-*` and similar are allowed. | Seeded templates `release-change` (`src/seed/release-change.ts:26`; 176 DB copies), `vessel-repo-promote` (`:125/:132`), `publish-substrate-authored-artifact` (`:119/:129`), `scaffold-and-publish-vessel` (`:300/:307`), `forge-vessel-for-shape`; the auto-bridge `activity:⟨auto-bridge-git_push⟩` selected by walks | cwd git config | **None.** Returns `commandResult` / `gitPushResult` only. |
| R4 | **local-tools `git_commit` / `gitCommitResult`** | `local-tools-vessel/src/index.ts:383` `sh("git commit -m …", cwd)`; registered `:669`, `:684`, advertised `:701`, `:712` | Any cwd | Discovery-routed `gitCommitResult` / `git_commit` impulses; walks | cwd git config | **None** |
| R5 | **substrate-pull-sync divergence self-heal**: rebase and push existing substrate-only commits | `scripts/substrate/substrate-pull-sync.sh:486-487` `pull --rebase` + `push -q origin HEAD:$BRANCH` (the container copy `/usr/local/bin/substrate-pull-sync` is byte-identical) | `/workspace/git/vessels/*` (`CLONE_DIR` `:29`). Rewrites SHAs of commits that R1–R4 already made. The super-repo branch refuses (`:1483`). | `substrate-pull-sync.timer`, when a clone diverged and every local-only author/committer is the substrate identity (`:470-478`) | re-commits with the rebaser's config (Substrate Autonomous) | **None.** Logs only. On failure it files the gap `pull-sync-diverged-<v>`. |
| R6 | **GitHub Actions bump-submodules** (off-box) | `.github/workflows/bump-submodules.yml:182-183` `git commit -F` + `git push origin HEAD:dev` | super-repo `dev` (submodule pointers) | cron `0 */6 * * *`, `workflow_dispatch`, called by nightly-dev-build | `substrate-bot <substrate-bot@users.noreply.github.com>` (`:174-175`) | None (N pointer bump) |
| R7 (dormant) | **host-sync intent**: the cutover falls back to `emitHostSyncIntent` (`vessel-mitosis-cutover.ts:313`, `:1849`, `:2358`) → `/workspace/mitosis-applied-host-sync.jsonl` for a host poller to commit over SSH | no consumer found in `scripts/`, `repos/*/src`, `~/.config` | host checkout | auth-failed push, or `MITOSIS_HOST_SYNC_MODE=1` (unset) | host SSH identity | intent row has gap_id/proposal_id. File last modified 2026-09-07. |
| — | Operator hand-landing under the substrate identity | manual | any | operator | author `Substrate Autonomous <substrate@autonomous.local>`, committer DevBob (for example `d42910bc`) | body prose cites dispatch/exec ids |

**R2b: in-process `bash` in goal-host-vessel.** This is a separate file:line that R2 hooks would not cover.
- goal-host-vessel constructs the ias-executor `GoalHost` (`goal-host-vessel/src/index.ts:13867`).
- Its constructor sets `this.proc = new BunProcessAdapter()`
  (`ias-executor-ts/src/hosts/goal-host.ts:547`).
- It registers `makeBashResolver(this.proc)` (`:664`, defined at `:115`) on the attached vessel
  `bun-proc` with resolverIds `["bash"]` (`:651`).
- That resolver runs `task.config.command` (a string[], so `["git","commit",…]` or
  `["bash","-c",…]`) through `adapters/bun-process.ts:13` `Bun.spawn`, inside the goal-host process.
- There is no command gate.
- So a DB template step with `resolver: 'bash'` (for example `detect-vessel-code-drift` `scan_drift`)
  may execute in goal-host rather than local-tools, depending on runtime resolver precedence.
  I did not determine that precedence.
- Identity: git config of the cwd. Linkage: none, beyond the step's own execution trace.
- Commands:
  `rg -n 'makeBashResolver\(|new BunProcess' repos/ias-executor-ts/src/hosts/goal-host.ts`
  → `115`, `547`, `664`.

Also checked, with no results:
- `docker exec substrate-live bash -c 'grep -rnE "git[^#]*\b(commit|push)\b" /etc/systemd /opt'`
  → only `After=`/`Wants=git-push-setup.service` lines in `federation-transport-vessel.service`.
  No unit invokes commit or push.
- `/usr/local/bin/*`: only `substrate-pull-sync` (R5) and the `setup-git-push` echo lines.

Ledger path note: `/etc/substrate/env` has `WORKSPACE_ROOT="/workspace/git/super-repo"`, but the
development-vessel unit overrides it (`systemctl show development-vessel -p Environment` →
`WORKSPACE_ROOT=/workspace`). So the cutover ledger, pending and host-sync paths resolve under
`/workspace`, and the "ledger last written 2026-07-23" claim holds for the live process.

Not routes (checked):
- `ias-executor-ts/src/examples/ship-change-vessel.ts:199` is only an example host.
- `validate-build.{ts,js}:247/250` prints a suggestion string.
- `backend-snapshot-to-git` seed explicitly does no commit (`:61`).
- `goal-host-behavior-scan.ts:127` only classifies.
- `.claude/` and `.githooks/` have no commit or push calls.

## Cross-check: every observed substrate subject maps to a route (last 30 days, `--all`)

Subject patterns by repo and author email:

```
cd /home/avi/documents/work/substrate && for r in . repos/*; do [ -e "$r/.git" ] || continue; n=$(basename $(realpath $r)); git -C "$r" log --all --since='30 days ago' --author='Substrate\|substrate' --format="$n|%ae|%s"; done | sed -E 's/(route-edit|recommit-route-edit)-[0-9a-f]{8}[^ ]*/\1-*/g; s/apply [^ ]+ via mitosis cutover/apply <X> via mitosis cutover/; s/bump [0-9]+ pointer\(s\)/bump N pointer(s)/' | sort | uniq -c | sort -rn
```

```
391 development-vessel|substrate-autonomous@metabob.com|substrate-authored: apply <X> via mitosis cutover   → R1
120 substrate|substrate-bot@users.noreply.github.com|chore(submodules): bump N pointer(s) to latest dev     → R6
106 activity-api|…@substrate.local|substrate-authored: apply <X> via mitosis cutover                      → R1
 97 goal-host-vessel|… mitosis cutover  (+50 dev-vessel @substrate.local, 17 llm-resolver, 8 ias-executor, 4 concept-db, 3 stateful-ui, 3 light-dispatch, 2 boredom, 1 local-tools) → R1
  5 substrate|…|Automated commit: updated submodule <v>                                                 → R2
  2 substrate|…|Automated commit: vessel code drift detected and committed.                             → R2
  2 substrate|…|Automated commit by substrate for code drift                                            → R2
  … 30 more one-off free-text subjects (vessel-code-commit-and-push*, Auto-commit: code drift for *,
    Vessel code commit/update, Merge origin/dev into development-vessel…, Stash local changes…,
    feat: Update boredom-vessel content, Add generated files, Add bun.lock file, …)              → R2 (R3 possible)
  1 substrate|substrate@autonomous.local|fix(relevance-sink): …                                        → operator hand-landing
```

Author identities in use:
`git log --all --since='30 days ago' --format='repo|%an|%ae' | sort | uniq -c`.
- `Substrate Autonomous <substrate-autonomous@metabob.com>` (development-vessel clone local config)
- `Substrate Autonomous <substrate-autonomous@substrate.local>` (system)
- `substrate-bot` (Actions)
- `Substrate Autonomous <substrate@autonomous.local>` (1, operator)

Config source:
`docker exec substrate-live git -C /workspace/git/vessels/development-vessel config user.email`
→ `substrate-autonomous@metabob.com`; `git config --system user.email` →
`substrate-autonomous@substrate.local`.

**The ad-hoc (R2) commits were made in the in-container super-repo checkout and its submodule
checkouts, not in the push clones.** That checkout is meant to be a read-only oracle source.
- `docker exec substrate-live git -C /workspace/git/super-repo/repos/boredom-vessel reflog --date=iso | grep 84cd2f2`
  → `84cd2f2 HEAD@{2026-09-19 21:11:40}: commit: feat: Update boredom-vessel content`
- The same burst in other submodule checkouts:
  - libp2p `542e712` at 21:11:58
  - identity `4b335ea` at 21:12:13
  - activity-api `7ffc375` at 21:12:16, pushed to `origin/feat/activity-api-gitignore`
  - stateful-ui `59646d1` at 21:12:19, on `origin/main`
- The push clone only shows `reset`/`pull` for 84cd2f2
  (`git -C /workspace/git/vessels/boredom-vessel reflog | grep 84cd2f2` → `reset: moving to origin/dev`).
- Where these landed: `git branch -r --contains <sha>` shows the ad-hoc commits reached
  **origin/dev** (super-repo 09-07 → 09-19 series, boredom, libp2p, metric-collector),
  **origin/main** (identity, stateful-ui), and **origin/development-vessel**
  (super-repo 09-20 → 09-21 series).

### The two UNLOCATED commits

- `4e4170a8` (super-repo, 2026-09-07 04:20:43Z)
  - Author and committer: `Substrate Autonomous <substrate-autonomous@substrate.local>`.
  - Subject: "Automated commit: vessel code drift detected and committed."
  - It is a `git add -A` of runtime junk: `elements.html` 3270 lines, `neptune_moons.txt`,
    `interactor-log/*.jsonl`, `compose-slots/slot-0.slot`, and so on.
    (`git show --stat 4e4170a8`)
  - The literal string exists in **no code**:
    `docker exec substrate-live grep -raIl "vessel code drift" /usr/local/bin /etc /opt /vessels /workspace --exclude-dir=node_modules --exclude-dir=.git`
    finds only data files (dispatch logs, DB exports, proposals, scenarios).
  - Therefore the message was LLM-authored through R2/R3.
  - The driving goal text is `rhythm-conductor-tick.ts:126`, introduced by substrate commit
    `a44dc58` on 2026-09-06 00:54Z:
    `git -C repos/development-vessel show a44dc58 -- src/resolvers/rhythm-conductor-tick.ts`
    → `+  "self-maintenance": "run the detect-vessel-code-drift scan across /workspace/repos, then for each vessel whose clone is strict and has changes, run the vessel-code-commit-and-push goal"`.
    The first drift commit follows about 27h later.
  - No dispatch or trace row for 09-07 04:20 survives. `grep "Automated commit"` over
    `/workspace/goal-host-dispatches.json`, the precompact DB export and the journal
    (the journal starts 2026-09-22 20:06) finds nothing.
- `7dcea685` (super-repo, **on `origin/development-vessel`, not a submodule**)
  - `git branch -r --contains 7dcea685` → `origin/development-vessel`.
  - Author: Substrate Autonomous @substrate.local, 2026-09-20 18:47:49Z.
  - "Vessel code commit", 221 files, +6475.
  - **Attributed to a dispatch.** `c22ca1c4-9448-4020-abbb-ccc4eaa3fe58`
    - goal `vessel-code-commit-and-push`, `executionId: exec_qn02rllv`,
      template `activity:⟨auto-bridge-git_push⟩`
    - `status: failed`, `reached: false`
    - window 1789930025 → 1789930075, i.e. 2026-09-20 18:47:05 → 18:47:55Z
      (`date -u -d @1789930025`)
    - This dispatch is a child of self-maintenance dispatch `b77421ed-…` (`exec_ngwj2ao3`,
      18:46:25 → 18:47:58Z).
    - The 18:47:49Z commit falls inside both windows.
    - So the route is R3, or R2/R2b, reached by a walk through the git_push auto-bridge.
      **The commit landed on the remote while the dispatch graded `reached:false`.**
    - `git_push` refuses `dev` but not `development-vessel`.

**Direct attribution for a sibling commit:**
- Dispatch `e0d1e496-7d38-47e5-9fa3-77b46cc3e8dc`
  - goal `vessel-code-commit-and-push`
  - `executionPath: universal_tool_fallback`, `reached: true`
  - 2026-09-21 00:23:33 → 00:32:00Z
  - answerBody: "A new file named `test_file.txt` was created, committed to the `development-vessel`
    branch, and then pushed to the remote `origin/development-vessel` branch … Committing the new
    file (along with other unintended changes that were already staged)."
  - This is super-repo commit `8260a854` at 00:31:37Z, "feat: Add test_file.txt for
    vessel-code-commit-and-push".
- Dispatch `cb7afa79-…` (self-maintenance goal, template `activity:⟨auto-bridge-git_push⟩`,
  00:09:04 → 00:28:58Z) covers the burst `72a91cfc…27f9c5da` "Automated commit: updated submodule
  <v>" at 00:11:36 → 00:11:43Z.
- Re-derive with:
  `docker exec substrate-live jq -c '(if type=="array" then .[] else (to_entries[]|.value) end) | select((.goal//"")|test("vessel-code-commit-and-push|detect-vessel-code-drift")) | {id:(.dispatchId//.id),startedAt,endedAt,reached,executionPath,tpl:.selectedTemplateId}' /workspace/goal-host-dispatches.json`.
- The execution traces (`exec_362ftgc3`, `exec_qn02rllv`) could not be fetched. `:18080` returned
  `INVALID_API_KEY` for the `~/.metabob/config.json` key, and a positive control
  (`?limit=1`) failed the same way. The failure is the key, not the ids.

## Incidents

### (1) 54b7762: the SurQL `^DEFINE FIELD` guard deletion

Command:
`for r in . repos/*; do git -C $r cat-file -t 54b7762 2>/dev/null && echo $r; done`
→ `repos/development-vessel commit`

Command:
`git -C repos/development-vessel show --stat --format='%H%nauthor: %an <%ae> %ad%n%B' 54b7762`

```
54b7762d8534ad757ae60a4e01d7bf4eb4f2deff
author: Substrate Autonomous <substrate-autonomous@metabob.com> Wed Sep 16 02:48:28 2026 +0000
substrate-authored: apply route-edit-ee2fa6ac-narrowed-compose-report via mitosis cutover
Gap: route-edit-ee2fa6ac-narrowed
Proposal: route-edit-ee2fa6ac-narrowed-compose-report
Mitosis: development-vessel-fc-2026-09-16T02-47-57-555Z
 src/resolvers/vessel-mitosis-evaluate.ts | 39 ----
```

- Route: R1 (feature_compose → cutover). The `-fc-` mitosis id marks feature_compose.
- On `origin/dev`.
- It deleted 39 lines, all removals. Included:
  - the tail of the `ALTER TABLE … ADD` refusal
  - the `MALFORMED_RE` "DEFINE FIELD names no table" refusal
  - the whole "A DEFINE FIELD THAT DOES NOT PARSE AS ONE IS MALFORMED" block, beginning
    `for (const stmt of splitSurqlStatements(sql)) { if (!/^DEFINE\s+FIELD\b/i.test(stmt)) continue;`
- Command: `git -C repos/development-vessel show 54b7762 | grep -E '^-'`.
- **Confirmed: the `^DEFINE FIELD` guard was deleted.**

### (2) 2026-09-19 unparseable autonomous commit that crash-looped a vessel

- sha **`84cd2f29067401331be0c67e987ca3c33503b716`**
- repo **boredom-vessel**
- author and committer `Substrate Autonomous <substrate-autonomous@substrate.local>`,
  2026-09-19 21:11:40Z
- subject "feat: Update boredom-vessel content", empty body
- 25 files, +4855
- `git branch -r --contains` → `origin/dev`

Command: `git -C repos/boredom-vessel show 84cd2f2:src/index.ts | grep -a -n -B1 'const AUTONOMOUS_GOALS'`

```
361-  "development-vessel:concept-relevance-backfill-v2",
362:const AUTONOMOUS_GOALS: readonly string[] = [
```

- The diff adds line 361 (`git show 84cd2f2 -- src/index.ts | grep -n '^+.*concept-relevance-backfill-v2'`).
- **Route: R2, not R1.** It has no `substrate-authored:` trailer. It was made in the super-repo
  submodule checkout (reflog above), in the same 21:11–21:12 burst as the other free-text
  commits. It never passed the cutover's gates.
- Fixed by R1 commit `36954f2` (2026-09-20 01:21:17Z, `apply route-edit-8f439b8e-compose-report`).
- **Unverified today:** the "1404 restarts / 4h" count comes from the memory note.
  `systemctl show boredom-vessel -p NRestarts` → `NRestarts=0` now, and the journal starts
  2026-09-22 20:06, so the count cannot be re-derived from the live container.

### (3) `regressed_by`: readers only, no writers

Command: `rg -a -n regressed_by repos/*/src --glob '!*.test.ts'`

```
repos/development-vessel/src/resolvers/gap-to-feature.ts:1841: … ['regressed_by'] !== undefined;
repos/development-vessel/src/resolvers/gap-to-feature.ts:1929: … ['regressed_by'] !== undefined;
```

- Both hits are reads (a `behavioralFail` predicate). No test files and nothing under `scripts/` or
  `packages/` mention it.
- The runtime copy has the same two reads at `/vessels/development-vessel/src/resolvers/gap-to-feature.ts:1851`
  and `:1949`.
- **Confirmed: readers only.**
- The gap store nonetheless holds 3 values:
  `grep -a -o '.\{0,20\}regressed_by.\{0,60\}' /workspace/git/super-repo/gaps/gaps.json`
  → `null`, `"bbb83ff"`, `"b5ed109"`.
- So something outside `src` writes them: an operator, or a generic `substrateGap_write` metadata
  merge.

## Implications for an "attempt record on every route" proposal

- Hooking only R1 misses every UNLOCATED commit and the crash-loop commit. **R2 (arbitrary shell)
  is the dominant uncontrolled route.** A per-resolver hook cannot cover it. It needs either a
  git-level hook in every checkout the container can write (for example a system
  `core.hooksPath` post-commit/pre-push hook that requires an attempt id from env or impulse), or
  git writes removed from `shell`.
- R3's protected-branch list omits `development-vessel`, and the rhythm goal at
  `rhythm-conductor-tick.ts:126` keeps generating commit-and-push work.
- Even R1 lacks the caller's execution_id: `cited_trace_ids: []`, and `emitLandingTrace` mints a
  fresh execution.
