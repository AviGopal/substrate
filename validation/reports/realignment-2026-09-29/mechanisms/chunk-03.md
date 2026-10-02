# Mechanism verdicts: chunk 03 (development-vessel)

Input: `classes/_mech_chunks/03.json` (37 items, area development-vessel). Deduplicated to 27 mechanisms below.
Checked read-only on 2026-09-29 around 05:00Z against `substrate-live`:
- **Live clone:** `/workspace/git/vessels/development-vessel` HEAD `f451e42` (2026-09-29 01:37Z). 262 resolver files and 106 seed files.
- **5-day execution table:** `execution`, 1,587 activity ids, window 09-24..09-29 because of the 150k cap.
- **30-day task traces:** `execution_trace_content` task `resolver_id`, 08-29..09-29, aggregated locally.
- **Lifetime counters:** `variant_performance_metrics` (vpm).
- **Journals:** systemd journals and timers.

**Evidence tiers.** "yes" means corroborated by the execution table or by task traces. vpm `updated_at` alone is not enough, because vpm has two writers and a mass touch happened on 09-28 (see `raw/live-activities.md`). Where vpm is the only signal, `used_now` is **unknown**.

## A. Corrections to chunk claims (live evidence overturns them)

| item | chunk claim | live finding |
|---|---|---|
| parity gate / seam extraction / spliceability | "imported by vessel-mitosis-cutover.ts and change-series-tick.ts" | Only `maintenance/change-plan.js` is imported (`resolvers/change-series-tick.ts:55`). `parity-gate.ts`, `seam-extraction.ts` and `spliceability.ts` have **zero non-test importers**. Meanwhile `composed-cap-author-a-behavior-neutral-seam-extractio` ran **60/0** in 5d: something is trying to reach this seam and failing. |
| draft-gap-closing-activity | "530 runs 09-21..28, 86% failure" | 5d execution table: **3 runs, 0 ok** (last 09-28T18:36). Lifetime vpm 13,105 / 1,629 ok (12%). Variant `-1783049075304`: 4,359 / 0. The detectors that watch it still run (`detect-cascading_…draft_gap_closing_activity` 47, `detect-unclassified_failure_…draft_gap_closing_activity` 46, both in 5d). |
| SHAPE_ACTION instruments (learning_mode, selection_entropy, shape_closure_demand) | "live-unused, 0 executions" | They are **read, but not through a trace**. `boredom-vessel/src/index.ts:2181-2199` (seam 2b: selectionEntropy drives exploration injection, and learningMode drives emphasis in `refreshSubstrateState`, best-effort). `learning-mode.ts` reads selection_entropy and shape_closure_demand. goal-host `index.ts:7237,11522` takes a `learningMode` option. 0 task traces in 30d. There is no boredom journal line for either in 24h, so it is unknown whether reads succeed. |
| probe layer, ingest-doc / stale-pointer, phantom, harness, OOM | "0 traces since 09-14" / "never reached" | vpm: probe-reachable-unlearned 132/114 (updated 09-21); ingest-doc-as-concepts 35/10 (09-28); detect-stale-pointer 15/10 (09-28); harness-run-matrix 102/99 (09-24); detect-phantom-success-trace 27/23; detect-service-oom-cascade 26/24. The execution table corroborates **phantom (5/5 in 5d)** and **OOM (4/4 in 5d)**, and `satisfier:stale_pointer_emit` 2/2 (09-24). ingest-doc, stale-pointer and harness have no 5d execution rows despite in-window vpm dates, so they are marked unknown. |
| substrate-authored/* branches | "origin/substrate-authored/* (62)" | `git ls-remote origin refs/heads/substrate-authored/*` returns **0**. One stale local remote-tracking ref remains. The branches are already pruned. |
| env_gate_fulfilled | "broken" | **Deleted** in `60e3154` ("chore(retire): delete env_gate_fulfilled — unwired, unconsumed, unreachable"). The file is absent from the live clone. |
| rhythm conductor | "live-used" | It runs, but through the bootstrap script `scripts/substrate/rhythm-conduct-tick.ts` on `rhythm-cadence.timer` (15 min). `rhythm_conductor_tick` has **0 task traces in 30d**, and `satisfier:rhythm_conductor_tick` was last seen 09-18 (22/7). In the journal over 3d: `enqueued=0` on 242 ticks, 1 on 37, 2 on 6. The 05:03Z tick logs "does not report a per-family reason". |
| dev-vessel shape list | "260 registered vs 257 route cases" | At f451e42, `routes/impulses.ts` has 262 indented `case "` lines (265 total `case "` tokens). The count keeps drifting; the registered-shapes number was not re-counted here (see `raw/live-resolvers.md`). |

## B. Verdicts

### Keep-general

1. **Compose ownership (`composeOwnership` / `ownedVessels` / `findComposeOwner`)**
   - **Location:** `gap-to-feature.ts:2716,4247,4529`; `routes/impulses.ts:1015`; `config.ts:93`; `composer-interruption-sweep.ts:27`.
   - **Evidence:** "not owned here" appears **1,955** times in goal-host and dev-vessel journals over 3d. Class history `node-locality`: worked 09-26 (988377f, 8645ead, fbb2fab, 1e18e09).
   - **Why keep:** this is the p2p placement seam that the operating model needs, because an absence on one node is not an absence.
   - **Discoverable via:** the `composeOwnership` shape in the discovery registry, already advertised.
2. **Rhythm conductor and outcome settlement** (chunk items 0 and 1 merged)
   - **Location:** `resolvers/rhythm-conductor-tick.ts` (settlement 55fba0e, penalty-leg fixes 2bc18d1/dc874da, stale-read fix 329fc5c).
   - **Status:** it is the law-5 seam, but it is driven by a timer and untraced (law 2 gap), and mostly idle.
   - **To make it discoverable:** advertise `timeShapedRhythm` and `rhythmFamilyGoal`. Make the timer dispatch the `rhythm_conductor_tick` activity so each tick lands in a trace, instead of importing it in-process. Report per-family decline reasons.
3. **Semantic cutover gate** (items 18, 19 and 32 merged; canonical is 32)
   - **Location:** `feature-compose.ts:609` `SEMANTIC_CUTOVER_GATE` (default on, env-gated off-switch). Types for `on_live_path` and `reachable_symbols` at `:622,:634`. `verifyPatchAddressesGap` is reused by `patch-with-tools.ts:1501`.
   - **Known limits:** it has passed inert patches (7e6fd80, dd34918, 314f228) and flipped its verdict on identical bytes (09-23). `apply-proposal-as-patch.ts:985,1185` states the gate is **not** on that path.
   - **Discoverable via:** already on the only landing lane. Follow-up: put it on the apply_proposal path, or retire that path.
4. **Compose and cutover trace emission (`softRefuse` / `cutoverApplied`)**
   - **Location:** `vessel-mitosis-cutover.ts`, `gap-to-feature.ts`, `seed/mitosis-tick.ts`, `push-health-observer.ts`.
   - **Evidence:** `vessel_mitosis_cutover` 24,660 tasks in 30d.
   - **Still open:** `gap_to_feature` has **0 task traces in 30d**, so the 08-29 "untraced" claim still holds.
   - **Discoverable via:** the trace store.
5. **Class-3 re-land-aware landed evidence (first landing = pending)**
   - **Location:** `gap-to-feature.ts` around 2815-2830. The live comment cites the inert close bafd83d. Class `hollow-landing` says it worked (08-14).
   - It was minted from exactly the fs_write hole in item 21 below.
   - **Discoverable via:** it is part of the gap-closure predicate. Also record it as a concept for the drafter.
6. **cyclic_flow_scan** (stability detector)
   - **Evidence:** 515 tasks in 30d; `development-vessel:cyclic-flow-scan-tick` 34/34 in 5d (lifetime 3,926 / 658).
   - **Residue:** the detector that watches it (`detect-cascading_development_vessel_cyclic_flow_scan_tick`, lifetime 7,151) is residue from its failing history and a candidate to retire.
   - **Discoverable via:** seed `cyclic-flow-scan-tick` plus the registered shape.
7. **Topology measurement (learned_topology_snapshot + substrate_health_tick + coverage_tick)**
   - **Evidence:** learned_topology_snapshot 211 tasks in 30d, `satisfier:learned_topology_snapshot` 84/37 in 5d. substrate_health_tick 179 tasks in 30d. coverage_tick 12 tasks in 30d (last 09-23), vpm 161/126.
   - **Merge:** `reachable_unlearned_report` (3/1, last 08-25) and `unknown_shape_report` (9/5, last 08-01) merge into this.
   - **Retire the ribosome duplicates of one pair**, keeping one canonical: `learned-composition-learned-topology-snapshot-to-substrate-health-tick`, `…-substrate-health-tick-to-learned-topology-snapshot`, `…-to-learned-topology-sna`, `auto-mint-learned_topology_snapshot`, `learned-auto-mint-learned-topology-snapshot-1jk8z5`, `composition:substrate-health-tick-to-learned-topology-snapshot`.
8. **Dev-vessel shape list (`config.ts` discovery.shapes + route switch)**
   - The single source of the registry. It drifts from the route switch (see section A).
   - **Discoverable via:** the registry itself. Follow-up: have `advertised_shape_coverage_scan` enforce agreement between the two.
9. **Advisory Ed25519 vessel identity (H2)**
   - **Location:** `discovery-registration.ts:15-29`, `VESSEL_IDENTITY_KEY_PATH`. Registry identity comes from discovery `ffd1d58`.
   - **Evidence:** only dev-vessel is `verified`; the other 10 vessels are `unverified`.
   - **Why keep:** it is the trust root for p2p. The next step is enforcement, not a new mechanism.
10. **registry-change-observer lifecycle fan-out**
    - **Location:** `observers/registry-change-observer.ts`, started at `index.ts:6`.
    - **Evidence:** its downstreams ran recently (probe-reachable-unlearned vpm 09-21, harness-run-matrix 09-24, coverage-tick 09-27). No journal line in 24h. used_now unknown.
    - **Why keep:** it is the event-driven trigger seam and the reader that item 13 depends on.
11. **learning_mode / selection_entropy / shape_closure_demand**
    - Boredom selection inputs, read directly (see section A). Keep them, but route the reads through a traced resolve so the loop can see them.

### Keep-specific

12. **runtime-drift watchdog.** `scripts/substrate/runtime-drift-tick.ts`, 10-min timer. At 04:59Z: 18 vessels checked, 2 not coverable (demo-vessel, relevance-sink-vessel). Repair is gated by `RUNTIME_DRIFT_REPAIR` (law 1). It falls under the bootstrap and watchdog exemption.
13. **concept-bridge-observer.** 641 journal lines in 6h. The hardcoded `BRIDGEABLE_SHAPES` (`observers/concept-bridge-observer.ts:54`) is a law-1 constant. Part B is deferred to `openspec/changes/2026-05-28-concept-bridge-observer/`.
14. **solicitation_outcome_scan (escalation backlog self-report).**
    - **Evidence:** satisfier 10/9, last 09-26.
    - **Address:** `solicitation-outcome-scan.ts:38` resolves the endpoint via discovery first and falls back to the pinned `:8270`, which is the replaced vessel (memory 09-22). 175b9f1 pinned it.
15. **detect-phantom-success-trace / phantom_trace_scan.** 5/5 in 5d, 17 tasks in 30d. The motivating 9,367 figure was an artefact, but the question it asks (success with empty output) is the hollow-completion class.
16. **detect-service-oom-cascade / service_oom_cascade_scan.** 4/4 in 5d, 20 tasks in 30d.
17. **detect-stale-pointer.** vpm 15/10 (09-28); `satisfier:stale_pointer_emit` 2/2 (09-24). Belongs to the docs-drift class. used_now unknown.

### Revive-general

18. **harness-run-matrix** (activity form of `validation/scripts/failure-mode-harness.ts`)
    - **Evidence:** vpm 102/99, last 09-24.
    - **Why revive:** under the script-retention rule in CLAUDE.md, this activity is what keeps the script trustworthy.
    - **Broken part:** `harness-check-scenario` (81/14, last 07-12) is broken. Its mis-wire gap is present in the live gap store: "declares input(s)/variable(s) no task consumes [gapScenario]".
    - **Discoverable via:** registry-change-observer and the rhythm family.
19. **probe-reachable-unlearned** (with probe-untraversed-edge merged in)
    - **Evidence:** 132/114, last 09-21. probe-untraversed-edge 73/14, last 06-30.
    - **Recurring class it serves:** 60% of Thompson picks go to arms with 2 or fewer observations that are never executed (`raw/live-activities.md`).
    - **Discoverable via:** registry-change-observer.
20. **parity gate / seam extraction / spliceability** (`src/maintenance/`)
    - **Evidence:** general, zero callers (see section A), but a 60/0 seam-extraction goal is demanding it. The dev-vessel resolver tree is 75k lines.
    - **Discoverable via:** wire it as an activity behind `vessel_mitosis_evaluate` rather than minting a new splitter. If nothing adopts it within one review, fossil it.

### Broken

21. **fs_write WRITE_ALLOWLIST scoping** (`resolvers/fs-write.ts:28-53`)
    - **Evidence:** `WRITE_ALLOWLIST` does not appear in the unit environment. The outer guard `!== undefined` skips the check. The inner deny fires only on an empty string, and after its `throw` there is a dead `return`.
    - **Recurrence:** the "fix" landed three times (69d680b, bafd83d, 6586f17). This is the recurring-for-the-same-reason failure, and it produced item 5.
22. **gap_to_scenario_bridge classKey dedup**
    - **Evidence:** 4,573 files in `/workspace/validation/failure-modes/scenarios` plus 3,365 in the super-repo copy. The tick ran 18,203 times in 5d (12% of the trace cap); 42,015 tasks in 30d.
    - **History:** dedup was tried 06-14 and reverted (class `narrowing-duplicates`). Writer and readers use different roots (class `write-read-mismatch`).
23. **create-shape-provider-goal** (escalation primitive; `escalate-unknown-shape` dispatches it)
    - **Evidence:** vpm 101,633 / 0, beta 101,634; the last execution was 07-13. `resolvers/trace-outcome-validity-audit.ts:96` says it produced recommendations but was recorded as failure, so this is a grading mis-record.
    - **Consequence:** it is a poisoned arm, still a live row, and still referenced by `seed/recover-from-goal-failure.ts:143` (0 runs) and `lib/meta-templates.ts:29`.
    - escalate-unknown-shape: 7/7, last 06-19.
24. **code_locality shadow resolver + mining tick**
    - **Evidence:** `development-vessel:code-locality-mining-tick` 31/31 in 5d, but `/workspace/locality/code-locality-index.json` was last written **09-18**. Only `shadow-log.jsonl` advances (09-29). `satisfier:code_locality` last 08-27.
    - A tick that reports success without rebuilding is a silent pass.
25. **comprehensibility_check**
    - **Evidence:** 0 task traces in 30d. `seed/detect-gate-saturation.ts:8,29` records that it scored 0.000 on every authored chain. Its consumer `draft-activity-from-pattern` ran 12/0 in 5d.

### Merge-into / duplicate-of

- **detect-recurring-pattern** (vpm 2/0): duplicate of `development-vessel:detect-recurring-trace-pattern` (22/18 in 5d).
- **credit_primed_concepts** (1 task in 30d, satisfier 2/0): its only wiring is `seed/draft-gap-closing-activity.ts:590`, which is a fossil. Merge it into feature_compose's lesson credit at the compose terminal (compose_lesson has 0 credited).
- **ingest-doc-as-concepts** (vpm 35/10): merge into the `ingest-docs` path (6h, working reader: feature-compose consultPrinciples). Keep one ingestion and make the timer dispatch the activity. used_now unknown.
- **reachable_unlearned_report and unknown_shape_report:** merge into topology measurement (item 7).
- **learned-composition topology duplicates:** merge into `learned_topology_snapshot` (item 7).

### Fossil

- **draft-gap-closing-activity** (items 5 and 7 merged; ids `development-vessel:draft-gap-closing-activity`, `…-1783049075304`, and one `activity:⟨…⟩` row) and its `gap-closing:*` 4-task report skeleton output (1,742 identical rows in the pool).
  - **Why fossil:** superseded by feature_compose. Its outputs are reports, not fixes.
  - **Archive:** the retire primitive (19ae84e) on the activity rows and the watching `detect-*draft_gap_closing*` detectors. Salvage `prior_failed_attempts` (60 tasks in 30d), which becomes one of three failure-memory stores to unify with the goal-host `goal_hash` store.
- **PR-authorship chain** (items 6, 8 and 36 merged): `publish-substrate-authored-artifact` (16/10, last 06-19), `evaluate-pr-via-internal-idioms` (8/1, still selected 09-27), `gh_pr_merge` / `deriveConvergentValidity` (satisfier 4/1, last 09-06).
  - **Why fossil:** superseded by direct push through the mitosis cutover. Remote branches are already gone.
  - **Archive:** retire the rows, and remove the seeds by a commit whose sha is the archive (the same pattern as 60e3154).
- **predict-and-verify / refine-on-disagreement:** 0/0 lifetime. Held out at boredom `index.ts:547`. The prediction-verify idea lives on in the causal attempt ledger. Retire the rows.
- **Obsidian observation seeds:**
  - `observe-obsidian-events` 8/2 (still selected 09-28)
  - `group-interaction-episodes` 48/4 (last 07-01)
  - `probe-obsidian-action-effects` 0
  - Unwired by the non-obsidian feeder change, and the Obsidian surface was replaced. Retire.
- **implicit-vessel-scan / obsidian-behavior-scan / interaction-expectation-verify:** 0 task traces in 30d. Satisfiers: obsidian_behavior_scan 6/5 (07-24), interaction_expectation_verify 11/4 (09-20). solicitation_outcome_scan (item 14) supersedes the read path. Remove the route cases and shapes by commit.
- **env_gate_fulfilled:** already removed (60e3154). `env_gate_scan` is registered but unseen in 30d.

## C. Principles evidenced
- Most "dormant / 0 traces" claims in the input were wrong in one direction or the other. A negative needs the execution table and task traces under the same id, and vpm dates alone cannot serve as the control.
- **Untraced but read** (the rhythm conductor, learning_mode and selection_entropy into boredom) is a different class from **unused**. The fix is to route the read through a traced resolve, not to retire it.
- The recurring-for-the-same-reason failures in this chunk are fs_write scoping (3 landings), scenario dedup (tried 06-14, 7.9k files returned) and create-shape-provider grading (101k failures before anything stopped it). Each needs a measured predicate, not another landing.
