## 0. Facts (done 2026-09-27)

- [x] 0.1 Landing branch, trigger at landing, leak paths, verification reads, node convergence
  (design.md Context).

## 1. Stage 1: scope containment

- [x] 1.1 LANDED `c110070` (08:38:51, BYTE-EQUAL; goal goals/1.1-1.2-…txt). development-vessel: `autonomyScope` reader (discovery over poolImpulse, newest record,
  30 s cache, fail closed only after a record was seen), exported beside `spendEnvelopeAllows`.
- [x] 1.2 LANDED with 1.1. Admission (autonomous path) refuses an excluded edit site before drafting,
  `stage:autonomy_scope`.
- [x] 1.3 LANDED `c27964b` (08:42:33, BYTE-EQUAL). feature-compose verdict floor: not directed (unknown counts as autonomous) and any
  applied op on an excluded path → withhold FAVORABLE.
- [x] 1.4 WRITTEN 08:43 (pool id `autonomy-scope`, 21 lane-core paths: compose, cutover, pull-cutover, push policy, git push, gap admission, gap store writer, apply-proposal, pool, lease, conductor, router, dev-vessel index/config, goal-host index, posterior update, llm-resolver index, boredom index, discovery/, identity/, scripts/substrate/). Measured on a copy of the live store with the live admission code: 542 of 2,340 open gaps refused `autonomy_scope` (goal-host index 195, feature-compose 105, cutover 78, gap-to-feature 77, …); 164 admitted. Write the `autonomyScope` record (lane-core list) and measure admissible work under it.
- [x] 1.5 PASSED 08:49: admission probe above (scope readable, 21 paths, 542 refusals, no plan call); synthetic undirected exact-edit compose on feature-compose.ts (land:false) → `[feature-compose] autonomy-scope floor: WITHHELD FAVORABLE`, verdict UNFAVORABLE, rolled_back true, runtime file clean, no commit; directed composes on the same files landed all day. Falsifier: an autonomous pick on an excluded file refuses at admission with no plan
  call; a directed goal on the same file lands; a synthetic autonomous compose straying onto an
  excluded file is withheld.

- [x] 1.6 LANDED `d7ec192` (09:14:05, BYTE-EQUAL): `autonomyScope.require_falsifier_classes` (class1/class2) read at admission; with it, 2,343 open → 9 admitted, all with a pre-existing falsifier outside the core. Reason: the first autonomous landing (bb5d6b9, falsifier none) was a live regression that nothing could have refuted.
- [x] 1.7 goal-host `abedf81` (step 0): investigation goals attributed to their parent gap (gapIdOfGoal) instead of minting route-edit gaps.

## 2. Reopen under containment (user approval)

- [ ] 2.1 Envelope ≈ $1/h; release the node-1 lease; the Documentation session releases node 2.
- [ ] 2.2 Observe 24–48 h. Pre-registered: autonomous drafted landing 30–50 % (bar 40 %), 1–3
  verified closures/day (bar 5), landing→closure conversion reported; demonstration parts 1–3
  measured; the 2.8/3.5/5.2 falsifiers of value-per-cost-selection read.

## 3. Stage 2: autonomy node (user decision)

- [ ] 3.1 Container (compute profile; bundled with value-per-cost 4.0's P220 publication).
- [ ] 3.2 Convergence ref read from a shape by pull-sync; `setup-git-push` honours it.
- [ ] 3.3 Move `autonomous_pick` ownership to the node; un-defer value-per-cost 5.5 (ii)/(iii).
- [ ] 3.4 Branch landing: trigger threaded to the cutover, ref-parameterised push/rebase/fetch,
  no mirror or host-sync fallback for non-dev targets, clone reset after a branch push.
- [ ] 3.5 Ref-aware verification: `pending_outcome_ref`, ancestor check against `origin/<ref>`,
  Class 1/1b via `git show <sha>:<path>`, Class 2 and behavioural checks delegated to the node.

## 4. Promotion

- [ ] 4.1 Evidence shape and promotion activity; durability grading.
- [ ] 4.2 Falsifier: the first autonomously authored commit promoted to `origin/dev` with no
  operator action.

- [x] 1.6b LANDED `00c0e5f`: the typecheck-class exemption holds only while the vessel fails typecheck now.
- [x] 1.8 LANDED `bb51374`: under containment admission no longer fails open onto target-less gaps (it had spent node 1's slot on leaked test-fixture gaps from substrate-gap-falsifier.test.ts, whose module-load race writes the live store during in-container test runs).

## 7. Drafting reliability (diagnosis 2026-09-27: 7 days of autonomous composes — semantic-gate addresses:false 107, ungrounded refusals 89, apply/verify mechanics 87)

- [x] 7.1 LANDED `6cb5042`: verbatim-replacement synthesis only for directed composes (gap prose had been synthesized into TS1005 11 of 14 times on one gap); replace_lines records post-edit bytes (spurious ROLLBACK CONFLICT).
- [x] 7.2 LANDED `b0782f8`: grounding falls back to the local filesystem when local-tools is restarting (all 13 '(0 bytes)' refusals in 7 days).
- [x] 7.3 LANDED `87d673d`: the gap's falsifier is stated to the drafter as its SUCCESS CRITERION (law 8).
- [ ] 7.4 Stage-A pre-typecheck loop (plan dry-run → EDIT blocks → splice check → scratch tsc → retry, then verbatim apply), keeping gap.summary untouched so refuters still run.
- [ ] 7.5 A grounding/guard refusal does not bump failed_attempts (isInfraRefusalBody already exempts the class posterior).
- [x] 7.6 LANDED `f26494b`: a gate-named symbol (`suspected_real_location`) resolves to its resolver file, so retries stop returning to the rejected edit_site.
- [x] 7.7 FABRICATE-TO-SATISFY lens for refuters and the drafter's closure criterion (after b585a03 created the tree its falsifier checks for).
- [x] 6.3c LANDED `375ec90`: decomposeGap refuses a step whose falsifier is the parent's own check (one step cannot flip it, so it cannot be verified alone).
- [x] 6.3d LANDED `2de0ae8` (2026-09-29, directed, BYTE-EQUAL; tsc 0; suite 2298/33 = parent): the
  gap_falsify pass decomposes up to 2 predicate-less gaps per scan BEFORE admission (edit site an
  existing source file outside the scope exclusions; no decomposed_at; not a step/recommit/narrowed
  child; no operator hold). Reason: decomposition was reached only after an admitted gap failed
  compose twice, and admission excludes predicate-less gaps, so the 762 open detected gaps with an
  edit site and no predicate were never decomposed (decomposition = 15 checked class1/2 steps in 48 h
  vs 3 from inherit). Cost bound: scan ~20/day → ≤ ~40 LLM calls/day, one attempt per gap
  (decomposed_at stamped on every attempt). Falsifier: node 1 logs `decomposing … before admission`
  and `[gap-decompose]` outcomes; admitted count on node 2 rises above 7 as steps are written.
  Related fixes the same night (value-per-cost 5.5(iv); CHECKINS 09-28 18:30–09-29 00:10):
  holder-held calibration 76bf256/094c230; admission re-tightened to class1/class2 (pool record);
  narrowed child waits for its parent's verdict 3df8ddd; class2 measured only where the store is
  held 5d0788b.

## 8. System-side verification of autonomous landings (autonomy paused until 8.1–8.4 hold)

- [x] 8.1 LANDED `79cdcd9` (consumer) + self-fact-reconcile producer, both byte-equal. Predicate polarity: `zero_field` (DEFECT count) in verifyGapConditionAsync; self_fact_reconcile writes it. `nonzero_field` is a HEALTH field and read divergence_count=1 as fixed, closing a live divergence `landed_verified` on a reverted landing. 21 store rows migrated; obsidian gap reopened.
- [x] 8.2 LANDED `c5d2d1c` (attempt-register: `directed` recorded, null when unsaid, after the refuters caught `=== true` storing false for silent callers) + `c9ba480` (feature-compose passes it). Falsifier PASSED: 8.4a's own landing intent att-mujvy0om-oucybcm reads directed:true. Record `directed` in the attempt intent (attempt-register + feature-compose) so the sweep can tell autonomous landings from directed ones via the `Attempt-Id:` trailer; no intent ⇒ treated as directed, never auto-reverted.
- [ ] 8.3 Cutover `revert_of` mode: `git revert --no-edit <sha>` in the push clone under the same lease/push/restart path; conflict ⇒ abort + escalate; no behavioral verification or pending stamp; attempt registered `route: auto_revert`.
- [x] 8.4a LANDED `49e6f48` (second dispatch; the first was refused by a stub-detector false positive, filed). Detect-record-hold (no revert): the sweep's present branch records `regressed_by`, an UNFAVORABLE outcome, a class-posterior miss and a `#2 regressed` settlement for an explicit `directed:false` landing whose edited vessel restarted onto it; the picker skips a regressed gap until `revert_sha` is recorded. Fixture A recorded / B directed n/a / C awaiting_restart / D no trailer n/a.
- [ ] 8.4 (deferred) Sweep auto-revert on the present branch: measurement predicate, autonomous intent, the EDITED vessel's unit restarted after the commit, no owed self-restart. Write `regressed_by {sha, at, revert_status: pending}`, UNFAVORABLE outcome, class posterior and settlement BEFORE calling the cutover (the revert restarts the sweep's own vessel). Awaiting-restart gaps keep the sweep re-running. Falsifier: fixture cases A (autonomous, evidence_resolve present ⇒ revert), B (directed ⇒ none), C (restart pending ⇒ none, sweep re-runs).
- [x] 8.7 LANDED `00b7ab0`: decomposed shape-checked steps must carry zero_field/defect_field (15 live step/probe predicates were field-less and read 'unknown' forever).
- [x] 8.4b LANDED `01304ad`: a falsified landing is penalized once — the local ledger's `#2` settlement is the marker, so a regressed_by stamp lost by the gap store re-stamps without a second posterior miss (probe: 2 calls → 1 settlement, β 2).
- [x] 8.8 LANDED `6c86595`: no undirected landing compose starts while the envelope refuses (a named-gap caller had bypassed it every 10 min).
- [x] 8.9 LANDED `f08df07`: an undirected compose of an operator_hold gap is refused BUSY (stopped a 4-second compose/narrow loop).
- [x] 8.10 LANDED `59bfc4c`: contained admission requires a class2 check to name a measured field (49 of 60 open class2 gaps had none and could never be judged).
- [x] 8.11 LANDED `28a69cf`: admission refuses a gap whose semantic-gate suspected_real_location is in an excluded path.
- [x] 8.12 LANDED `4d3381c`: advertised_shape_coverage_scan answers one shape's live producer_count (null when the registry is unreachable). It also removes a guard that refused the real discovery endpoint, which had left the scan blind (0 advertised shapes; now 325).
- [x] 8.13 LANDED `36b82b8`: nonzero_field reads a finite number only; null/missing/non-numeric is unknown, so an outage can neither close a gap nor falsify a landing.
- [x] 8.15 LANDED goal-host `4361247` (operator-approved): fileCapabilityGap counts demand per shape on the gap row (demand_goals) and files OPEN only when a 2nd distinct goal needs the shape; a first demand writes a closed walk_artifact gap. The 693 open single-demand capability gaps were closed walk_artifact (22 writes lost to the store race and resent; all verified). Measured first: 697 open capability gaps, 697 distinct shapes, 0 demanded by 2+ goals.
- [ ] 8.14 (superseded by 8.15; revisit only for shapes with recurring demand) Supply: backfill the 367 missing_capability gaps with evidence_resolve {advertised_shape_coverage_scan, input {shape}, nonzero_field producer_count}; the capability filer (goal-host fileCapabilityGap) attaches it at birth; admission routes capability gaps (no single edit site) through routeCapabilityGapToNewResolver. Known weakness: a stub producer satisfies producer_count, guarded only by the stub detector and semantic gate.
- [x] 8.16 LANDED `c24444a` + `537e6c0`: test_suite runs one `test_file`, reports flat `requested_not_passing` (a deleted or renamed test stays >0), and runs tests with DISCOVERY_ENDPOINT/DISCOVERY_VESSEL_ENDPOINT at a dead address (a live-container test run had registered a phantom local-tools endpoint).
- [ ] 8.17 Controlled experiment (filed 09-28 02:30): 7 failing-test gaps (activity-api 2, concept-db 4, local-tools 1), each class2 zero_field requested_not_passing, each verified >0 at birth. Measure autonomous draft→FAVORABLE→kept on clean, measured, in-scope supply. Then a detector files these automatically (the operator filing them is the gap, law 13).
- [x] 8.20 LANDED `f2491b4`: operator reverts reach the learning path. The sweep turns an operator regressed_by (revert_sha + attempt_id owned by the node) into, once: a `#2 regressed` settlement (source operator_revert), a class-posterior miss, an UNFAVORABLE outcome, and an attempt_consequence lesson the drafter reads; the pending loop also treats that landing as reverted. Live 05:19: learned c4bb14d and a198907 (settlements written, lessons persisted after 2 min). Fixture: once, idempotent, skips foreign-node and sweep-authored records. Also: node-1 settle window restored 120000 → 900000 (the acceptance value left in place).
- [x] 8.21 LANDED `5e9a0b2` (byte-equal; tsc 0): the post-landing suite RUNS again on development-vessel and activity-api. From 08-31 to 09-28 every one of ~600 landings on those two vessels logged `post_land_suite ran=false`: `test_suite` never passed `timeout_sec`, so the shell group-killed the suite at its 30 s default before bun printed a summary (suites now ~39 s). Smaller vessels kept `ran=true`, so the channel looked alive. Verified: production call on node 2 → ran=true 2314/25; the next cutover (fad0d3c) logged ran=true 2314/25.
- [x] 8.22 LANDED `fad0d3c` (byte-equal; tsc 0; failing set identical to parent, 33 names; stub detector N/A): a test NEWLY failing after a landing withholds its landed_verified stamp (reuses `behavioralVerificationFailed`), and the failing-test baseline is written only from a suite that ran to its summary. Stale baselines written from killed runs were moved to `/workspace/backup/post-land-baseline-20260928T073124` on both nodes; node 2's development-vessel baseline from the full fad0d3c run was restored. Falsifier pending: the first landing that newly breaks a development-vessel test must log `landed_verified credit withheld` and stay unstamped.
- [ ] 8.23 Detector for the 8.21 class: a joint binding on the rate of `post_land_suite ran=false` per vessel (a check that reports "did not run" as a neutral value decays silently).
- [ ] 8.5 Class detector (gap filed, operator_hold): a Class-2 predicate must read 'present' at birth or be marked `predicate_suspect` and kept unclosable.
- [ ] 8.6 Strike limit: two auto-reverts on one gap ⇒ operator_hold / needs_information (no ping-pong).

## 6. Supply: the system makes gaps verifiable (gap_falsify)

Measured 2026-09-27: 286 open gaps outside the scope have an edit site but no class1/class2
falsifier; the verifiable autonomous pool is 9. No detector writes a predicate before compose.
- [x] 6.1 LANDED as a pass inside gap_lifecycle_scan (reuse, law 3): `0259b8c`, `c5f0081` (only the gap-store holder falsifies), `b5df9c2` (skip in-scope gaps). First run falsified 10 (9 in scope, before 6.1c), second 0: the deterministic rules are exhausted outside the scope. `gap_falsify` resolver + seeded tick activity (development-vessel), graded by whether a
  gap it falsified later closes by that predicate after a landing (a predicate true before any
  landing is a miss). Deterministic v1 rules: (a) a `-narrowed` child inherits its parent's
  class1/class2 predicate fields (narrowing strips them today; 2 gaps); (b) a backtick-quoted
  identifier in the summary that is absent from the edit-site file becomes `expected_literal`,
  skipping non-source files (canary .json etc.) (31 gaps, mixed quality). Writes via
  substrateGap_write with `predicate_source: "gap_falsify:<rule>"`; the classifier re-stamps.
- [ ] 6.2 v2: LLM-proposed predicate (reusing `rankWithLlm`/localization) for the remaining ~250,
  validated deterministically (literal absent now for expected_literal; present now for
  hardcoded_url; shape advertised for class2) before writing.
- [ ] 6.3 DECOMPOSITION CONTRACT (the supply lever; evidence 2026-09-27 11:00–11:25, all refusals examined: an
  incomplete multi-part draft (route-edit-ec962628, 1 of 3 parts), a wrong-file draft (self-fact relevance-sink: edit
  site patch-with-tools.ts, judge points at self_fact_reconcile), a DESTROY-TO-SATISFY draft silencing a detector
  (refuters 2/2, conf 1.00/0.82), and a hollow literal write (tracePersistencePolicy). The verifier caught all four;
  the drafter cannot do design-sized gaps in one single-file draft, and no vessel outside the protected set fails
  typecheck, so there is no atomic supply. Every verifiable gap left is design-sized.) Give the existing
  investigation step a structured output instead of a free-text walk: for a verifiable parent that has failed ≥ 2
  attempts, one LLM call reads the parent summary, its falsifier, the refusal reasons and the edit-site window, and
  proposes 1–3 child steps, each {edit_site (one existing source file), change (one sentence), falsifier}. Each
  child is validated deterministically before it is written: the file exists and is outside the autonomy scope; a
  class2 child names a shape that discovery advertises (evidence_resolve/verify_shape) and that currently reports
  the defect; a class1 child's literal is absent now and comes with a named live-path reader. Children are written
  as `<parent>-step-<k>` with `parent_gap_id`, and the parent is closed only when its own falsifier passes. Graded
  by child closure (a child closed by its falsifier after an autonomous landing is the first decomposition
  success). A parent whose steps cannot be given a behavioural falsifier is recorded `cannot_falsify` (a finding
  about missing observables, not a failure). Replace the investigation `/run-goal` dispatches (bumpFailedAttempts, pre-compose) with
  a `gap_falsify` call on the parent, so investigation spend produces fields, not gaps.
- [ ] 6.4 Narrowing keeps pre-compose predicates (strip only `removed_line_of_landing_commit`).

## 5. Demonstration and debt

- [ ] 5.1 Demonstration parts 4–5 on the autonomy node (adaptation, variant exploration).
- [ ] 5.2 Convert code gates to activities (admission order, envelope read, breaker, verbatim
  edits, closure credit), through the lane, off the critical path.
