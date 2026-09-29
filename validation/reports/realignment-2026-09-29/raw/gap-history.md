# Gap history (round 2 shard: gap-history), reconstructed 2026-09-29

Scope: what the gap store itself remembers, era by era, about which problem
classes existed and how they came back. Sources were read only. Snapshot copies
for analysis went to `/tmp/gh-hist/` on the host. Nothing in any container was
modified.

## 0. Sources found (and what each one is)

| Source | Location | Rows | Created range | Notes |
|---|---|---|---|---|
| narration gaps | `validation/gaps/gap-001..008.md`, `INDEX.md` (host repo) | 8 | 2026-05-23 → 05-25 | Written by hand by the validator role (commits `e9257033`..`fcf4c4e5`). INDEX says `.yaml`, but the files are `.md`. The INDEX has not been updated since 05-24. |
| pre-class-dedup store | node1 `/workspace/gaps/gaps.json.bak-preclassdedup` | 4522 | 06-13 → 06-14 | 99.7% open. The four meta-detectors (`14ec0de1`, 06-13) flooded it, then dev-vessel `c8be5b1` "dedup substrateGap by CLASS" ran on 06-14. |
| July reset store | node1 `/workspace/gaps/gaps.json.backup` | 220 | all 07-22 | Every `created_at` is 07-22, so the store was re-created on that date. The June store was not carried forward. |
| tracked store in git | super-repo `gaps/gaps.json` @ `3142f140`,`3cbf5a0e`,`3754d093`,`ee6ac596` (07-25) | 238–240 | 07-24 → 07-25 | Untracked on 08-02 by `8f8e87e7`. Only 5 commits, all on 07-25, all from an unscoped `git add -A`. |
| truncated temps | node1 `/workspace/gaps/gaps.json.{856159.60,1761044.46}.tmp` | n/a | 08-07 | Unparseable. These are writes whose rename never completed. |
| fossil store | node1 `/workspace/gaps/gaps.json` (+ `.pre-halt-backup`, `gaps-resweep-snapshot.json` 08-30) | 2670 (backups) / 830 (current) | 07-22 → 08-08, plus stragglers up to **09-26** | Frozen as the live store on 08-08, but it is still written to (see §4.1). |
| operator job snapshots of the then-live super-repo store | host `~/.claude/jobs/af312d72/tmp/gaps_*.json` (09-04), `~/.claude/jobs/074acb94/tmp/gaps{,2..F}.json` (09-05..07) | 2039 → 3548 | 08-16 → 09-07 | These are the **only surviving copies** of the 08-16..09-17 live store. |
| live store | node1 `/workspace/git/super-repo/gaps/gaps.json` | 6279 | **09-18** → 09-29 | The super-repo clone was re-created 09-18 00:56 (dir birth time) and `gaps/` 09-18 16:48. |
| orphan temps in live dir | node1 `/workspace/git/super-repo/gaps/gaps.json.*.tmp` ×14 | n/a | 09-20 → 09-26 | ~98 MB of residue. The atomic-write leak is still active. |
| node 2 store | compose2-live `/workspace/git/super-repo/gaps/gaps.json` | 70 | 09-25 → 09-26 | Frozen since 09-26 12:07. |
| auto-draft decision log | node1 `super-repo/gaps/auto-draft-decisions.jsonl` | 4506 lines | 09-22 → 09-29 | Write-only. |
| landability log | node1 `super-repo/gaps/landability_predictions.log` | 66,866 lines / 10.5 MB | 09-26 → 09-29 | Write-only. |
| funnel series | node1 `super-repo/gaps/funnel-history.jsonl` (47 runs, 09-19 →) and `/workspace/gaps/funnel-history.jsonl` (459 lines, to 09-07) | | | Two series. The old one starts with a TypeScript code block. |
| parked landings | node1 `/workspace/parked-landings/*.json` | 47 | 09-24 → 09-26 | |
| other | `/workspace/gaps/audit-findings-batch.json`, `gap-conceptgraph.json` (07-29) | small | | Not analysed. |

## 1. Timeline of the gap store: eight discontinuities in five months

1. **05-23/24.** Gaps are Markdown files written by a validator agent. gap-003 (goal failure without failure mode) recurred ×12 and gap-007 (named template succeeds but the parent goal still fails, i.e. hollow completion) recurred ×6. On 05-25, gap-008 recorded that the substrate had died unnoticed (iteration 17, `fcf4c4e5`).
2. **06-13 → 06-14.** Four meta-detectors mint **4522 gaps in about 2 days**: `responsibility_misallocation` 1373, `architectural_pattern` 730, `novel_failure_mode_detected` 714, `activity_lifecycle` 697, `resolver_distribution` 684, `trace_outcome_inconsistency` 286. 9 were closed. The fix was class-dedup `c8be5b1` / `c214385` (06-14). *First instance of detector flood → bulk dedup.*
3. **07-22.** The store restarts from zero. The first rows are `orphaned_capability` (108 of 220) plus `auto_draft_decision:<hash>:<kind>` telemetry rows.
4. **07-25 → 08-02.** The store is committed into the super-repo by `git add -A` and untracked on 08-02 (`8f8e87e7`). The commit message says WORKSPACE_ROOT was **absent** from `/etc/substrate/env` on 08-02.
5. **08-08/09. Split brain.** WORKSPACE_ROOT becomes `/workspace/git/super-repo` for some writers. `gap-lifecycle-scan.ts:235` hard-codes `/workspace/gaps/gaps.json`, so the closing lane reads a dead file: it reported 2666 total / 462 open while the live store had 197 / 153 (memory `reference-split-brain-state-trees…-2026-08-09`). The old funnel series (2540 rows, close_rate 0.79) was orphaned and the new series started at 5 rows / close_rate 0.083 (`AUTONOMY_DEMONSTRABILITY_2026-08-22.md:316`).
6. **08-30.** An operator spent an investigation on a false "write-persistence bug" because they probed the fossil path. The snapshots `gaps.json.pre-halt-backup` and `gaps-resweep-snapshot.json` (2670 rows) come from that episode (memory `reference-gap-store-fossil-vs-live-path-2026-08-30`).
7. **09-09.** The store went from 4,113 to 44 rows across a vessel restart (97% loss). It was recovered from orphaned `.tmp` files and a pre-merge backup, ending at 4,187 rows (`ADDENDUM-2026-09-10-operational-evidence.md` §F).
8. **09-18.** The super-repo clone was re-created. The live store's earliest `created_at` is 09-18T00:56. **Of the 3548 rows in the 09-07 snapshot, only 256 ids exist in the live store**, and those are re-detections by deterministic detectors plus auto-draft ids. **Of 264 operator/human-filed gaps before the reset (121 open), 6 ids survive, and all 6 are test fixtures** (`placeholder-scrub-probe`, `heal-probe`, `gap-001`, `post-mutation-probe`, `compose-trigger-guard-on/off-probe`) that tests re-wrote. Every real operator-filed open gap was lost, along with its `failed_attempts` and lessons. Examples: `missing-capability-gaps-expire-before-they-are-ever-attempted`, `the-recommit-path-converts-a-semantic-reject-into-an-inert-landing`, `escalation-bypasses-the-inert-change-gate-so-refused-work-lands-anyway`, `the-trace-store-saturates-the-host-and-starves-the-lane-that-would-repair-it`. Since then 1724 rows were minted on 09-20 alone.
9. **09-28.** The operator audit bulk-closed **734 `missing_capability`** gaps with the resolution "single-goal demand (09-28 audit: 697 open capability gaps, 697 distinct shapes, 0 demanded by 2+ goals)". This is the same shape as the 06-14 dedup and the 09-05 expiry finding.

**Every discontinuity reset the law-7 gap triple.** Latency and durability cannot be computed across a store that is reborn every 4–6 weeks. In the live funnel series, `median_latency_ms` is **0 on all 47 runs** (09-19 → 09-29) and `expired` is 0 on every run while `stale_open` climbs 0 → 1434. The July series had real latencies of about 2.8e6 ms. So gap-latency measurement went dark with the path move, and the expiry closer is dormant on the real store.

## 2. Category census per era

| era (file) | N | top categories |
|---|---|---|
| 06-13/14 preclassdedup | 4522 | responsibility_misallocation 1373, architectural_pattern 730, novel_failure_mode 714, activity_lifecycle 697, resolver_distribution 684, trace_outcome_inconsistency 286 |
| 07-22 backup | 220 | orphaned_capability 108, missing_capability 41, residual_shape_proposal 10, unreachable_producer 10, poison_producer 9, auto_draft_* 14 |
| 07-25 git | 240 | missing_capability 82, orphaned_capability 52, systematic_failure 18, architectural_pattern 13, unreachable_producer 12 |
| 07-22→08-08 pre-halt | 2670 | edit_intent_route 469, missing_capability 452, auto_draft_fallback_recommend 424, auto_draft_triggered 352, null 141, orphaned_capability 136, systematic_failure 131, unreachable_producer 114 |
| 08-16→09-07 (job snapshot) | 3548 | missing_capability 548, edit_intent_route 490, auto_draft_* 1410, systematic_failure 392, orphaned_capability 117, … and a long tail of LLM-invented categories (`bug`, `capability`, `correctness`, `systematic-failure` with a hyphen, …) |
| 09-18→09-29 live | 6279 | auto_draft_* 3372 (54%), missing_capability 763, edit_intent_route 563, systematic_failure ~400, unaccounted_landing 134, self_development 106 |
| node 2 09-25/26 | 70 | orphaned_capability 40, other 10, conversation_only 4 |

The vocabulary is open: live `source` has more than 90 distinct values, including file paths, "LLM", "Automated Analysis" and **uninterpolated templates** (`{{goal.gap_status}}`, `{{substrateGap.source}}`, `{{status}}` …). There are 23 placeholder rows in live, 11 on 09-07, 10 in pre-halt and 1 in June. The operator filed `gap-store-accepts-uninterpolated-template-placeholders-as-a-real-gap` on 09-05; the class is still present on 09-29.

## 3. The one constant: closure composition

Excluding auto_draft telemetry rows:

| era | non-telemetry gaps | closed | attrition (expired / bulk / stale / churned / single-goal) | condition gone (producer_now_exists / already_resolved) | landed or verified reason | no reason |
|---|---|---|---|---|---|---|
| 07-22→08-08 | 1837 | 1365 | **1077 (79%)** | 59 | **105 (7.7%)** | 112 |
| 08-16→09-07 | 2138 | 1176 | **934 (79%)** | 26 | **66 (5.6%)** | 149 |
| 09-18→09-29 | 2907 | 937 | **734 (78%)** | 11 | **52 (5.5%)** | 129 |

Across three generations of the store, about 78% of closes are attrition and about 6% are landed or verified. The headline `close_rate` in the funnel (0.57–0.75 live) is inflated by the auto_draft rows, which are 3372 of 4253 closed. This is the "gap closure is bimodal: instant or expiry" finding of 09-11, reproduced by the numbers in every era.

`edit_intent_route` (operator code-edit route) in live: 563 rows, **8 closed, 555 open**. Derived children (`recommit-*` / `*-narrowed`): 17 on 07-25, 104 on 08-08 (52 closed), 433 on 09-07 (173 closed, 147 rejected), **746 live (29 closed, 713 open)**. Children are 12% of the live store and close at 4%, the same 4% measured on 08-10 (`reference-retry-forks-a-new-gap…-2026-08-10`).

## 4. Mechanisms observed in this shard

### 4.1 Gap-store path (general seam, **broken three ways**)
- `substrate-gap.ts` writes `${WORKSPACE_ROOT}/gaps/gaps.json`. Live WORKSPACE_ROOT is `/workspace/git/super-repo`.
- **`scripts/substrate/typecheck-scenario-gen.ts:27` reads `GAPS_PATH ?? "/workspace/gaps/gaps.json"`.** `/etc/substrate/env` has no GAPS_PATH (checked for the key only). Its timer runs every ~45 min, so all its `typecheck_error` gaps land in the **fossil**. There are 20 such rows, created 09-11 → 09-26, for example `typecheck-development-vessel-src-resolvers-vessel-mitosis-cutover-l2784-ts1005`, `…gap-to-feature-l3394-ts2451`, `…composer-interruption-sweep-l62-ts18048`, all open. That is 20 real broken-build signals the live lane never saw. It also wrote 62 typecheck scenarios to `/workspace/validation/failure-modes/scenarios`. Status: **live, and write-read-mismatched**. It is the seventh hat of the WORKSPACE_ROOT split: 08-02 absent → 08-08 set → 08-09 split brain → 08-30 false persistence bug → 09-05 `autonomy-lift-gate-reads-a-fossil-heartbeat-at-a-different-path` → 09-22 two memory stores (unit `Environment=WORKSPACE_ROOT=/workspace` versus EnvironmentFile) → 09-26 typecheck gaps into the fossil.
- `boredom-vessel/src/index.ts:2393-2401` carries a comment acknowledging the fossil, with the fallback `/workspace`.
- Atomic-write temp leak: about 50 files / 300 MB on 09-10, 14 files / ~98 MB in the live dir now, and 2 in the fossil dir from 08-07. The class has been open since at least 08-07.

### 4.2 `landability_predictions.log` (specific, **write-only**)
- Written by `gap-lifecycle-scan.ts:404-414`. The writer came from substrate-authored `418d80d` (09-26, "apply model-opportunity-gap_landability-compose-report via mitosis cutover"). Its comment reads "Write a compact log of predictions for later validation". **No reader exists in any repo or in `/vessels`.**
- Volume: 66,866 lines in 3 days, 140 distinct timestamps, ~480 lines per tick, about 3.5 MB/day of unbounded growth.
- Informativeness: the scores take **about 12 discrete values** (0.40, 0.43, 0.60, 0.63, 0.77, 0.80, 0.97, 0.99, …) keyed by category plus a few features. `missing_capability` is 0.767 on 10,412 of its lines. The scores are not per-gap discriminative. They feed `gap-landability-model.ts:151`, which **auto-closes below 0.25** (`gap_landability_low`) with a burial guard. That is the calibration-seal family again: a category-level prior decides a gap's fate.

### 4.3 `auto-draft-decisions.jsonl` (specific, **write-only**)
- Fix `goal-host-vessel 3d4aa60` (09-22), "auto_draft decisions go to JSONL, not the gap store". This moved **telemetry that had been polluting the gap store since 07-22** (14 rows on 07-22, 833 on 08-08, 1410 on 09-07, 3372 in live, 635–1337 per day on 09-19..21). The fix worked for the store. The JSONL itself has **no reader** (grep `auto-draft-decisions` finds only the two `appendFile` calls at `index.ts:16822,16877`).
- Content shows repeat-dispatch loops. "reconcile the trace store back under its configured cap" was decided **518 times** from 09-24 to 09-28 (76/107/109/138/88 per day): a remedy that never succeeds and is re-dispatched forever. Others: attempt-ledger canary fixture goals 310 (09-23..26), "Register the resolver `unaccounted_landing_scan`" 216 in one day (09-23), `federation_verification_report` 163 over 7 days, `db_performance_slow_queries` decomposition 98.

### 4.4 Parked landings (specific, **live-read but stranded**)
- `feature-compose.ts:114-133` writes and `gap-to-feature.ts:5257` reads (resume). 47 parks, **all `reason:"pre-cutover"`, all `verify={typecheck,shape_dispatch,tests}=true`, all `judge.addresses=true`.** 41 of the 47 gaps are still open, 3 closed, 1 superseded, 2 missing from the store.
- **25 of 47 target `human-surface-vessel/src/routes/proxy.ts`.** human-surface is one of the vessels the substrate cannot author: it has no gitlink or push clone (memory 09-22 AUTHORABILITY). So passing patches for one file pile up under new `route-edit-*` ids and `-narrowed` copies (`route-edit-6a48da40` and `-narrowed`, `89de2d52` and `-narrowed`, `recommit-the-human-surface-prefers-a-host-mapped-public-endpoint…` and its parent). It is a parking lot with no exit for that vessel.
- 2 parks are the attempt-ledger **canary fixture** (`src/fixtures/attempt-ledger-canary.json`, runs:1). That is test residue in the landing lane.

### 4.5 Funnel history (general, live-used, **metric degraded**)
- `gap-lifecycle-scan.ts:661-742` reads the last 12 lines. There are two series; the old one (459 lines, to 09-07) begins with a markdown TypeScript code block, meaning an LLM wrote code into a data file. The live series has latency 0 and expired 0 throughout (§1).

### 4.6 Class dedup (general, **worked once, recurring need**)
- `c8be5b1` / `c214385` (06-14) dedup by volatile-stripped id. It did not prevent the 09-19..21 flood (1724/day) or the 734-row single-goal-demand backlog closed by hand on 09-28. The dedup is by id, and floods come from **new ids per failure/goal**: `route-edit-<hash>`, `recommit-<parent>-<class>`, `resolver-dist-orphans-<ts>`, `self-repair:timers:<date>` (54 live).

### 4.7 Test-probe fixtures as gaps (**test-residue, three stores, two nodes**)
- The same fixed id set (`some-real-gap`, `flat-{summary,detail,description,text,title}-probe`, `placeholder-scrub-probe`, `heal-probe`, `gap-001`, `post-mutation-probe`, `compose-trigger-guard-{on,off}-probe`, `contract-conformance-probe`) appears in the 09-07 snapshot (created 08-30), in the live store (re-created 09-19 after the reset) and in the node-2 store (09-25/26). So the development-vessel suite writes into whichever live store its env points at, on every run and on every node. pre-halt adds `probe-a..d`, `ladder-rung-9-probe`, `probe-flat-ptr`, `scrub-live-probe`, `probe-auth-test` (08-03..05).
- Filed and re-filed: 08-29 `vessel-tests-call-live-services-so-the-suite-failure-count-tracks-substrate-load` (closed) → 09-05 `a-leaked-test-fixture-trace-has-retried-against-activity-test-for-six-days` (open, then lost at reset) → 09-26 `development-vessel-tests-rewrite-fixture-gaps-into-the-live-store-and-refresh-detected-at` (open) → 09-28 `test-runs-inherit-the-live-environment-and-write-to-live-services` (open). **Four hats; the 08-29 one was closed.**

### 4.8 Narration gaps (`validation/gaps/`) (**fossil**)
- The protocol calls for `bun run validation/scripts/substrate-narrator.ts` and an INDEX sorted by recurrence × severity. The last commit was 05-24. It is superseded by the runtime store. It is useful only as the origin record of hollow completion (gap-007) and missing failure mode (gap-003).

## 5. Recurring families: same root, different hat (dated)

Each line gives a date, the gap id or event, and its status then, followed by what happened later.

**A. Capacity or busy refusal counted as an authoring failure → category or gap sealed** (calibration-seal)
- 08-26 `triage-only-categories-are-permanently-marked-hopeless` closed; `hopeless-categories-are-hard-excluded-so-they-can-never-recover` closed; `hopeless-gaps-are-dropped-by-a-continue-before-scoring` closed (+ `-narrowed`, + `pickmostlandable-continue-drops-hopeless…`, + `hopeless-continue-drops-gaps-before-scoring-retry`). **One defect was filed 5 times in one day.**
- 08-27 `a-capacity-refusal-is-counted-as-a-failed-authoring-attempt` closed / `-narrowed` rejected; `calibration-counts-killswitch-invocations-as-authoring-failures` closed; `category-counter-outlives-the-per-gap-counter…` closed
- 08-29 `a-busy-capacity-refusal-is-counted-as-a-failed-attempt-and-seals-the-category` closed
- 08-31 `autonomous-cleanup-deleted-the-busy-requeue-mechanism` open (an autonomous regression removed the fix mechanism)
- 09-05 `hopeless-seals-at-8-attempts-but-needs-271-to-be-informative` open (lost at reset)
- 09-23 `the-gap-write-nudge-starts-a-compose-pass-without-checking-lane-capacity-so-a-busy-pass-wr…` open
- 09-24 parked `a-directed-gap-to-feature-refused-for-capacity-bumps-failed-attempts-so-five-busy-replies-in-five-minutes-bury-the-gap-under-the-fa-penalty` (verified patch, never landed)
- 09-28 memory: a directed hand-off without `directed:true` produces a silent WITHHELD FAVORABLE
- 09-26→29 landability log: category-level scores gate auto-close at 0.25

**Root that never moved:** attempt accounting does not distinguish "the lane refused" from "the drafter failed", and category-level priors (hopeless, calibration, landability) are consulted before per-gap evidence. Seven or more filings, with 3 declared closed.

**B. The store or state path moved and a reader or writer kept the old one** (write-read-mismatch / sync-deploy-drift)
- 08-02 WORKSPACE_ROOT absent (`8f8e87e7`) → 08-09 split brain (lifecycle scan hard-coded) → 08-22 two funnel series → 08-30 false persistence bug on the fossil → 09-05 `autonomy-lift-gate-reads-a-fossil-heartbeat-at-a-different-path` (closed) and `walk-fs-edit-resolves-vessel-paths-against-wrong-root` (open, lost) → 09-22 two memory stores (680 notes unread since 07-25) → **09-26 typecheck-scenario-gen still writing the fossil (found in this shard, unfiled)**.

**C. Summary or record overwrite destroys fields, then the overshoot** (write-read-mismatch / directed-overshoot)
- 08-28 `gap-summary-overwrite-drops-operator-guards-and-misdirects-the-semantic-gate` open; 09-03 `compose-report-overwritten-by-retry-destroys-the-landing-evidence` open; 09-05 `substrategap-write-replaces-instead-of-merging-destroying-omitted-fields` **closed**; 09-05 `detector-re-emit-overwrites-a-verified-closure-and-erases-its-evidence` closed; 09-06 `spec-refinement-overwrites-a-verbatim-anchor…` closed; 09-11 memory note: `detected_at` rewritten by another lane.
- 09-23 memory: "the gap store carries forward omitted keys". The merge fix overshot, so a cleared `pending_outcome_verification` does not stick; the 09-26 note says "clear doesn't stick (sweep re-derives it)".

**D. Stale-base compose silently reverts a landed commit** (autonomous-regression)
- 08-28 `mitosis-cutover-lands-a-stale-base-patch-as-a-silent-revert` closed / `-narrowed` rejected → 09-24 memory: `6ab8271` undid `a0ff3d3`; `staged_base_sha = PATCHED hash`, so the drift gate deadlocked the lane → 09-26 `a-coalesced-retry-inherits-a-stale-base-compose-that-silently-reverts-the-commit-landed-in…` open. **It was declared closed on 08-28 and recurred twice.**

**E. Restart or drain kills in-flight work** (sync-deploy-drift / spend-envelope-throughput)
- 09-05 `a-vessel-restart-kills-an-in-flight-compose-and-the-dispatch-stays-running-forever` rejected, `accepted-dispatch-lost-to-a-draining-process` rejected, `gap-drain-drops-96-percent-of-all-events` rejected → 09-20 `goal-host-cutover-restart-fires-blind-at-timer-time-killing-in-flight-dispatches` (+ `-narrowed`) open → 09-23 `the-drain-and-quiesce-counters-ignore-gap-to-feature-so-a-self-restart-kills-the-compose…` closed → 09-24 `the-restart-breadcrumb-samples-in-flight-before-the-quiesce…` open. **It was rejected in September and re-filed after the reset.**

**F. Test runs write to live stores** (test-residue-live-state): §4.7. Four hats since 08-29, plus fixture gaps present in every store generation on both nodes.

**G. Behaviour steered by env vars** (env-gating)
- 08-18 `gap-env-gated-substrate-authoring-decision-emit` closed → 08-29 `empty-string-env-vars-defeat-nullish-coalescing-endpoint-defaults` closed → 08-30 `concept-db-health-reports-upkeep-enabled-from-an-env-var` (twice, open) → 09-05 `env-gate-scan-is-blind-to-threshold-gates` rejected → 09-24 `trace-persistence-and-retention-are-steered-by-environment-variables…` open (twice) → 09-26 `the-compose-lane-cap-is-an-env-var-frozen-at-boot…` open → 09-28 `test-runs-inherit-the-live-environment…`. The gap-store path itself is env-steered: `GAPS_PATH`, `PARKED_LANDINGS_DIR`, `WORKSPACE_ROOT` (§4.1).

**H. Inert or hollow landing passes the gate** (hollow-landing)
- 05-24 gap-007 (named-template success but goal fails) → 08-06 `panel-observed-zero-step-hollow-walks` → 08-27 `semantic-gate-misses-an-unwired-new-parameter-inert-landing` → 09-02 `autonomous-land-produced-an-inert-fix-on-a-file-with-no-test-coverage` → 09-05 `substrate-landed-an-inert-patch-backslash-doubling…` closed, `the-recommit-path-converts-a-semantic-reject-into-an-inert-landing` open → 09-06 `the-vacuous-edit-gate-cannot-tell-instrument-repair-from-inert-change` → 09-24/25 the vacuous guard over-refuses (`…refuses-log-level-demotions…`, `…strips-string-literals-with-a-newline-crossing-regex…`), which is the overshoot → 09-27 `a-class1-literal-step-is-verified-by-a-hollow-write-whose-only-reader-is-a-log-line` open.

**I. Gap closes without a fix** (false-verification)
- 08-28 `seventy-four-percent-of-gap-closures-are-ttl-expiry-not-resolution` open → 08-29 `a-gap-with-no-measurement-predicate-closes-on-commit-provenance-even-if-that-commit-was-reverted` → 09-05 `autonomous-closure-paraphrases-a-gap-and-closes-it-without-fixing-anything` → 09-06 `a-gap-was-closed-with-a-remedy-that-never-happened` closed → 09-11 memory: 18-second close, no commit → 09-22 memory: the class-1 arming guard never fires. §3 shows the ratio is unchanged across all three eras.

**J. Missing-capability auto-mint that nobody demands** (gap-content / goal-walk-floor)
- 07-22: 41 rows; 07-25: 82; 08-08: 452 (382 closed, mostly expiry); 09-05 memory: 82% expire and only 4% are ever composed (`missing-capability-gaps-expire-before-they-are-ever-attempted`, lost at reset); live: 763, with **734 bulk-closed 09-28 for single-goal demand**. The filer (goal-walk failure → capability gap) was never changed to require demand. The operator closes the backlog by hand each era.

**K. Forking children instead of enriching the parent** (narrowing-duplicates)
- 07-25: 17 children → 08-10 memory: 21% of the store, 4% close rate → 08-26 `duplicate-route-edit-application-gap-level-race`, `gap-failure-penalty-survives-a-corrected-specification-narrowed` → 08-27 `recommit-gaps-inherit-a-healthy-category-and-outrank-everything` rejected → 09-12 memory: auto-minted children monopolise the compose lane (57%) → live: 746 children, 29 closed; parked landings duplicated per `-narrowed` copy (§4.4).

**L. Detector flood → bulk cleanup** (gap-content / codebase-bloat-fossils)
- 06-13 4522 in 2 days → dedup; 08-06/07 temp files of 4.5 MB; 09-19..21: 808 + 1724 + 1403 per day; 09-28 bulk close of 734. There is no rate or admission control at filing time, and cleanup is always manual.

**M. Placeholder or uninterpolated gaps** (drafter-quality / gap-content)
- June: 1 (`uninterpolated_placeholder_in_activity_id`); 08-08: 10; 09-07: 11 (incl. closed `{{goal.goal_id}}`); 09-05 filed `gap-store-accepts-uninterpolated-template-placeholders-as-a-real-gap` (lost at reset); live: 23 rows with status or source `{{…}}`.

## 6. Claims versus later evidence

- 06-14: "dedup substrateGap by CLASS" (c8be5b1). Later floods of 1724/day on 09-20 and a hand bulk close on 09-28. It did not hold as a general guard.
- 08-02: "untrack runtime state… llm-resolver reads WORKSPACE_ROOT ?? /workspace, WORKSPACE_ROOT absent". WORKSPACE_ROOT was set by 08-08, which caused the split brain on 08-09 and the fossil writes still happening on 09-26.
- 08-28: `mitosis-cutover-lands-a-stale-base-patch-as-a-silent-revert` closed. Recurred on 09-24 (6ab8271 undid a0ff3d3) and 09-26 (open).
- 08-29: `a-busy-capacity-refusal-is-counted-as-a-failed-attempt-and-seals-the-category` closed. Recurred 08-31 (mechanism deleted), 09-23, 09-24 (parked), 09-28 (memory).
- 08-29: `vessel-tests-call-live-services…` closed. Recurred 09-05, 09-26 and 09-28, and fixture gaps are present in every store since.
- 09-05: `substrategap-write-replaces-instead-of-merging…` closed. The overshoot, carrying forward omitted keys, meant a cleared flag does not stick (09-23, 09-26).
- 09-10: the store was restored to 4,187 rows, "0 missing". The whole store was lost again at the 09-18 clone rebuild (256 of 3548 ids survive; 0 real operator gaps).
- 09-22: `3d4aa60` moved auto_draft telemetry out of the gap store. **Held**: no auto_draft rows are created after 09-22 in live. The new JSONL has no reader.
- 09-26: `418d80d` added landability prediction logging "for later validation". Nothing validates it three days later; it is 10.5 MB, write-only.
- The funnel `close_rate` of 0.57–0.75 (live) as a progress signal is contaminated: 3372 of the 4253 closed rows are telemetry, and 734 are a bulk administrative close.

## 7. Keep / fix / drop, from this shard

Keep:
- The idea of `funnel-history.jsonl` (gap-triple series), but repair latency (0 everywhere) and exclude non-gap rows.
- Parked-landing resume. It is a real general seam, but it needs an exit when the target vessel is unauthorable, and dedup per file or edit rather than per gap id.
- `3d4aa60` (telemetry out of the gap store).
- Class-dedup as an admission rule, extended to the families in §5, not only ids.
- The operator-filed gap corpus from 08-16..09-07, which **survives only in `~/.claude/jobs/074acb94/tmp/gaps2.json`**. Its 116 lost open operator gaps (many with measured root causes) should be re-imported or folded into the realignment's class list before that tmp dir is cleaned.

Fix:
- Point `typecheck-scenario-gen` at the live store, or better, resolve the store by shape instead of by path.
- Remove the fossil `/workspace/gaps/` once nothing writes it.
- Bound or rotate `.tmp` residue.
- Make fixture tests hermetic: no default live WORKSPACE_ROOT or GAPS_PATH.
- Stop category-level priors (hopeless, calibration, landability < 0.25) from closing or burying individual gaps without per-gap evidence.
- Separate "lane refused" from "attempt failed" in attempt accounting, at one seam.

Drop:
- `landability_predictions.log` and `auto-draft-decisions.jsonl` as write-only logs. Either wire a reader (an activity that validates predictions) or stop writing them.
- `validation/gaps/` (May narration fossil). Archive it in the commit message.

## 8. Principles distilled

- A gap store that is reborn every 4–6 weeks cannot measure durability. A lost store also loses the recurrence evidence that would show a "fix" didn't hold, so "newly resolved" is structurally unfalsifiable.
- Any state reached by a path (env var, hard-coded default) forks silently when the path moves. Seven hats in this shard alone.
- A log with no reader is not learning; it is disk growth that looks like instrumentation.
- A retry that forks a new gap id defeats every id-based dedup, recurrence count and closure credit.
- Attrition closes about 78% of gaps in every era. A close-rate metric that does not split attrition, telemetry and administrative closes from landed or verified closes is a gamed metric.
- A category-level prior applied to an individual gap (hopeless, calibration, landability) seals work independently of that gap's evidence. The class was declared fixed three times.
- Tests that default to the live environment write fixtures into every store they touch, on every node, for as long as the defaults exist.
