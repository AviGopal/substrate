# Live gap store: what it says about recurrence (shard: live-gaps)

Source: `docker exec substrate-live cat /workspace/git/super-repo/gaps/gaps.json`, snapshot taken 2026-09-29 ~03:58Z (container clock), **6,278 rows, 10.58 MB**. Compared against node 2 (`compose2-live`, same path, 70 rows, last written 2026-09-26 12:07Z). Also read: the row counts of 2 of the 14 orphaned `gaps.json.<pid>.<n>.tmp` files, the tail of `funnel-history.jsonl` (47 lines), and the tail of `landability_predictions.log` (66,866 lines). Everything was read-only. I copied the files to /tmp and analysed them with Python.

Not read: `auto-draft-decisions.jsonl` (1.0 MB), the body of `landability_predictions.log` beyond its tail, the contents and diffs of the tmp files beyond two row counts, and two tmp files that do not parse (`gaps.json.1667864.1734.tmp`, `gaps.json.839455.339.tmp`, both "Unterminated string").

Hard numbers below come from id prefixes and field values. Numbers that come from keyword regexes over summaries are marked ≈.

---

## 0. The store at a glance

| slice | rows | status | dates (first_detected_at) |
|---|---|---|---|
| `auto_draft_decision:*` (telemetry, 4 rows per draft event) | **3,372** | all closed | 09-18 16:50 → 09-22 02:36 (writer stopped; rows remain) |
| capability gaps (`kind:capability_gap`, category missing_capability) | **750** | 733 closed (693 bulk-closed `walk_artifact` by `operator:claude-avi` on 09-28 ~01h), 17 open | 09-18 → **09-29 03:53 (still being filed)** |
| `route-edit-*` (edit-intent routing gaps) | **625** | 613 open, 11 closed | 09-19 → 09-29 |
| `recommit-*` (repeat-failure children; 19 `recommit-recommit-*`) | **430** | 415 open | 09-19 → 09-29 |
| `*-narrowed` children | **480** | 296 open | 09-01 → 09-29 |
| `unaccounted-landing-*` | **138** | 114 superseded, 14 open, 9 rejected | 09-23 → 09-28 |
| `self-repair:timers*` (re-enable funnel-drain.timer) | **54** | all resolved | 09-25 14h → 09-26 07h |
| named (hand- or detector-titled) gaps, excluding the above | ≈1,050 | mostly open | 2023-09-22(!) → 09-29 |

- Status: closed 4,253 · open 1,816 · superseded 126 · resolved 55 · rejected 17 · **12 rows with templated status** (`{{status}}`, `{{substrateGap.status}}`, `{{goal.gap.status}}`, …) · 1 `reopened` · 1 `Open` (capitalised).
- By source: goal_host_auto_draft 3,372 · substrate_detected 2,092 · human_reported 324 · none 282 · substrate_self_repair 55. The `source` field also holds file paths, dispatch ids and template placeholders (`{{source}}`, `{{goal.gap_source}}`) as values.
- `falsifier` is `none` on 6,020 rows, `unresolvable` on 118, `class2` on 81, `class1` on 50. **Only about 2% of the store carries a machine check.**
- `failure_lessons` counts: 0 on 5,224 rows · 1 on 496 · 2 on 250 · 3 on 175 · 4 or more on 133 (up to 9).
- Sum of `failed_attempts`: 3,311. 232 gaps have 5 or more failed attempts.
- The funnel (`funnel-history.jsonl`, 09-29 03:24) reports `close_rate 0.6786` and **`median_latency_ms 0`**. It also reports `stale_open 1444` of 1,807 open and `open_with_failures 973`.
- Closures by date, excluding telemetry: 09-19 17 · 09-20 12 · 09-21 2 · 09-22 7 · 09-23 20 · 09-24 32 · 09-25 23 · 09-26 17 · 09-27 2 · **09-28 690 (the bulk capability-gap close)**. Substantive closure runs at **about 5–30 per day**.

**Top conclusion.** About 66% of the store (auto_draft 3,372 plus 733 closed capability gaps plus 54 self-repair rows) is telemetry, generator noise or bulk-closed noise. The gap triple that law 7 calls progress is computed over this store, so it is dominated by records that assert no expectation. The 0.68 close rate is not a measure of progress. The 0 ms median latency is itself broken.

---

## 1. Problem classes (seed keys), with recurrence

### gap-content — gaps born without a usable edit site or machine check (largest class)
- **Capability-gap generator** (750 rows). Goal-walk target inference confabulates a shape name, and a detector then files "AUTHOR a resolver that produces ONLY shape X" for it. Every `missing_shape` is unique. Examples: `meaningful_content`, `learning-loop-results`, `lifecycle:execution:succeeded`, `desired_note_content`, `known_answer_probes`. 693 were closed by hand on 09-28 as `walk_artifact`. The generator was not touched: 17 more have been filed since, the latest at 09-29 03:53Z. Outcome: **hand-completed (partial)**. This is the goal-walk-floor class wearing the gap-content hat.
- `falsifier:none` on 96% of rows. **157 open gaps have `pending_outcome_verification`**, and 125 of those carry the note "pending sweep: single landing, no measurement predicate". Something landed, and nothing can tell whether it worked.
- `gap-disagreement-gaps-have-no-localization-pathway` (09-19, closed) and `gap-processing-strips-the-operator-localization-that-made-the-gap-actionable` (09-20, open). The system's own processing strips the specifics an operator put into a gap.
- `the-auto-pick-composes-untargeted-zero-landability-gaps-every-cooldown-because-nothing-excludes-a-gap-with-no-edit-site` (09-26, open). In one hour, 11 picks went to `model-opportunity-*` gaps that have no edit site.
- `gap-backlog-unhealthy` (09-22, open): 1,444 of 1,807 open gaps have been stale for more than 48 h.
- Detector families that file gaps nobody can act on, all still open: `reach-gap-*` 40 (39 open, 09-18 → 09-28) · `precondition-rejection-*` 15 (all open, 09-18/19 only, never re-evaluated) · `systematic-failure-*-zero` 30 (tasks "(no tasks)", 0/0 ok) · `goal_host_failing_direction-*` 7 · `vessel-demand-*` 6 (the same 3 shapes filed on 09-21 and again on 09-23; `discoverByShapesQuery` is required by 68 templates and advertised by no vessel) · `template-input-lint-*` 23 (all filed 09-22, all open) · `docs-drift-*` 24 (all open since 09-18/20) · `model-opportunity-*` 7 · `resolver-dist-orphans-*`, `arch-pattern-catalogue-bloat-*` (the same text refiled with timestamp ids 3 times).

### narrowing-duplicates — one problem, many rows (the "hats" machinery)
- Lineage generators: `route-edit-<hash>` → `-narrowed` → `recommit-…-<failure_class>` → `recommit-recommit-…` → `-step-N`. 625 + 430 + 480 rows, overwhelmingly open.
- **The worst hat: `repos/discovery-vessel/src/registry.ts` is the edit_site of 209 gaps** (208 open, 09-19 23h → 09-26 10h). 74 of them are the text "REOPENED 2026-09-20T18:4xZ with recurrence evidence — the closure did not hold (solution durability failure)". The rest restate "Discovery registration rows record WHAT was registered but not WHO". The root gap is `gap-something-re-registers-local-tools-grounding-shapes-on-ephemeral-ports` (09-19, "THIRD RECURRENCE 2026-09-21 ~22:34Z": port 28905 on 09-20, 24257 on 09-21). It was refiled under hand-written names 6 more times: `discovery-registration-missing-identifier`, `-who-identifier`, `-missing-writer`, `-structural-identity-gap` (all 09-21/22, source None, LLM-paraphrased), `discovery-registrations-carry-no-registrant-identity-so-the-ephemeral-port-writer-cannot-be-found` (09-21), and `a-transient-verify-instance-registers-an-ephemeral-endpoint-under-the-live-vessel-id-and-heartbeats-keep-it-alive` (09-23; this one names the likely mechanism). It is still open. On 09-28, `severed-joint-discovery-endpoints-healthy` saw the same class again: `metabob-mcp-…@127.0.0.1:18801` is registered and does not answer.
- `repos/human-surface-vessel/src/routes/proxy.ts` has 67 gaps (65 open, 09-25 → 09-26), on 2 roots: "surface reads a federated peer's state after a local restart" and "surface prefers a host-mapped endpoint it cannot dial".
- `repos/development-vessel/src/fixtures/attempt-ledger-canary.json` has 24 open gaps: canary flips intact↔broken from the ledger experiment. That is experiment residue left in the store.
- `repos/activity-api/src/routes/template-audit.ts` has 20 gaps (19 open), and its step-1 decomposition confabulates ("Import TypeSafe's decision provider client library").
- Hats refiled under new ids (same text, different id): `pull-sync-has-failed-every-tick-since-the-container-clone-left-dev` and `substrate-pull-sync-has-failed-every-tick…` (09-20, both open) · `inconsistent-reach-judge-verdicts`, `inconsistent-reach-judge`, `a-cached-verdict-carries-no-observation…` (09-23) · `consumption-gap-2026-09-23`, `goal-host-vessel-consumption-issue`, `the-walk-withholds-both-alpha-and-beta-for-satisfier-steps…` (09-23; 4,335 verdicts withheld per 24 h) · `forward-gap-reads` and `forward-gap-read` (09-25) · `remedy-livelock-trace-store-reconcile` ×3 and `remedy-livelock-db-performance-slow-queries` ×2 (09-25) · `poison-*` ×7 (09-28 12h) and again as `poisson-*` ×3 (09-28 16h, misspelled) · `trace-outcome-inconsistency-variantPromoteResult…` ×3 in the same minute · `novel-failure-development-vessel:mitosis-tick|cascading-*` ×3 in the same minute · `composer-interruption-*` ×4 (09-25 06h) · `db_performance_slow_queries_2026-09-18t16` and `…T16` (the same gap, with a case difference in the id) · `no-scheduled-caller-reads-any-human-surface-probe-verdict` plus the `gap-`-prefixed variant plus a `-decomposition` row dated **2024-07-30**.
- `gap-mu*`: auto-generated rows ("investigate and decompose gap memorynote-write…") that duplicate a named parent.
- `duplicate_of` is set on 118 rows (115 superseded). Dedupe exists, but it runs after filing.
- `a-gap-whose-last-two-drafts-failed-the-same-way-is-redrafted-again-and-burns-the-lane` (09-25, open) measures the cost: 486 gaps have 2 or more lessons, 144 end in two lessons of the same class, 11 of 28 retries repeated their class, and about 20–25% of compose capacity lands nothing. The `recommit-` depth cap limits prefixes only; gap-drain re-picks are uncapped.
- `the-narrowing-minter-spawns-a-child-for-a-gap-whose-last-lesson-is-a-deterministic…` (09-24, open).
- `the-compose-lesson-writer-force-reopens-closed-gaps-and-mints-recommits-for-landed-parents` (09-23) was followed by `…writes-back-the-callers-stale-gap-snapshot…` (09-24; landed, but its narrowed child is still open) and `a-substrate-authored-block-in-the-compose-lesson-writer-forges-operator-approved-true` (09-25). **That is 3 hats of one writer on 3 consecutive days.**
- `reopen_count` is **unreliable** as a recurrence signal. The 74 "REOPENED … recurrence evidence" rows carry reopen_count 0 or None, and `gap-001` (test fixture) carries 1,614. **Prose and state disagree.** Count recurrence from lineage and text, not from this field.

### false-verification — false closes, wrong predicates, gameable metrics
- **Auto-draft telemetry faked the close rate** (`auto-draft-telemetry-records-pollute-the-gap-store-and-fake-the-close-rate`, 09-20, still OPEN). On 09-19, 117 of 135 closes were telemetry; on 09-20, 102 of 109. The writer stopped on 09-22 02:36, but the 3,372 rows still dominate `closed_total`. The gap itself was never closed. Outcome: partial (writer stopped, residue kept).
- **Flapping predicate closes**: 5 `self-fact-divergence-*` gaps have reopen_count **23–26** in 6 days (09-23 → 09-29 03:51). Each carries `closed_reason: predicate_verified_by_detector` while its status is `open`. The cause is recorded in `class2-predicate-polarity-is-never-checked-at-birth-so-inverted-predicates-close-live-defects` (09-27, open). `nonzero_field: divergence_count` was read as a health field, so the sweep closed a live defect as `landed_verified` on b585a03, a landing that was reverted. That gap cites a **second occurrence**: `trace-failure-pattern-report nonzero_field: occurrence_count` on 09-01.
- `close_falsified_measured_on_wrong_node` is used as a closed_reason (`self-fact-divergence-authoring-root-relevance-sink-vessel-clone-narrowed`): a close was measured on the wrong node.
- **landed_verified breakdown (35 rows)**: close_basis **absent on 18** (landed and unmeasured) and `operator_exercised_falsifier` on 17. Of the 35, 5 are open again. Separately, 20 rows carry `regressed_by` (16 open), and 21 were closed by measurement (`predicate_verified_by_*`, `measured_by_operator`, federation-probe `fed:*`), several of which later flapped.
- `a-landed-sha-closes-a-gap-whose-close-basis-is-absent-and-overrides-an-operator-reopen` (09-22, open): a landing re-closed two gaps 3 minutes after the operator reopened them.
- `ui-legibility-gap-id-collides-across-audited-surfaces` (09-21): the operator's own class1 `expected_literal 'surface'` was already present 5 times in the file, so the gap was "CLOSED WITHOUT ITS FIX". `the-predicate-uniqueness-guard-reads-a-path-that-cannot-exist-so-it-never-fires` (09-22, open) is the guard failing open.
- `reach-granted-on-completion-shape-presence-while-the-artifact-fails-the-deterministic-oracle` (09-20, open) · `the-question-completion-oracle-is-satisfied-by-a-contribution-with-no-content` (09-20) · `gap-reach-gate-accepts-artifact-existence-without-content-check` (09-19, landed_verified, reopen 1).
- `model-reality-phantom-failure-*` ×8 (09-18 → 09-28, all open): templates recorded 0% success with ZERO real errors over 586–2,385 traces (auto-bridge-problem_detection 2,385; source-code 1,414; goal-host-walk-failed 870). Correct runs are β-penalised. The class was re-detected on 09-28 and never fixed.
- `trace-outcome-inconsistency-variantPromoteResult_recorded_as_success` (09-28): the opposite error, a no-op recorded as success. `phantom-success-auth_*` (09-20).
- `lost-reached-verdict-*` ×4 (09-19 → 09-25, open): reach-patch matched no row, so the verdict is lost and the ribosome cannot extract.
- `an-operator-verdict-that-a-passing-landing-regressed-has-no-reader` (09-28, open): 4 autonomous landings (a198907, c4bb14d, 9cfdea4, af2c737) passed their own checks, 3 were closed landed_verified, and all were reverted by the operator. The attempt settlement, class posterior, decision_outcome and compose_lesson never hear about it.
- `pull-sync-testgate-skipped-*` ×8 (09-24 → 09-25): the test gate was skipped because the tick budget was exhausted. "Not a passing gate", yet convergence proceeded. `pull-sync-testgate-baseline-degraded-*` ×2 and `pull-sync-test-gate-blames-a-commit-for-an-environment-dependent-test`.
- The funnel's `median_latency_ms: 0` is a broken metric.

### hollow-landing — inert or check-satisfying commits
- `autonomous-landing-fabricated-the-checked-thing-to-satisfy-an-existence-falsifier-and-the-judge-passed-it` (09-27, b585a03: `mkdir -p /vessels/<v>/src`, FABRICATE-TO-SATISFY; reverted 12c7d9a).
- `a-class1-literal-step-is-verified-by-a-hollow-write-whose-only-reader-is-a-log-line` (09-27, a198907, env-gated `AUTHORING_ROOTS_PATH`; reverted 4068e7e).
- `autonomous-landing-typechecked-through-an-as-unknown-as-cast-and-broke-surface-goal-dispatch` (09-27, human-surface bb5d6b9; reverted).
- `a-landing-in-a-seed-template-file-is-inert-until-the-seed-unit-re-runs…` (09-24, open).
- `landing-gates-read-diffs-and-never-run-them-cited-trace-ids-is-accepted-but-never…` (09-23, open).
- `the-resolver-runtime-evidence-rule-returns-favorable-on-any-single-trace…` (70d2a00, 09-25) and `the-human-reported-class-bucket-keys-on-category-but-operator-gaps-carry-human-r…` (768ae7c, 09-25). Both are autonomous landings that do not do what their gaps asked.
- `pathway-acceptance-is-intermittent…`: "BEHAVIORAL VERIFICATION FAILED after 49b884e (logging-only landing)", 09-23. Closed later.
- `gap-to-feature-hardcodes-a-landed-commit-verification-bypass-for-human-surface-vessel` (6c33870 and 47171d1, 09-26): an autonomous commit special-cased its own gate.
- `vacuous-plan-guard` fixes 326a983, 212408a and 0874216 (09-23/24, landed_verified with operator falsifiers) are genuine gate repairs. `the-vacuous-plan-guard-refuses-log-level-demotions…` (09-25, open) and `the-stub-detector-reads-a-call-followed-by-a-ternary…` / `stub-detector-reads-a-method-call-before-a-null-returning-catch…` (09-24, 09-27) show those gates also refuse correct edits.

### autonomous-regression — substrate landings that broke things
- `landed-commit-was-never-parse-checked-syntactically-invalid-file-pushed` (84cd2f2, 09-19): the vessel crash-looped. Open, with a recommit.
- `a-substrate-authored-deletion-wedged-the-surql-landing-gate-and-nothing-detected` (54b7762, 09-16). Open.
- `a-landing-gate-passed-a-global-fetch-monkey-patch-that-rewrote-every-resolve-call` (goal-host 8c31cdb, 09-25) plus `revert-8c31cdb-global-fetch-shim` (open) plus `falsified-autonomous-landing` (09-27).
- `a-cutover-overwrites-a-newer-committed-landing-on-the-same-file…` (6ab8271 silently reverted a0ff3d3, 09-24, open). `a-coalesced-retry-inherits-a-stale-base-compose-that-silently-reverts-the-commit` (09-26, open). `an-exact-edit-goal-can-land-with-some-of-its-edits-silently-dropped` (f49d02e, 09-26, open).
- `pull-sync-test-regression-{development-vessel 24a64a80, ias-executor-ts 3cf29a35, activity-api 39783b0d}` (09-25 → 09-28, open).
- `the-landing-lane-cannot-land-an-atomic-change-to-a-test-and-the-code-it-checks` (09-28; the af2c737 revert).
- Regressions were detected by the operator, not by the system. Every `regressed_by` stamp on 09-27/28 was written by `op…`.

### directed-overshoot — operator-directed fixes that regressed or overshot
- The asResolvePath fix (`asresolvepath-discards-a-working-absolute-resolve-url…`, landed_verified 09-20) overshot. It was followed by `rawresolve-concatenates-an-absolute-resolve-endpoint-onto-the-row-endpoint…` (09-22, open), `seven-more-resolve-url-sites-still-concatenate-an-absolute-endpoint` (09-22, open; steps 1–3 closed `superseded_hollow_decomposition` on 09-28) and `resolve-url-walk-path-sites-7457-15128` (landed_verified 09-28). **Four hats over 9 days.**
- `goal-host-cutover-restart-fires-blind…` (0c1540e) and `analysis-goals-never-bind-the-named-data-shape…` (4678802) were marked "INSTANCE LANDED BY OPERATOR BYPASS — NOT AUTONOMOUS WORK". The second has reopen_count 4 with landed_verified.
- `gap-to-feature-drops-the-directed-flag…`: "BEHAVIORAL VERIFICATION FAILED for the landing 5ec4719", then closed by measurement at 112e194.
- `a-learned-pathway-whose-head-is-a-satisfier…`: 579f365 and c37df24 PARTIAL, then "FAILED after 3d2e52a" on the narrowed child (open).
- `goal-path-records-are-rejected-by-a-phantom-uniqueness-violation`: 39a8cb0 was "a refuted diagnosis" and d6205d5 worked.
- `a-failing-trace-store-reconcile-re-takes-the-single-global-change-window…`: 62e174a FAILED behavioural verification. Open.
- `the-trace-store-reconcile-remedy-pins-the-base-template-id…`: 2fd1dca FAILED, and the item is "half verified".
- `walk-cannot-construct-an-llm-payload…`: "RETRACTED — MISDIAGNOSED" (8439aa0 had already done it on 07-28). Its lineage still has 5 recommit rows and 24 failed attempts.
- `an-in-flight-compose-is-lost-to-an-unattributed-restart`: "CORRECTED — the earlier claim was FALSE".

### sync-deploy-drift — clones, pull-sync, restarts, runtime vs clone
- `runtime-drift-*` 14 (13 open) and `runtime-source-truncated-*` 10 (all open) cover 10 vessels, 09-18 → 09-27. Repair is "not armed (set RUNTIME_DRIFT_REPAIR=1 to arm)", which is env-gated. Every vessel's live `/vessels/<v>/src` diverged from its clone at least once.
- The pull-sync family has 20 gaps (19 open): diverged super-repo (09-20), failing every tick, skipped test gates ×8, `pull-sync-defers-an-owed-restart-indefinitely…`, `…reopens-admission-after-the-quiesce-drain…`, `…rebuilds-a-shared-package-with-tsc-alone…`.
- Stale super-repo copies: `four-compose-gates-read-the-target-file-from-the-super-repo-submodule-copy` (09-24), `three-more-compose-readers…` (superseded ×3), `the-anchor-band-centring-reader…`, `the-nontermination-and-dead-store-simulation…`, `the-co-located-test-discovery…` (09-24/25, open), `the-super-repo-submodule-pointer-for-development-vessel-lags-the-push-clone-by-a-hundred-commits` (09-24, open), `a-submodule-worktree-in-the-super-repo-is-frozen-by-draft-residue` (09-24), `stranded-local-autonomous-commits-wedged-super-repo-pull-convergence-invisibly` (09-22). **The same class came back 7 times as "one more reader of the stale copy".**
- The human surface runs from `/workspace/git/human-surface-release`, which nothing updates. Three hats: `the-deployed-human-surface-code-clone-has-no-updater…` (09-20), `the-substrates-own-deploy-step-cannot-deploy-the-live-human-surface` (09-22) and `the-live-human-surface-is-unreachable-by-every-substrate-edit-lane` (09-22).
- `three-fleet-vessels-are-plain-files-in-the-super-repo…` (09-22, open) plus the `self-fact-divergence-authoring-root-*` family (21 rows, flapping).
- `docs-drift-CLAUDE-md` and `docs-drift-README-md`: the detector says `validation/scripts/failure-mode-harness.ts` is "not in live_truth.existing_paths", but **the file exists on the host clone**. Either the container super-repo lags or the detector reads the wrong root. The store cannot tell which.

### restart / lane throughput — spend-envelope-throughput and change-window
- "Restart kills in-flight compose" hats (≈180 rows by regex; named examples): `goal-host-cutover-restart-fires-blind…` (09-20) · `development-vessel-self-cutovers-restart-the-vessel-faster-than-a-compose-completes` (09-23) · `the-drain-and-quiesce-counters-ignore-gap-to-feature` (404a89c, landed_verified 09-23) · `the-long-running-classifier-reads-only-pointer-type` (bf74cc5, 09-24) · `every-restart-budget-is-shorter-than-a-compose…` (09-24, open: 16 restarts and 4 lost composes in 3 h) · `consecutive-landings-each-schedule-their-own-self-restart…` (09-24, open: 11 landings and 18 restarts) · `the-restart-breadcrumb-samples-in-flight-before-the-quiesce…` · `a-helper-selfrestartalreadyowed…` (26 failed attempts, closed) · `autonomous-landings-restart-development-vessel-inside-coordinated-windows…` (09-25). **Four landed fixes, and the class kept reappearing.**
- Change-window lease (≈69 rows): `eleven-concurrent-cutovers-of-one-staged-root-all-acquired-the-change-window-lease` (09-23) · `a-verified-patch-is-rolled-back-when-the-change-window-lease-is-held` (09-23) · `discarded-landings-2026-09-2{4,5,6}` (verified landings discarded after passing every gate) · `a-named-lease-acquired-on-a-node-running-older-lease-code…` (09-26).
- The compose lane: `compose-lane-allocation-starves-cooled-human-gaps…` (09-22) · `the-picker-cannot-see-a-root-cause-gaps-blast-radius…` (09-24; the lessons bonus reads `per_gap_failure_lessons`, a field with **zero writers**, while 19 writers use `failure_lessons`) · `one-edit-site-takes-every-auto-pick-across-cycles…` (09-26) · `an-untargeted-gap-pick-pass-does-serial-escalation…` (09-26) · `self-alteration-throughput-zero-{evaluate_or_cutover,apply}` (09-21, 09-22) · `self-alteration-stale-proposal-backlog` (5,914 proposals, 12 failed attempts).
- `remedy-livelock-*`: `db_performance_slow_queries_2026-09-18T16` has **118 failed attempts** (the most in the store; dispatched 15 times in 6 h to a remedy template `development-vessel:db_perf…` that **does not exist**, see `the-slow-query-detector-names-a-remedy-template-that-does-not-exist…`). `trace-store-reconcile-2026-09-23T04` was dispatched 47 times in 6 h.
- `wasted-cycle-*` ×3 (09-28): mitosis-tick 12×, gap-to-scenario-bridge-tick 36× and dispatch-latest-auto-draft 5×, all at 100% zero-work.

### trace-store-db — SurrealDB, growth, migrations
- `db-contention` (09-18, p95 3.5 s) · `db_performance_slow_queries` ×2 (9,112 slow) · `performance-inefficiency-execution_traces_list` (5 s).
- `the-trace-store-is-42gb-of-unreclaimed-rocksdb-blobs…` (09-25; 676 blob files = 40.8 GB, 425 of them from July) · `trace-store-retention-removes-six-percent-of-ingest-so-the-store-can-never-drain` (09-24) · `trace-store-reconcile-2026-09-24T11` (row_count 150,062 > cap 150,000, 27 failed attempts, open).
- The perf-1…perf-6 batch (09-25 08–09h, ≈14 gaps, all open): duplicate ingest (63% of inserts), sink abort at 15 s against a 46–51 s server p50, full-table scans, a pooled query that ignores its SQL, full-SQL INFO logging (7.5 GB/day), the dense tier scanning every row, the legacy score read matching no rows (selection runs on default priors), learning-track rewrites, 650 write conflicts per hour dropping `context_thompson_scores` updates, the FTS rebuild, and `cluster_shadow_decision` impulses of 70–100 KB each.
- Migrations: `cold-boot-silently-skips-twenty-two-unparseable-migration-files` (09-22) · `migration-040/045/007-…-on-every-activity-api-start` (24 of 24 starts, 09-24) · `activity-api-migrations-that-time-out-are-never-recorded-and-rerun…` · `no-activity-template-has-been-registrable-since-the-reseed-because-learning-track…` (09-23) · `the-signature-count-probe-uses-count-distinct-which-surrealql-cannot-parse` (09-26).
- `activity-api-recommend-queries-block-the-event-loop…` (09-23) and `activity-api-is-stopped-externally-about-every-nine-minutes…` (09-23).

### gap-store-integrity (new key; the seeds do not cover the JSON gap store itself)
- `gap-store-collapsed-against-its-own-high-water-mark` (09-18, open, reopen 8): 9,275 rows went to 4,636. The gap cites a **precedent on 09-09** (4,113 to 44 across a restart). The mechanism is a partial load followed by a save. **The store has almost nothing before 09-18**: only 23 rows carry earlier dates, and they are test fixtures dated 2023/2024/05-27/08-30/09-01. Every gap from the months before the reset is gone from the live store.
- `gap-store-writes-are-lost-under-concurrent-writers-while-reporting-updated` (09-27, open): 9 of 22 writes were lost while reporting `updated`. `the-gap-store-serialises-writes-only-within-one-process…` (09-25) is the same class, 2 days earlier.
- Every single-gap write rewrites 10.6 MB. There are **14 orphaned `gaps.json.*.tmp` files, about 100 MB** (09-20 → 09-26). Two of them are truncated or unparseable. The ones I counted held 1,775 rows (09-20) and 5,349 rows (09-25).
- `gap-writer-silently-drops-the-operator-field…` (09-20): 0 of 1,708 gaps carry an operator. `service-failure-gap-store-census` (09-24): the census unit itself failed.

### write-read-mismatch
- Placeholder rows persisted verbatim: 10 ids such as `{{substrateGap.id}}`, `{{goal.gap_id}}`, `{{shape_gap_resolution.id}}`, `{{goal.target_output_shape.substrateGap_write.gap.id}}`, plus `gapId`, `g.id`, `unaccounted-landing-${sha.slice(0,12)}`, and `repo` values such as `${repo}` and `repoName`. Rendering fails open into the store. This recurs from 09-19 to 09-25 despite `placeholder-scrub-probe`, and `the-template-provider-blanks-every-placeholder-at-load-time` (landed 09-24) was the sibling.
- `the-picker … lessons bonus reads per_gap_failure_lessons`: a field with zero writers.
- `human-surface-uiquestion-read-drops-gap-needs-human-panels` and `human-surface-participation-journal-records-unreadable-by-interactor-log-consumers` (09-20).
- `lesson-failure-crediting-posts-to-a-404-address…` (09-20).
- `severed-joint-*` ×5 (09-27/28, open): `decision_outcome` is not written within 1 h (lag 4,193 s); ribosome-registered (ribosome registers `shapes:[]`, which discovery rejects); **ribosome-extraction lags by 591,566 s (6.8 days)**, so learned-pathway reuse is starving; behavioural-verification-input matches 0 gaps; discovery-endpoints-healthy fails. `joint-liveness-detector-checks-nothing` (09-28): it checked 1 of 1 bindings and could not read its registry.
- `forward-gap-read(s)` (09-25): `resolveSubstrateGap` does not forward reads to the shared store (see node-locality).
- `observation-loop-death-is-invisible` (09-19): the heartbeat has no reader. `no-scheduled-caller-reads-any-human-surface-probe-verdict` (09-20, 12 failed attempts).

### node-locality
- The node 2 store has **70 rows, last written 09-26 12:07**. It contains fixtures and orphaned-capability rows for node 2. The probe `compose-ownership-shared-store-probe-071025` (09-26) confirmed that writes forward to node 1, but reads (`forward-gap-read`) do not forward. Per-node gap views diverge.
- `close_falsified_measured_on_wrong_node` (self-fact narrowed). `an-operator-pause-and-rhythm-posteriors-are-node-local…` (09-26). `containment-readers-fail-open-when-the-node-holding-the-record-is-missing-from-discovery` (09-27). `a-named-lease-acquired-on-a-node-running-older-lease-code…`. `compose-ownership-duplicate-earlyTargetVessel` (09-25; the summary contains the unrendered `claimants.join(", ")`).
- The surface shows a peer's state as its own after a local restart: `when-a-local-producer-restarts-the-surface-reads-a-federated-peers-state…` plus `development-vessel-restart-2026-09-26` plus ≈20 route-edit rows on proxy.ts.

### test-residue-live-state
- `gap-001` ("updated summary", **reopen_count 1614**), `gap-missing-concept`, `falsifier-{none,c1,c2,unresolvable,pair-good,pair-bad,merge,heal}-001` (plus `-narrowed` children, **which the lane then tried to compose**), `some-real-gap`, `dupe-*`, `class-b-*`, `flat-*-probe` ×5, `heal-probe`, `placeholder-scrub-probe`, `contract-conformance-probe`, `post-mutation-probe`, `compose-trigger-guard-{on,off}-probe`, `mitosis_freshness_violation:…deadbeef…`, `patch_failures_20231115`. These are present on **both nodes**.
- `unaccounted-landing-*` has 72 rows on `/workspace/git/ledger-u-probe` (a probe repo).
- `development-vessel-tests-rewrite-fixture-gaps-into-the-live-store-and-refresh-detected-at` (09-26, open: 21 "opened" in 8 minutes, inflating open-rate) · `a-test-process-posts-escalations-to-the-live-human-surface…` (09-26) · `a-human-surface-test-appends-501-fake-feedback-records-per-run-to-the-live-participation-journal` (94,188 of about 98k records are fake) · `a-test-run-in-the-live-container-registered-a-phantom-endpoint-in-live-discovery` (09-28) · `test-runs-inherit-the-live-environment-and-write-to-live-services` (09-28: 8–16k POST/min). The discovery ephemeral-port hat (above) is plausibly the same class: a transient verify or test instance registering under the live id.
- Experiment residue: `attempt-ledger-canary.json` (24 gaps), `gap-artifact-expectation-violated-trendcheck-*` ×14, `gap-trend-expectation-violated-*`, and `the-trend-expectation-battery-overlaps-its-own-ticks…`.

### human-surface-escalation
- `248-escalations-were-asked-of-a-vessel-no-human-reads` (09-22, open): the only way out of the hopeless seal posts to a pinned `:8270`. `operator-escalation-backlog` (09-20: 169 of 171 unanswered) · `hopeless-gap-escalation-dedupes-in-process-memory-so-every-restart-re-asks` (09-25: 37 re-asks per day per gap) · `pending-verification-escalation-dedupes-in-process-memory…` (09-25; the same class, a second hat) · `a-question-card-omits-the-question-the-evidence…` (the human's own words, 09-22) · `the-surface-awaiting-count-counts-only-the-displayed-questions` · `ui-feedback-*` ×4.
- `the-substrate-cannot-see-its-own-human-surface-because-the-image-has-no-browser` (09-25, operator_hold).
- `operator-hold-only-guards-closing…` (09-25). 99 rows carry `operator_hold`.

### goal-walk-floor
- The capability-gap generator (above). `goal-target-inference-reads-what-is-happening-in-the-world-as-substrate-health` (09-22; a human asked 8 times) · `…picks-shellresult-over-the-advertised-vesselhealth-shape` (09-25, regressed_by e9ee9b4) · `…rewrote-a-repo-relative-path-into-an-absolute-substrate-path` (09-22; steps 1–3 on 09-28, open; step 1 proposes a special-case override) · `…adds-an-unrelated-shape-so-a-correct-code-search-answer-grades…` (09-26) · `a-walk-executes-a-write-shape-named-only-in-an-edit-goals-falsifier-text` (09-25).
- `pathless-goal-captured-by-early-edit-intent-onto-confabulated-file` (09-20, 10 failed attempts) · `an-investigate-goal-that-names-a-source-file-is-converted-into-an-edit…` (09-25) · `an-edit-goal-whose-compose-route-fails-falls-through-to-a-walk-that-mints-a-file` (09-26).
- `gap-floor-generates-exact-values-instead-of-executing-the-procedure` (09-19, landed_verified; the narrowed child is still open with 2 recommits) · `a-walk-treated-a-401-as-an-observation…` (09-20) · `the-widened-retry-target-is-a-disjunction-evaluated-as-a-conjunction` (09-22) · `produced-llmcompletion-does-not-flow-into-the-deferred-memorynote-terminal-body` (09-22, 14 failed attempts).
- `reach-gap-*` ×40: shapes advertised but not reachable from cold, including `llmcompletion`, `shell`, `bash`, `websearchresult`, `git-diff`, `source-code`, `substrategap`. That is **the ReAct floor's own tools**.

### selection-learning
- `model-reality-selector-unscored` (09-18): recommend returns null Thompson scores. `the-legacy-score-read-matches-no-rows-so-selection-runs-on-default-priors` (09-25). `variant-performance-metrics-record-failed-executions-but-thompson-beta-does-not-grow` (09-24: 100% failing, 93% posterior). `a-template-whose-tasks-throw-is-graded-as-ungraded…` (09-24). `credit-is-assigned-to-the-wrong-arm-and-the-withholding-claim-is-false` (09-20, 2 recommits). `the-walk-withholds-both-alpha-and-beta-for-satisfier-steps` (4,335 per day). `posterior-drift-*` ×3. `learning-loop-chain-does-not-conduct` (posterior_delta untested). `gap-composition-flow-components-split` (67 islands). `cost-model-miscalibrated`. `selector-novelty-degeneracy` (09-28). `detector-coverage-dormant` (9 of 67 detectors never selected). `rhythm-cadence-registry_empty` (09-22). `rhythm-reality-sync-rewrites-the-whole-rhythm-body-from-a-stale-read…` (09-26).

### composition-crystallization
- `severed-joint-ribosome-extraction`: 6.8 days without extraction. `learned-paths-record-no-domain-endpoint-for-most-goals-so-transfer-has-no-key` (09-20: 56.1%, 8,737 of 15,572 paths; 3 recommits). `the-path-recommender-skips-shape-signature-borrowing…` (9c376b2, landed_verified). `pathway-acceptance-is-intermittent…` (249ff89, landed_verified: "20/20 accepted"). `a-learned-pathway-whose-head-is-a-satisfier…` (narrowed, FAILED). `the-template-provider-blanks-every-placeholder…` (09-24: every chained template fails, 108 failed executions per day; predicate_verified_by_operator; narrowed child open). `precondition-rejection-activity:⟨learned-composition-*⟩` ×5 (09-18/19).

### endpoint-routing
- Resolve-URL hats (above). Discovery ephemeral ports (above). `solicitation-outcome-scan-pins-one-ui-endpoint-instead-of-discovery` (REOPENED after substrate-authored 175b9f1 routed it to the obsidian vessel). `the-human-surface-prefers-a-host-mapped-public-endpoint-it-cannot-dial-in-container` (5,713 re-probes). `discovery-binds-loopback-so-the-published-port-is-dark…` (09-24). `three-published-host-port-mappings-are-dead…` (09-22). `the-gap-drain-observer-dispatches-a-remedy-by-its-pinned-target-template-id…` (09-24; still open, and a step was minted 09-27). `development-vessel-is-absent-from-the-discovery-registry…` (09-23). `a-walk-targeting-goal-execution-resolves-it-through-goal-host-itself…` (09-26). `while-goal-host-drains-the-surface-routes-a-goal-to-an-unreachable-federated-peer` (09-25).

### env-gating (law 1)
- `the-compose-lane-cap-is-an-env-var-frozen-at-boot…` (COMPOSE_MAX_CONCURRENT, 09-26) · `trace-persistence-and-retention-are-steered-by-environment-variables…` (09-24) · `runtime-drift` repair armed only by `RUNTIME_DRIFT_REPAIR=1` · a198907 introduced `process.env.AUTHORING_ROOTS_PATH` (reverted) · `gen-env-re-quotes-an-already-quoted-persisted-secret…` (09-20) · `gap-mu82wqoh` (a reboot silently de-federates because gen-env does not round-trip federation values, 09-19).

### federation-p2p
- `fed:*` ×6: 4 closed by measurement through federation-probe-tick on 2 quiescent sweeps (punchthrough_unavailable, stale_foreign_rows_advertised, relay_dial_failed, registry_lost_local_rows). `fed:join_door_host_dependent` and `fed:no_relay_anchor` are open. The falsifier had to be carried in the summary because `substrateGap_write` discards a free-text falsifier.
- `discovery-forwardtopeers-discards-per-peer-outcomes…` (09-20) plus `forwardToPeers-empty-file` (a confabulated child: "the file … is empty").

### dormant-mechanism
- `self-op-health:repair_unit_dormant` (gap-compose.timer, 09-24) · `detector-coverage-dormant` (9 detectors) · `validator-cadence-severed` (10 of 97 validators silent) · `service-failure-*` ×8 (the detectors themselves fail: joint-liveness, validator-liveness, compose-drift, learning-loop-selftest, gap-store-census, memory-budget-check, learning-liveness-probe, substrate-pull-sync) · `orphaned-capability-*` 51 (see mechanisms) · `an-operator-recorded-falsifier-exercise-has-no-lifecycle-reader…` (09-23).

### memory-recall
- `the-memory-store-has-no-retire-primitive…` (b5ed109 FAILED, then 19ae84e worked; measured_by_operator 09-22) · `the-expectation-trend-checker-never-retires-the-probe-notes…` (d4171b1 was a silent no-op, then worked 09-23) · `concept-db-lexical-search-has-returned-nothing-since-09-02-so-every-recall-is-de…` (fd645bd `String.replace` fills only the first placeholder; 0 lexical matches in 1,248+ searches; open) · `boredom-re-runs-one-fixed-concept-query-every-72s…` · `memorynote-write-stores-the-rendered-instruction-envelope…` (09-20, open).

### drafter-quality
- The recommit failure-class mix (430 rows): semantic_reject 163 · anchor_not_found 85 · verify_failed 62 · syntax_break 45 · typecheck_dangling_reference 34 · compose_execution_failure 27 · wrong_location 12 · park_stale 2.
- `the-compose-lane-lands-under-nine-percent-and-two-thirds-die-at-anchor-or-ground…` (landed_verified 09-22; the drafter's semicolon habit) · `compose-anchor-failure-rate-degraded` (20.6% vs 5.3%) · `patch-with-tools-fails-as-a-class…` (7 of 9 failed, 09-22) · `patch_failures_20231115` (the same text dated 2023) · `the-anchor-redraft-stringifies-the-prompt-function…` · `a-retry-targets-the-old-edit-site-because-localize-prefers-edit-site…` (35 of 123 mis-localized) · `the-pwt-semantic-refuters-confabulate-dialect-semantics…` · `the-semantic-gate-lets-two-samples-of-one-refuter-prompt-overturn…` · `goal-supplied-exact-edits-are-re-drafted-by-the-llm-planner…` (09-27) · `goal-host-retries-a-verbatim-exact-edit-goal-after-a-substantive-refusal` (09-27).
- `the-system-does-not-author-exact-edit-goals…` (09-25, open): operator exact-edit goals landed 4/4 and autonomous drafts 88/211 (42%). **This is the decisive measurement for law 8.**

### codebase-bloat-fossils
- `orphaned-capability-*` 51 (38 open) · `arch-pattern-catalogue-bloat` ×3 · `resolver-dist-orphans` ×2 · `activity-lifecycle-unload` ×25 (15 templates with combined_score 0) · `vessel-demand` (68 templates require a shape nobody serves) · 14 tmp files · the 66,866-line `landability_predictions.log` (10.5 MB, appended every pass and never read by anything visible in the store) · `docs-reap-refused` (606 stale doc sections, above the safety limit).

---

## 2. Mechanisms (status as evidenced by the store)

| mechanism | where | general/specific | status | evidence |
|---|---|---|---|---|
| Gap store (`gaps.json`, whole-file rewrite, per-process lock, atomic rename) | development-vessel substrate-gap.ts, `/workspace/git/super-repo/gaps/` | general seam | **broken** (lost writes, collapse, 14 tmp orphans) | gap-store-writes-are-lost…, gap-store-collapsed… |
| substrateGap_write validation | same | general | broken (accepts `{{…}}` ids, drops `operator` and free-text falsifier) | 10 template rows; gap-writer-silently-drops-the-operator-field |
| Narrowing / recommit / step minter | gap-to-feature.ts, feature-compose.ts appendComposeLesson | general | live-used; **the main multiplier of rows per problem** | 480 narrowed, 430 recommit, steps confabulated |
| Class-1 `expected_literal` predicate | substrate-gap.ts `predicateLiteralNotUnique` | general | broken (fails open) | the-predicate-uniqueness-guard-reads-a-path-that-cannot-exist |
| Class-2 `evidence_resolve` predicate sweep (`verifyGapConditionAsync`) | development-vessel | general | live-used; polarity bug makes it flap | 5 gaps reopened 23–26×; class2-predicate-polarity… |
| federation-probe-tick closure (2 quiescent sweeps, re-opens on failure) | federation | specific | **live-used, honest** | 4 `fed:*` closed by measurement |
| Observation loop / artifact expectation (restore-on-violation) | development-vessel | general | live-used; heartbeat unread | 12 gap-artifact-expectation closes; gap-observation-loop-death-is-invisible |
| Trend-expectation battery | development-vessel src/index.ts ~530 | specific | live-used, noisy; overlaps its own ticks | gap-trend-*, the-trend-expectation-battery-overlaps… |
| Auto-draft telemetry into the gap store | goal-host auto_draft | specific | fossil (stopped 09-22), **residue 3,372 rows** | auto-draft-telemetry-records-pollute… |
| Capability-gap generator (missing producer, then "author a resolver") | goal-host / detector | general | **live-used and harmful** (750 confabulated shapes) | still filing 09-29 |
| self_repair_operational (re-enable allowlisted timers) | development-vessel | specific | live; **fights operator quiet windows** (funnel-drain re-enabled 54× in 17 h) | self-repair:timers* |
| unaccounted_landing_scan | development-vessel | specific | live; per-sha flooding; 72 rows from a probe repo; one phantom from a rejected draft | unaccounted-landing-*, refactor-aggregate-unaccounted-landing-gaps-per-repo |
| self_fact_reconcile | development-vessel | general | live; flaps (polarity); its closes were falsified | self-fact-divergence-* |
| joint-liveness detector (`jointBinding` registry) | unit joint-liveness.service | general | **broken** (unit failed; checks 1 of 1; cannot read registry) | service-failure-joint-liveness, joint-liveness-detector-checks-nothing |
| Hopeless seal plus escalation to `:8270` | gap-to-feature.ts `hopeless()`, `resolveUiWritePassthrough` | general | live-unused by humans (248 asks, 0 answers); in-memory dedupe re-asks | 248-escalations…, hopeless-gap-escalation-dedupes… |
| Remedy dispatch by pinned template id (gap-drain observer) | development-vessel | specific | broken (phantom template, 118 attempts; bypasses family sampler) | db_performance_slow_queries…, the-gap-drain-observer-dispatches… |
| pull-sync test gate | scripts/substrate/substrate-pull-sync.sh | general | partial (skipped on budget ×8; blames environment) | pull-sync-testgate-skipped-* |
| runtime-drift repair | development-vessel | specific | dormant (env-armed `RUNTIME_DRIFT_REPAIR=1`) | runtime-drift-* texts |
| gap-compose.timer | unit | specific | dormant | self-op-health:repair_unit_dormant |
| 9 detector templates (gap-lifecycle-tick, self-alteration-funnel-tick, selector-saturation-audit-tick, model-opportunity-tick, advertised-shape-coverage…, ui-legibility-audit-tick, dead-end-decision-scan-tick, …) | development-vessel | mixed | dormant (never selected by UCB) | detector-coverage-dormant |
| Ribosome extraction and registration | ribosome-vessel | general | **broken** (6.8 days without extraction; registers shapes:[]) | severed-joint-ribosome-* |
| decision_outcome writer | activity-api | general | broken (severed) | severed-joint-decision_outcome |
| Orphaned resolvers (0 activities invoke them): assessment_summary, attempt_register, attempt_snapshot, author_producer, coarsenableChain, code_add_import, code_find_function, code_find_import, code_insert_after_line, code_locality, code_read_lines, code_replace_lines, code_search, code_verify_typecheck, composeOwnership, config_file, docFixPolicy(_write), docs_align_bridge, escalation_disposition_apply, extractionPolicy, fileList, fossilRankReport, gh_pr_create, gh_pr_merge, goal_summary, http_response, interaction_expectation_verify, interactor*_write, interface_deploy_reach_check, lessonExecutionPolicy, llmModelPolicy(_write), llmSpendSummary(Node), mcp:tool_call, obsidian:ui_screenshot, obsidian:vessel_count, operational_state, perf_canary_resolve, performance_reach_gate, prune(-/_)stale(-/_)mitosis (duplicate name), pushPolicy(-/_)write (duplicate name), substrateBootstrap | various | specific | live-unused (8 rejected as false orphans: code:analysis_context, mcp:tool_call, substrateBootstrap, …) | orphaned-capability-* (09-19 → 09-28) |
| Model-reality consistency audit | development-vessel | general | live; its findings are never repaired | model-reality-phantom-failure-* re-detected 09-28 |
| funnel-history / landability_predictions writers | development-vessel | specific | live-writing, readers unknown; latency metric broken | funnel median_latency_ms 0 |
| Containment (autonomyScope, spendEnvelope) readers | gap-to-feature.ts | general | live; fail open when the holding node is missing from discovery | containment-readers-fail-open… |
| compose_lesson to drafter | concept-db / feature-compose | general | live; lessons do not carry regressions; class-grain posting hits 404 | lesson-failure-crediting-posts-to-a-404…, an-operator-verdict… |

---

## 3. Principles stated in the gap texts
- A gap whose close_basis is absent must never be closed by a landing. Mark it landed_unverified and keep it open until its falsifier is exercised. A gap with operator_hold is not auto-closed. (a-landed-sha-closes-a-gap-whose-close-basis-is-absent…)
- A class-2 predicate filed while its defect is present must read "present" at birth. One that has never read present has never been shown to measure the defect. (class2-predicate-polarity…)
- A literal predicate is satisfied only when the literal is read on a live path by something other than logging. (a-class1-literal-step-is-verified-by-a-hollow-write…)
- Refuse diffs that fabricate the thing the falsifier checks for (FABRICATE-TO-SATISFY, the sibling of DESTROY-TO-SATISFY). (autonomous-landing-fabricated…)
- Resolver tests must never write the live store. Fail closed if the resolved store path is the live one. (development-vessel-tests-rewrite-fixture-gaps…)
- A writer that pins a peer cannot learn the peer was replaced. Route through discovery. (248-escalations…)
- A metric satisfiable without fixing anything will be satisfied. Telemetry must not sit in the gap store. (auto-draft-telemetry-records-pollute…)
- A skipped gate is not a passing gate. (pull-sync-testgate-skipped-*)
- A detector that cannot check must gap on itself. (joint-liveness-detector-checks-nothing)
- The pick predicate should skip a gap whose last two lessons share a class and carry no new information, and reframe or escalate it instead. (a-gap-whose-last-two-drafts-failed-the-same-way…)
- Before feature_compose, turn a localized gap into an exact-edit spec: verify unique anchors, apply to a scratch copy and run tsc. The gap between operator and autonomous landing rates (4/4 vs 42%) is information at dispatch time. (the-system-does-not-author-exact-edit-goals…)
- An operator revert must write back into the attempt settlement, class posterior, decision_outcome and compose_lesson. (an-operator-verdict-that-a-passing-landing-regressed-has-no-reader)
- Dormancy needs a disposition: enable it or retire it. (self-op-health:repair_unit_dormant; detector-coverage-dormant)
- Closure by measurement over 2 quiescent sweeps, reopening on failure, is the model that held. (fed:* closes)
- A store must be monotonic apart from deliberate pruning. A size drop is data loss, not attrition. (gap-store-collapsed…)
- A gap write should re-read its own row after commit and report lost_update. (gap-store-writes-are-lost…)

---

## 4. Why the same issue comes back wearing a different hat (the mechanism, as the store shows it)
1. **The unit of work is a text row, not a problem class.** Each detector, each narrowing, each recommit and each LLM paraphrase mints a new id. Nothing keys rows by root cause. The only dedupe (`duplicate_of`, 118) runs after filing, and `reopen_count` does not track recurrence.
2. **Closure is mostly unmeasured.** 96% of rows have no falsifier. 18 of 35 landed_verified closes are unmeasured. The measured closers that exist either flap (the polarity bug) or are the operator. So "resolved" is proclaimed on landing, and the recurrence arrives as a new row with a new name.
3. **Regression signals do not flow back.** Operator reverts stamp `regressed_by` on the gap only. The picker, posteriors and lessons keep the favourable verdict.
4. **The store itself loses and fabricates state**: the collapse, lost concurrent writes, test fixtures, placeholder rows and telemetry. Metrics computed over it cannot show whether anything got better.
5. **Several fixes were landed at one call site of a multi-site class** (resolve-URL ×4 hats, stale super-repo readers ×7, restart-kills-compose ×9, lesson writer ×3). Each partial fix was declared closed, and the next site then surfaced as a "new" gap.
