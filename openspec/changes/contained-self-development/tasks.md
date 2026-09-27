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

## 8. System-side verification of autonomous landings (autonomy paused until 8.1–8.4 hold)

- [ ] 8.1 Predicate polarity: `zero_field` (DEFECT count) in verifyGapConditionAsync; self_fact_reconcile writes it. `nonzero_field` is a HEALTH field and read divergence_count=1 as fixed, closing a live divergence `landed_verified` on a reverted landing. 21 store rows migrated; obsidian gap reopened.
- [ ] 8.2 Record `directed` in the attempt intent (attempt-register + feature-compose) so the sweep can tell autonomous landings from directed ones via the `Attempt-Id:` trailer; no intent ⇒ treated as directed, never auto-reverted.
- [ ] 8.3 Cutover `revert_of` mode: `git revert --no-edit <sha>` in the push clone under the same lease/push/restart path; conflict ⇒ abort + escalate; no behavioral verification or pending stamp; attempt registered `route: auto_revert`.
- [ ] 8.4 Sweep auto-revert on the present branch: measurement predicate, autonomous intent, the EDITED vessel's unit restarted after the commit, no owed self-restart. Write `regressed_by {sha, at, revert_status: pending}`, UNFAVORABLE outcome, class posterior and settlement BEFORE calling the cutover (the revert restarts the sweep's own vessel). Awaiting-restart gaps keep the sweep re-running. Falsifier: fixture cases A (autonomous, evidence_resolve present ⇒ revert), B (directed ⇒ none), C (restart pending ⇒ none, sweep re-runs).
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
