# Slice S: gap_localize — authored falsifiers for needs-information gaps (REALIGNMENT §2.3)

## Why
Node 2's auto-pick admits 0 of ~1,880 candidates per tick. `needs_information` (~850) is three reasons merged (gap-to-feature.ts `admitActionableGaps`, origin/dev):
- NI1 (476): no site at all.
- NI2 (404): a site, but the falsifier is not class2 (autonomyScope `require_falsifier_classes:["class2"]`).
- NI3 (52): class2 with no measured field.

The existing supply organs never reach these gaps:
- `localizeGap` runs only after admission, and its write-back drops the file it found (it stores `localized:true`, never `edit_site`).
- gap_falsify (`gap_lifecycle_scan`) decomposes ≤2 gaps a run, needs an existing site, ran once today, and wrote 2 checks of 13 attempts. It can only point at an EXISTING failing test, and for most defects none exists.

What produced every fast landing today (6 gaps, 5–7 min arm→land) was a hand-written red test plus controls: the operator's check-first protocol. That step is the missing organ.

## Scope of slice S (and only this)
Target **NI2 gaps with a verified existing site** (331 at origin/dev). Not NI1: site inference without evidence is the measured-null class (09-08 RCT, 6.8% vs 6.9%). NI1 gets abstain plus `needs-localization`, nothing invented.

Per gap, in order, stopping and recording the reason at the first failure (abstain, never fabricate):
1. **Site check.** `edit_site` exists at origin/dev in its vessel AND contains the defect signature: an identifier or literal from the summary/evidence, matched via `fs_grep`. A failure is recorded as `localize_abstain: site_missing | signature_absent`.
2. **Draft.** One LLM call drafts a NEW test file `test/<gap-slug>.localize.test.ts` (or `src/…` per the vessel's convention, from `vesselTestInventory`). Inputs: the site file, 1–2 existing tests of that vessel as style exemplars, and the gap summary/evidence. It must contain ≥1 RED test (the defect) and ≥1 CONTROL (the same unit's correct behaviour today).
3. **Static rules, enforced in code, not the prompt:**
   - It imports only the module at `edit_site` (relative), plus bun:test and node builtins.
   - Never the vessel entry (`src/index.ts`), anything that binds a port, or `process.env` reads.
   - No `/proc` reads and no network.
   - A violation is recorded as `localize_abstain: test_rule:<which>`.
4. **In-container verification at origin/dev** (the lane's environment, not a host), in a scratch worktree of node 1's clone, env-scrubbed run:
   - 0 unnamed failures (the file loads);
   - every RED name fails with a named assertion failure (not "not run", not an import error);
   - every CONTROL passes;
   - the vessel's existing suite load-error count is unchanged.

   Else `localize_abstain: verify:<which>`, with output kept.
5. **Land the test.** Commit only that new file, through the existing landing path, as a test-only commit (pull-sync classes it test-only; no restart). Rate limit: ≤2 authored tests per vessel per hour, as a policy shape, not a constant.
6. **Arm.** `substrateGap_write` on the same gap id, resending the summary:
   - `falsifier:"class2"`, `evidence_resolve{test_suite, only_tests:[RED+CONTROL], zero_field:"requested_not_passing"}`;
   - `predicate_source:"gap_localize:authored_test"`, `test_author:"gap_localize"`.

   Then wait until node 1's clone contains the test commit, re-arm (timeout+1), and REQUIRE `predicate_birth_sha` to contain the test. A `present` verdict at a sha without the test is the known defect (a-check-first-birth-verdict-reads-present-when-the-named-tests-do-not-exist-at-the-evaluated-sha); it is treated as not armed.

## Self-certification conditions (advisor + qa rulings)
1. **Test lineage ≠ fix lineage, enforced in state.** `strayTestEdits` (feature-compose.ts:3444) refuses a draft that edits an existing test file other than the gap's `edit_site`. The authored test is not the site, so the fix draft cannot weaken it. Known hole: `apply-proposal-as-patch-lands-without-a-gap-so-the-stray-test-edit-gate-never-runs` (open); gap_localize gaps must land only via compose (the admitted path) until it is closed.
2. **Red is a named assertion failure** on the parent sha, with a passing control in the same file, measured in the container. A load failure is never red: f4ceb0f was exactly that and blocked node 1's local-tools.
3. **Test-green gates landing, not acceptance.** Closure via the falsifier is landing evidence. Credit and "verified" additionally need the consumer replay where the gap carries one (124 NI gaps carry a trace or exec id): re-dispatch the originating goal or trace, read `reached`. Gaps with no consumer close as `landed_test_green`, not `verified`.

## Caller (named before building)
A boredom condition in the pool: "open NI2-with-verified-site count > 20 AND the gap_localize rate limit not exhausted" selects the `gap_localize` activity (batch ≤3 gaps). It is a time-shaped rhythm impulse, not a timer. The activity is graded by its traces: armed-and-landed counts as success; abstain is neutral; a load failure caught post-land counts as failure.

## Placement / builder
- Logic: `repos/development-vessel/src/resolvers/gap-localize.ts`, NEW. It is not in autonomyScope `excluded_paths`, so the lane can repair it later. It imports `decomposeGap`/`evaluateGapCheck`/`localizeGap`/`vesselTestInventory`; it does not copy them.
- Operator (a) bootstrap: only the three-place registration (config.ts + routes/impulses.ts + discovery), the activity template, and the boredom condition. config.ts and index.ts are excluded.
- Tests for gap-localize.ts itself:
  - unit tests of the static rule checker (must-fail fixtures: imports index.ts, binds a port, reads process.env, reads /proc);
  - the abstain paths;
  - the birth-sha-contains-test rule.

  All are red/green per the usual protocol.

## Pre-registered measurement (first 10 gaps, not a yield claim)
For each: site-check refusals, static-rule refusals, verify refusals (load / not-red / control-red), tests landed, gaps armed with a valid birth sha, fix landed by the lane, consumer replay reached. Compared with gap_falsify's 2/13 written. Every resulting landing is labelled `supply: gap_localize (operator-bootstrapped)` until the caller has run unaided for 24h.

## Carried alongside, not instead
`localizeGap`'s write-back drops the file it found (gap-to-feature.ts ~6393–6407, an excluded file). File a scoped `limitChangeProposal`, not a hand fix: it is the first real test of limits moving on evidence.

## qa ruling (2026-10-02 ~20:45Z): APPROVE with one fix-first; (a)/(b) answered
- FIX FIRST — drafted code never runs as root. Step 4 runs the draft UNPRIVILEGED and contained: setpriv 65534, private tmp WORKSPACE_ROOT, no network (unshare -n), time limit; afterwards assert the scratch worktree is clean and no live store mtime moved. Static checker gains must-fail fixtures for child_process/Bun.spawn/Bun.$, eval/new Function/dynamic import(), fs writes outside tmp/Bun.write, fetch/WebSocket, outliving timers, and import-time side effects of the edit_site module (defence in depth, not the boundary). Until run_suite is unprivileged (S2/S3): authored tests are held OUT of root's run_suite and run only in the contained runner.
- (a) Protection keyed to STATE, not a forgeable author trailer: at arming record `authored_test:{path, blob_sha}` on the gap; the landing gate refuses any landing that modifies/deletes that path+blob while the gap is open (except a gap_localize re-authoring that re-passes steps 1–4). RELEVANCE: the RED assertion must reference step 1's defect signature (static check; must-fail fixture: unrelated red → abstain).
- (b) Land the test through COMPOSE as a depth-1 child gap `<gap>-localize-test` (edit_site = the new test path; falsifier = step 4's deterministic verification), not a new push path (the nearest gap-less path is apply-proposal-as-patch, the open stray-test hole). One chokepoint.
- The step-5 rate limit is lane-writable until slice L: accepted interim, bounded by ≤3 per batch.

## v2 — CONSOLIDATION (2026-10-02 ~21:15Z): S extends gap_falsify, no gap_localize organ
Prior art: gap_falsify (dev-vessel 0259b8c7, 09-27, lane-landed; runs inside gap_lifecycle_scan, ≤2 gaps/run, needs an existing site, ~1 run/day, 2 written of 13), parent_check birth judging (eebecd02, 09-30), test-audit-loop (05-18, 10/35). S becomes a NEW RULE of gap_falsify — `authored_test` — alongside `inherit` and `parent_check` (predicate_source `gap_falsify:authored_test`), so its outcomes are graded by the same per-rule ledger gap_falsify already keeps. Because gap-lifecycle-scan.ts and gap-to-feature.ts are excluded, the rule's logic lives in a non-excluded module (`falsify-authored-test.ts`) that gap_falsify calls; the operator bootstrap is the one call-site line in gap-lifecycle-scan.ts plus lifting gap_falsify's per-run cap into a policy shape. The caller problem (gap_falsify runs ~once a day) is fixed by giving it its own pool condition (NI2-with-verified-site demand, weighted by demand_goals count from R) instead of riding the lifecycle scan. All qa v1 rulings carry (contained unprivileged runner FIRST; state-keyed authored_test {path, blob_sha}; relevance check; depth-1 compose child; held out of root run_suite).

## Reader = behaviour change (qa, 2026-10-02 ~21:25Z)
"Reader" means a consumer that CHANGES BEHAVIOUR on real traffic, not a report. R's reader is the re-dispatch through goal-execution-with-retry, gated on all linked gaps being closed; S's reader is admission (an S-armed gap becomes class2 and is auto-picked). The pre-registered measurement must show both readers firing on real traffic, including "selected by its caller N times in 24h" for R and S. A record written without a behaviour change is the June-template failure (built, seeded, never selected). demand_goals has two writers now: goal_reach entries are tagged {source:"goal_reach", ...} and must not change any existing demand_goals consumer (tested).

## Generality rule (user ruling 2026-10-02 via the surface session: "If we make changes to affect the outcome the system won't be working")
The operator's check-first arming today (ed21374, d7e1674) produced instance tests, and the lane answered each with more vocabulary (b260a15, 7295de1, acf4922: three layers of word lists in isCountableQuestion; 7fe068c: a news-only writer route). S must not automate that pattern:
- An authored RED test asserts a CLASS behaviour (the form of the request or the structure of the walk), not one goal's text. It must carry ≥2 RED instances that share the break but differ in topic/vocabulary, and ≥1 CONTROL from a different topic that must stay unchanged.
- Static relevance check extended: if all RED instances share a distinctive content word that the fix could key on (a topic noun), abstain with `test_rule:instance_vocabulary`.
- Freeze: no arming against src/quantitative-goal.ts until the general synthesis-before-judgment fix (walk-synthesis-step-does-not-receive-the-pool-evidence-it-should-summarize) lands; then re-check whether the countable rule is needed at all, or should key on form (a measurable attribute of an enumerable set, named as a quantity).

## Relevance vs generality (qa refinement)
- relevance = the RED tests exercise the edit-site behaviour named by the CODE-level defect signature (the identifier/field/call/literal in the faulty joint), never a goal's topic vocabulary;
- generality = ≥2 RED instances differing in topic + a cross-topic CONTROL; abstain `instance_vocabulary` when the reds share a topic noun.
A draft passing one but failing the other abstains. S's first-10 measurement uses gaps picked by a rule recorded BEFORE the run, not by hand.
