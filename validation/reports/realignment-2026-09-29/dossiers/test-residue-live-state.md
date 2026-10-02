# Dossier: test-residue-live-state

**Class key:** `test-residue-live-state`
**Date:** 2026-09-29. Live checks ran 04:56–05:15 UTC and were read-only (file reads, `git log`/`status`, journal greps, read-only SurrealQL).
**Nodes:** node 1 = `substrate-live` (hub, standalone). Node 2 = `compose2-live` (PROFILE=compute).
**Inputs:**
- `classes/test-residue-live-state.json`: 34 attempts, 41 problems (one keyed `concurrent-operator-sessions`), 4 claims.
- Raw notes that mention the class: `gap-history` §4.7 and §5F, `node2-runtime` §6, `critic-2` §2, `git-devvessel-2`, `git-super-2`, `git-deployment`, `transcripts-2`, `transcripts-4`, `openspec-7` §124, `memory-1`, `memory-9`, `live-gaps`, `live-pool-memory`, `memory-adjacent`, `validation-other-3`.
- The records for `reports-2`, `reports-3`, `reports-6`, `reports-7` and `reports-8`.
- `_mech_chunks/19.json` (the isolated verification runner) and `_principles.json` ("Tests must be hermetic by default").
- The live verification in "Current verified state" below.

## One line

Every non-production run can write production state. That covers tests, compose verification suites, probes, batteries, acceptance runs and operator experiments. Nothing sits between "a run that is not production" and the live stores:
- the gap store
- discovery
- the DB
- feedback
- the memory store
- `/workspace/db-backups`
- `/tmp`
- git clones

Since 06-05 each repair has closed one module's path, one runner's env, one test's cleanup or one symptom. The next run found another channel. The newest repair (`f451e42`, 09-29 01:37) moved the leak into a tracked file in the vessel's push clone, and one test runner is still not scrubbed.

## What this class is (and is not)

The missing capability is an **execution boundary for non-production runs**. The runner must enforce it, so it cannot live in each module or call site. It also needs a teardown and retract path for whatever a probe or experiment leaves behind. The class has five faces, and every timeline event below is one of them.

| Face | What is missing | Instances |
|---|---|---|
| **A. Store path captured at load, or defaulting to a live or tracked location** | Modules read `WORKSPACE_ROOT` and similar paths once, at import. `bun test` shares one module registry, so whichever file imports first decides the path. The default is either the live store or `process.cwd()`, which is a git clone. | Memory note test, fixed by `5dc8ab8` on 08-06. Trace spool (`fdc9100`, 08-21). The falsifier test's import race (`fd86777`, 09-01, still leaking on 09-29). Attempt ledger (`2974205`, 09-23). Locality index (08-29). Under `env -i` the suite now writes the **tracked** `development-vessel/gaps/gaps.json` (verified today). |
| **B. The runner inherits the live env, so tests write into live services over HTTP** | The test process gets the vessel's own env: DB credentials, `GAP_STORE_ENDPOINT`, `METABOB_API_KEY`, default discovery. | Suite runs published events at 8–16k/min (`914828a2`). The `127.0.0.1:20236` phantom discovery row broke node-2 composes for about 20 minutes on 09-27/28 (`2b049b7a`). Ephemeral verify registrations emptied grounding (`c62651ba`, 09-22). 94,188 fake feedback records; "other-question" rose by 7,500 per hour on 09-26. A real `systemctl start gap-compose.service` (fixed by `d7135b7`). The live vessel process logged `[gap-falsifier] updated mitosis_freshness_violation:…:mitosis-2026-06-03T00-00-00Z` at 01:36:12 on 09-29 (verified). |
| **C. Production code hardcodes absolute live paths that tests exercise** | env scrubbing cannot reach these writes. | `db-admin-repair.ts:408` writes `/workspace/db-backups/…`. The test assumes ENOENT, which holds on a dev box but not on a substrate box: 1,766/1,769 files on node 1 and 391/391 on node 2 are fixtures. The latest was written 09-29 03:44Z on node 2, **after** `f451e42` (verified). |
| **D. Probes, batteries and experiments have no teardown or retract path** | Residue outlives the run and is then read as real. | `audit-scratch` has 18 DBs. `scratch_test` has 3, plus a quoted twin namespace (verified). `/workspace/git/ledger-u-probe` (`c410578`, 09-26 05:09) left 72 `unaccounted-landing` rows and an open `unaccounted-landings-ledger-u-probe` gap (verified). The three operator `trace-store-reconcile-*` variants are still in `activity` (verified). Battery notes made up 54% of memory (09-22). There are 11 and 4 leftover `/vessels/*mitosis*` directories on the two nodes (verified). `exec_test_1` / `https://activity.test` was retried in production for days (08-14..21). A test template was selected for a real operator goal (05-30). |
| **E. Residue crosses into git and into metrics** | Drift-commit and "sync vessel code" commit whatever is dirty. The metrics then count fixture rows. | `e72a7fc8` (09-13): +176k lines including `tmp_gaps.json`. `9d839e0` (09-28, autonomous "sync vessel code") committed the dev-vessel gap store and learning-mode state; `66ba773` removed them the same day. The node-1 super-repo clone holds 1,629 dirty entries, including literal `{{out_path}}` (mtime 09-24) and `{{target_path}}` (mtime **09-28 04:45**, after the 09-25 bounded_shell fix) (verified). Fixture rows inflated "gaps opened" (5,416). 21 of 40 regressed settlements were canary fixtures. Probe traffic inflated reach 2.5×. |

**Records in the class file that belong elsewhere.** These are listed here, not in the timeline:
- The `concurrent-operator-sessions` problem row (memory-6), which has its own key.
- An agent's `make -n` destroying substrate-live (09-23) → `operator-instrument-fault`. It shares face D's "a dry run is not a sandbox" lesson.
- The untracked relay private key `scripts/substrate/federation-relay/.relay-pub-key.protobuf` (09-16) → security / `env-gating`. It is residue, but the risk is key exposure, not state pollution.
- concept-db `d844020`, which added INSERT handlers to a test fake (09-28) → `hollow-landing` / `false-verification` (possible test-appeasing).
- The causal-attempt-ledger acceptance "depended on stopgaps" (09-26) → `false-verification`. Only its settle-window-left-at-test-value item is residue.
- `auth_resolve_v1` telemetry recorded as learning traces (561,660 rows) → `trace-store-db`. It is not test residue.

## Timeline (dated; every "fixed" claim with what later showed)

| Date | Event | Claimed | What later showed |
|---|---|---|---|
| 2026-04-22 → 09-11 | activity-api: global `mock.module` amputated 53 test files. Namespace TDZ. Seed fixtures sat in the live DB (git-activityapi). | `858a30b`, `7f19b1a` (08-17), `64a24dd` (08-22), `4377b99` (09-02): mocks completed and a mock-completeness detector added. The suite went from 509 to 769 passing. | This worked for mock completeness, but not for isolation: seed fixtures stayed in the live DB, and on 09-11 tests contradicted autonomous code. |
| 2026-05-30 | `gap-closing:test-valid-1780148026306` was selected for a real operator goal (openspec-2) | — | Fixture templates were in the live selection pool. Later recurrences are face D. |
| 2026-06-05 → 08-09 | The memory-note test wrote the real store. Tracked runtime files caused host-sync rejects (git-devvessel-1). | `5dc8ab8` (08-06): read `WORKSPACE_ROOT` at use time | **Undone as a pattern**: `07972f9`/`fd86777` (08-30/09-01) chose to "capture ONCE at module load" in `substrate-gap.ts`. That race is what the falsifier test lost. |
| 2026-06-13 | 245 abandoned mitosis dirs were pruned by boredom (`f45b079 prune_stale_mitosis`) | Worked | 11 `/vessels/*mitosis*` dirs on node 1 and 4 on node 2 today. The prune does not cover `/vessels`. |
| 2026-07-22 → 08-10 | Probe templates and edges polluted cold walks. The probe string "author_producer validation probe content." was drafted as a file body. Audit/probe residue minted empty UI panels (memory-5, validation-other-1). | — | No eval tenant or TTL was ever built. |
| 2026-08-02 | Verifier subagents told to stay READ-ONLY attempted feedback writes, and one ran root SQL (memory-2) | — | Read-only prompts do not enumerate write classes. The same thing happened again with operator batteries (09-22) and ledger runs (09-26). |
| 2026-08-03..05 | `probe-a..d`, `ladder-rung-9-probe`, `scrub-live-probe`, `probe-auth-test` gaps were written into the store (gap-history) | — | This is the first appearance of fixture ids in the gap store. |
| 2026-08-06 | `bee05ca`: a bare satisfier stopped writing live vessel source | Worked | — |
| 2026-08-14..21 | The `https://activity.test` fixture trace was retried every 10 s in production, 81% of trace-sink errors. `exec_test_1` made up 81/83 spool files (reports-3, git-mid). | `fdc9100` (ias-executor-ts): spool dir isolated in tests | **Held for the spool.** `/workspace/trace-spool` holds only `quarantine/` today (verified). A 09-05 gap `a-leaked-test-fixture-trace-has-retried-against-activity-test-for-six-days` was lost at the reset. |
| 2026-08-29 | Hermeticity sweep of about 40 operator commits (`616ff68`, `7f5f454`, `93060ef`, `33855a3`, `efe7cd3`, `fbbfd9b`, …). dev-vessel went from 95 to 41 failing tests; 21/36 of the remaining failures were live-service timeouts. | Gap `vessel-tests-call-live-services-so-the-suite-failure-count-tracks-substrate-load` **closed** | The same fixture id set reappeared in every later store generation. The class was re-filed 09-05, 09-26 and 09-28. |
| 2026-08-30 | `d7135b7`: a test seam guard on `systemctl` spawn, so the suite stops starting the real `gap-compose.service` | Worked (deterministic guard test) | `54c3c2df` (09-14): an autonomous isolation of `systemd-restart.test.ts` still hit a nonexistent unit (1 pass / 5 fail). The guard covers one call site. |
| 2026-08-30 | `07972f9`: "correct the false incident narrative"; path captured once at module load | — | This created the import race documented on 09-01. |
| 2026-09-01 | 8 `falsifier-*` rows were rejected as `test_pollution` via `substrateGap_write`. `fd86777`: "a suite that can silently write to the LIVE gap store now fails loudly" (`gapStoreRootForTest()`). | Worked (transcripts-2) | Live 09-29: all 8 `falsifier-*` rows are **open**, rewritten at 01:36:05–01:36:07. Their `-narrowed` children were created 09-27 and the lane tried to compose them (live-gaps, openspec-7 §124). Failing loudly did not stop the write. |
| 2026-09-06 → | The `db-admin-repair.test.ts` backup rail started writing fake pre-mutation backups on substrate boxes (node2-runtime) | — | Still active: node 1 has 1,766 of 1,769 files, node 2 has 391/391, and 11 were written 09-29, the latest 03:44Z (verified). |
| 2026-09-12 | `substrate-gap.test.ts` wrote `some-real-gap` and `dupe-1786176268999` into the live store (memory-1) | Clean-up by closing rows | Rows re-created on 09-19 (post-reset), 09-26 (node 2) and 09-29 01:42:30 (node 1) (verified). |
| 2026-09-13 | `self_interference_scan` + `state_dependent_test_blame` (`44904fa`, `fc7789c`) flagged 55 tests that own 69% of blame pairs | Detector "live" | It grades blame, not writes. The fix to the false-blame gate was rejected by the false-blame gate itself. |
| 2026-09-14 | `scripts/substrate/run-isolated-verification.sh`: user, mount, net and PID namespaces plus chroot, no live sockets or credentials (self-care-progress) | "Validated boundary probes" | **Built and abandoned.** It is untracked in the host repo (`??`), has 0 callers, and was never wired into feature-compose (verified; mech chunk 19). |
| 2026-09-15..22 | `c62651ba`: the ephemeral verify instance's discovery row emptied every grounding window. `7cc9da4`/`ffd1d58`: evict dead rows at resolve, plus a liveness guard. | Partial | The fix is on the symptom side. There were 4 incidents on 09-19/20 that needed a manual local-tools restart, and a new phantom row appeared on 09-27. |
| 2026-09-22 | SurQL gate bisect campaign: "26/26 MET" | Closed | 18 DBs in `audit-scratch` plus 3 in `scratch_test` and a quoted `'scratch_test'` twin are still on the live server (verified). |
| 2026-09-22 | Battery notes were 578/1,077 of live memory, which displaced conventions (memory index) | A retire primitive landed (`19ae84e`) | The primitive exists. Nothing retires probe output by default. |
| 2026-09-23 | `2974205`: `attempt-ledger.ts:11` got a `NODE_ENV === "test"` guard: "a test run must never write the live ledger" | Worked for that store | It is the **only** NODE_ENV guard in dev-vessel `src/` (verified grep). |
| 2026-09-24 | Operator variants `trace-store-reconcile-{lease-ttl-120s,release-before-verify,swap-timeout-15min}` were created to test reconcile fixes | — | They ran 171/23 and 166/19 against a base of 470/110. **All three are still in the `activity` table** (verified). |
| 2026-09-24 | Container hooks stopped recording `/tmp` checkouts (#16), which had produced about 900 events/h | Worked | — |
| 2026-09-24/25 | `bounded_shell` ran `sed -i` in the super-repo checkout. Fixed by local-tools `11636e6` (scratch cwd; falsifier MET 06:03Z) and goal-host `60833b4` (503 retryable). | Worked | A second residue writer was found 09-25 (`c8a4bb4e`). `{{target_path}}` was written in the super-repo root at **09-28 04:45** (verified). The detector (2.2) is still open. |
| 2026-09-25 | `390202d`: the producer-validation restore path (`/vessels/repos/…` → `/vessels/…`), after the live canary was overwritten by a probe | Dispatched | The probe's side effects (git commits) are still unsandboxed (#60). |
| 2026-09-26 | The dev-vessel suite re-wrote 11 fixture gaps into the live store on every `bun test`; node 2's local `gaps.json` froze at 09-26 12:07 with 70 rows. Filed `development-vessel-tests-rewrite-fixture-gaps-into-the-live-store-and-refresh-detected-at`. | "`GAPS_ROOT_AT_LOAD` isolation chain" | Not dispatched as of 09-27 06:49. The gap is **still open** (verified). |
| 2026-09-26 05:09 | Causal-attempt-ledger graded runs used `/workspace/git/ledger-u-probe` | Accepted 3×10/10 | The probe repo and 72 `unaccounted-landing` rows remain. The settle window was left at the 2-minute test value. |
| 2026-09-27/28 | An operator ran the local-tools suite inside node 2, and `127.0.0.1:20236` was registered in live discovery (`2b049b7a`). Runner changes `c24444a`/`537e6c0` followed. `914828a2`: the runner inherits DB creds. | Partial | Filed `test-runs-inherit-the-live-environment-and-write-to-live-services` (edit site `test-suite.ts`). It is **still open**. |
| 2026-09-28 03:37 | `ea07298` (dev-vessel `test-suite.ts:171`, autonomous): `env -i PATH HOME NODE_ENV=test TZ=UTC bun test`. The records attribute it to local-tools; the live `git show --stat` shows development-vessel. | Landed on that gap's own edit site | The gap stayed open, and other runners were not changed. |
| 2026-09-28 | `9d839e0` (autonomous "sync vessel code") committed the dev-vessel `gaps/gaps.json` and `state/learning-mode-state.json`. `66ba773` (operator) removed "runtime residue" the same day. | Removed | Both files are tracked, and both are dirty again today (below). |
| 2026-09-29 01:37 | `f451e42` (autonomous, `feature-compose.ts:5106,5791,5913`): the same `env -i` scrub on 3 more call sites | "Test-run leak into live gap store fixed" (transcripts-4 C35) | **01:42:30–01:43:13: about 20 fixture rows were rewritten in the node-1 live store** (verified), with `mitosis_freshness_violation:…mitosis-mismatch-2026-06-04` at 01:42:47. The 03:15 self-summary lists "fixture leak is fixed" as a claim that "fell apart within hours". |
| 2026-09-29 01:38 / 01:44 | The scrubbed runs wrote `WORKSPACE_ROOT=cwd`, which resolves to `/workspace/git/vessels/development-vessel/gaps/gaps.json`. That file is **git-tracked**, and `git status` shows ` M gaps/gaps.json`, +293 lines, on node 1 (verified). | — | The leak **moved** into the push clone, where the "sync vessel code" family already committed it once (`9d839e0`). |

## Root causes

1. **There is no execution boundary for non-production runs.** Tests, verify suites, probes and experiments run inside the live container, as the live user, with the live filesystem, the live env and live localhost services. Isolation is opt-in per module (`attempt-ledger.ts:11`, `gapStoreRootForTest()`), per call site (`ea07298`, `f451e42`) or per test (`d7135b7`, `fdc9100`). The default is "write production".
2. **Paths are captured at module load, with live or tracked defaults.** `config.ts:43` defaults `WORKSPACE_ROOT` to `process.cwd()`. `substrate-gap.ts` captures its root once at load (since `07972f9`, 08-30). `bun test` shares one module registry, so isolation depends on import order. That is the falsifier race, and `fd86777`'s "fail loudly" did not stop the write. Under `env -i` the default target is the vessel clone, and its `gaps/gaps.json` is tracked.
3. **Production code writes absolute live paths.** `db-admin-repair.ts:408` writes `/workspace/db-backups`. The test assumes ENOENT, which is true on a dev box and false on a substrate box, so env scrubbing cannot reach it.
4. **Tests talk to live services over HTTP.** Default discovery and the loopback ports reach the running vessels. The 09-29 01:36/01:42 `[gap-falsifier]` writes went through the live dev-vessel process (pid 3650439), not a file path.
5. **Nothing tears down or retracts residue, so readers treat it as real.** Scratch DBs, probe repos, variant activities, mitosis dirs, `{{…}}` files and fixture gaps have no TTL or tenant marker. The lane composes fixture gaps (the `falsifier-*-narrowed` rows). `gap-001` has `reopen_count` 1,614. The lifecycle tick was dispatched 22× on node 2's fixture store. Metrics count the rows.
6. **The drift-commit family turns residue into history.** "sync vessel code" and "Committing changes for vessel2" commit whatever is dirty (`e72a7fc8`, `9d839e0`), and the pre-commit hook is not installed in substrate clones (reports-7).

## Why it recurs

The shared capability is missing, so each fix covers only the channel that was just observed. The attempts come in five kinds:
- **One module's path:** `5dc8ab8`, `fdc9100`, `2974205`.
- **One runner's env:** `ea07298`, then `f451e42`. `vessel-mitosis-evaluate.ts:263` still spawns `bun test` with `env: { ...process.env, PATH }`, the full live env including `WORKSPACE_ROOT=/workspace/git/super-repo` (verified; file last changed `70d2a00`, 09-25).
- **One test's side effect:** `d7135b7`, `fd86777`.
- **One symptom:** `7cc9da4`/`ffd1d58` evict dead discovery rows, 09-01 manual `test_pollution` rejects, 09-28 bulk removals.
- **One detector that grades blame instead of writes:** `self_interference_scan`.

Every one of these is correct for its instance. None moves the default. `env -i` is also the wrong layer: an empty env falls back to `process.cwd()`, and the cwd is itself a live, tracked clone.

The class meets the user's definition of the failure exactly: the same issue recurs for the same reason. Four gap filings (08-29 closed, 09-05 lost, 09-26 open, 09-28 open) name the same root. The same fixture id set is present in every gap-store generation on both nodes (08-30 snapshot, 09-19 post-reset, node 2 09-26, node 1 09-29).

## Shared capability that would retire it

**A sandboxed run primitive for every non-production execution**, at the seam where a run is spawned. That seam is local-tools `shell`/`bounded_shell`, the dev-vessel `test-suite` resolver, `vessel-mitosis-evaluate` `runCheck`, `feature-compose`, pull-sync's test gate, and operator or probe invocations. The primitive should be one resolver or activity (for example a `sandboxedRun` shape) that all of those route through. It provides:
- a private root and private tmp;
- no live env, sockets or credentials;
- a private loopback;
- a residue manifest.

It needs three companions:
1. **A residue tenant and TTL**: every probe, battery or experiment row carries a run id and expires or is retracted at run end. This covers scratch namespaces, variant activities, probe repos and fixture gaps.
2. **A positive-control detector activity**: run a suite with a deliberate canary write and prove it lands only in the sandbox. Diff every live store and every push clone's `git status` across the run, and file a gap when anything changed.
3. **Admission rules** that refuse fixture-shaped ids and templates (`{{…}}`) in live stores. The rule can be generated from the test files' own fixture ids.

The primitive already exists in dormant form: `scripts/substrate/run-isolated-verification.sh` (09-14). It should be kept, tracked, and wired as the one runner, rather than written again.

## Prior attempts at that same capability, and why each did not hold

- **`5dc8ab8` (08-06), read `WORKSPACE_ROOT` at use time.** It fixed one store. Its pattern was reversed on 08-30 (`07972f9`) for law-1 reasons, so the import race returned.
- **The 08-29 hermeticity sweep (~40 commits) and closing `vessel-tests-call-live-services…`.** It stubbed fetch per file and did not change the default. New tests and new files leaked again, and the gap was closed on the sweep rather than on a measurement.
- **`d7135b7` (08-30), the systemctl seam guard.** One call site. `54c3c2df` (09-14) still invoked restart.
- **`fd86777` (09-01), `gapStoreRootForTest()` to "fail loudly".** It detects inside one test file and does not prevent writes from other files or from HTTP. `falsifier-*` rows were rewritten on 09-29.
- **The 09-01 manual reject of 8 `falsifier-*` rows as `test_pollution`.** It removed the instance, and the rows were re-created. No code in dev-vessel `src/` knows `test_pollution` today (verified grep).
- **`self_interference_scan` (09-13).** It measures blame correlation, not writes, and its own remedy was refused by the gate it diagnoses.
- **`run-isolated-verification.sh` (09-14).** This is the right capability. It was never committed and has 0 callers, so the class kept recurring for 15 more days next to it.
- **The discovery liveness guard `7cc9da4`/`ffd1d58` (09-19/22).** It treats the symptom at resolve time. The test still registers, and the phantom row appeared again on 09-27.
- **`2974205` (09-23), the NODE_ENV guard on the attempt ledger.** One store. It relies on NODE_ENV, which `vessel-mitosis-evaluate` does not set.
- **local-tools `11636e6` (09-25), bounded_shell scratch cwd.** It covers one writer. A second writer was found the same day (`c8a4bb4e`), and `{{target_path}}` reappeared on 09-28.
- **`ea07298` (09-28) and `f451e42` (09-29), `env -i` at 4 call sites.** Per call site: `runCheck` in mitosis-evaluate is not scrubbed, HTTP into live services is not blocked, the absolute-path writers are untouched, and the fallback target became the tracked push-clone file.
- **The operator bulk clean-ups: 09-28 `66ba773` and the 09-28 removal of 734 gaps.** They remove the instances, and the next suite run or drift-commit re-creates them.

## Current verified state (2026-09-29, 04:56–05:15 UTC)

**Node 1 (`substrate-live`)**
- **Live gap store** `/workspace/git/super-repo/gaps/gaps.json` (6,279 rows): 35 fixture-pattern rows.
  - Rewritten at 01:36:05–01:36:07: all 8 `falsifier-*`, all **open**.
  - Rewritten at 01:42:30–01:43:13, after `f451e42`: `some-real-gap`, `dupe-1786176268999`, `class-b-1786176268124`, `contract-conformance-probe`, `flat-{summary,detail,description,text,title}-probe`, `placeholder-scrub-probe`, `heal-probe`, `gap-missing-concept`, `post-mutation-probe`, and `compose-trigger-guard-{on,off}-probe`, all open. Also `gap-001`, with `reopen_count` **1,614**, and `reach-gap-test-report`.
  - Also present: `mitosis_freshness_violation:development-vessel:mitosis-2026-06-03T00-00-00Z` (01:36:12) and `…mitosis-mismatch-2026-06-04` (01:42:47), `unaccounted-landings-ledger-u-probe` (open), and 4 `-narrowed` falsifier children (open).
  - No fixture writes since 01:43:13. **This is not evidence of closure:** the newest `/tmp/dev-vessel-test-*` on node 1 is from 01:44:07, so no dev-vessel suite has run since.
- **Push clone** `/workspace/git/vessels/development-vessel` (HEAD `f451e42`): ` M gaps/gaps.json` (+293 lines, written 01:44:11 by a scrubbed run) and ` M state/learning-mode-state.json`. There has been no "sync vessel code" commit since `66ba773`. This is a recurrence waiting to happen, not one that has happened.
- **Runners:** `env -i` is present in `test-suite.ts:171` and in `feature-compose.ts` at 5106, 5791 and 5913. **Absent** in `vessel-mitosis-evaluate.ts` `runCheck` (`env: { ...process.env, … }`). The only NODE_ENV guard in `src/` is `attempt-ledger.ts:11`.
- **Other residue:**
  - `/workspace/db-backups`: 1,773 entries, all fixture files apart from 3 older real ones and a few legacy exports.
  - `/tmp`: 46,159 entries, including 302 `dev-vessel-test*`.
  - Super-repo clone: 1,629 dirty entries (1,089 `validation/failure-modes/scenarios`, 463 `vessel-scenarios`, `{{out_path}}` from 09-24, `{{target_path}}` from 09-28 04:45, `trendcheck-*`, `*undispatched_todos*.txt`).
  - `/workspace/git/ledger-u-probe` at `c410578` (09-26 05:09).
  - 11 `/vessels/*mitosis*` dirs.
  - `/workspace/trace-spool` contains only `quarantine/`, so the `fdc9100` spool fix held.
- **SurrealDB:** namespaces `audit-scratch` (18 DBs), `scratch_test` (`idxprobe`, `mig205`, `mig205b`) and a quoted `'scratch_test'` twin. The `activity` table still holds `trace-store-reconcile-{lease-ttl-120s,release-before-verify,swap-timeout-15min}` and `trace-store-reconcile-1784064351637`.
- **Gaps for this class:** `development-vessel-tests-rewrite-fixture-gaps-into-the-live-store-and-refresh-detected-at` is open (09-26, edit site `substrate-gap.test.ts`). `test-runs-inherit-the-live-environment-and-write-to-live-services` is open (09-28, edit site `test-suite.ts`, which `ea07298` already changed).

**Node 2 (`compose2-live`)**
- Local `gaps.json` (70 rows) has been frozen since 09-26 12:07, with 16 fixture rows. It is a fossil, and the store is now held on the hub.
- The scrubbed feature-compose runs at 03:21–03:23 wrote their falsifier/reachability test stores into `/tmp/dev-vessel-gap-falsifier-test-*` and `/tmp/reachability-gap-repair-test-*`, and the hub store gained no fixture rows. **That is a partial positive control, for the scrubbed path only.**
- The push clone `development-vessel/gaps/gaps.json` was rewritten at 01:38 (613 B).
- `/workspace/db-backups` has 391/391 fixture files, 11 of them written 09-29, the latest 03:44:39Z (`delete_none_fk` on `activity_composition_graph`, `affected_count:7`). Channel C is **open**.
- `/tmp` has 50,767 entries (789 `dev-vessel-test*`). There are 4 `/vessels/*mitosis*` dirs.

**Not re-verified today:** phantom discovery rows. The discovery list route answered 404 on the paths I tried, and node 1 `/health` reports `registeredVessels: 11`. The last evidence is `2b049b7a` (09-27). Also not re-verified: the fake-feedback volume (last recorded as 94,188 rows) and the event-bus bursts (`914828a2`).

## Retire condition (measurable, checked continuously, on both nodes)

The class is retired when **all** of the following hold for **7 consecutive days** on every node, as measured by a scheduled detector activity whose own positive control passes:

1. **Zero live-store writes from non-production runs.**
   - No row created or updated in the live gap store, discovery registry, feedback/oracle corpus, memory store or DB by a process descended from a suite, verify, probe or battery run.
   - This is measured two ways: by a run-id/tenant tag on every such write, and by a before/after diff of the fixture-pattern id set (the `test/**` fixture ids) around every suite run.
   - The fixture-pattern count in every live gap store stays at 0.
2. **Zero new files in `/workspace/db-backups`** matching the fixture signature (`"rows":[{"c":7}]`).
3. **Push clones and super-repo clean across suite runs.** `git status --porcelain` for every push clone and super-repo clone is identical before and after each suite run. No tracked runtime file (`gaps/gaps.json`, `state/*.json`) is modified, and no `{{…}}` path exists.
4. **One spawn primitive.** The count of `bun test` / suite spawn sites that do not route through the single sandboxed-run primitive is 0 (static grep across vessels and scripts, run by the detector).
5. **Canary proves the boundary.** Each day the detector runs a suite containing a deliberate canary write (file, HTTP to discovery, gap write), and the canary is found **only** inside the sandbox. A canary that escapes files a gap, so the detector cannot pass by being blind.
6. **Residue has an owner.** Every scratch namespace, probe repo, variant activity and mitosis directory older than its TTL is retracted automatically, and the count of those older than their TTL is 0.

## Keep / fix / drop

**Keep**
- `scripts/substrate/run-isolated-verification.sh` as **the** primitive. Commit it, wrap it as an activity, and route every runner through it. It is general and was validated on 09-14.
- `fdc9100` (spool isolation, held) and `2974205` (the ledger NODE_ENV guard). These become instances the primitive makes redundant, not the mechanism.
- `d7135b7` (systemctl seam) and `fd86777`'s `gapStoreRootForTest()` as unit-level assertions.
- `self_interference_scan`, relabelled as a blame detector (a related class), not a residue detector.
- local-tools `11636e6` (scratch cwd) and container hook #16.

**Fix**
- Route `vessel-mitosis-evaluate.ts` `runCheck`, `test-suite.ts`, `feature-compose.ts` and pull-sync's test gate through one sandboxed-run resolver. Remove the per-site `env -i` strings once they do.
- Untrack or ignore dev-vessel `gaps/gaps.json` and `state/learning-mode-state.json`, and make the `WORKSPACE_ROOT` fallback a temp dir rather than `process.cwd()` when `NODE_ENV=test`.
- Make `db-admin-repair.ts` take its backup dir from injected context, and make its test assert on a temp dir.
- Retract the verified residue as one traced operation:
  - fixture gaps on node 1
  - the node-2 fossil store
  - `ledger-u-probe` and its 72 `unaccounted-landing` rows
  - the 3 `trace-store-reconcile-*` variants
  - the `audit-scratch` and `scratch_test` namespaces
  - the 1,700+ fixture db-backups
  - the `{{…}}` files
  - the stale mitosis dirs
  - `/tmp` test dirs
- Close or merge the two open class gaps into one gap whose edit site is the spawn seam and whose falsifier is retire condition 5.

**Drop**
- Per-call-site env scrubbing as a strategy.
- "Tell subagents READ-ONLY" as a control.
- Closing class gaps on sweep commits without a canary measurement.
