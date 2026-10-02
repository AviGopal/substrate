# Mechanism verdicts, chunk 02: development-vessel (65 items, deduplicated to 36)

Source chunk: `classes/_mech_chunks/02.json` (65 items, area `development-vessel`).
Measured 2026-09-29 around 04:00–05:00Z. Every check was read-only.

Where the evidence comes from:
- **Code:** the live clone `/workspace/git/vessels/development-vessel` in `substrate-live` (HEAD `f451e42`, 2026-09-29 01:37). 262 resolver files.
- **Executions:** the hub `execution` table, which holds a **5-day window** (09-24 to 09-29; 150k-row cap, see `raw/live-activities.md` §0). In this file, "used_now = yes" means the mechanism executed in that window on some node. Node 2 (`compose2-live`, compute/spoke) writes its traces to the hub.
- **Gaps:** the live gap store `/workspace/git/super-repo/gaps/gaps.json` (6,285 rows, 1,822 open).
- **Journals:** `journalctl -u development-vessel` on both nodes.
- A 30-day `execution_trace_content` SPLIT query hit the helper's 30 s cap, so it was not used. **A "0 executions" claim below covers 5 days only**, unless it cites the 30-day "unseen shapes" list in `raw/live-resolvers.md` §5.

How to read the verdicts:
- Discoverability for kept items names the registration: a shape in `src/config.ts` `discovery.shapes`, a seed template in `src/seed/`, or a unit.
- A fix is only as good as the live code. Several chunk claims ("fixed 09-15", "broken 08-15") were re-checked against HEAD, and 4 of them changed the verdict (items A, D, G, L).

**Archive convention for fossils:** these match the other chunk writers.
1. Git history keeps the file at the cited hash.
2. Remove the shape from `development-vessel/src/config.ts` `discovery.shapes`, together with its `routes/impulses.ts` case.
3. Retire any seed or activity row with the retire primitive (`19ae84e` for notes; the activity retire used for the 1,106 gap-closers).
4. Write one `concept` row (type `fossil`) in concept-db. It names the intent, the superseding mechanism and the hash, so the intent stays recallable over discovery/p2p after the code is gone.

A structural fact affects several verdicts. `gap_to_feature` is **handled in `routes/impulses.ts` but not registered** (`raw/live-resolvers.md` §2). So every mechanism that lives inside gap-to-feature.ts is reachable only through the `gap-compose` unit, the in-process nudge, or a direct POST. Discovery cannot route to any of them. This affects clusters I, J, K, L, M and N.

---

## A. Semantic gate + adversarial refuter quorum: **keep-general, with two named defects**
Chunk items: 3, 5, 9, 13, 15 (same mechanism under five names). Item 11 merges in as well (section G).
- **Location:** `feature-compose.ts`
  - the semantic-gate plumbing around lines 1687/1721;
  - the judge at around 2279–2283;
  - the `fc-shape-vocab` fail-open rule at 1485/1493/1675;
  - `suspected_real_location` (also read in gap-to-feature.ts).
- **Used now:** yes. It runs inside every `feature_compose` (1,941 runs, 381 ok in 5 days). **164 open `*-semantic_reject` recommit gaps** (of 415 open `recommit-*`) are its refusals.
- **Defect 1: it still fails open.** The chunk says "refuseWhenJudgeUnavailable 09-15". That identifier **does not exist in any live clone's history** (`git log -S` is empty across `/workspace/git/vessels/*`). Line 2283 still returns `addresses:true … fail-open, unverified by judge`. The mitigation is only the `verified:false` flag, which blocks strong credit (lines 627–630). The fix was either never landed or lived in a different repo. It is the same "fix lost / never landed" class as `5598853` (09-15), which undid 7 autonomous compose landings (`raw/git-devvessel-2.md` l.76).
- **Defect 2: refuter confabulation.** Two samples of one refuter prompt can overturn a passing judge. The gap `the-semantic-gate-lets-two-samples-of-one-refuter-prompt-overturn-a-passing-judge…` has been open since 09-24. The quorum was altered 3 times (a105756, 7ab6155, 1746f5a). SurrealQL dialect confabulation led to `the-pwt-semantic-refuters-confabulate-dialect-semantics…` (open, 09-22).
- **Why keep:** it made correct evidence-based rejections (right in 3 of 4 cases on 09-12; wrong-site drafts refused on 08-13). It is the only check that a draft addresses the gap.
- **Discoverable as:** not a shape. It is an internal stage of `feature_compose` (config.ts:91). To make it reachable, it should be registered as its own verdict shape (`semantic_gate_verdict`) so the walk and the refuter quorum can be graded as an activity (law 2).

## B. fc-* localisation gates (anchor-provenance / anchor-region / order / symbols / scope / coverage): **keep-specific**
Chunk item: 4.
- **Location:** `feature-compose.ts` (`fc-anchor-provenance`, `fc-scope`, `fc-coverage`). `fc-coverage` and `fc-grounding` are also referenced in gap-to-feature.ts.
- **Used now:** yes, on every compose.
- **Evidence and history:**
  - Anchor death was "two-thirds die at anchor or grounding" (8d165a9, 09-22).
  - 2f2ba0f (09-23) stopped provenance from re-drafting deterministic verbatim ops.
  - The same address bug was fixed at 8 call sites on 09-24 before `targetFileOnDisk` (20a668b) became the single resolver. It is present now, in feature-compose.ts only.
  - The `fc-scope` log line still misreports its centring (reports-3).
- **Discoverable as:** internal to `feature_compose`. The lessons come from their refusal classes (see H).

## C. Honest grounding refusal (fc-grounding) + groundedUniqueAnchor: **keep-general**
Chunk items: 12, 30.
- **Location:** `fc-grounding` in feature-compose.ts and gap-to-feature.ts; `groundedUniqueAnchor` in gap-to-feature.ts only.
- **Used now:** yes, on every autonomous pick.
- **Evidence:**
  - 09-18 principled refusals: P5 falsified, B5 held (reports-5).
  - reports-8 addendum Z: the gap-derived anchor with a 40-line window is already stronger than hand-supplied anchors.
  - History to remember: `5598853` found 48/48 grounding windows at 0 bytes because of a bare catch (100% refusal). The seam has to be re-probed with a positive control, not trusted.
- **Discoverable as:** internal to gap_to_feature/feature_compose. It should be exposed as a `groundingWindow` shape so the ReAct floor (`universal-tool-fallback`, 17% ok) can reuse it. That lane has the same "blind plan" problem.

## D. Verify stage (install / dry-run / typecheck / shape-dispatch / tests markers): **keep-general** (the chunk's "broken" is stale)
Chunk item: 7.
- **Location:** `feature-compose.ts:5791–5801`, plus the park re-verify at `:195–199`.
- **Used now:** yes.
- **Why the verdict changed:** the 08-15 defect was "absent TC_EXIT scored as failure, 137 unread". Live code now echoes `TC_EXIT=$TCE` explicitly, and the comment at `:5795` records the old bug ("TC_EXIT was never echoed").
- **Residual defect:** the test leg is `timeout 240 … bun test`, and restart and drain budgets are shorter than composes (see Q).
- **Discoverable as:** internal to `feature_compose`. The same marker contract is duplicated in `patch-with-tools` (section P).

## E. feature_compose isolated worktree + `land:true` + deterministic verbatim synthesis: **keep-general**
Chunk item: 8.
- **Location:** feature-compose.ts, shape `feature_compose` (config.ts:91).
- **Used now:** yes.
  - 1,941 runs, 381 ok (20%) in 5 days; last run 09-29T03:51.
  - `auto-bridge-feature_compose`: 60 runs, 47 ok.
  - `satisfier:feature_compose`: 11 runs, 6 ok.
- **Evidence:**
  - Landed a57dc30, 2f2ba0f, 1f58320 (reports-4).
  - Pre-validated exact-edit goals land (memory 09-24).
  - Hazard: without `verify_vessels`, ops apply to the LIVE tree.
- **Discoverable as:** the `feature_compose` shape, plus the edit-intent route in goal-host.

## F. preLiveSync staging of drafts into the live tree: **broken → merge-into E (isolated worktree)**
Chunk item: 6.
- **Location:** `feature-compose.ts:6752–6900`. It now also feeds `parkFiles[].base_content` (`:6842`).
- **Used now:** yes.
- **Why it is broken:**
  - It was the root cause of #23, #26, #27, #45 and #50, and of false pre-snapshots (reports-2).
  - It is the source of the 09-24 lane deadlock, where `staged_base_sha` was the patched hash (memory 09-24).
  - `a-refused-surql-cutover-left-its-live-sync-in-the-live-tree` is still open (09-22, plus `-narrowed`).
- **Recommendation:** writing drafts into the live runtime tree before cutover is the harmful part. The isolated-worktree path (E) already does the right thing. Keep only the pre-image capture (`base_content`) as a read of the committed blob, not of the live file.

## G. zero_behaviour_delta gate + string exemption: **merge-into A**
Chunk item: 11.
- **Location:** `ede0030` (09-14) touched **patch-with-tools.ts only** (61 lines). The identifier exists only there.
- **Used now:** barely. The pwt lane executed once in 5 days (`satisfier:patch_with_tools` 1/1).
- **Why merge:** the live inert-diff refusal for feature_compose is A's comment-only / declaration-anchored refusal. This is a second copy of one intent ("refuse vacuous edits") in a lane that is itself broken (P). Fold it into A as one deterministic pre-judge floor.

## H. compose_lesson corpus + recall by failure class: **broken** (general need; the writer corrupts gap state)
Chunk item: 14.
- **Location:** feature-compose.ts writes the corpus and reads it back through discovery (concept-db `compose_lesson`). `learning-signal-health-observer.ts` also reads it.
- **Used now:** yes.
- **Evidence:**
  - Only 45 rows, with no `edit_site`, and lessons are never graded (concept-db-db).
  - Open gaps from the writer:
    - `the-compose-lesson-writer-force-reopens-closed-gaps-and-mints-recommits-for-landed-parents` (09-23);
    - `…-writes-back-the-callers-stale-gap-snapshot…` (09-25; recommit on 09-28);
    - `a-substrate-authored-block-in-the-compose-lesson-writer-forges-operator-approved-true…-narrowed` (09-26).
- **Why broken:** this is the only drafter-facing teaching channel (CLAUDE.md "teach through the channel that is read"), so it must survive, but its write side mutates gaps.
- **Discoverable as:** the concept-db `compose_lesson` concept type, recalled at prompt-build.
- **Repair:** split the lesson write from the gap write, and grade lessons by next-attempt outcome.

## I. Causal attempt ledger (pre-snapshot, flips, settlement, lessons, commit↔dispatch link): **keep-general**
Chunk item: 16.
- **Location:** `attempt-ledger.ts`, `attempt-register.ts`, `attempt-checks.ts`. Shape `attempt_register` is at config.ts:104.
- **Used now:** yes, lightly.
  - `satisfier:attempt_register` 8 runs, 3 ok (last 09-24).
  - `satisfier:attempt_snapshot` 5 runs, 2 ok.
- **Evidence:**
  - Accepted RUN12 10/10 on 09-26 (memory).
  - `orphaned-capability-attempt_register` and `orphaned-capability-attempt_snapshot` are open (09-26).
  - Defect: 71 canary fixture-toggle commits land on origin/dev as "autonomous" (`raw/git-devvessel-2.md` l.43).
  - It is the third of three causal mechanisms for one intent (causal-adjudication 09-05, dormant with 0 executions; causal baseline 439072c 09-16). This one is the survivor. The other two belong to other chunks as merge-into I.

## J. Gap close/land sweep: sweepPendingLandVerifications + closeLandedGap + close-oracle gate + per-class earned-trust posterior + landed-commit shield: **keep-general**
Chunk items: 25, 29, 32, 33, 35, 36 (one mechanism).
- **Location:**
  - `sweepPendingLandVerifications` in 5 files: gap-to-feature.ts, substrate-gap.ts, vessel-mitosis-cutover.ts, removed-line-predicate.ts, and one more;
  - `closeLandedGap`;
  - `landedCommitVerdict`;
  - `readCloseOracleCalib` at gap-to-feature.ts:3383 (the 4b1f862 per-class posterior, still present under `recordCloseVerdict`/`readCloseOracleCalib`).
  - `007163ab` is a super-repo **docs** commit (08-14, "close-oracle gates on measurement not provenance"), not code.
- **Used now:** yes. The last change was 6583dd4 (09-28, which unstarved the store order).
- **Evidence:**
  - 09-15: checked=25, closed=6.
  - About 120 `landed_verified`.
  - First close on the system's own measurement: 09-28 (memory, four seams).
- **Defects:**
  - It re-derives `pending` from the commit subject, and a clear does not stick.
  - It never re-measures closed gaps.
  - It is starved by gaps with no predicate.
  - Item 29, the "landed-commit shield", shields wrong landings (14763ff partial). It merges here as the weakest evidence class.
- **Discoverable as:** only inside the unregistered `gap_to_feature` and the cutover. It should be exposed as a `gapCloseVerdict` shape so the close decision is traced and gradeable.

## K. Autonomous pick spreading: lineage backoff + capacity peek + per-file cooldown + lineage cap + protected-vessel exclusion: **keep-general**
Chunk items: 26, 34.
- **Location:** gap-to-feature.ts. Commits:
  - b17eccd, b44dcad (08-31, lineage grain);
  - 289cf2f;
  - 61b4812 (09-26);
  - 6fa5883, 5ebe5df.
- **Used now:** yes, on every pick.
- **Evidence:** composes went from 5.8 to 10 per hour; the proxy.ts monopoly broke; recommit share fell from 46% to 25%.
- **Residual gap:** `the-auto-pick-composes-untargeted-zero-landability-gaps-every-cooldown…` (open, 09-26).
- **Discoverable as:** internal. The parameters are constants, a law-1 hazard. They should be read as a `pickPolicy` impulse.

## L. Calibration seal / hopeless() disposition: **keep-general**. Escalation channel: **broken** (recurring live)
Chunk items: 27, 31, 37.
- **Seal:** `hopeless()` in gap-to-feature.ts and escalation-disposition-apply.ts. `76bf256` (09-28, substrate-authored) moved the table to a holder-held one after node 2 was sealed to a pool of 2 on node-local history.
  - Verdict: **keep-general**. It is the "learned disposition" of law 7.
- **Escalation:** `resolveUiWritePassthrough` → `ui-write-passthrough.ts:24–25` → `process.env.STATEFUL_UI_VESSEL_ENDPOINT ?? "http://127.0.0.1:8270"`. The dev-vessel unit sets no such variable.
  - The hub journal in the **last 6 h** shows repeated `[gap-escalation] pending-verify uiQuestion_write accepted …` into the replaced vessel. `raw/live-resolvers.md` counts 318 panels created 09-22 to 09-28, after the 09-22 diagnosis.
  - On node 2 (09-26 12:10) it **threw**: `uiQuestion_write THREW … Unable to connect … no human was asked`.
  - Also open: `hopeless-gap-escalation-dedupes-in-process-memory…` and `pending-verification-escalation-dedupes-in-process-memory…` (09-25/26).
  - Verdict: **broken**. This is a textbook "same issue recurring for the same reason": a pinned, env-gated peer (law 1 and law 11). The fix is to route `uiQuestion_write` by shape through discovery to whichever surface serves it on the p2p network, not to patch the port.

## M. escalation_disposition_apply (+ label lift + answered-panel union): **revive-general** (after L's channel is fixed)
Chunk items: 0, 1, 57.
- **Location:** `escalation-disposition-apply.ts`, shape at config.ts:786. d3e1ca2 (09-14) lifts EDIT_SITE/EXPECTED_LITERAL/VERIFY_SHAPE out of an operator answer. 9cb83d0 and 891304c/91cc1ff fixed its parser.
- **Used now:** no.
  - The shape is in the 30-day "unseen" list (`raw/live-resolvers.md` §5).
  - There are 0 executions in 5 days.
  - `orphaned-capability-escalation_disposition_apply` has been open since 09-26.
  - Node 2 mentions it only as that gap's hopeless escalation, which failed.
- **Why revive:** it was 12/12 armed on 09-15, then starved because answers go to a surface no human reads. It is the only executor that turns a human answer into a predicate. The recurring class is human-surface-escalation.
- **Discoverable as:** the existing shape. It needs a scheduled or event reader on the live human surface's answer stream.

## N. Adjudication pathway (admitActionableGaps): **keep-general**
Chunk item: 28.
- **Location:** gap-to-feature.ts and compose-slots.ts (53c4b4e, 09-19, substrate-authored).
- **Used now:** yes, on every admission.
- **Evidence:** E1'–E3' plus transfer MET on 09-19. Blind spot: it cannot see agreeing-wrong verdicts (producer and verifier both wrong).
- **Discoverable as:** internal to gap-to-feature. It needs a verdict shape (as in J).

## O. Decomposition contract (6.3 / 6.3c / 6.3d): **keep-general**
Chunk item: 20.
- **Location:** gap-lifecycle / decomposer. The fixes were f1a51fa, 8bfc972 and 00b7ab0. It moved pre-admission in `2de0ae8` (2026-09-29, substrate-authored).
- **Used now:** yes. `stateful-ui-resolve-defaults-destroy-live-panels-step-1..3` were minted at 09-29T05:00.
- **Evidence:** before the fixes, steps inherited parent checks, carried vacuous predicates, and saw a 7,000-char window.
- **Discoverable as:** internal. Its product is `-step-N` gap rows.

## P. patch_with_tools ReAct patcher: **broken → merge-into E**
Chunk item: 52.
- **Location:** `patch-with-tools.ts`, shape at config.ts:522.
- **Used now:** 1 execution in 5 days; 2 tasks in 30 days.
- **Evidence:**
  - It reports reached=YES without landing and edits the live `/vessels` tree (memory-1).
  - Open gaps:
    - `patch-with-tools-writes-the-live-runtime-copy-unleased-racing-operators-and-cutovers` (+ `-narrowed`, 2 recommits, 09-21);
    - `patch-with-tools-fails-as-a-class-…` (refreshed 09-28);
    - `patch-with-tools-restores-its-pre-run-snapshot-blindly-and-wipes-a-concurrent-landing…` (09-26/28);
    - `edit-intent-escalation-treats-an-already-landed-edit-as-an-anchor-failure-and-patch-with-tools-applies-it-twice` (09-25).
  - `runtime-drift` reports `resolvers/patch-with-tools.ts` differing from the clone (`raw/timers-readers.md` l.45).
- **Recommendation:** keep the intent (a tool-using fallback author) as a mode of E's isolated worktree, and retire the live-tree variant.

## Q. LONG_RUNNING_TYPES drain/quiesce counter: **keep-general** (under-sized)
Chunk item: 45.
- **Location:** `long-running.ts` (404a89c on 09-23, bf74cc5 on 09-24; b789d9c sized the budget).
- **Used now:** yes, on every restart.
- **Evidence:** `development-vessel is draining` refused 790 + 62 feature_compose tasks in 5 days. `recommit-every-restart-budget-is-shorter-than-a-compose…` is open (09-24/26).
- **Discoverable as:** internal. The budget should come from the compose-duration distribution in traces, not a constant.

## R. Maintenance lease (named: change_window, trace_store, cutover, autonomous_pick): **keep-general** (defective)
Chunk items: 46, 47.
- **Location:** `maintenance-lease.ts`, shape `maintenanceLease` (config.ts:797). Used by vessel-mitosis-cutover.ts, gap-drain-observer.ts, seed/trace-store-reconcile.ts, and the gap-to-feature `autonomous_pick`.
- **Used now:** yes.
- **Evidence:** 3f4be28 fixed a self-deadlock. There are 7 named-lease commits from 09-24. Open gaps:
  - `eleven-concurrent-cutovers-of-one-staged-root-all-acquired-the-change-window-lease…` (09-23);
  - `a-failing-trace-store-reconcile-re-takes-the-single-global-change-window-faster-than-its-ttl…` (09-24);
  - `a-verified-patch-is-rolled-back-when-the-change-window-lease-is-held…` (09-24);
  - `a-named-lease-acquired-on-a-node-running-older-lease-code-becomes-the-unnamed-lease-and-blocks-every-cutover` (09-26; a p2p version-skew case);
  - `the-trend-expectation-battery-overlaps-its-own-ticks-and-ignores-the-autonomous-pick-lease` (09-26).
- **Why keep:** a shared, discoverable seam is the right design. The defects are lease scoping and cross-node versioning.

## S. Gap lifecycle scan (expiry, hasNoAttemptEvidence, producer_now_exists, LOW_VALUE, churned, age re-verify, burial guard, autoClose): **keep-general**
Chunk items: 21, 22, 23, 24, 38.
- **Location:** `gap-lifecycle-scan.ts`, shape `gap_lifecycle_scan` (config.ts:462), seed `gap-lifecycle-tick.ts`.
- **Used now:** yes.
  - `development-vessel:gap-lifecycle-tick` 24/24 (last 09-29T03:10).
  - `satisfier:gap_lifecycle_scan` 45 runs, 38 ok.
  - fbf7433 (09-04) `hasNoAttemptEvidence` is present, as are `producer_now_exists` and `LOW_VALUE`.
- **Superseded evidence:** item 22 "no live driver (08-02)" and item 24 "not run since 08-18" are old.
- **Defects:**
  - It remains mostly a TTL closer: 69% of closures were TTL (08-29), and churned 0 / auto_closed 0 on 2,527 gaps (08-07).
  - The camelCase `autoClose` trap.
  - Items 21 (db90246, cfd3dd8, 07-09) are folded in; their live effect is unverified.
- **Discoverable as:** the shape and the tick.

## T. gate_self_probe (metamorphic) + selftest kit (emit_shape / reach_graded): **keep-general**
Chunk items: 39, 64.
- **Location:** `gate-self-probe.ts`, shape at config.ts:306, seed `gate-self-probe-tick.ts`.
- **Used now:** yes.
  - `development-vessel:gate-self-probe-tick` 37/37 (last 09-29T03:39).
  - `satisfier:gate_self_probe` 20 runs, 13 ok.
- **Evidence:** it caught 550f2f7 unaided on 09-10.
- **Unverified:** `emit_shape` and `reach_graded` (activity-api execution-traces.ts) were not checked here, so their part of the verdict is unknown.
- **Worth doing:** the class law "a gate that is never probed is a fail-open gate" makes this the detector for A's fail-open defect. Add a "judge unreachable" probe case.
- **Discoverable as:** the shape and seed.

## U. Four horizon detectors (vessel-responsibility-audit, vessel-architecture-pattern-scan, activity-lifecycle-audit, resolver-distribution-audit): **keep-general**
Chunk item: 59.
- **Location:** four resolvers plus four seed ticks.
- **Used now:** yes, 35/35, 41/41, 29/29 and 38/38 ticks in 5 days.
- **Defect:** the responsibility audit read 0 principles over HTTP (unresolved). Its many `gap-closing:responsibility-*` and `arch-pattern-single-dispatcher-*` offspring are report-skeleton fossils (`raw/live-activities.md`). The detectors are fine; their remedy factory is not.
- **Discoverable as:** the shapes (e.g. `vessel_responsibility_audit` at config.ts:491) and the seeds.

## V. selector_saturation_audit: **keep-general**
Chunk item: 56.
- **Location:** config.ts:624, seed tick. Wired in boredom at `:2896` and `:3234`. Origin a0f1a0a (06-14).
- **Used now:** yes, 38/38 ticks (last 09-29T03:14).
- **Open question:** it has not flagged that 60% of Thompson picks go to arms with n≤2 (`raw/live-activities.md` selection-learning). Whether it reads `thompson_selection_log` is unverified.

## W. Detector coverage scan + draft-detector-activity: **broken** (runs, yields nothing)
Chunk item: 61.
- **Location:** `detector-coverage-scan.ts` (config.ts:719), seeds `detector-coverage-audit-tick.ts` and `draft-detector-activity.ts`.
- **Used now:** yes.
  - Ticks 25/25; `draft-detector-activity` 51/51.
  - The latest `draft-detector-activity` execution (09-29T02:57) has **`output_impulses: []`**.
  - `detector-coverage-dormant` was opened 09-29T02:58, and `detector-coverage-gap-*` rows keep opening.
- **Why broken:** the C.GATE was never evidenced (openspec-3).
- **Recurring class:** dormant-mechanism. Detectors are drafted but never wired into seeds. That is why item X exists.

## X. 22 orphaned detector resolvers (composition-flow-health-scan, schema-assert-drift-scan, concept-credit-integrity-scan, env-gate-scan, …): **fossil**, except concept_credit_integrity_scan (revive-general)
Chunk item: 58.
- **Location:** the files are present in `src/resolvers/`. There are no seed templates. `env_gate_scan` is in the 30-day unseen list.
- **Evidence:** the trace-reading ones are blind on a spoke. `concept_credit_integrity_scan` found 15 of 50 degenerate when run by hand (reports-3). That is a live finding for the selection-learning class, so wire it through W's seed path once W yields.
- **Recommendation:** archive the rest by the convention.

## Y. learning_signal_health_observer: **broken** (runs, never yields)
Chunk item: 42.
- **Location:** `learning-signal-health-observer.ts`, config.ts:618. `minLoadedVolume = pointer.minLoadedVolume ?? 50` at line 46.
- **Used now:** yes.
  - `learning-signal-health-observer-tick` 32/32; the last one (09-29T03:14) has **empty `output_impulses`**.
  - The endpoint returns 55 with 34 loaded, so it is permanently in cold start (memory-10, reports-8).
- **Why broken:** this is the detector the selection-learning class needs (loaded-but-never-credited signals, e.g. the invalid-URL betas poisoned 09-22 to 09-28). The threshold should be derived, not a constant.

## Z. learning_transfer_report `lambda1_inequality_ok`: **duplicate-of `scripts/substrate/spectral-gap.ts`**
Chunk item: 43.
- **Location:** `learning-transfer-report.ts:235` (`density >= fraction`).
- **The duplicate:** spectral-gap.ts writes `lambda1_for_inequality` and `inequality_holds` to `/workspace/metrics/spectral-gap.jsonl`. The latest line has `live_lambda1: 0`, `inequality_holds: true`. It has been flat since 07-15 (memory-5), so both instruments of one mint governor are dead legs.
- **Used now:** `satisfier:learning_transfer_report` 1 run, 0 ok in 5 days. 0 journal hits on node 2.
- **Recommendation:** keep the one with a reader, which is neither today. Also open: `template-input-lint-development-vessel_learning-transfer-gap-tick` (09-22).

## AA. memoryNote store + retire primitive: **keep-general** (store split three ways; recall broken)
Chunk items: 44, 48, 49, 50.
- **Location:** `memory-note.ts` → `WORKSPACE_ROOT/memory/notes.json`, read at use time (lines 55–58). Shapes `memoryNote` and `memoryNote_write` at config.ts:151–152. Retire primitive 19ae84e (09-22).
- **Used now:** yes.
  - `satisfier:memoryNote` 31 runs, 29 ok.
  - `satisfier:memoryNote_write` 540 runs, 394 ok.
  - `learned-composition-*-to-memorynote-write` chains are heavily used.
- **State of the stores:**
  - Hub, `/workspace/memory/notes.json`: **59 notes, first on 09-26, 0 retired**.
  - Super-repo copy: **680 notes, last written 07-23** (the WORKSPACE_ROOT fork of Jul 25 to Sep 22, frozen).
  - Node 2 has **no** `/workspace/memory/notes.json`.
  - 552 residue notes were retired on 09-23 (reports-1). 1,788 more sit in `.bak` files nothing reads (node2-runtime).
- **Open gaps:**
  - `memorynote-write-stores-the-rendered-instruction-envelope-instead-of-the-content-value` (+ `-narrowed`, 09-20);
  - `goal_host_failing_direction-memoryNote_write`;
  - `systematic-failure-satisfier_memoryNote_write-zero`.
- **Also:** recall ignores topic, and target inference cannot find `memory`/`recall` (03:35 report, 09-29).
- **Why keep:** law 10 makes this the authority. The repair is one store per network, reachable by shape over p2p, rather than one file per node.

## AB. Standing pool (poolImpulse / standing.json atomic write): **keep-general** (path split)
Chunk items: 53, 54.
- **Location:** `pool-impulse.ts`, shape at config.ts:163. The live file is `/workspace/git/super-repo/pool/standing.json` (2.3 MB, fresh). `/workspace/pool/standing.json` (9.7 MB) has been frozen since 09-07, and 3 aborted `standing.json.tmp.*` files are left over (`raw/timers-readers.md` l.102–103).
- **Used now:** yes. `satisfier:poolImpulse` 14/14, `poolImpulse_write` 4/4, `auto-bridge-poolImpulse*` 5.
- **Defects:** `standing_intent_shapes` is not folded into selection (openspec-4), and `poolImpulse_write` is double-owned with goal-host (`raw/live-resolvers.md` §5).
- **Recommendation:** one path, and reap the tmp files.

## AC. dev-vessel fs_* / git_* resolvers: **duplicate-of local-tools-vessel**
Chunk item: 17.
- **Location:** dev `fs-read|write|edit|list|grep.ts` and `git-*.ts`. local-tools serves the same shapes from `src/index.ts:690–734` (`fs_read`, `fs_write`, `fs_edit`, `git_status`, `git_diff`, `git_commit`, …).
- **Evidence:** 7 shapes are owned by both vessels (29 multi-owner shapes on the hub).
  - `fs_edit` is 18% ok, with "path outside workspace root" 161 times.
  - `git_branch_create` is 0 of 2,393, with no error text.
  - `recommit-fs-edit-applies-new-text-through-string-replace-so-dollar-patterns…` is open (09-28).
- **Recommendation:** by data locality both vessels run in one container, so keep a single owner. Keep local-tools for the general tool plane, and keep dev-vessel's copies only if they resolve the dev push clone's root. That root split is the recurring WORKSPACE_ROOT class.

## AD. Gap-drain remedy dispatch by pinned template id: **broken → merge-into the family sampler / gap_to_feature path**
Chunk item: 18.
- **Location:** `services/gap-drain-observer.ts:186–210`. It uses `remedy.target_template_id` verbatim.
- **Used now:** yes.
- **Evidence:**
  - 118 attempts at a phantom template.
  - Open gaps: `the-gap-drain-observer-dispatches-a-remedy-by-its-pinned-target-template-id-so-the-reconcile-family-sampler-is-bypassed` (3 instances plus 2 recommits, refreshed 09-28T23:53); `the-slow-query-detector-names-a-remedy-template-that-does-not-exist…` (+ `-narrowed`, 09-25).
  - It is one of **three redundant compose entry points** (`raw/timers-readers.md` l.120).
  - The 0ac156a (09-25) re-point did not close it.

## AE. db-friction observer (slow-query gaps): **merge-into trace-store-health-observer**
Chunk item: 2.
- **Location:** `f3f5fc5` (07-22) added 52 lines to `trace-store-health-observer.ts` and nothing else.
- **Used now:** yes, through the `trace-store-health-check` 10-minute timer.
- **Defects:**
  - Its remedy names a phantom template (AD).
  - The observer counts rows and cannot see blob garbage: `the-trace-store-health-observer-counts-execution-rows-and-cannot-see-blob-garbage…` (open 09-25).
  - Its timer detector spawns `-narrowed` and `-semantic_reject` children of `trace-store-reconcile-2026-09-24T11`.

## AF. gap-landability-model auto-close (< 0.25): **fossil**
Chunk item: 19.
- **Location:** `gap-landability-model.ts:39,138,155`. Its exports (`trainModel`, `scoreGap`, `predictLandability`) have **no runtime caller**; the only import is a type import in `types/gap-landability-types.ts:7`.
- **Evidence:** the scores took about 12 discrete values (gap-history). What does run is `gap-closing:model-opportunity-gap_landability-*` (146 + 16 + 8 + … runs in 5 days). Those are report-skeleton gap-closers of the June fossil factory, and `model-opportunity-gap_landability` stays open (refreshed 09-29T03:11).
- **Recommendation:** archive by the convention. Retire the `gap-closing:model-opportunity-gap_landability-*` rows. The learned-disposition intent is carried by L (seal) and S (lifecycle).

## AG. interventionRefused / intervention_evaluate (S3 push-away): **fossil** (dormant intent, recorded as a concept)
Chunk items: 40, 41.
- **Location:** `intervention-evaluate.ts`, shapes at config.ts:417–419.
- **Used now:** no.
  - `intervention_evaluate` is on the 30-day unseen list; 0 executions in 5 days; 0 journal hits on node 2.
  - `pushAway` does not exist in the code.
- **Recommendation:** S3 is not a live recurring class today. Archive it by the convention and keep the intent as a concept so it can be revived when S3 starts.

## AH. goal_summary resolver: **keep-specific**
Chunk item: 62.
- **Location:** `goal-summary.ts`, config.ts:770.
- **Used now:** yes. `satisfier:goal_summary` 22 runs, 9 ok (last 09-29T02:31). The walk reaches it as a satisfier, which contradicts "no reader".
- **Recommendation:** close `orphaned-capability-goal_summary` (open 09-26) with that trace as evidence, and track its 41% success.

## AI. author_composed_capability: **keep-general** (information-starved)
Chunk item: 60.
- **Location:** `author-composed-capability.ts`, config.ts:90.
- **Used now:** yes, lightly. `auto-bridge-author_composed_capability` 5 runs, 2 ok; `satisfier:author_composed_capability` 1 run, 0 ok (09-26).
- **Evidence:** it works only when the information is complete (n=2 on 09-18). `reach-gap-author-composed-capability` is open (09-26), and hasSubstance churn ran to 09-26.
- **Why keep:** it is the encapsulation step of the operating model (plan a chain of existing resolvers, then mint).

## AJ. remedy-effectiveness-observer: **keep-specific**
Chunk item: 55.
- **Location:** config.ts:810, seed `remedy-effectiveness-observer.ts`.
- **Used now:** yes. `satisfier:remedy_effectiveness_observer` 4/4 (last 09-25).
- **Evidence:** it named the reconcile livelock on 08-09 but did not prevent it recurring. Five `remedy-livelock-*` gaps were closed on 09-25 while the underlying reconcile gaps stay open (AE).
- **Recommendation:** its findings need a consumer, such as the family sampler.

## AK. test_suite post-land verification on cutoverApplied: **keep-general**
Chunk item: 63.
- **Location:** `test-suite.ts:179–180`, with `timeout_sec: Math.min(budgetSec + 30, 900)` present (5e9a0b2, 09-28). Origin 2ddcac0 (08-04). Shape at config.ts:143.
- **Used now:** yes. `satisfier:test_suite` 94 runs, 81 ok (last 09-29T02:15).
- **Evidence:** it was dead from 08-31 to 09-28. There were 5 or more one-site attempts on the shell-timeout seam first (7ed1bf8, 8dcc6a0, c37aab5, 9822a8e, d8a5f84).
- **Recurring class:** the timeout belongs in the shell resolver contract (one seam), not at each caller.

## AL. autocomplete-concept-writer + concept-usage-backfill: **broken**
Chunk item: 51.
- **Location:** `observers/autocomplete-concept-writer.ts`, started at `index.ts:393`; `seed/concept-usage-backfill.ts`.
- **Used now:** unknown. It starts on boot. Execution evidence was not isolated (it is an in-process observer and writes no execution row).
- **Evidence:** it creates concepts instead of incrementing them, and task 3 never ran (June, validation-other-1). This was not re-verified today, so the verdict carries over from the source.
- **Recommendation:** merge into concept-db's `concept_record_usage` rather than keeping a dev-vessel writer. That is the data-locality fix (law 11).

## AM. staged-not-landed refusal + preEditContent restore + hard-fail detectors: **keep-general** (unverified)
Chunk item: 10.
- **Location:** feature-compose.ts. The docs-1 claim was not independently re-probed today.
- **Used now:** yes, as part of E.
- **Why keep:** the honesty rule "never grade a staged change as reached" is load-bearing.
- **Caution:** its sibling "no work is not a win" was silently reverted once (f365f3a, 07-04; restored by 0d4c241, 08-29). It needs a gate_self_probe case (T).

---

## Cross-cutting findings for the synthesis

1. **Five mechanisms run on schedule and yield nothing.** They look healthy by success rate: W (draft-detector-activity 51/51, empty output), Y (32/32, empty output), X, Z and AF. A 100% tick success is not evidence of a working detector. This is the "a detector must be proven to COMPLETE" law.
2. **Three verdicts rest on fixes the live code does not contain:**
   - `refuseWhenJudgeUnavailable` (A): never in any live clone;
   - the per-class oracle (J): present under different names;
   - TC_EXIT (D): actually fixed.

   Claims of the form "fixed on date X" in the collector records must be checked with `git log -S` before they are reused.
3. **The same recurring-for-the-same-reason pattern shows up four times here, and each is a per-node constant where a shape should route over discovery/p2p:**
   - escalation pinned to `127.0.0.1:8270` (L);
   - memory as a per-node file (AA);
   - standing pool and drain-log path splits (AB);
   - node-2 lease version skew (R).
4. **gap_to_feature is unregistered in discovery**, and it hosts J, K, L, N and C. The core of self-development cannot be reached by any peer that routes by shape.
5. **Duplicates to collapse:**
   - A ⊃ G;
   - E ⊃ F, P;
   - I is the survivor over causal-adjudication and the causal baseline;
   - local-tools ⊃ AC;
   - spectral-gap ≡ Z;
   - trace-store-health-observer ⊃ AE;
   - the family sampler ⊃ AD.
