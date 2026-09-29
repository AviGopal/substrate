# validation-other-3 — validation/failure-modes and validation/scripts

Shard: `validation/failure-modes/` (README, PROGRESSION, schema, cycles/, proposals/,
scenarios/, vessel-scenarios/) and `validation/scripts/` (incl. `lib/`), plus the
`validation/results/` receipts those scripts wrote and the live container copies of the
failure-mode store. Read-only; research date 2026-09-28/29.

## 0. What these directories actually are (the one-paragraph answer)

- `validation/failure-modes/` began (2026-05-22) as a hand-authored 6-scenario
  "lift validation" harness (FP-11, FP-12, FP-15, FM-17, FM-43, FM-44) with a
  progression driver that declared **LIFT CANDIDATE** within ~20 hours. Since June it has
  become a **runtime store**: `gap_to_scenario_bridge` (development-vessel) mirrors every
  open gap into `scenarios/<gap-id>.json` / `vessel-scenarios/<gap-id>.json` as the
  drafter's input queue. 2232 of the 2275 tracked scenario files carry
  `bridge_source: gap_to_scenario_bridge`. The store is committed to git (bulk
  "Substrate Autonomous" drift commits), exists in **three diverging copies**, and its
  readers and writers do not agree which copy is live.
- `validation/scripts/` is ~75 operator-run instruments (harnesses, probes, one-off tests)
  plus **220 tracked compiled artifacts** (`.js/.d.ts/.map`) swept in by an autonomous
  commit. By the CLAUDE.md script-retention rule almost none of them qualify: the only real
  invoker (a GitHub Actions weekly workflow) has **failed 20/20 runs since 2026-05-18**.

---

## 1. failure-modes/ — the original lift harness and its LIFT claim

Files: `README.md` (7.3KB), `PROGRESSION.md` (8.5KB), `schema.json`, `cycles/cycle-{0,1,2,3,5,6,7,8}.json`
(no cycle-4 file), `proposals/` (9 files). Results in `validation/results/*failure-mode*.json`.

### Design (README, 2026-05-22)
- 63-mode matrix (45 FM + 18 FP), prioritizing false positives because they corrupt the
  Thompson posterior. Scenario lifecycle: dispatch goal_text to `POST /v2/activities/recommend`,
  classify `reuse | new | gap`. "We do not write the recovery activity ourselves."
- Lift criterion (PROGRESSION): 3 consecutive **weekly** cycles with
  `manual_intervention_debt == 0`, gap count strictly decreasing, and autonomous proposals present.
- README claims (2026-05-23) the harness was migrated to an activity: development-vessel
  lifecycle observer fires `harness-run-matrix` automatically on qualifying `execution_completed`.

### Receipts — the cycle timeline (all against canary `https://activity.metabob.com`)

| report file | generated_at | reuse/new/gap |
|---|---|---|
| 2026-05-22-failure-mode-baseline | 05-22 11:27 | 0/0/6 |
| cycle-1 | 05-22 11:33 | 0/0/6 |
| cycle-3 | 05-22 21:06 | 0/0/6 |
| cycle-4 | 05-23 04:47 | 0/0/6 |
| cycle-5 | 05-23 06:17 | **6/0/0** |
| cycle-6 | 05-23 06:42 | 6/0/0 |
| cycle-7 | 05-23 06:47 | 6/0/0 |
| cycle-8-verify | 05-23 07:38 | 6/0/0 |
| 2026-07-05-failure-mode-report (hub `138.197.116.56:18080`) | 07-05 09:57 | **1/0/6** (7 scenarios; same six are `gap`, only `loop-c-vessel-scaffold-dispatch-consumer` reuse) |

Commits: d8004133 (05-22 DEV-1..4), b9eca1ed (05-22 cycle-2 "autonomous proposals"), d0aee198
(05-22 "first clean cycle"), 5504d03c (05-22 "LIFT CANDIDATE"), 4b7ce0e8 (05-23 cycle-8 +
"progression-driver debt scoping fix").

### Why the LIFT claim does not hold (discriminating facts)
1. **Not weekly** — every cycle ran within 2026-05-22 11:26 → 2026-05-23 07:38 (~20 h).
2. **Harness change, not system change** — gap flipped 6→0 between 04:47 and 06:17 on 05-23;
   `cycle-5.json` notes: "Harness methodology fix this cycle: added discover-by-shapes forward-mode
   fallback so templates are found even before they rank in /recommend … one-time harness
   improvement, not per-gap debt." The metric was satisfied by widening the matcher.
3. **Self-contradicting cycle files** — `cycles/cycle-6.json` records `baseline_gap_count=6,
   manual_intervention_debt=3, consecutive_zero_debt_cycles=0`, while `cycle-7.json` asserts
   "All three lift criteria met for three consecutive cycles (5, 6, 7)" and
   `consecutive_zero_debt_cycles=3`. `cycle-7.json` also has `proposals_by_author.make_activity_autonomous=0`
   yet `autonomous_proposals_present=true`.
4. **Measured on canary, not the substrate**; the debt KPI was "scoped" in the same commit
   that declared cycle-8 (4b7ce0e8 "progression-driver debt scoping fix").
5. **Regressed/never real**: 2026-07-05 run against the hub: the same 6 scenarios = gap.
6. **Proposal content**: the live copy `/workspace/validation/failure-modes/proposals/proposal-fp-11.json`
   (authored_by `make_activity_autonomous`, `created_at: 1970-01-01T00:00:00.000Z`) is a template
   named "Resolve fs_read file-not-found failure and extract validation scenario" whose description
   says it "Closes the gap where fs_read fails with HTTP 500 on missing file
   /workspace/validation/failure-modes/scenarios/fp-11.json". **The autonomous drafter drafted a
   "fix" for its own failure to read the scenario** — a hollow proposal counted as the lift signal.
   The repo copy of `proposal-fp-11-silent-semantic-failure.json` (different id) is a plausible
   replay-divergence design; the two lineages diverged.
7. PROGRESSION's own "infra blockers" (FM-43 needs `/execution-traces/correct`, FM-44 durable
   outbox, FP-11 input fingerprint) were conventional code changes, not activities — the harness
   could never have closed them by minting templates. The failure classes they name (silent trace
   loss, partial success recorded as total, silent semantic failure / confabulation) are the same
   classes still being rediscovered in September (hollow-landing, false-verification).

Key: `false-verification` / `selection-learning` claim; recurrence pattern = "metric satisfied by
changing the measurement" (the gameable-metric law in operator memory, 09-15, is this same class).

---

## 2. failure-modes/scenarios + vessel-scenarios — the gap→drafter queue

### Counts and copies
| location | scenarios | vessel-scenarios | proposals | newest |
|---|---|---|---|---|
| host repo (git-tracked) | 2275 | 1046 | 9 | — |
| node1 `/workspace/git/super-repo/validation/failure-modes` | 3364 | 1509 | 9 | route-edit-5cd11674-step-1.json 2026-09-29 03:25 |
| node1 `/workspace/validation/failure-modes` | 4573 | 1532 | 1 | typecheck-…-vessel-mitosis-cutover-l2785-ts1005.json 2026-09-26 14:06 |
| node2 `/workspace/git/super-repo/…` | 2275 | 1046 | 9 | 2026-09-26 12:16 |
| node2 `/workspace/validation/…` | 0 | 0 | 0 | — |

Git authorship of scenarios: d8004133 (Devbob 05-22), f42ad044 (06-24 "commit accumulated work"),
3142f140 (substrate-live 07-25 "commit all"), 4e4170a8 & 6ced94dc (Substrate Autonomous 09-07
"vessel code drift detected and committed"), 13c5d466 (09-18, 1909 files incl. 1785 failure-mode
files), 796fac89 (09-19), edc68d49 (09-26). `.gitignore` has no rule for failure-modes. CLAUDE.md:
"a file the substrate rewrites is not a file git should carry" — violated.

### WRITE-READ SPLIT (the strongest finding in this shard)
- Writer `repos/development-vessel/src/resolvers/gap-to-scenario-bridge.ts:142-144` writes
  `join(WORKSPACE_ROOT, "validation/failure-modes/scenarios")`. Unit sets `WORKSPACE_ROOT=/workspace`
  but `/etc/substrate/env` sets it to `/workspace/git/super-repo` and EnvironmentFile wins
  (verified: env value == super-repo) → writes land in the **super-repo** copy (newest 09-29).
- Writer `scripts/substrate/typecheck-scenario-gen.ts:26` hardcodes
  `/workspace/validation/failure-modes/scenarios` → writes land in the **/workspace** copy (newest 09-26).
- Readers hardcode `/workspace/...`: `draft-gap-closing-activity.ts:94,152` (seed template `fs_read`
  task path), `pick-priority-scenario.ts:119`, `vessel-arrival-scan.ts:54`.
- Result: the drafter reads a directory the bridge doesn't write; the bridge's scenarios reach the
  drafter only if a same-id file happens to exist in the other copy. Receipt: proposal-fp-11 above
  (drafted a repair for an `fs_read` 500 on the scenario path). Also 7 live `gap-closing:*` activity
  rows have task path literally `/workspace/validation/failure-modes/scenarios/.json` (empty id).
- Same class as operator memory 09-22 "TWO MEMORY STORES" (unit WORKSPACE_ROOT vs env-file) — the
  memory fix did not grep the scenario store's call sites. Key `write-read-mismatch` + `env-gating`.

### Third path: gap-lifecycle-scan reprobe (latent false close)
`repos/development-vessel/src/resolvers/gap-lifecycle-scan.ts:251-309` `dispatchScenario` resolves
`path.resolve(import.meta.dir, "../../validation/failure-modes/scenarios")` →
`/vessels/development-vessel/validation/...` (does not exist in container or repo) → always
`scenario-not-found` → `reproduced:false` → line 588 stamps `reprobe_evidence: {result: "not_reproduced"}`
and proceeds to auto-close as `churned_unlandable`. Also `!response.ok → reproduced=true`
(any HTTP error counts as reproduction). **Measured**: 0 `churned_unlandable` closes in the live
gap store (6279 gaps) — the autoClose path has not fired, so this is a **dormant fail-open gate**, not
an observed false close. Keys `false-verification`, `dormant-mechanism`.

### Null vessel-scenarios (autonomous regression, still producing)
`gap-to-scenario-bridge.ts:229-233`: for vessel-authoring gaps with no `classification_metadata.shape`,
the IIFE returns `null`, and the code still writes `JSON.stringify(null)` = `"null"` to
`<id>.json`, then `exists()` short-circuits every future pass → the gap is permanently
"bridged" to nothing. Lines introduced by three Substrate Autonomous mitosis cutovers on
2026-08-05 (bd42c72, 4e9eb41, 92dce2c). Counts: host repo 971/1046 null; node1 super-repo
**1428/1509 null, newest 2026-09-28 18:31**; node1 /workspace 46/1532 null (older lineage, pre-08-08).
The system itself filed `wasted-cycle-development_vessel_gap_to_scenario_bridge_tick` (open,
detected 2026-09-29 03:38): "dispatched 36× with 100% zero-work"; the gap-falsifier logs
`falsifier=none` for it (09-28 23:32, 09-29 00:52, 03:38) — the detector sees waste but the gap is
unmeasurable, and the null-write root cause is not named. Keys `autonomous-regression`,
`hollow-landing`, `gap-content`.

### Scenario population = the recurring failure census
- 889 `route-edit*` files over 605 distinct route-edit hashes; 664 `*-narrowed*` files (708 with one
  "-narrowed" level); 661 `recommit-*` files. route-edit scenarios are often meta-gaps
  ("investigate and decompose gap route-edit-6d101670: …") — gaps about gaps.
- Recommit failure-reason suffix counts (drafter-quality census):
  semantic_reject 199, syntax_break 98, anchor_not_found 83, typecheck_dangling_reference 80,
  verify_failed 68, (-narrowed) 64, compose_execution_failure 50, wrong_location 13,
  mis_localized_path 3, partial_spec_omission 2.
- Narrowed children are verbatim copies plus a "WHY PREVIOUS ATTEMPTS FAILED" block
  (diff of route-edit-0287b484 vs -narrowed: only description/goal_text prefix + source_gap_id
  differ). Sample failure block: anchor_not_found in `goal-host-vessel/src/index.ts` "lines
  11904-11909 of 16403" (a 16k-line file), semantic_reject for hardcoding
  `currentShaOnOriginDev = ""` with a TODO, syntax_break TS1005 at index.ts:4300.
- Other named families: docs-drift-* 23, gap-env-gated-* 12 (+narrowed), detector-coverage-gap-* 11,
  conservation-* 11 (e.g. `conservation-posterior-junction-violated`: "175 arms, posterior
  observations exceed 1.5x recorded executions"), fed-* 7 (relay unreachable off host, stale foreign
  rows, permanent auth reject invisible, phantom reservation), baseline-typecheck-broken-repos-* 7
  (goal-host-vessel index.ts TS1135/TS1005/TS1472 — untouched baseline broken), db_performance_* 4,
  db-contention 2, orphaned-capability-* 123, goal_host_failing_direction-* 11,
  goal_host_inconsistent_direction-* 6, identical-failure-run-*, systematic-failure-*-zero,
  precondition-rejection-*.
- Self-referential named scenarios that restate the round-1 problem classes: 
  `gap-narrowing-produces-no-measurable-improvement-in-landing`,
  `gap-to-feature-narrowing-guard-blind-to-recommit-lineage`,
  `capacity-refusals-increment-failed-attempts-and-trip-the-narrowing-threshold`,
  `failed-attempts-counts-dispatches-that-never-produced-a-compose`,
  `an-autonomous-repair-lands-without-closing-the-gap-it-repaired`,
  `a-retry-rollback-reverts-a-previous-attempts-successful-landed-change`,
  `a-semantically-refused-change-was-landed-by-the-lane-that-has-no-semantic-judge`,
  `a-skipped-rollback-leaves-the-runtime-running-code-that-git-never-received`,
  `drafter-emits-no-op-edits-at-a-third-of-attempts`,
  `drafter-cannot-locate-or-delete-one-line-in-a-large-file`,
  `gap-patch-with-tools-mislocalizes-in-large-single-line-json`,
  `compose-throughput-is-one-lane-against-a-growing-pool`,
  `docs-align-tick-never-executes`, `config-surface-probe-has-no-scheduled-caller`,
  `gap-store-collapsed-against-its-own-high-water-mark`, `goal-vocabulary-is-a-synonym-treadmill`,
  `escalation-disposition-parser-rejects-its-own-verb-names`, `empty-api-key-crashes-llm-resolver-on-boot-and-darkens-the-whole-plane`.
  The scenario dir is the **same gap set** as the live gap store (round 1), duplicated to disk —
  not independent evidence, but it preserves titles of gaps later deleted from the store.

### Test-fixture leak into the queue (test-residue-live-state)
Scenarios `falsifier-{c1-001,c2-001,heal-001,merge-001,none-001,pair-good,pair-bad,unresolvable-001}`
mirror gaps that are **open in the live store** with `detected_at 2026-09-01T00:00:00Z` (fixture
timestamp); `falsifier-c2-001-narrowed` and `falsifier-heal-001-narrowed` (created 2026-09-27 09:43)
exist — the loop is spending narrowing/compose on test fixtures. Origin confirmed:
`repos/development-vessel/test/resolvers/substrate-gap-falsifier.test.ts` — its own comments
(lines 28-71) say `config.ts` snapshots `WORKSPACE_ROOT` at import, `bun test` shares one process,
and the suite "lost the import race" and wrote into `/workspace/git/super-repo/gaps/gaps.json`.

### Activity catalog impact
Live `activity` table: 4010 rows, **1925 `gap-closing:*`** (32 in 2026-05, 1841 in 2026-06, 51 in
07, 1 in 09); 1119 of them retired/deprecated; counters `total_executions` sum 0 (counters known
vestigial). `activity_execution_traces` (legacy table, only July 2026 rows, 18135 total) holds 156
`gap-closing:*` executions (111 success), 338 `draft-gap-closing-activity` (73 success), 333
`gap-to-scenario-bridge-tick` (333 "success"), 94 `drafter-trigger-tick`. No execution evidence after
July in the tables checked. Duplicate composes: four `compose-gap-closing:auto-1781521028034-… →
activity:proposed_pattern_authored_relevance_backfill_dispatch` rows differing only by timestamp
suffix; `draft-gap-closing-activity` and `harness-check-scenario` each exist twice
(`…-1783049075304`, `…-1783049071519`). Open gap `template-input-lint-development-vessel_harness-check-scenario`
(09-22): the harness-check-scenario seed declares `gapScenario` input no task consumes — "silent
mis-wire". Keys `codebase-bloat-fossils`, `narrowing-duplicates`, `selection-learning` (1841 mints in
one month = the "wrong mint is negative value" law, law 3).

Journal (dev-vessel since 09-21): 0 mentions of `harness-run-matrix` / `failure_mode_matrix_score` /
`draft-gap-closing-activity` / `harness-check-scenario`; 156 of gap-to-scenario. The README's
"harness-run-matrix fires automatically" (05-23) has no current evidence.

---

## 3. validation/scripts — retention audit

Tracked: 291 files; 220 are compiled `.js/.d.ts/.map` (all 55 ts/js pairs in sync — none stale — i.e.
emitted by a root `tsc` then committed). Added by 4e4170a8 (Substrate Autonomous, 2026-09-07,
"Automated commit: vessel code drift detected and committed", 2134 files / 59401 insertions: 1120
failure-modes, 208 validation/scripts, 897 compiled artifacts, plus literal files `{{target_path}}`,
`{{unitFilePath}}` at root). 796fac89 (09-19) added `{{dirPath}}/src/*`. 6ced94dc (09-07) added
`Substrate/Projects/*` (68 files, still tracked, outside ALLOWED_TOPLEVEL_DIRS). Operator cleanup
d993b331 (09-23) removed root scratch files and installed the placement hook; the compiled artifacts
in validation/scripts and `Substrate/` remain.

### Invocation search (basenames in repos/*/src, scripts/, Makefile, Dockerfile*, .claude, .github,
.githooks, packages, validation/*.sh; plus directory refs `validation/scripts`/`validation/failure-modes`
in Dockerfile.substrate, Makefile, units, scripts/substrate/*.sh)
- **Only real invoker**: `.github/workflows/weekly-recommendation-validation.yml` (Mon 09:00 UTC) →
  `run-weekly-harness.sh` → `reuse-harness.ts`, `compare-reports.ts`, `test-forge-goal-completion.ts`,
  `goal-generator.ts`, `stratified-harness.ts`. **20/20 runs failed, 2026-05-18 → 2026-09-28**
  (run 36401878072: "FATAL: METABOB_API_KEY is not set." — secret `METABOB_API_KEY_VALIDATION`
  empty; would also target an endpoint not reachable from a GitHub runner). Dead for its whole life.
- Dockerfile.substrate copies no `validation/` directory; no unit or Makefile target references it.
- All other code hits are comments (argument-chain-check in ias-executor trace-sink and
  memory-budget-check.service; `_forge-via-ias-executor` "functional equivalence"; harness-check-scenario
  "seed-template equivalent of failure-mode-harness.ts"; ingest-doc-as-concepts names
  ingest-doc-mint-from-file as a companion; rolling-pool read via `validation/generated/rolling-pool.json`
  by boredom-vessel — a data file, not the script; progression-driver compat path in
  failure-mode-matrix-score; substrate-cycle-resync mentioned in federation-probe-tick comment).
- `scripts/substrate/units/memory-budget-check.service` (08-17) already states: "A repo-wide grep for
  its name returned two hits, both comments … validation/scripts/argument-chain-check.test.ts. Two
  careful instruments, zero call sites." — the class was named and the unit fix applied to one of two.
- `registration-backlog.json` (2026-05-20): 2 registered / 15 unregistered — never updated.

### Per-script table (last commit; category; verdict)
| script | last | what it measured | verdict |
|---|---|---|---|
| failure-mode-harness.ts | 08-28 | 6-scenario lift harness (sec. 1) | fossil; superseded by harness-run-matrix (itself no current evidence) |
| progression-driver.ts | 05-23 | cycle KPI / LIFT stamp | fossil (produced the false LIFT) |
| reuse-harness.ts / compare-reports.ts / stratified-harness.ts / goal-generator.ts / test-forge-goal-completion.ts / run-weekly-harness.sh | 05-21..07-01 | recommend MRR/Hit@k, stratified coverage | dormant: only caller is the 20/20-failing workflow |
| self-dev-reliability.mjs | 08-26 | CORRECT/INERT/DUPLICATE classification of Substrate-Autonomous commits, target ≥90% of last 50 | **keep** (independent oracle over git; categories 2-4 stubbed); operator-run, hardcodes ROOT=/home/avi/... |
| validatability-harness.py | 07-28 | external honest-reach vs self-reported (gaming_gap, confabulation_rate, hollow_rate) | **keep** (external oracle); hardcodes :18210 |
| falsification-harness.py | 07-27 | must-fail battery → honest-failure rate | **keep**; hardcodes :18210 |
| goal-expectation-harness.ts | 08-25 | TP/CONFABULATION/FALSE_REJECT/TN with independent oracle, LLM judge | keep-candidate |
| reach-generalization-harness.py | 08-07 | reach vs corpus growth, novel-batch generalization, `reached` vs `correct` columns | keep-candidate |
| complexity-ladder-harness.ts | 08-12 | reach by transformation count, content-binding oracle; notes pathway-reuse unmeasurable (`pathwayReusePicks` process-local Map; `tierOf` has no reuse branch) | keep-candidate; result 2026-08-12-complexity-ladder.json |
| stage-harness.ts | 08-12 | calls each of ~10 layer functions directly on fixtures from real trials | **keep** — latest result 29 pass / 7 known_open / 0 regression (stage-harness-latest.json, uncommitted) |
| eval-ablation-harness.py / eval-composition-harness.py | 07-26 | floor vs warm (forceFloor/observe/seed) ; derive→emit composition content binding | keep-candidate; hardcode :18210/:18090, /home/avi |
| conditioned-differentiation-harness.py | 08-12 | — | result 2026-08-12-conditioned-differentiation.json; dormant |
| human-goal-flows.mjs | 08-07 | goals through the human surface (/api/run-goal, /api/resolve) | keep-candidate (surface parity) |
| posterior-divergence.ts | 08-18 | — | dormant |
| external-data-oracles.sh | 08-15 | — | dormant |
| substrate-cycle-resync.mjs | 08-08 | result substrate-cycle-resync-2026-08-08.{md,json} | dormant |
| argument-chain-check.test.ts | 08-17 | ias-executor trace-sink arg chain | dormant (named zero-call-site instrument) |
| thompson-compare.ts, run-learning-campaign.sh | 05-05 | canary-era | fossil |
| test-18-*, test-22-*, test-4-6-*, test-goal-host-recommend, test-ported-resolvers, test-slot-binding-chain, test-state-space-signature-roundtrip, _test-audit-loop, test-audit-on-report, verify-*-branch-health, verify-diagnostic-loops, probe-*, substrate-explicit-vessels-check, substrate-narrator, seed-architectural-principles, seed-capability-gap-examples, cite-check, closure-audit, ingest-doc-mint-from-file, observe-chain-window, _forge-via-ias-executor, cdb-*.py | 05-05..06-24 | phase-era one-offs | fossil (tests belong in vessel repos per CLAUDE.md) |
| lib/* (adversarial-mutate, contamination-delta, decision-record-completeness, decomposition-depth, output-normalizers, refinement-detectors, rolling-pool, shape-registry-hash, shape-signature-pool, topology-gap-band) | 05-19..07-01 | helper libs for the harnesses | follow their callers (dormant) |

Hardcoded endpoints: 21 scripts use `localhost:18xxx`/`127.0.0.1:8xxx` (18210 ×11, 18080 ×10, 18090 ×7,
18100 ×5, 18260 ×4, 8210/8220/8100/8090); 17 files embed `/home/avi`; 13 reference canary/minibob.
Violates "nothing hardcodes an endpoint; goal-host is resolved via discovery" and location independence
(law 11). Key `endpoint-routing`.

### What to keep (recommendation for the realignment)
The valuable, general asset here is the **external-oracle family**: validatability, falsification,
goal-expectation, reach-generalization, complexity-ladder, stage-harness, self-dev-reliability. They
share one idea — grade `reached` against independently computed truth and report the gap between
self-report and reality — which is exactly the instrument for the recurring "declared fixed" failure.
None is placed: all are operator-run, hardcode host ports, and write results to an operator folder.
Per law 2 and the retention rule they should become one activity family (independent-oracle audit)
scheduled by rhythm, reading discovery-resolved endpoints, with results as shaped impulses. The
6-scenario lift harness, progression-driver, and the weekly workflow are fossils. The scenario store
should leave git and collapse to one path.

---

## 4. Problems (class keyed)
- write-read-mismatch: scenario writer (super-repo via env file) vs readers (/workspace); typecheck-scenario-gen writes the other copy; proposals lineages diverged (9 vs 1).
- autonomous-regression + hollow-landing: 08-05 cutovers made the bridge write `"null"` scenarios; 1428/1509 live, still growing 09-28.
- false-verification / dormant: reprobe path always `scenario-not-found` → `not_reproduced` evidence; not yet fired.
- false-verification (claim): LIFT CANDIDATE 05-22/23 via harness widening; regressed 07-05.
- test-residue-live-state: falsifier-* test fixtures live as open gaps + narrowed children + scenarios.
- codebase-bloat-fossils: 220 compiled artifacts, 3321 tracked scenario files, placeholder-named files, Substrate/Projects fixtures, 1925 gap-closing activities.
- dormant-mechanism: weekly workflow 0/20; harness-run-matrix no evidence; ~70 scripts with no invoker.
- endpoint-routing: 21 scripts hardcode ports.
- drafter-quality: recommit reason census (semantic_reject 199 …).
- narrowing-duplicates: 664 narrowed scenario copies; duplicate compose rows.
- gap-content: wasted-cycle gap falsifier=none; route-edit meta-gaps wrapping other gaps.
- sync-deploy-drift: node2 copies frozen at 09-26 and /workspace copy empty on node2 — the store is per-node (node-locality).

## 5. Coverage notes
- Sampled scenarios by name pattern (all 2275 names grouped) and read ~12 in full; vessel-scenarios
  grouped and sampled (most are "null").
- Trace evidence limited to legacy `activity_execution_traces` (July-only) and dev-vessel journal since
  09-21; the current trace store was not queried for post-July drafter executions.
- Did not read every script body; read headers of the 12 harnesses that carry the substantive claims.
- CI failure cause read from one run log; the other 19 assumed same (all 10-17 s duration).
