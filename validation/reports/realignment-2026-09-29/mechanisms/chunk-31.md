# Mechanisms chunk 31: local-tools-vessel

Input: `classes/_mech_chunks/31.json` (15 items). Checked on 2026-09-29 at about 05:20 UTC against the live clone
`/workspace/git/vessels/local-tools-vessel` in `substrate-live`. The clone's HEAD is `85b4c01` (09-28 10:06,
substrate-authored). `/vessels/local-tools-vessel/src/index.ts` is byte-identical to the clone, and the unit is
`active`. Other sources: 72 h of `journalctl -u local-tools-vessel` (15,706 non-gc lines), 7 d of
`journalctl -u development-vessel`, the live gap store (`/workspace/git/super-repo/gaps/gaps.json`), the dev-vessel
clone, and the raw notes `live-resolvers.md`, `node2-runtime.md`, `syzygy.md`, `git-small.md`, `memory-8.md` and
`transcripts-4.md`.

The vessel is small: `src/index.ts` has 777 lines, plus `test-exec-slots.ts` at 192. Every mechanism in this chunk
lives in one of those two files, except items 5 and 15 (see the corrections).

## Corrections to the collector records

- **Item 5, "failing-test measured gaps"** is not a local-tools mechanism. The `requested_not_passing` field is
  produced in `development-vessel/src/resolvers/test-suite.ts:221`, which also files the gaps. It belongs in the
  development-vessel chunk. It is judged here only because its live instance points at this vessel (see F1).
- **Item 6, "fs_write primitive: broken"** is out of date. Both defects in the record were fixed and pinned:
  - The relative-path defect was fixed by `mapPath`'s workspace anchoring (08-09), pinned by `7a38f37`.
  - The whole-file fragment replace was fixed by the truncation guard `67a9e71` (08-02).
  - The primitive now works and is guarded. The open defect is that there are two producers (see M3).
- **Item 14, "governor symbol name not found"** is refuted. The symbols are `acquireTestSlotOrWait` and
  `isTestClassCommand` in `test-exec-slots.ts`. They are imported at `index.ts:17` and used at `:180` (`sh`) and
  `:361` (`bounded_shell`). They landed in `44c2b21` (08-30).

## Dedupe: 15 items reduce to 8 mechanisms

| Canonical mechanism | Chunk items merged |
|---|---|
| **M1** shell executor `sh()` / `shell` resolver (`index.ts:~160-206`) | 2 satisfier shellResult universal executor, 11 boundedShellResolver (second spawn site) |
| **M2** process bounding: `groupBounded` + `__killtree` + MAX_TIMEOUT_SEC + test-exec slot governor | 10 groupBounded/setsid, 13 groupBounded+killtree+governor+caller timeout, 14 __killtree+test-exec governor |
| **M3** fs write/edit primitives with guards (`fsWrite :224`, `fsEdit :258`) | 3 catastrophic truncation refusal, 6 fs_write primitive, 9 fs_edit/fs_write guards, 12 local-tools write guards |
| **M4** `mapPath` (`index.ts:31`) | 8 |
| **M5** line-range edit: `code_replace_lines` (local-tools) + feature-compose `replace_lines` op | 1 |
| **M6** SUBSTRATE_EXECUTION_ID threading (`shell :206`, `bounded_shell :364`, `gitCommit :387`) | 4 |
| **M7** id-less request instrumentation (`index.ts:205`, `:363`) | 7 |
| **M8** local-tools on the syzygy inventory spoke | 15 |
| (F1) failing-test measured gaps (dev-vessel) | 5, judged for its local-tools instance only |

## Verdicts

| # | Mechanism | Verdict | Used now | Live evidence (09-29) |
|---|---|---|---|---|
| M1 | Shell executor `sh()` / `shell`, `bash`, `shellResult` | **keep-general** | yes | This is the tool plane of the ReAct floor. Traffic in 72 h: at least 15,063 shell requests, counted from the id-less log lines, which cover nearly all of it (see M6). `live-resolvers.md`: `shellResult` 11,505/7,104. The biggest caller is a dev-vessel `ROOT="/workspace/git/vessels/development-vessel"...` scan (5,153). Next are `find`/`ls` over `/workspace/git/super-repo/Substrate/Projects` (≈1,500) and per-vessel `grep -rnE export…` scans. Earlier defects were CWD/env facts and the 30 s timeout `6fb9282` (memory-3). The 09-28 post-land-suite death was that timeout on the caller side (memory index 09-28). |
| M1b | `boundedShellResolver` (`bounded_shell`, `index.ts:346`) | **merge-into** M1 (`sh()`) | no (0 id-less `bounded_shell` lines in 72 h) | This is a second spawn site. Every fix to shell execution has had to be applied here as well, which is the principle "every fix applied twice": `4d0c600` (08-31, groupbounded-fix-not-propagated-to-sibling), the slot governor copy (`:357-361`), id threading, and `11636e6` (09-25, cwd default). It differs from `sh()` in three ways: it reads `timeout` from the body root only, defaults to 10 s, and defaults cwd to `/workspace/tmp/bounded-shell`. Keep the `bounded_shell` and `boundedShellResult` shape names as aliases, but implement them as `sh(command, cwd ?? tmpdir, timeout)`. That leaves one spawn site. |
| M2 | Process bounding: `groupBounded`/`__killtree` (`index.ts:121-137`), MAX_TIMEOUT_SEC=900 (`:167`), slot governor (`test-exec-slots.ts`) | **keep-general** | yes | Every M1 call goes through it (`:183`). Pinned by `group-bounded.test.ts` and `test-exec-slots.test.ts`. The history covers the 08-30 escaped-descendant defect, `44c2b21` (governor), `81c8f57` (setpgid theory refuted) and `4d0c600` (kill -0 guard, substrate-authored, FAVORABLE). |
| M2b | dev-vessel `process-group.ts` `groupLeaderArgv`/`killProcessGroup` (setsid) | **duplicate-of** M2 (lesson re-learned at a second site; `0fd7487`) | yes (only in `vessel-mitosis-evaluate.ts:15,259`) | Two implementations of the same rule, "kill the whole tree on timeout". The setsid form is the stronger mechanism and the killtree form is the more portable one. Merge target: one exported helper in a shared package (`packages/` or `ias-executor-ts`) that both vessels import. The next process-bounding fix would otherwise be applied twice, the M1b class again. |
| M3 | fs_write/fs_edit primitives and guards: truncation refusal (`:238-250`, `67a9e71`), empty-anchor refusal, identity-edit refusal, unicode-normalized unique fallback, `$`-safe replacer (`85b4c01`, 09-28) | **keep-general** | yes | The guard is live and firing: **27 `fs_write refused` in 72 h**, the last at 09-29 02:18. **24 of the 27 are the same write**: `/vessels/discovery-vessel/src/registry.ts 25829→41`. The other 3 are `gap-to-feature.ts 338905→41`. The guard stops the damage, but the 41-byte placeholder writer retries the same refused write for the same reason (the principle "same issue recurring for the same reason"). A refusal is not fed back to the caller as a verdict. That caller is the finding to file, not the guard. `fs_write` traffic is 18,987 (live-resolvers). |
| M3b | Second producer of `fs_read/fs_write/fs_edit/fileWriteResult/git_*`: dev-vessel `resolvers/fs-write.ts`, `fs-edit.ts` (`routes/impulses.ts:281,287`, `config.ts:106-108`) | **duplicate-of** M3 | yes | One of the 29 multi-owner shapes on the hub (live-resolvers:193). `fs-write.ts:59` carries its own copy of the truncation guard, with the comment "A TRUNCATION GUARD MUST LIVE WITH EVERY PRODUCER". It also has an allowlist that local-tools lacks. That allowlist is where the `fs_edit` "path outside workspace root" failures come from (161 in 5 d; live-resolvers:118,174). The same verb has two roots and two guard sets, and discovery picks between them. Pick one owner. local-tools is the tool vessel and the placement law 11 favours. Make the dev-vessel cases thin delegations, the way `http_response` → `web_resource` was done in chunk 05. |
| M4 | `mapPath` (`index.ts:31`): `repos/` → `/vessels`, bare path → `WORKSPACE_ROOT` | **keep-general**, **merge** siblings into it | yes (all fs/code resolvers, `:211-612`) | `2aaa834`, `44375c6`, `7a38f37`. Its comment records the 08-09 confabulation caused by ENOENT starvation. There are three path resolvers for one question ("which file does this path name?"): this one, `analysis-vessel/src/resolve-file-path.ts` (present) and dev-vessel `resolveInAnyWorkspace` (`fs-write.ts:52`). Their roots disagree, which is the root split behind memory 09-22 and the 161 "outside workspace root" failures. Put one exported resolver in `packages/`, and make discovery or a `pathResolution` shape the place that says where roots are. |
| F1 | Failing-test gap `failing-test-local-tools-vessel-src-map-path-test-ts` (+ `-narrowed` 04:00, `-step-1` 05:20; all open since 09-28, edit_site `repos/local-tools-vessel/src/index.ts`) | **broken** (misdiagnosed gap) | yes | I reproduced it read-only (`bun test src/map-path.test.ts` in the clone): **0 pass, 1 error `EADDRINUSE` port 8230**. `map-path.test.ts:19` imports `./index`, and importing that module starts the `VesselDaemon` (`index.ts:747`). Inside the live container the port is taken, so the suite fails before any assertion runs. `mapPath` is not at fault. The gap aims the drafter at `index.ts`'s path logic. It has already spawned a verbatim `-narrowed` duplicate and a decomposition step, which are the narrowing-duplicates class. `group-bounded.test.ts:23` has the same import side-effect. The fix is in the test harness: move the daemon start behind `import.meta.main`, or move the pure helpers into a module without side effects. The dev-vessel `test_suite` producer should also classify "unhandled error between tests / EADDRINUSE" as an environment failure, not `requested_not_passing` (see chunk for development-vessel). |
| M5 | Line-range edit: local-tools `code_replace_lines`/`code_read_lines` (`:612`, registered `:697`) + feature-compose `replace_lines` op (`feature-compose.ts:353,2700,2712`, `c86451f` 08-25) | **keep-general** (two layers, not duplicates) | yes | The dev-vessel journal has 93 `replace_lines` lines in 7 d. Examples: `[fc-repair] replace_lines applied src/routes/impulses.ts:361-361 (system-derived anchor)` on 09-28 22:31, and patch-with-tools `turn 6 code_replace_lines -> OK … /vessels/boredom-vessel/src/index.ts:3925-3938` on 09-29 04:35. The two are different layers. The compose op is a declarative plan item with `expect_first_line`/`expect_last_line` guards. The local-tools primitive is an interactive tool. Keep both. The compose op should apply through the primitive rather than write bytes itself, which would be the M3b rule again. |
| M6 | SUBSTRATE_EXECUTION_ID threading | **keep-general**, **broken in effect** on the shell path | partly | It is in place at `:206`, `:364` and `:387`. The git-commit path is attributed (`3ae3fe8`, the causal ledger accepted 3×10/10 on 09-26). But **15,063 of the shell requests in 72 h arrived WITHOUT execution_id**. By pointer keys: `[type,timeout_sec,command,cwd]` 6,120, `[type,command,cwd]` 5,171, `[type,command]` 3,460. `node2-runtime.md:92` has 2545/2545 id-less on node 2, including mitosis staging copies. The dispatch-id chain was fixed one hop at a time (transcripts-4 C8: 7+ commits `6b4da46`…`ca4f8a5`, `959519e` enterWith), and the shell hop is still open. The general fix is in the caller seam: the resolve envelope should carry `execution_id` by default, in `ias-executor-ts` resolve dispatch, rather than each caller adding it one site at a time. |
| M7 | Id-less request instrumentation (`index.ts:205,363`) | **keep-specific** (downgrade to a counter) | yes | It did its job: it named the `[type,command]` sender that led to `1b98343` (reports-2). It is now the largest log producer on the vessel, at 15,063 of 15,706 non-gc lines in 72 h. The signal it carries is a rate (M6). Replace the per-call line with a per-caller counter emitted as an impulse, or sample 1 in 100, so the id-less rate becomes something the gap detector can read. At present it is journal-only and has no runtime reader. |
| M8 | local-tools on `syzygy-local-inventory` | **fossil** | no | `syzygy.md:31-34,58,68`: a proof fixture for "explicit inventory + idempotence" that was never torn down. Its goal-host had 0 dispatches in 6.4 d. It still advertises `shell`, `fs_write` and `gitCommitResult` to the production hub, with the last hub-register at 09-29 04:22. That is a write-capable tool producer on a laptop, selectable by discovery. It duplicates `local-tools-vessel@syzygy-hub`. Tear down the inventory container, or mask the unit (`DISABLED_VESSELS`). Record the proof result in `docs/archive/fossils/syzygy-inventory-proof.md`. |

## How the kept ones stay discoverable

- **M1, M2, M3, M5, M6** are already discoverable. They are registered through `VesselDaemon` (`index.ts:720-745`,
  `systemVessel: true`) under both the output shapes (`shellResult`, `fileWriteResult`, `codeReplaceResult`…) and
  the tool-name aliases (`shell`, `fs_write`, `code_replace_lines`…).
  - Discoverability is not the gap here. **Single ownership** is (M3b, M4).
  - 8 of 34 local-tools shapes had no traced output in 30 d, mostly `code_*` helpers and `web_search`
    (live-resolvers:195). `code_replace_lines`/`code_read_lines` are used, but inside patch-with-tools, where the
    journal records them and the trace does not. That explains why they read as unseen.
- **M4 and M2** should become shared package exports (`packages/` or `ias-executor-ts`) that local-tools,
  dev-vessel, analysis-vessel and mitosis import. With one implementation, the next fix to either rule does not
  have to be repeated at several sites.
- **M7** becomes discoverable only after it is turned into a shaped counter, for example
  `toolCallAttribution{caller, with_id, without_id}`. A journal line has no reader.

## Recurring-for-the-same-reason findings from this chunk

1. **Fix applied at N sites.** This happened with shell spawn (M1b, 4 duplicated fixes), process bounding (M2b),
   the fs guards (M3b, "must live with every producer") and path resolution (M4 ×3). Each time, the class repair is
   a single owner, not another copy.
2. **A guard refuses, and the caller repeats.** There were 24 identical refused writes to `registry.ts` (M3). A
   refusal has to go back to the caller as a verdict with the reason, like the failure store of 09-22. Otherwise
   the guard has to catch the same write again.
3. **A test-harness failure is filed as a code defect.** F1 is an import side-effect (`EADDRINUSE`), and it was
   filed against `mapPath`. It then spawned duplicates. The `test_suite` classifier should separate an
   environment error from an assertion failure before it files anything.
4. **One hop at a time.** Execution-id propagation (M6) was fixed hop by hop over ≥8 commits, and the shell hop is
   still 100% id-less on both nodes.

## Archive targets

- M8: `docs/archive/fossils/syzygy-inventory-proof.md`, with the container name, the date it was created (09-22),
  and the 0-dispatch finding.
- M1b: no archive. It collapses into an alias, and history is in `git log` (`c709850`, `4d0c600`, `11636e6`).
- M2b and M3b: no archive. They are merges, and the losing implementation's comments are carried into the shared
  helper.
