# Shard: git-deployment — super-repo `scripts/substrate/`, bootstrap/ops scripts, `repos/deployment`

Read-only. Sources: `git log` of the super-repo restricted to `scripts/substrate`, `Dockerfile.substrate`,
`scripts/git-hooks`; add/delete cycles (`--diff-filter=A/D`); `git log -S` on recurring identifiers; the
`Substrate Autonomous` author's commits; the host working tree (`git status/diff`, read only); the
in-container super-repo clones and unit state on `substrate-live` (node 1, hub) and `compose2-live` (node 2);
`repos/deployment` history (summary only). Dates are commit dates (2026). No file other than this one was written.

Scale: 5,473 super-repo commits; 591 touch `scripts/substrate` (05: 39, 06: 138, 07: 138, 08: 168, 09: 108).
Tracked in `scripts/substrate`: 457 files, of which **192 are compiled `.js/.d.ts/.map` artefacts** (see
codebase-bloat). ~26k lines of `.ts/.sh`. Most-churned files: `Makefile` 70 commits, `gen-env.sh` 70,
`substrate-pull-sync.sh` 65, `federation-transport-server.ts` 55, `vessels.inventory.json` 28.

---------------------------------------------------------------------------------------------------------

## 1. By problem class

### sync-deploy-drift — `substrate-pull-sync.sh`: 65 fixes, the same five sub-classes re-fixed

pull-sync was born 07-01 (`2afd215e` "self-contained launch, self-sync, and dynamic fleet membership") and has
been patched 65 times. Its commit subjects cluster into five recurring sub-classes; each was declared fixed and
then re-fixed under a new description:

| Sub-class | Commits (date) | Pattern |
|---|---|---|
| "a change of type X does not deploy" (content-hash coverage) | `596fd717` 07-20 (compare tree CONTENT not marker sha) · `967e3d6e` 07-25 (.json) · `cb28e450` 07-25 (sql/.surql) · `23ee216e` 08-05 (systemd units) · `392e1990` 08-05 (units every tick) · `5ddfc7e2` 08-07 (selector + fleet def) · `38e4f79a`/`a030952b`/`b749a2a5` 08-07/08 (gen-env, secrets writer) · `7f97df70` 09-09 (timer converged but never enabled) · `66cc9185` 09-24 (fingerprint scripts/ too) · `31f15baf`/`4bb21141` 09-28 (declarations-only shared packages) | Every new artefact type silently failed to deploy until someone noticed. There is no generic "the whole tracked tree is the deploy unit" rule; the fingerprint is an allowlist that is extended one type at a time. |
| "restart the right units" | `41182490` 08-02 (inventory unit is a timer, runs a service) · `2289f113` 08-18 (vessels run out of super-repo clone) · `421653ab` 09-23 (every unit that runs a converged vessel's source) | Unit→source mapping re-derived three times. |
| in-flight / drain guard before restart | `c5db6415` 07-04 · `887577bd` 07-08 · `e22271bd` 08-04 · `25907d96` 08-05 · `3c86768c`,`a07265a1`,`2deb9cad` 08-08 · `379ef9f4` 08-10 · `ad535830` 08-11 · `25aad2cc` 08-15 (quiesce outlived the unit — converged nothing) · `73a3b54c` 08-19 (deferred restart was PERMANENT — mirrored code never loaded) · `85bc103c`,`fd3d6871` 09-24 (defer by age of oldest in-flight request) | ~13 fixes; two of them (`25aad2cc`, `73a3b54c`) found the guard had silently stopped all convergence. |
| one bad vessel / masked unit stops everything | `e8da4bfe` 08-08 (one dirty vessel stopped all 17 others) · `b0df07e3`,`cb5b0b24` 08-08 (masked vessel) · `2e47b75e` 08-04 (masked vessel aborted whole sync) · `9d261470` 08-01 (mitosis deferrals starved convergence forever) · `9333f0f7` 09-06 (count only tracked changes as dirty) | Same "one blocks all" class five times. Live 09-28: node 2 cpg-inference-ts build failure ⇒ `synced=0` (per MECHANISM-AUDIT-2026-09-28). |
| silent skip / silent failure | `65648ab5` 08-03 (never swallow failed gap emission) · `0b89a4ef` 08-17 (failed fetch skipped glue in silence) · `a183983a` 08-17 · `24877839` 08-18 (unbound variable in a LOG STRING took the code channel down) · `490b529d` 08-22 (failed sync exits non-zero) · `66cc9185` 09-24 ("stop skipping in silence") | Recurs after every fix. **Live now (09-29 03:53Z) node 2 reports `done — synced=0 skipped=0 failed=0` while its super-repo clone has `vessels.inventory.json` truncated 425→9 lines and `scripts/substrate/learning-loop-selftest-tick.ts` deleted (uncommitted, mtime 09-28 20:24Z), and logs "submodule worktrees left at old pointers (uncommitted work — NOT discarded)".** |

Test gate in the deploy loop: `676cb859` 08-04 regression detector → `2e47b75e` 08-04 "detector was blind" →
`86491fec` 08-04 "my own fix wedged the deploy loop" → `3feff283` 08-04 min-of-2 → `4e79dd76` 08-17 gap when gate
disables itself → `6278a317` 08-17 "a failure COUNT cannot express regression, and it wedged convergence" →
`6c7c5b8a` 08-28 attribute regressions to the commit. Outcome: partial. `bb217e5e` (09-13) records pull-sync
exited non-zero on 26 runs in 12h incl. "TEST GATE BLIND — converging ungated".

**Parallel sync mechanisms (duplicates of one job: bring live `/vessels` to origin/dev):**
1. `substrate-pull-sync.sh` + timer (live-used, node 1 and 2).
2. `mirror-to-live.sh` (called by pull-sync, `feature-compose.ts`, `patch-with-tools.ts`, `pull-cutover.ts`, goal-host).
3. `runtime-drift-tick.ts` repair path (`63b48175` 09-13), then **defaulted OFF next day-ish** (`bb217e5e` 09-13): "shipped a second repairer on the same cadence, which is a race… I had credited the watchdog for that restore; it did nothing"; root cause "the grep that established 'nothing invokes mirror-to-live' ended in `| head -15`". Kept as detector only; `RUNTIME_DRIFT_REPAIR` env gate (law 1).
4. `host-pull-sync.sh` + `host-sync-poller.sh` (host-side, added 06-04/06-17, units deleted 06-25, re-added 06-26, all deleted 08-11 in `a267367e`). Fossil, deleted.
5. `federation-pull-sync.sh` (called only from pull-sync).
6. development-vessel rhythm family **`vessel-sync-and-health`** (`repos/development-vessel/src/resolvers/rhythm-conductor-tick.ts:127`): an LLM-walked goal "fast-forward the clone with git pull --ff-only, mirror the updated src into /vessels/<vessel>/src, restart the vessel unit…" — a third, natural-language re-implementation of pull-sync.
7. rhythm family **`self-maintenance`** (`rhythm-conductor-tick.ts:126`): "run the detect-vessel-code-drift scan … run the vessel-code-commit-and-push goal" — the generator of the residue commits below.
8. `pull-cutover.ts`, `vessel-mitosis-cutover.ts` (dev-vessel; land path).

**Runtime depends on uncommitted host state (location-independence breach, law 11).** Host tree at 09-28 20:11:16
has uncommitted edits to `Dockerfile.substrate` (+`COPY scripts/substrate/git-hooks-ledger/ …`),
`setup-git-push.sh` (+12 lines installing `core.hooksPath` = ledger hooks), `gen-env.sh` (+86/−, generic
provider-secret carry), units `development-vessel.service` (+`CUTOVER_LEASE_WAIT_MS=330000`) and
`development-vessel-seed.service` (+ordering after identity-seeder), and `Makefile` (+906/−333). The running
node-1 image already has the ledger hooks installed (`setup-git-push` journal 09-25 22:35Z "attempt-ledger git
hooks installed") and `grep -c LEDGER_HOOKS /usr/local/bin/setup-git-push` = 5 — i.e. **the image was built
from a dirty tree; a fresh build from origin/dev would not install the ledger hooks.** The only committed
ledger artefact is `eca6bb44` (09-26, hooks directory). The uncommitted Makefile restores targets that
`e375d716` (09-23, "one launch manifest") deleted (`run`, `run-detach`, `run-live`, `run-live-obsidian`,
`ui-bridge-*`, `clone-vessel-repos`) and `openspec/changes/unified-install-interface/tasks.md` has 1.1–2.8
un-ticked in the working tree — all five files share mtime 20:11:16, one second after HEAD `9c967329`. Writer
unknown; recorded as fact, not interpreted.

### codebase-bloat-fossils / test-residue-live-state / autonomous-regression — the drift-commit family

The self-maintenance "detect vessel code drift → commit everything and push" family has committed runtime state,
scratch output and compiled artefacts into git at least **nine times**, across the super-repo and five vessel repos:

| Commit | Repo | Date | Size | Content |
|---|---|---|---|---|
| `4e4170a8` | super-repo | 09-07 | 2,134 files, +59,401 | root scratch (`neptune_moons.txt`, `elements.html` 3,270 lines, `e.g`, `data.json`, `noop-template.json`), `interactor-log/*.jsonl`, `load-attribution/`, `compose-slots/`, 192 compiled `.js/.d.ts/.map` under `scripts/substrate/` |
| `e72a7fc8` "Committing changes for vessel2" | super-repo | 09-13 | 27 files, **+176,265** | `tmp_gaps.json` (175,104 lines), `leases/maintenance.json`, `selftest_output.txt`, `task_[abc]_output.txt`, `state/learning-mode-state.json`, `gen-env.sh` +11, 10 submodule pointers, `repos/human-surface-vessel/src/store.ts` +58 |
| `13c5d466` | super-repo | 09-18 | 1,909 files, +33,963 | mostly `validation/failure-modes/scenarios/*.json` |
| `796fac89` "vessel-code-commit-and-push cpg-inference-ts" | super-repo | 09-19 | 412 files, +16,104 | `generate_report.js` 6,234 lines, `.d.ts/.map` for `Substrate/Projects/*`, `known_answer.txt`, `my_probe.txt`, compiled copies of dev-vessel src |
| `edc68d49` "Fix runtime drift for development-vessel by syncing state/learning-mode-state.json" | super-repo | 09-26 15:12Z | 8 files | **root `leases/maintenance-autonomous_pick.json`, `leases/maintenance-trace_store.json`** — live lease state; still tracked today |
| `877180a` | human-surface-vessel | 09-07 | 167 files, +7,503 | |
| `6a11bd6` (message names **cpg-inference-ts**) | human-surface-vessel | 09-19 | 26 files | mislabelled commit |
| `47bcd83` | concept-db | 09-19 | 106 files | compiled `.d.ts.map` etc. |
| `542e712` | libp2p-federation-transport | 09-19 | 12 files | compiled `.js/.d.ts` beside src |
| `799d574` | discovery-vessel | 09-21 | −753 lines (`src/index.ts` −548) | pushed to a stray remote branch `origin/temp-discovery-vessel-update`, not dev |
| `9d839e0` "sync vessel code" | development-vessel | **09-28 11:26** | 424 files | 422 `.bun/install/cache` binaries + `gaps/gaps.json` + `state/learning-mode-state.json`, on origin/dev |

Cleanups (each operator-authored, each after the fact): `8d3e57ce`/`bf56bffa` 08-02, `1150750f` 08-05,
`a009e1d9` 09-15 (untrack interactor log — "reset --hard was destroying operator feedback"), `d993b331` 09-23
(191 files, −192,534 lines: "remove tracked scratch files, and install the placement hook where the substrate
commits"), `f90dda1a` 09-26 (untrack runtime-state snapshots), dev-vessel `66ba773` 09-28 (untrack 422 bun cache
files). Hold: 09-28 14:50 the `rhythm-self-maintenance` `timeShapedRhythm` got `budget: 2` + `hold.lift_when:
"the commit step stages only src/ … never runtime or cache paths"` (CHECKINS row, `46a6b047`). Outcome of all
prior cleanups: **reverted/recurred** — the generator (commit whatever the drift scan sees) was never changed,
only its output deleted.

Still in the tree today (residue the cleanups missed): 192 compiled files in `scripts/substrate`, 142 in
`packages/interaction-conformance`, 68 in `packages/vessel-discovery-client`, 220 in `validation/scripts`, 60
in `openspec/changes`; root-tracked `Substrate/` (68 files: `MyNewProject.md`, `MyTestProject.md`,
`temp_test_open_todo.md`…, all written by `Substrate Autonomous`), `leases/` (2), `run_scan.js`, `history.txt`.

In-container clones (untracked, pending the next drift-commit): node 1 super-repo has **1,629 dirty entries**
(1,552 untracked `validation/failure-modes/scenarios/*.json`, 11 `Substrate/Projects`, root
`undispatched_todos*.txt`, 12+ `trendcheck-product-*` files, and literal-template filenames **`{{target_path}}`
(09-28) and `{{out_path}}` (09-24)** — an unrendered binding written as a path). Node 2 has 20 (same
`{{…}}` files, `patch.diff`, `mitosis-pending.json`, `temp_validation_prompt.md`, and the clobbered inventory /
deleted script above).

### false-verification / dormant-mechanism — the placement gate is inert on both nodes

- `d993b331` (09-23) claims setup-git-push "now installs the pre-commit placement hook in the in-container
  clones, so new launches reject new root files".
- The causal-attempt-ledger (committed hooks `eca6bb44` 09-26; installer lines uncommitted, but live since
  09-25 22:35Z) sets `git config --system core.hooksPath /usr/local/share/substrate/git-hooks-ledger`. That
  directory has `post-commit`, `post-rewrite`, `reference-transaction`, `_record.sh` and **no `pre-commit`**;
  `ledger_chain` only chains the hooks it has. With `core.hooksPath` set, git ignores `.git/hooks/pre-commit`.
- Evidence it failed: `edc68d49` (09-26 15:12Z, `Substrate Autonomous`) committed root-level `leases/` — a
  directory not in `ALLOWED_TOPLEVEL_DIRS` — 16 h after the hooksPath install.
- Node 2 journal logs `WARN placement gate INERT` at 09-26 12:00 and 13:05 (a warning with no reader). Node 1
  has no `.git/hooks/pre-commit` at all and no placement line in its retained journal (silent).
- CLAUDE.md already describes exactly this failure ("a container-wide core.hooksPath without a chaining
  pre-commit leaves the gate inert (the boot log says so)"), so the docs know and nothing acts. Class:
  directed-overshoot (a new mechanism disabled an older one) + dormant-mechanism.

### codebase-bloat-fossils — script retention (CLAUDE.md rule) and add/remove/re-add cycles

**Pruned once already.** `8d3e57ce` 08-02 "prune 38 files with no caller on any plane" (validate-handoffs/ 16,
naming/ 5, vault-cleanup/ 3, `backfill-composition-edges.ts` + `composition-edge-backfill.ts` "transposed-name
twins of one job, disagreeing on the password env var", `vessel-verify.sh` "a generalized per-vessel build/test
verify gate, committed and then called by nothing"). `1150750f` 08-05 retired 6 more
(`autonomy-metrics-view.ts`, `criterion-coverage.ts`, `docs-align-scan.ts`, `meta-closure-view.ts`,
`obsidian-learning-probe.sh`, `setup-obsidian-probe-vault.sh`; "Two of them cited only each other").
`008f3ab9` 08-20 deleted 63 Makefile targets and the static `llm-resolver-{opus,haiku,google}` units;
`23042561` 08-20 found the 63 deleted targets still in `.PHONY` "SILENTLY SUCCEEDING".
`e375d716` 09-23 deleted `configure-local.sh` and `docker-compose.cluster.yml`, "the deploy scripts collapse into
deploy.sh".

**Uncalled today** (path-qualified search over `scripts/`, `.claude/`, `.github/`, `Dockerfile.substrate`,
unit files, `packages/`, every `repos/*` git tree, and the node-1 `/etc/systemd` + `/usr/local/bin`; docs and
openspec mentions excluded):

| Script | Added | Status |
|---|---|---|
| `identical-failure-run-tick.ts` | `a172e235` 09-16 | **Run once by hand, never scheduled.** Its first run found an auth activity failing 2,286×/24h, 30 runs over the bound, 26 members for a never-non-zero category. No unit, no caller. Dormant detector for the "same failure, nothing changed" class — the user's core complaint. |
| `performance-status.ts` | `bdb27d5d` 07-30 | Makefile target removed in `008f3ab9` 08-20; orphan since. |
| `autonomy-status.ts` | 06-19 | Same (target removed 08-20); `8d3e57ce` kept it *because* it had a target. |
| `warn-baseline-drift.sh` | `f06e1470` 08-09 | Warns about `make sync-<vessel>`, a target deleted 08-20. Fossil. |
| `deploy-hub.sh`, `deploy-hub-pull.sh`, `deploy-remote.sh`, `ui-only-up.sh` | 07-01…07-19 | Headers say DEPRECATED shims over `deploy.sh`/profiles (09-23). Four lanes kept "so an existing invocation keeps working". |
| `bootstrap-remote-google-arm.sh` | `59de7cda` 07-18 | "temporary conduit … while every local LLM provider key is credit-dead". |
| `gen-cluster-fixture.sh` | 09-23 | Called by nothing (the acceptance harness does not invoke it). |
| `concept-db-bench.ts`, `db/verify-vpet-plans.sh` | 07-17 / — | Manual investigation tools; cited only in a guide. |
| `federation-relay/{fed-federated-resolve,fed-resolve-client,obsidian-passthrough}.ts` | 06-30…07-01 | No caller (obsidian-passthrough cited only in docs/FEDERATION.md). The same kind of file `8d3e57ce` pruned (`e2e.ts` etc.). |

**Scheduled but unvalidated.** Node 1 runs **~40 custom systemd timers** (auto-describe-resolvers, autonomy-metrics,
coherence-metric/recover, compose-drift, compose-teacher, composition-edge-reconcile, db-contention-check,
db-maintenance, efficiency-failure-tick, funnel-drain, gap-compose, gap-store-census, goal-host-behavior,
ingest-docs, joint-liveness, learning-liveness-probe, learning-loop-selftest, light-dispatch-healthcheck,
m1-trainer, memory-budget-check, model-reality-audit, observe-orthogonal-refresh, obsidian-{collaborate,intake,learn},
operator-goal-generator, rhythm-cadence, runtime-drift, self-development-trend, self-operational-health,
self-recovery, self-repair-operational, spectral-gap, substrate-pull-sync, surgical-gap-scan,
trace-store-health-check, typecheck-scenario-gen, validator-liveness). Every one reports `Result=success` on its
last run (09-29 ~03:5xZ; `memory-budget-check` success with exit 1). The CLAUDE.md retention rule requires an
activity that validates each script and reaches consistently; none has one. `WHY-THINGS-KEEP-BREAKING-2026-09-28`
counts 253 break cases of which the system itself detected 2 and **no named detector was first to catch any**.
Green timers are therefore not evidence (silent-skip law).

**Add/remove cycles.**
- `compose-topology-drain.ts` + unit/timer: added `06c48140` and reverted `f1348751` the same day (06-22).
- `host-pull-sync.*`, `host-sync-poller.*`: added 06-04/06-17 → deleted 06-25 → re-added 06-26 → deleted 08-11.
- mitosis staging units `development-vessel-mitosis-2026-06-03T…`, `goal-host-vessel-mitosis-…` ×2: committed 07-25 (weeks after the snapshot), deleted 08-02 (`bf56bffa`, with 128 files of `repos/*-mitosis-*` trees).
- `minibob*.service`: added 05-23, deleted 05-24.
- `llm-resolver-{opus,haiku}` (07-03), `-google` (07-15), static units + drop-ins deleted 08-20 after "every arm shipped twice on one port, and half of them crash-looped invisibly" (`30ebe24b`); replaced by `render-llm-arms.sh`/`apply-llm-arms.sh` + `llm-arms.json`.
- `units/local-tools-vessel.service.d/readonly-super-repo-checkouts.conf`: `9aa0b085` added and `6b238b63` reverted 09-24 ("the same ReadOnlyPaths landed in the unit template itself (ae957b5e)… The drop-in duplicated it").
- `units/activity-api.service.d/fts-rebuild-stopgap.conf`: added and removed 09-25 (`9fdb0b27`) once activity-api `9387ca7` stopped scheduling rebuilds (worked).
- `surgical-gap-scan` endpoint+absolute-path detector: `da76f061` → reverted `807b92ef` 09-28: "duplicates existing work … the trace-side oracle already detects and closed this class … A static scanner, if wanted, belongs as a graded resolver like env_gate_scan, not a host timer script."
- `docs-align-scan` timer retired for the rhythm family `a87673e8` 08-02 (worked: law 5 migration).

**`repos/deployment`** (gitignored local clone, 1,014 commits, 2026-03-28 → 06-25; 761 in April): the pre-substrate
Kubernetes/helmfile lineage (charts, canary/production promotion, 37 scripts: `deploy-canary.sh`,
`progressive-canary.sh`, `promote-*.sh`, `sync-vessels.sh`…; vessels `minibob`, `metabob-activity-api`,
`metabob-analysis-api`, `metabob-proto`, `metabob-internal-dashboard`). Superseded by the single-container
image (`fe7dd493` 05-23 "single-container fleet with systemd PID 1"). Fossil; not referenced by the image,
units or inventory. Other gitignored non-submodule trees in `repos/`: `workbench`, `terminal`,
`metabob-cloud-dashboard`, `react-renderer`, `user-vessel`, `conversation-vessel`.

### env-gating (law 1) — `gen-env.sh` as the behaviour bus

`gen-env.sh` (1,801 lines, 70 commits) and unit `Environment=` lines carry behaviour, not only bootstrap:
`MITOSIS_DIRECT_PUSH` (10 commits touching it, 06-16 → 09-23), `TRACE_RETENTION_*` (5; `a78fcfd7` rendered
`TRACE_RETENTION_DELETE_BATCH=1` 08-16, reverted `07e32d38` same day after 320 queries in flight / p50 33.7s),
`ENABLED_EXTRA_VESSELS` (13), `DISABLED_VESSELS` (19), `RUNTIME_DRIFT_REPAIR` (3), `FTS_REBUILD_INTERVAL_MS`
(stopgap drop-in), `CUTOVER_LEASE_WAIT_MS` (uncommitted, 09-28), `SUBSTRATE_PUSH_VESSELS` +
`GAP_STORE_ENDPOINT` (`e31e28dd` 09-26: "carry … into /etc/substrate/env" — they had not reached units).
Recurring delivery defects of the bus itself: `28f78545` 08-21 "seven variables had no working delivery path,
and nothing could tell"; `fd9d1102` 08-22 "unquoted values corrupted config in transit, and no instrument could
see it"; `f32b2274` 08-22 "a comment in an unquoted heredoc ran as a command every boot"; `fdd5503f` 09-20 "stop
quote-doubling persisted secrets on read"; `ae110fcd` 08-08 "secrets file was overwritten from a list that keeps
changing"; the uncommitted 09-28 generic provider-secret carry exists because "`docker run -e <VENDOR>_API_KEY`
was a silent no-op TWICE over". `WORKSPACE_ROOT` touched by 16 commits (`09d9baa6` 07-25 "set durably"; units
still pin `/workspace` while the env file names the super-repo — the two-memory-stores split recorded 09-22).
Outcome: partial; law-1 debt grows with each knob.

### node-locality / federation-p2p

- Node 2 masks ~33 of ~40 timers (profile). `7f97df70` (09-09) made pull-sync enable any converged timer
  reported `disabled`; per MECHANISM-AUDIT, on 09-26 12:56Z it enabled never-fired DB watchdogs on DB-less node 2,
  which then failed "Unable to connect"; now `compose-drift`, `joint-liveness`, `learning-loop-selftest`,
  `validator-liveness` are `masked failed` on node 2. Directed fix → cross-node regression.
- Node 2 clone damage (inventory 9 lines, deleted script) with pull-sync reporting clean — see above.
- `apply-inventory.sh` reads `/workspace/substrate/fleet/vessels.inventory.json` (volume), while
  `self-fact-reconcile.ts:88` reads `scripts/substrate/vessels.inventory.json` in the super-repo clone — two
  inventories; on node 2 the second is now the clobbered 9-line file.
- Federation transport (scripts-hosted vessel `federation-relay/federation-transport-server.ts`, 55 commits):
  the **phantom-reservation** class re-fixed ≥7 times — `494a990e` 07-25 reservation watchdog, `ea5882bd` 07-29
  detect phantom, `abf60661` 07-29 clobbered the self-heal → `9fa6bd81` 07-29 restore, `824609c6` 07-30 halve tick,
  `6ec65736` → reverted `0a535483` → `cfad41db` 07-31 "root fix for the phantom storm", `3dbbbeff` 09-14 "the
  phantom watchdog was manufacturing the outage it existed to catch". The federation oracle (`a0c702bb` 09-11,
  `federation-probe-tick.ts` 1,451 lines) needed ~25 self-fixes in 4 days (`9834bd95` "four defects … found by
  adversarial review", `26a53fe0` "a negative control that could not fail", `015b31fa` "the close rate was
  inflatable", `e4fe46d1` "the oracle lived in the workspace it measures, and the subject deleted it").
- Spoke boot: `965901e1` 09-14 "repair the guard that bricked every spoke boot"; `6d19c0a0` 08-20 "a spoke
  silently joined the wrong substrate"; `7736ac2f` 08-20 "the two layers of my own fix disagreed above port 47534".

### directed-overshoot (operator fixes in this shard that regressed)

- `e2ba1a69` 08-17 lowered SurrealDB `MemoryHigh/Max` to 10G/12G fleet-wide from a workstation measurement;
  pull-sync converged it onto the hub and the kernel OOM-killed the production DB; reverted `9df01220`
  ("the cap did not prevent an OOM; the cap WAS the OOM").
- `a78fcfd7` → `07e32d38` 08-16 retention batch=1 (degraded hub, reverted).
- `008f3ab9` → `25ee2162` 08-20 "the surface I shipped had five blockers, including one that disabled every LLM
  arm"; → `23042561` (.PHONY silent success); `8de05562` "my predicate broke every arm".
- `86491fec` 08-04 "my own fix wedged the deploy loop"; `6c689441` 08-22 "repair two defects the last round
  introduced, and stop apply lying"; `a600a8b9` 08-22 "repair two fixes that overshot".
- `bb217e5e` 09-13 runtime-drift repair duplicated pull-sync (truncated grep).
- `7f97df70` 09-09 → node-2 DB watchdogs enabled (above).
- causal-attempt-ledger hooksPath → placement gate inert (above).

### human-surface-escalation / endpoint-routing (as seen from deployment files)

- `:8270`/`18270` literal appears in 13/10 commits of launch scripts through `e375d716`/`fa7e9189` 09-23
  (stateful-ui-vessel, the replaced surface). `9179b739` 06-02 "ui-bridge make targets for host:18270" — the
  uncommitted Makefile restores `ui-bridge-*`.
- `008f3ab9` records `make health` "probed hardcoded 18xxx ports while documenting that it honoured LIVE_NAME,
  so on a multi-instance host it reported a DIFFERENT fleet"; `a600a8b9` "stop probing another fleet's port".

### spend-envelope-throughput / trace-store-db (deployment-side)

- `self-recovery-tick.sh` ("immune system", `6f5e1bdd` 06-20): 16 commits, repeatedly autoimmune — `92b1b1fa`
  06-30 "was docker-exec-from-inside → autoimmune", `9520a372` 07-10 consecutive failures, `fc143654` 07-23 back off
  when SurrealDB is the bottleneck, `44250006` 08-03 don't restart in start phase, `1d9190eb` 08-07 "the immune
  system was holding the door shut on the cure", `0b3f70b2` 08-08 / `337c3b81` 08-17 DB-pressure probe, `ad9da780`
  09-16 "bound the recovery reflex". Memory index: watchdog killed a vessel mid-scan (09-14). Outcome: partial.
- Retention/cap knobs in units and gen-env (`ee9c1dc2` 07-16, `6eda182a` 07-22 cap 150k + valve + cgroup cap,
  `ae447b44` 06-21) — the trace-growth problem handled by env knobs rather than design (07e32d38: "the remaining
  lever is … partitioning … or not storing this volume").

### docs-drift (deployment-side)

- `6ebabec5` 08-20 "an agent followed these docs in a clean clone and found ten defects"; `16c9b46b` 08-21
  "'building from source' silently didn't build"; `92e5fb3a` 08-20 "the false PAT prerequisite survived";
  `1150750f` 08-05 ~170 falsehoods corrected. `e375d716` 09-23 moved all setup commands to README § Installation
  with an acceptance harness (`scripts/substrate/acceptance/*`, `run-acceptance.sh` 694 lines); tasks 1.2/1.4
  record "Pending: a run on a published digest", "Pending: the one-gap check" — acceptance not yet run end to end.

---------------------------------------------------------------------------------------------------------

## 2. Mechanisms (deployment tier)

| Mechanism | Location | General / specific | Status (evidence) |
|---|---|---|---|
| Single-container image + systemd units | `Dockerfile.substrate`, `scripts/substrate/units/` | General (bootstrap tier) | live-used; but the live image includes uncommitted Dockerfile/setup-git-push edits |
| Launch manifest + profiles | `docker-compose.yml` (root), `gen-env.sh`, `entrypoint.sh`, `apply-inventory.sh` (`d8fed96f`, `e375d716` 09-23) | General | live-used; host Makefile working copy regresses it (uncommitted) |
| `substrate-pull-sync.sh` | scripts/substrate | General deploy convergence | live-used, both nodes; 65 fixes; silent-clean on a damaged node-2 clone |
| `mirror-to-live.sh` | scripts/substrate | General | live-used (pull-sync, feature-compose, patch-with-tools, pull-cutover, goal-host) |
| `runtime-drift-tick.ts` | scripts/substrate + timer | Specific detector | live-used as detector; repair path dormant behind `RUNTIME_DRIFT_REPAIR` (duplicate of pull-sync) |
| rhythm `vessel-sync-and-health` | dev-vessel `rhythm-conductor-tick.ts:127` | Duplicate (LLM re-implementation of pull-sync) | duplicate |
| rhythm `self-maintenance` drift-commit | dev-vessel `rhythm-conductor-tick.ts:126` | Specific | broken — generator of residue commits; held 09-28 via rhythm budget |
| `vessel-ctl.sh` (status/restart/logs/apply/drift) | scripts/substrate, in image | General management surface | live-used; replaced ~40 Makefile targets (`008f3ab9`) |
| LLM arm renderer | `render-llm-arms.sh`, `apply-llm-arms.sh`, `llm-arms.json` | General | live-used; replaced static per-model units (duplicate removed 08-20) |
| Placement gate | `scripts/git-hooks/pre-commit`, installed by `setup-git-push.sh` | General | broken/inert in containers (core.hooksPath = ledger dir without pre-commit) |
| Attempt-ledger git hooks | `scripts/substrate/git-hooks-ledger/` | General | live-used (installed by an uncommitted installer) |
| self-recovery "immune system" | `self-recovery-tick.sh` + timer | General | live-used; history of autoimmune regressions |
| substrate-doctor / substrate-ready / substrate-status | scripts/substrate | General | live-used; doctor re-fixed for reporting wrongly (`26ae3d94`, `0baff728` "FAILURES with all seven checks passing", `c1bd0da4`, `1d3785de` "un-vacuum check 6") |
| `joint-liveness-tick.ts` | scripts/substrate + timer (`daa2632c` 08-25) | General in intent | live-unused in effect: one binding (`decision_outcome`), never extended (WHY-THINGS-KEEP-BREAKING) |
| `identical-failure-run-tick.ts` | scripts/substrate (`a172e235` 09-16) | General detector for the recurrence class | dormant — no unit, ran once |
| `watchdog-tick.ts` | via `*.service.d/watchdog.conf` drop-ins | General | live-used |
| federation transport + relay + probe oracle | `scripts/substrate/federation-relay/` | General (a vessel hosted in scripts/, outside the submodule authoring loop) | live-used; high churn |
| `federation-pull-sync.sh` | scripts/substrate | Specific | live-used (called by pull-sync only) |
| host-side sync (`host-pull-sync`, `host-sync-poller`) | deleted 08-11 | — | fossil (deleted) |
| deprecated launch shims (`deploy-hub*.sh`, `deploy-remote.sh`, `ui-only-up.sh`) | scripts/substrate | Specific | fossil / duplicate of `deploy.sh` |
| `identity-seeder`, `bootstrap-seeder`, `concept-db-seeder`, dev-vessel seed | units + `seed-*.ts` | Bootstrap tier | live-used; seed ordering race still only fixed in the uncommitted unit edit |
| `repos/deployment` helm/k8s lineage | gitignored clone | — | fossil |
| Acceptance harness | `scripts/substrate/acceptance/` (09-23) | General (install contract) | live-unused: end-to-end run on a published digest still pending |
| ~40 custom timers (list in §1) | units | mixed | live-used but unvalidated (retention rule); cadence as static intervals, not rhythms (law 5) |

---------------------------------------------------------------------------------------------------------

## 3. Principles found in this source

- "A gate with no call sites can never be observed failing, so it can never be trusted when it passes" (`8d3e57ce` 08-02, now in CLAUDE.md script-retention).
- "Two copies is the producer/consumer drift this tree keeps paying for" (`008f3ab9` 08-20).
- "A truncated search is not an absence" (`bb217e5e` 09-13).
- "A timer that never runs emits silence, and silence reads as health" (`7f97df70` 09-09); "an active timer proves scheduling, not work" (`6452ee6f` 08-09).
- "A cap is a property of the HOST … Lowering a live cap is not a safe edit" (`9df01220` 08-17).
- "Cheap per statement is not cheap in aggregate" (`07e32d38` 08-16).
- "A static scanner … belongs as a graded resolver, not a host timer script" (`807b92ef` 09-28) — law 2 applied to scripts.
- Placement law: runtime state belongs in the volume and is gitignored; "a file the substrate rewrites is not a file git should carry" (CLAUDE.md; `f90dda1a`).
- "Fails LOUD on its own input … fails QUIET on gap emission" (`a172e235`).
- Lift conditions on holds name the generator, not the instance ("the commit step stages only src/…", 09-28 14:50 CHECKINS).

## 4. What to keep / organize (recommendation input)

Keep (general, live, at a shared seam): launch manifest + profiles, `gen-env.sh` (bootstrap part only),
`apply-inventory.sh`, `vessel-ctl.sh`, `substrate-pull-sync.sh` + `mirror-to-live.sh` (as THE one sync path),
LLM-arm renderer, seeders, doctor/ready/status, attempt-ledger hooks (commit the installer), watchdog drop-ins.

Consolidate: one sync path — retire the rhythm `vessel-sync-and-health` goal text and runtime-drift repair; make
the pull-sync fingerprint "every tracked path" instead of a per-type allowlist. Give the placement gate a
`pre-commit` in the ledger hooks dir that chains (one fix, both nodes). Change the drift-commit generator to stage
only source trees before lifting its hold.

Retire (fossils): deprecated deploy shims, `warn-baseline-drift.sh`, `bootstrap-remote-google-arm.sh`, orphan
federation-relay clients, the 192+142+68+220+60 tracked compiled artefacts, root `Substrate/`, `leases/`,
`run_scan.js`, `history.txt`; `repos/deployment` and the other gitignored non-submodule trees (archive).

Wire or delete: `identical-failure-run-tick.ts` (the recurrence detector the user asked for — schedule it on the
hub or fold it into joint-liveness), `performance-status.ts`/`autonomy-status.ts` (no surface since 08-20).
Convert timers that encode behaviour (gap-compose, funnel-drain, operator-goal-generator, surgical-gap-scan,
compose-teacher…) into activities/rhythms per laws 2 and 5, keeping only the bootstrap/watchdog tier as units.
