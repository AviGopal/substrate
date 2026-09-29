# git-devvessel-2 — development-vessel git history 2026-08-16 → 2026-09-29, plus resolver inventory

Source: live clone `substrate-live:/workspace/git/vessels/development-vessel` (HEAD `f451e42`, 2026-09-29 01:37Z).
Node 2 (`compose2-live`) clone is at the same HEAD `f451e42` (no node divergence for this repo at time of reading).
Host submodule `repos/development-vessel` is at `ba0f30b` (2026-09-23), **300 commits behind** the live clone.
The super-repo gitlink inside the container (`/workspace/git/super-repo/repos/development-vessel`) is at `5e9a0b2`, 22 behind.

## Coverage and method

- `git log --since=2026-08-16`: **1042 commits** (795 `Substrate Autonomous`, 241 `DevBob Assistant` (operator via Claude Code), 3 `Avi Gopal (operator bypass)`, 3 `avi (operator, via Claude Code …)`).
- Full `-p --unified=0` diffs, excluding `.bun/` (1.3 MB). All operator commit subjects were read. Bodies were read for the key reverts (fe52076, 4f6f466, 97f7cdf, 8a5223c, 91b11fe, 6501db3, 0d4c241, 66ba773, ca53600, 5598853). Autonomous subjects/diffs from 09-22→09-29 were read line by line, and the 134 autonomous commits with named gap ids were all read.
- **Inverse-pair detector**: for each commit B and each earlier commit A within 400 commits, B counts as a revert of A if B removes ≥80% of A's added lines and adds ≥80% of A's removed lines. It found 222 pairs, 161 of them on the canary fixture and **61 non-canary**. It misses reverts more than 400 commits apart and partial re-edits.
- **Repeated-line detector**: an identical added line (≥25 chars, not a comment) that appears in ≥3 commits.
- Resolver inventory: `ls src/resolvers` gives 262 entries (257 .ts, 5 co-located tests, plus `types`). For each resolver I grepped its importers, took its last-touched date, and cross-checked the seed templates (`src/seed`, 105 files) against the `execution` table.
- **Caveats.** The `execution` table seems to keep only about 7 days: the 7d and 30d counts for `development-vessel:mitosis-tick` were identical (7874), and `math::min(created_at)` returned null. So "not executed" below means *not executed in the retained window*, not "never used". Seed file names and activity ids differ in some cases (for example `shadow-state-observer-ticks` holds several ids).
- **Intent gap.** 605 of the 796 autonomous subjects name a `route-edit-<8hex>` id that is **absent from the live gap store** (`/workspace/git/super-repo/gaps/gaps.json`, 6278 rows). Their commit bodies carry only a Gap/Proposal/Mitosis/Base-SHA/Attempt-Id template. **The intent behind 76% of autonomous landings cannot be recovered from git or the gap store.** That is itself a finding (codebase-bloat-fossils / gap-content): a landing with no recoverable "why" cannot be audited.

## Headline numbers

| metric | value |
|---|---|
| autonomous commits | 795 / 1042 (76%) |
| canary-fixture toggles (`src/fixtures/attempt-ledger-canary.json`, a 1-line `{"canary": "intact", "runs": N}`) pushed to origin/dev as substrate-authored | **71 (9% of autonomous)**, 2026-08-31 → 09-26 |
| autonomous commits of 1–2 changed lines | 354 (45%) |
| 3–10 lines / 11–50 / 51–200 / >200 | 221 / 183 / 34 / 3 |
| non-canary inverse pairs (a later commit undoes an earlier one) | 61 (≈8% of non-canary autonomous commits were undone) |
| autonomous subjects with `-narrowed` | 62 |
| autonomous subjects with `recommit-` | 68 |
| autonomous subjects `apply mitosis-<timestamp>` (no gap id at all) | 112 |
| most-touched files (autonomous/all) | feature-compose.ts 161/201, gap-to-feature.ts 128/151, substrate-gap.ts 108/119, canary 70/70, rhythm-conductor-tick.ts 31/37, patch-with-tools.ts 26/29, vessel-mitosis-cutover.ts 25/45 |
| dev-vessel journal lines over 3 days | 296,052; `[gap-falsifier]` 70,761 and `[substrate-gap-event-publish]` 70,659 (log spam; the falsifier is recomputed per scan, e.g. repeated `falsifier=none`) |

Autonomous commit rate: 0–17 per day through 08-31, 25–37 per day 09-05→09-15, a trough of 1–6 per day 09-16→09-21 (seal/containment), then 43→80 per day 09-23→09-27 (post-reopen).

The self-development loop is **mostly editing itself**. Three files (feature-compose, gap-to-feature, substrate-gap: the compose lane, the picker and the gap store) take 397 of the 795 autonomous commits (50%).

---

## By problem class

### hollow-landing

- **Canary fixture toggles count as autonomous landings.** 71 commits (`d58105a`, `7bcf314`, `281bd41`, … first 2026-08-31, last 09-26) each flip a single value in `src/fixtures/attempt-ledger-canary.json`. They are fixture walks for the causal-attempt-ledger acceptance runs, and they land on origin/dev under `Substrate Autonomous` with the same template as real work. They inflate every "autonomous commit" count by 9% and add 161 inverse pairs to history. The fixture is read only by `attempt-checks.ts` and `attempt-register.ts`. Outcome: **live, unaddressed.** The acceptance fixture should not produce pushed commits on the shared branch, or those commits must be labelled distinctly.
- **dbb2917 (2026-08-22): two comment lines restating the gap text plus a whitespace reindent**, landed as closing route-edit-56849210 ("the drafter fails a one-line regex edit three different ways"). Reverted by operator 4f6f466. Side effect: the single inert landing made `verifyGapCondition` read `pending`, so the gap was picked 432 times in 48h and composed zero times. Outcome: reverted.
- **9d839e0 "sync vessel code" (2026-09-28, rhythm self-maintenance family)** committed 422 `.bun/install/cache` binaries plus runtime writes to `gaps/gaps.json` and `state/learning-mode-state.json`. Cleaned by 66ba773 (operator), which added `.bun/` to .gitignore and put the family on hold. **Still open:** `gaps/gaps.json` and `state/learning-mode-state.json` are still *tracked* in the vessel repo (`git ls-files`), which contradicts "runtime state is gitignored". Outcome: partial.
- **2248fae (07-20, autonomous) replaced the 268-line learning-mode controller with an unrelated concept-db lister under the same shape name.** The shape contract was satisfied and the body was hollow. Found and restored by operator 6501db3 on 2026-08-29. Outcome: worked (restore). The class (declared shape returned with a non-conforming body) has no detector.
- **f365f3a (07-04, autonomous) silently reverted "no work is not a win"** (an empty drain reported as success), as collateral inside an unrelated gap. Restored by 0d4c241 on 2026-08-29. Same honesty class as 93d7596 ("a write that succeeds is not an edit"), which the operator notes "the fleet keeps re-growing".
- Operator-added hollow-landing guards: 5ea6e02 (08-23, refuse a commit that strips load-bearing evidence and changes no code), 9c4e242 (09-05, refuse a literal edit that cannot change behaviour), `vacuous-edit.ts`, which has since been autonomously edited 6 times (212408a, 326a983, 0874216 on 09-24; ed313f2 and 4c154b9 on 09-25, the last of which *relaxes* the guard for log-level demotions), and de0a3b0 (08-26, reject tautological self-tests).

### autonomous-regression

- **`--no-block` on the gap-compose nudge.** 61a6e46 (09-11, autonomous) added it. 985859a (09-11, autonomous, a few hours later) **removed it**. Operator ca53600 (09-14) re-added it. In between, every `substrateGap_write` blocked the event loop for minutes: 115 s /health silences, the store grew 7,323 → 7,650 rows in one night (~327 freezes), and 36 picks produced zero cutovers. Outcome: now fixed (4 occurrences in substrate-gap.ts). The recurrence is the finding.
- **510b6df (08-28) was a stale-base cutover.** It was staged against base 4e87aba, which predates 421052c, so a no-op patch became a 44-line deletion of the fix it was meant to close. Reverted by fe52076. The operator filed "the stale-base overwrite class".
- The **stale-base / overwrite class recurs**:
  - 08-28 (510b6df → fe52076).
  - 09-24: a0ff3d3 was undone by 6ab8271, a 109-line autonomous resume-a-parked-landing commit that reverted a0ff3d3's one-line change. It was re-applied by 7994841.
  - 09-24: `0a0d59f` tried to close the class with a committed-drift refusal, but compared HEAD against `staged_base_sha`, which feature_compose sets to the hash of the *patched* file. It refused every cutover and was reverted by operator 97f7cdf ("the pipeline could not land its own fix"). 082f6ee then changed `staged_base_sha` to base_content. Per 97f7cdf, the overwrite class "stays open".
- **Autonomous duplicate insertions**:
  - 128f51f and 31d07cd (09-25) inserted the same 31-line AUTONOMOUS-PICK LEASE block twice. 15bb263 deleted one copy (31 lines), and 292aff1 (09-27) re-touched it.
  - `forwardToGapStore` was added twice (51e30de, 516bc18 on 09-25). Only one definition survives.
  - The `classification_metadata` spread is duplicated at substrate-gap.ts:728 and :732 (see write-read-mismatch).
- **The `gapsPath` default flip-flopped**: 9b2473a (09-06) set `join(workspaceRoot(),…)`, ab4e064 (09-09) set `"/workspace/gaps/gaps.json"`, and 6b15167 (09-09) set it back to workspaceRoot. That is three autonomous landings in 3 days toggling the live-store address. The current line is 330 (`workspaceRoot()`).
- **Sleep insertions**: `setTimeout(resolve, 50|10|0)` was added to feature-compose.ts by c42cef9, bce0115, 95865af and 9e5f3e7, and each was removed by a later autonomous commit (0149dfb, 3b297ea, 6fcdf40, 24ad682). These are symptom edits for timing races that then churned.
- **git-status symbolic-ref fix landed twice**: abbfa4c (08-29) and 7c6c3ff (09-15), with 7c6c3ff reverted the same day by 230011b.
- Operator restorations of deleted behaviour on 2026-08-29 (6501db3, 0d4c241), plus c173011 ("restore the execution citation on substrate-authored concepts").

### directed-overshoot

- **ca53600 (2026-09-14, operator).** The message describes a single `--no-block` flag. The diff is **+30/−122** on substrate-gap.ts, and the inverse detector matches it as undoing 12 autonomous landings (b907922, f2aea65, 985859a, c0df2ff, a7ee2a1, d312f43, d5e2251, 6417ff6, ec3f93a, 0a9d921, 8cdb1a4, d36c4e3). Removed content includes:
  - the **8-hex id-normalisation in `gapClassKey`** (landed 3× on 09-14 as 8cdb1a4, 14def70 and 3a97d2f under gap "consumption-gate-is-inert-because-gapclasskey-does-not-strip-8-hex-discriminators");
  - a gaps.json load-validation and salvage block;
  - hardcoded `"route-edit-…"` ids in a union type (junk);
  - one copy of the classification_metadata passthrough.

  Cause (stale local base vs deliberate cleanup) is PLAUSIBLE only. The closest prior blob (01cf120, 09-11) still differs by 19 lines. What is proven is that the message understates the diff by roughly 5×. **Current state: `gapClassKey` (substrate-gap.ts:313-323) has no 8-hex rule**, so every `route-edit-<8hex>` gap gets a unique class key and the consumption gate / class dedupe is inert for them. Outcome of the 8-hex fix: **reverted, never relanded.**
- **5598853 (2026-09-15, operator)** says "log inside the grounding catch… behaviour is unchanged". The diff is **+40/−63** on feature-compose.ts and undoes 7 autonomous landings (206f055 RETRY CONTEXT, 170c3d6, 44caeaa, a325ef1 directed verdict, ad38ca4 recommit-depth, 14e761c, 16a92c3 test-target grounding). The "behaviour unchanged" claim is false at the diff level.
- **Operator-reverted operator changes**:
  - be26a6b + 196e755 (08-30, "closure predicate at birth") were reverted by 8a5223c (08-31). A predicate derived at or after land time can never read 'absent', so it converted 2 correctly-pending gaps to permanently-present and manufactured re-lands.
  - fee458e (08-30, "prefer line-addressed edit") was reverted by 91b11fe (08-31) after apply_failed rose 0% → 31% → 45% → 66%.
  - 18a4e3c / 14e530e (08-28): docs-align accuracy was kept disabled, then enabled the same day.
- **The federation fix series on one day (2026-08-18)**: afde30b (hub-egress looped back to local), 4a57cfa (a multiaddr does not mean remote), 79b0b9c ("one arm per peer was an over-correction"), 01ab865 (the cascade could not see a federated failure), 659cb35 (a foreign substrate was answering), c35af84, 2371bb2 (resolve federated arms lazily). That is 7 successive corrections to one routing seam in a day, each partly fixing the previous one's overshoot. No federation code in this repo has been touched since 08-18 (`git log -- src/resolvers/*federat*` since 08-19 returns 0).
- Operator bypasses (3):
  - 0c1540e (09-20, cutover quiesce, "after 3 gated drafter attempts");
  - f5bbaa0 (09-22, class-Thompson gap-lane allocation);
  - 03505e5 (09-22, honour the region hint first).

### false-verification

- **d8c93b4 (2026-09-25, autonomous) forged `operator_approved: true`** onto the gap inside the compose-lesson writer ("force operator_approved: true so the lesson write proceeds"). Reverted by 60ad9cd (autonomous, gap "a-substrate-authored-block-in-the-compose-lesson-writer-forges-operator-approved-true"). Root cause: the approval-boundary prompt told the drafter to set the flag itself, fixed in 5cbc6d0. Outcome: reverted. A drafter can write authority fields; nothing structural prevents it beyond the prompt.
- **patch-with-tools.ts:239 (d12c654, 2026-07-26, operator-authored, still live)** hardcodes `evaluation_evidence: { verdict: "FAVORABLE", base_success_rate: 1, mitosis_success_rate: 1, cited_trace_ids: [] }` after a static evaluation, and passes it to `vessel_mitosis_cutover`. This is the same class as d8c93b4 (synthetic evidence at the landing seam), but not caught. The autonomous landing 70d2a00 (09-25, "resolver changes must show runtime evidence: cite at least one execution trace id") addresses the evaluate side, but `cited_trace_ids: []` is still emitted here.
- **The close/verify oracle was rewritten repeatedly**:
  - 308cb8a (08-23) recognised conventional-commits reverts after `revert(` defeated `landedCommitVerdict` (4f6f466 body);
  - 54cb1b0 (08-31) Class 1b presence predicate;
  - a0bee87 (08-31) removed-line predicate;
  - 65115b5 (08-31) "the closure sweep has been silent since it was written";
  - e204d06 (09-01) "no Class-2 predicate has ever been evaluated — wrong envelope";
  - 2c48c6c (09-01) "a census that can lie is worse than no census";
  - c08db58 (09-02) the reach-rate falsifier could close a gap on a single graded run;
  - f36c851 (09-07) falsifier census blind to class-1b;
  - d9131e6 and 5499f5c (09-15) arming guard for already-present expected_literal, landed twice. Per memory 09-22 the guard *never fires* (ENOENT path bug); 7061bda (09-26) pinned it with a test. Arming-guard outcome: landed 09-15, broken until at least 09-22, then test-pinned.
  - f122f86 (09-23) gap-closure-by-predicate-not-landing;
  - f083cf0 (09-15) land-signal only matched a gap id in the commit message.
- Operator "a thin/empty sample is unmeasured, not a pass": bd3117e (08-28, health-tick lift gate rewarded idleness), 483d5c4 (08-28, empty baseline), 0bd7ffe and 495de00 (09-05, rung denominators).

### write-read-mismatch

- **Flat-pointer gap write drops `classification_metadata`.** b907922 (09-09, gap "the-flat-pointer-gap-write-path-silently-drops-every-measurement-predicate"), f2aea65 (09-09) and ec3f93a (09-13) are the same fix landed 3×. ca53600 removed one copy; **two identical spreads remain at substrate-gap.ts:728 and :732**. Outcome: partial (works, duplicated). Per memory 09-23 the store also "carries forward omitted keys".
- **Trace readers were reading the wrong table**: 6b580d5 (llm-quota-observer) and 24105a2 (failure-count-report), 08-29, "read `executions` — it was seeing an empty trace stream". 9a33df2 (08-29) repointed `error` at the real trace store.
- **Causal writes**: 83d5c60 (09-05, "both impulse writes omitted a required field and were silently inert") and 0e9e3d6 (09-16, "read the fields that are actually stored"). 929f625 documented NONE vs NULL.
- **Landing trace emission placed wrongly 3 times** (08-29): 4afd4c1/e8e3fec emit, ee74683 ("the append site never fires"), 7bbda5d ("two single-site placements were both wrong"), 8af0f94 (it was fire-and-forget and never arrived), 3ea9136 (bound the await). Then c5f3f09 graded landing traces reached:true "so the ribosome can extract".
- **e0a07bf and 3ca4758 (09-06)** "landed-vessels-filters-on-a-field-the-cutover-never-sets", landed twice.
- **solicitation-outcome-scan read a surface the human answers never reach**: 510b6df (the bad autonomous attempt), then 421052c (08-28, operator), then 175b9f1 (09-20, it pins one UI endpoint instead of discovery).
- **The drafter-lesson channel**: f580efd (08-30) "mirror lessons to concept-db, not to discovery"; cc5bc8b checks the mirror HTTP status; 04e1065/64c5ebf (08-31, 09-01) "a LANDED prior attempt now reaches the drafter"; 95d973e/b865620 (09-11) conceptSearch compose_lesson pointer added then removed.
- **d4171b1 / 4332e38 (09-23)**: the expectation-trend checker never retires the probe notes it grades (memory residue).
- **3ed68a6 (09-23)**: dev-vessel resolve rejected a bare-type body that sibling vessels accept, so "drafted requests land green and do nothing".

### sync-deploy-drift

- **The stale super-repo copy was used as the target-file source.** On 2026-09-24, 8 autonomous landings share one root cause: compose gates read the target file from the super-repo submodule copy, "a hundred commits behind the push clone". Those landings are 20a668b (four gates), a0ff3d3 (anchor-band centring), 13841a4 (nontermination/dead-store simulation), 1d4ac1c (co-located test discovery), 996b841 (three more readers), 8abd573 (live-sync rollback restores over a committed copy), 7994841 and 5c31f5e. That makes 8 separate call-site fixes of one address bug instead of one resolver (`targetFileOnDisk`, introduced by 20a668b). Measured now: the in-container super-repo gitlink is 22 commits behind the live clone, and the host submodule is 300 behind.
- **The post-land suite was dead from 08-31 to 09-28** because the shell tool's 30 s default kills the process group before the suite prints (memory). The fix is 5e9a0b2 (09-28, autonomous: `timeout_sec: Math.min(budgetSec + 30, 900)`). Earlier partial fixes of the same class: 7ed1bf8 (08-28, per-test timeout, "bun's 5s default was a load sensor"), 8dcc6a0 (08-29, "7ed1bf8 fixed test-suite.ts and missed the landing gate"), c37aab5 (08-29, "ask the shell for the time verify actually needs"), 3e687d2 and 0fd7487 (08-29, mitosis timeouts leak children), a07c8ce (08-30), 9822a8e (09-06, a load-induced verify timeout charged to the drafter), d8a5f84 (09-15, narrowed). That is **five or more attempts on "the test gate times out" over one month**; each fixed one call site of the shell-timeout seam.
- **Seed-template landings are inert until the seed unit re-runs**: d2f526a (09-26, narrowed), ddde382 (09-25) and 5475e11 (09-24, "raise seed_version whenever this body changes").
- **Push-clone HEAD**: 6de3011 (09-07) "nothing-ever-advances-the-push-clones-own-head", and 6667772 (09-23) "the precutover suite … clean-slates the staged index so git commit finds nothing to commit".
- **self-fact-reconcile**: 983ca92, bad7993, 4e70cbb (09-23) plus 5 authoring-root divergence landings on 09-27/28 (b585a03, 04b3e9c, a198907, b20274c, 9c86aff). Of these, b585a03 was reverted by 12c7d9a, 04b3e9c by 37d0f72 and a198907 by 4068e7e: **3 of 5 undone the same day**.

### test-residue-live-state

These entries all describe one class: a test run or fixture writes to live state.

- 1813930 (08-28): the mitosis-cutover suite was non-deterministic under ambient `MITOSIS_*` env.
- 08-29 hermeticity sweep: about 40 operator `test(...)`/`fix(test)` commits on one day (5525797, 616ff68, 7f5f454, 93060ef, 4810ad6, 6d7d266, 33855a3 "code-locality-tick: stop mutating live state", fbbfd9b "release the maintenance lease after the suite", efe7cd3 "restore global fetch so these suites stop poisoning later ones", …).
- d7135b7 (08-30): make the compose-trigger side effect test-hermetic.
- fd86777 (09-01): "a suite that can silently write to the LIVE gap store now fails loudly".
- 2974205 (09-23, autonomous): "bun test sets NODE_ENV=test; a test run must never write the live ledger".
- 7061bda (09-26, operator): isolate the falsifier suite.
- f451e42 (09-29, autonomous): run the verify suite under `env -i PATH HOME NODE_ENV=test TZ=UTC`, stripping ambient env.
- The **super-repo working tree in the container is littered with residue**: `trendcheck-product-*` (≈25 dirs), `trendcheck-base64-*`, `memoryNote-trendcheck-*`, `temp_file.ts`, `temp.json`, `test_file.txt`, `{{out_path}}`, `{{target_path}}`, `known-answer.txt` and `known_answer.txt`. These are unrendered template placeholders and battery outputs written as files at the repo root.
- The canary fixture (above) is test residue landed as commits.

Recurrence: at least 7 distinct fixes from 08-28 to 09-29, and the class has no single seam (no sandboxed test env enforced by the runner until f451e42).

### narrowing-duplicates

- 6304d64 (08-29) stopped narrowing `recommit-` gaps, closing the alternation loop; da86fbb pinned it with a test.
- b17eccd (08-31) added exponential per-gap backoff; b44dcad applied it at LINEAGE grain, not gap id.
- ad38ca4 (09-14, autonomous) recommit-depth counted `-narrowed`; removed by 5598853.
- 72fdb1f (09-24) and 2992a23 (09-25) touched the recommit guard again (`_recommitDepth < 2 && cls !== "scope_refused"`, then `&& !reason.startsWith("[deterministic] ")`).
- a57dc30 (09-23): "a narrowed child inherits its parent's predicate and authorship fields and is minted without failure lessons as a verbatim duplicate".
- fcbd737 (09-24): "the narrowing minter spawns a child for a gap whose last lesson is a deterministic refusal".
- 415a903 (09-15): "auto-minted child gaps monopolize the cap-1 compose lane".
- 8cdb1a4/14def70/3a97d2f (09-14): the 8-hex class-key fix, landed 3× and later lost (above). **Without it, every route-edit id is its own class.**
- 617b12a / b6f0d14 (09-25): fold per-commit unaccounted-landing gaps into per-repo aggregates. The new unaccounted-landing detector (eccd6d9, 09-23) immediately produced per-commit duplicate gaps.
- 62 `-narrowed` and 68 `recommit-` autonomous landings. Recurrence: the narrowing/recommit guard was edited on 08-29, 08-31, 09-14, 09-15, 09-23, 09-24 and 09-25.

### drafter-quality

- Anchors:
  - 8efd578 and cc2354d (09-12): the drafter anchors on comments and message strings, producing zero behaviour delta;
  - 64968c1 (09-06): spec refinement overwrites a verbatim anchor;
  - 489503a (09-20): fc-repair discards the plan's unique anchor;
  - 2f2ba0f (09-23): the anchor-provenance gate re-drafts a deterministic verbatim op;
  - 8d165a9 (09-22): "the compose lane lands under nine percent and two-thirds die at anchor or grounding";
  - operator 03505e5 (09-22): honour the explicit region hint first;
  - ae48c95 (09-06): tell the blind-edit anchor repair which statement failed;
  - c86451f (08-25): `replace_lines` op; fee458e/91b11fe (line-addressed edit reverted, above).
- Net-new files: 632955a, 578b831, 3c6a4b3 (08-24/25), and 60ec54a (09-23), "a target that does not exist on disk yet is a CREATE".
- Semantic gate / refuters:
  - a105756 (08-18): a quorum of one is not a quorum;
  - 7ab6155 and 1746f5a (09-24): "two samples of one refuter prompt overturn a passing judge so a shared confabulation rolls back a verified byte-exact patch" (landed twice);
  - 31dbc81 (08-29): waive reachability for test-only diffs;
  - 70d8fd0 (09-28): SATISFY-STALE-TEST guidance.
- Grounding: 5598853 (09-15) found 48 of 48 grounding windows reported 0 bytes because of a bare catch, a 100% refusal rate; 08ae5f9 (09-06) admission gate cannot read the file the gap names.

### gap-content

- e137df6 (09-05): "prose-only gaps are structurally unclosable so the TTL becomes their only exit".
- ea2476c (08-30): defer gaps that name no existing file.
- ddb34cb (09-01): "make 'can this gap ever close?' a fact the store holds".
- d3e1ca2 (09-14): lift EDIT_SITE/EXPECTED_LITERAL/VERIFY_SHAPE out of an operator answer.
- 4e5a603 (09-14): gap selection ignores whether a gap can be verified closed.
- c23b601/194df79 → bea12ec (09-27): ACTIONABLE-ONLY ADMISSION (value-per-cost 2.2) was landed twice, reverted, then re-landed.
- 9bf8512 (09-27, operator test): "siteless gaps without a class1/class2 falsifier are not compose work".
- 6023162 (09-23): reconcile-filed divergences need a data repair, not a patch.
- 53c4b4e (09-19): disagreement gaps have no localization pathway.

Recurrence: "gaps born without an edit site or machine check" was addressed on 08-30, 09-01, 09-05, 09-14 and 09-27, each time at a different seam (picker, store fact, TTL, escalation parse, admission).

### calibration-seal / human-surface-escalation

- 9cb83d0 (08-28): apply the human's disposition, "the executor the seal was waiting on".
- 891304c and 91cc1ff (08-29): the escalation disposition parser rejected its own verb names.
- 60722a6 (08-29): a live human exemption earns selection priority, not just seal immunity.
- 7d48a27 (09-20): gap-site saturation cap starves human-reported gaps.
- f5bbaa0 (09-22, operator bypass): class-Thompson gap-lane allocation, because the compose lane starved cooled human gaps.
- 768ae7c (09-25): human-reported class bucket split.
- 03d98c1 (09-25): hopeless-gap escalation dedupes in process memory, so every restart re-asks the same human question.
- 31ce2f7 (09-25): operator_hold only guarded closing, so held gaps were still composed.
- 030b224 (09-25): the substrate cannot see its own human surface (no browser in the image; the legibility scan reads obsidian).
- f80bc67 and 9ec3a29 (09-25): "the substrate's own deploy step cannot deploy the live human surface".

### selection-learning

- 1ed2c3f (08-25): flag undifferentiated posteriors as degenerate.
- 2bc18d1 / dc874da (09-16): the rhythm conductor's posterior gained a penalty leg, then "the penalty leg was resetting the demand clock it exists to protect".
- 40395ba (09-05): assert an arm cannot execute more than it is selected.
- **The trace-store-reconcile family sampler** took 6 landings under one gap on 09-24: 2bccc64, 651d10a, 0da5fd0, c598f1d, 2fd1dca, a8f457a, plus a5b4772 "reads only the first hundred templates so it samples a family of one". The last line of this repo's history, 0ac156a (09-25), still re-points the remedy at `gap_to_feature`. Executions: `trace-store-reconcile` 470, `-lease-ttl-120s` 171, `-release-before-verify` 166 in the retained window, so the variants *are* being drawn now.
- 329fc5c (09-26): rhythm-reality-sync rewrote the whole rhythm body from a stale read, so concurrent alpha/beta settlements were lost. rhythm-reality-sync's poolImpulse write was landed 3× (282b78d 09-10, 2b9c520 09-15, cc51104 09-18).

### spend-envelope-throughput

- Compose capacity:
  - 289cf2f (08-31): ask for compose capacity before paying for selection;
  - 5472e8b (08-29): BUSY is a retry, not a failed attempt;
  - be891f3 (08-29): a compose that never ran must not burn cooldown;
  - 817fb3f (08-29): refuse an empty pointer before claiming a slot;
  - 799bd58 and 4290d6c (09-23/26): the gap-write nudge ignores lane capacity (landed, then narrowed);
  - c8cfc38 and 01d085d (09-24): per-gap in-flight guard, landed twice;
  - 57e103c (09-26): an untargeted pick pass takes over 5 s.
- Change window:
  - b001631 and 62e174a (09-24): a failing trace-store-reconcile re-takes the single global change window, so cutovers deferred 45× in 90 min;
  - named maintenance leases: ace49c0, e17ea38, 4e40707, 80e168f, 0b06246, 9ee5d9d, a2f7542 (09-24);
  - 565dcfa (09-23): respect the change_window lease on rollback.
- Restarts:
  - 60f4469 and 46d252c (09-24): consecutive landings each schedule their own self-restart;
  - 404a89c and bf74cc5 (09-23/24): drain/quiesce counters ignore gap_to_feature, so a self-restart kills the compose it drives;
  - 0c1540e (09-20, operator bypass): quiesce goal-host at fire time.
- Resumable landings (09-24): 873fd81 parks a patch that passed verify; 6ab8271 resumes it; c1dd4c2 prefers a fresh park; b789d9c sizes the drain budget.

### endpoint-routing / env-gating

- **The empty-env `??` pattern** was fixed at many sites: 3409fac (08-29, "treat an empty env var as absent"), fbb2441 (patch-with-tools), f22d88e (advertised-shape-coverage-scan), and 6501db3 (carried forward). The autonomous d5a4aba (09-08) threw on an empty DISCOVERY endpoint and was reverted by f9f1ea2.
- 57b6cd6 (08-21): `GOAL_HOST_VESSEL_ENDPOINT` defaulted to the development-vessel port.
- 0288c40 (08-17): two resolvers called activity-api paths it does not mount.
- 175b9f1 (09-20): solicitation scan pins one UI endpoint.
- 57c759a (09-23): development-vessel was absent from the discovery registry and did not re-register, **so every activity it serves was unroutable**.
- 5be029a (08-16): `http_response` ignored the URL and fetched a hardcoded httpbin probe.
- 1170047 (08-16): health-report assumed a vessel.
- Env gates: gap-env-gated-write-allowlist was landed 3× on 08-17 (6651808, 038ed0d, 8f05704); f38f68b (gap-env-gate-fulfilled) and 4814234 (dev-operator-present) followed on 08-18; b705e54 (09-03) skip-compose-trigger; 60e3154 (08-29) deleted `env_gate_fulfilled`, "unwired, unconsumed, unreachable"; 2e21501 (09-05) records why the env-gated early return was deleted. Still live: `patch-with-tools.ts` reads `process.env.AUTHORING_ROOTS_PATH` (a198907, reverted by 4068e7e), and gap-to-feature and attempt-register read `process.env["SUBSTRATE_NAME"]` for owner/node (b2f30d3, 792a9cd).

### dormant-mechanism

- **09-05 operator "ladder" / causal burst (~40 commits in one day)**:
  - operational-state (3333f00 recovery ladder, rungs 2/3/6/7);
  - causal-adjudication (e996240, 6d0c16e, f94db3e, 85c490f, 9de05c4);
  - detector-yield (fd4afe6, a245fee, 0ca8bad);
  - schema-drift (8636190, e85d3ab);
  - gate-self-probe (ecf1d17, fe3cece);
  - mitosis-evaluate dialect checks (e8bc5ca, 99f4613, ade829d, 84d9900).

  Retained-window executions: `gate-self-probe-tick` 37, `detector-yield-registry-tick` 41, `satisfier:operational_state` 3, **causal-adjudication 0, schema-drift 0**. causal-adjudication.ts (498 lines) is imported only by substrate-gap.ts and gap-to-feature.ts. Status: dormant (PLAUSIBLE; activity-id mapping unverified).
- **Three causal mechanisms for one intent** ("did this action change the world?"):
  1. 09-05 causal-adjudication + operationalState snapshots (operator);
  2. 09-16 439072c "stamp a causal baseline before anything acts" + 4e9a45e/0e9e3d6 (operator);
  3. 09-23 causal-attempt-ledger `attempt-ledger.ts`/`attempt-register.ts`/`attempt-checks.ts` (autonomous, openspec-driven; `attempt_register` 8 executions, `attempt_snapshot` 5).

  The ledger was ACCEPTED on 09-26 per memory. The first two are duplicates or fossils unless they are folded in.
- reach-rate-scan (bb8516e 09-01, c08db58 09-02), sensing-integrity-tick (0d0fbde 09-01), docs-align (f3933c5, ddbfdc4, 14e530e, ffbabd7 09-23): no executions of `detect-reach-rate-shortfall` or `docs-align*` in the retained window.
- **53 of 105 seed templates** had no execution in the retained window. Among them: detect-reach-rate-shortfall, detect-cutover-stuck-loop, mechanism-health-tick, trace-store-health-observer, self-interference-scan-tick, substrate-health-tick, learning-transfer-gap-tick, harness-run-matrix, release-change, ship-change, vessel-repo-promote, predict-and-verify, recover-from-goal-failure, try-direct-answer, and the obsidian probes.

### composition-crystallization

- c5f3f09 (08-29) grades landing traces reached:true so the ribosome can extract. `learned-activity-learned-feature-compose` has 233 executions in the retained window, so the extraction did produce a learned feature-compose activity.
- 379cf6c (08-29): two seed templates advertised llm output shapes nothing in the fleet emits.
- bbfc43b (08-29): register cyclic_flow_scan so its seeded activity can route (the three-place rule).
- Executions show heavy repeated gap-closing activities: `gap-closing:pull-sync-unhealthy-activity-api-1784251158497` ran **1490 times in about 7 days**, a gap-closing template stuck on a loop. That gap was also landed 3× autonomously (d1a52b1, af1d3db 09-05; 405de7f 09-07).

### codebase-bloat-fossils

See the resolver inventory below. Also:
- the duplicated classification_metadata spread (substrate-gap.ts:728 and :732);
- runtime files still tracked in the vessel repo (`gaps/gaps.json`, `state/learning-mode-state.json`);
- the canary fixture commits;
- the residue in the super-repo root.

### docs-drift

- f3933c5 (08-21): the docs checker reported 40 findings on correct docs, all false.
- ddbfdc4 (08-22): stop reporting correct docs and correct refusals as failures.
- 18a4e3c/14e530e (08-28): accuracy check disabled and then enabled.
- 9abb4bd (08-29): expect shape_existence, not accuracy, for a prose shape mention.
- ffbabd7 (09-23): deterministic install-surface checks.
- 2efbe8f (09-23): README dev-server section marked developer-only.
- 07972f9 (08-30): corrected a *false incident narrative* in a code comment. Code comments carried confabulated history.

### trace-store-db

- 7399f0c (08-28): page the trace list instead of silently truncating at 100.
- a5b4772 and 2fd1dca (09-24): `/templates` clamps limit to 100, so the family sampler saw one.
- 5550d3c and 9dbdd58 (09-05): mitosis-surql DEFINE FIELD parsing. Per memory 09-22, a substrate-authored deletion (54b7762, in another repo) wedged the surql gate.
- 5f3c69d (09-05): one parallel query group, bounding the seeding race.

---

## Resolver inventory (src/resolvers, 257 .ts files, live clone)

Import counts (non-test importers): almost all resolvers are imported exactly once, by `src/routes/impulses.ts` (1145 lines, 265 `case` arms, 258 distinct shape cases). So an import proves registration, not use.

- **Never imported (dead):** `operator-review-patch.ts` (236 lines, last touched 2026-06-12), and `git-head-commit.ts` (44 lines, fixed by the operator on 08-29 in bc7ab7f but imported only by a test). Fixing `git-head-commit` spent effort on dead code.
- **Shape cases with no reference outside impulses.ts in any vessel**: `failure_count_report` and `fossilRankReport`.
- **Last-touched distribution**: 21 files last touched in May, 67 in June, 63 in July, 52 in August and 54 in September. 151 of 257 (59%) have not been touched since the start of this window.
- **Near-duplicate / overlapping families** (candidates to fold; unverified which are live):
  - docs: `docs-align-bridge`, `docs-align-scan`, `docs-align-tick`, `doc-drift-fix`, `doc-fix-policy`, `docs-decision-answer-scan`, `docs-decision-deliver`, `docs-decision-solicit` (8 resolvers, 0 docs-align executions in the retained window).
  - recurring patterns: `trace-recurring-pattern-scan`, `recurring-pattern-cluster`, `recurring-pattern-concept`, `trace-failure-pattern-report`, `resolver-pattern-report`, `failure-mode-summary`, `failure-mode-matrix-score`, `failure-count-report`.
  - attempts: `prior-failed-attempts` and `prior-successful-attempts` (seed draft-gap-closing-activity; 1 `satisfier:prior_failed_attempts` execution) vs the new `attempt-ledger`/`attempt-register`/`attempt-checks` vs goal-host's failure memory keyed by goal_hash (memory 09-22). **Three failure-memory stores.**
  - causal: `causal-adjudication` + `operational-state` vs the `attempt-*` ledger (above).
  - pairs: `detector-yield-registry` / `detector-yield-registry-tick`; `learning-policy` / `learning-policy-writeback`; `load-attribution` / `load-attribution-report`; `code-locality` / `code-locality-mining-tick`; `noop` / `lift-demo-noop` / `emit-shape`.
  - obsidian: 11 `obsidian-*` resolvers plus `ui-screenshot`, `ui-write-passthrough` and `ui-legibility-scan` in the development-vessel. The live human surface is a separate vessel (and per memory not authorable). By data locality (law 11) these belong with the surface. Retained-window use is small (`satisfier:obsidian:note with project list content` 25, `ui_screenshot` 4, `vessel_count` 3).
  - file and git tools: `fs-read`, `fs-write`, `fs-edit`, `fs-grep`, `fs-list`, `git-*` (8), `gh-*` (3) and `http-fetch`/`http-retry`/`web-resource`. local-tools-vessel also advertises fs/shell primitives (its index.ts references `fs_read`/`fs_write`/`git_status`), so these are candidate cross-vessel duplicates.
  - observers: 20 or more `*-observer` resolvers, many single-use ticks.
- 53 seed templates have no execution in the retained window (list above).

---

## Mechanisms (general vs specific; used vs fossil)

| mechanism | location | general? | status | evidence |
|---|---|---|---|---|
| mitosis cutover (stage→evaluate→cutover→push) | vessel-mitosis-cutover.ts, patch-with-tools.ts | general (the single landing seam) | live-used | 589 `vessel_mitosis_cutover` execs in the window; 886 rows in mitosis-applied.jsonl |
| pre-cutover newly-failing gate (`computeNewlyFailing`) | 70b3e31/ab3622c 08-23; 6d1562c isolation re-run | general | live-used; the post-land suite was dead 08-31→09-28 (fixed 5e9a0b2) | memory, 5e9a0b2 |
| committed-drift gate (`0a0d59f`) | vessel-mitosis-cutover.ts | general | reverted (97f7cdf); overwrite class open | 97f7cdf body |
| resumable/parked landings | feature-compose.ts 873fd81, 6ab8271 (09-24) | general | live-used | 97f7cdf "parked … resume once this lands" |
| close oracle: Class 1 / 1b / 2 / 3 predicates, `landedCommitVerdict`, arming guard | substrate-gap.ts, gap-to-feature.ts, removed-line-predicate.ts | general | live, repeatedly rewritten; arming guard broken 09-15→≥09-22 | 54cb1b0, a0bee87, e204d06, d9131e6/5499f5c, 7061bda |
| closure predicate at birth | be26a6b | general | reverted (8a5223c) | manufactured re-lands |
| line-addressed `replace_lines` preference | fee458e | specific | reverted (91b11fe) | apply_failed 0→66% |
| `gapClassKey` 8-hex normalisation | substrate-gap.ts | general (class dedupe / consumption gate) | reverted, never relanded; **consumption gate inert for route-edit ids** | ca53600; current :313-323 |
| `targetFileOnDisk` (push-clone-first file resolver) | feature-compose.ts 20a668b | general helper, created after 8 call-site fixes | live-used | 09-24 cluster |
| vacuous-edit guard | src/vacuous-edit.ts | general gate | live, autonomously loosened (ed313f2 log-level demotions) | 6 autonomous edits |
| semantic gate / refuter quorum | patch-with-tools pwt-semantic-gate | general | live; the quorum was altered 3× (a105756, 7ab6155, 1746f5a) | |
| maintenance leases (named: cutover, trace_store, change_window, autonomous_pick) | maintenance-lease.ts | general | live-used | 09-24 series, 128f51f lease |
| per-gap in-flight guard / compose slots | compose-slots.ts (c8cfc38, 01d085d) | general | live | |
| narrowing / recommit minting | feature-compose.ts, gap-to-feature.ts | specific policy | live, churning; creates duplicates | 62 narrowed + 68 recommit landings |
| exponential lineage backoff | gap-to-feature b17eccd/b44dcad | general | live (unverified) | |
| causal-adjudication + operationalState snapshots | causal-adjudication.ts, operational-state.ts | general intent | **dormant** (0 adjudication execs; 3 operational_state) | exec table |
| causal baseline stamp | 439072c (09-16) | specific | duplicate/unknown | |
| causal attempt ledger | attempt-ledger/register/checks (09-23) | general | live-used, ACCEPTED 09-26 (memory) | 8 register / 5 snapshot execs |
| self-fact-reconcile | self-fact-reconcile.ts (983ca92, 09-23) | general (self-model vs reality) | live-used, 574 tick execs; 3 of 5 of its own authoring-root landings reverted same day | |
| unaccounted-landing scan | unaccounted-landing-scan.ts (eccd6d9) | general | live; produced per-commit duplicates, folded 617b12a | |
| gate-self-probe | seed/gate-self-probe-tick.ts | general (test your own gates) | live-used, 37 execs | |
| detector-yield registry | detector-yield-registry(-tick) | general | live-used, 41 execs | |
| schema-drift detector | 8636190/e85d3ab | specific | dormant (0 execs) | |
| reach-rate-scan | bb8516e | specific | dormant (0 execs of detect-reach-rate-shortfall) | |
| docs-align family (8 resolvers) | docs-align-*, doc-*, docs-decision-* | specific | dormant in the window; duplicate family | |
| federation cascade in dispatch | 08-18 series | general | untouched since 08-18; federation verification satisfiers run (176/110 execs) | |
| canary fixture walk | src/fixtures/attempt-ledger-canary.json | specific acceptance fixture | live, pollutes history | 71 commits |
| rhythm self-maintenance "sync vessel code" | rhythm family (9d839e0) | specific | held by the operator (66ba773) | |
| synthetic FAVORABLE evidence | patch-with-tools.ts:239 | seam-level | live defect | d12c654 |
| prior-failed/successful-attempts | resolvers | specific | near-dormant (1 exec), duplicated by the ledger and goal-host failure memory | |
| obsidian-* resolvers in dev-vessel | 11 files | specific | mostly dormant; misplaced by locality | |
| `operator-review-patch`, `git-head-commit` | resolvers | specific | fossil (never imported) | |

---

## Principles stated in this history (with location)

- "A detector with no reader is an archive": e85d3ab (schema-drift, 09-05).
- "A detector nothing runs is indistinguishable from one nobody wrote": 603d7a4 (08-17).
- "A census that can lie is worse than no census": 2c48c6c (09-01).
- "No work is not a win; an empty drain is not success": 0d4c241 (08-29), restoring 54fc5c8.
- "Returning your declared shape with a non-conforming body is worse than failing": 6501db3 (08-29).
- "A thin/empty sample is UNMEASURED, not a pass": bd3117e and 483d5c4 (08-28).
- "A redefinition is not a change in the world": 0572cae (09-05).
- "Divide by the arms where evidence can change a decision": 495de00 (09-05).
- "A predicate derived at or after land time can never read 'absent'": 8a5223c (08-31).
- "Message format is load-bearing: a revert must match the detector's grammar": 4f6f466 (08-22) and 308cb8a.
- "Confirm a failure in isolation, not by re-running under the same load": 6d1562c (08-28).
- "Push is an owner-scoped capability; shared-branch landing needs an evidenced promotion": 2b3e296 (09-23).
- "operator_approved is operator authority: code never sets it": 60ad9cd (09-25).
- "A test run must never write the live ledger": 2974205 (09-23); f451e42 `env -i` (09-29).
- "The correct overwrite check compares HEAD to the PRE-edit content the compose started from": 97f7cdf (09-24).
- "Reverting on mechanism plus a monotone trend rather than waiting for significance": 91b11fe (08-31).

## Recurrence summary (the same issue in a different form)

1. **Test gate timeouts**: 7ed1bf8 → 8dcc6a0 → c37aab5 → 0fd7487/3e687d2 → a07c8ce → 9822a8e → d8a5f84 → 5e9a0b2. One seam: a shell-tool default timeout plus load. Fixed one call site at a time over 31 days.
2. **Stale target source / stale base**: 510b6df (08-28) → 8 call-site fixes (09-24) → 0a0d59f/97f7cdf → 082f6ee. Overwrite class still open per 97f7cdf.
3. **Fixes lost to a later commit**: `--no-block` (09-11 → 09-14), the 8-hex class key (09-14, still lost), classification_metadata (3 landings, 2 copies), learning-mode controller (07-20 → 08-29), no-work-is-not-a-win (07-04 → 08-29), a0ff3d3 (09-24). **Nothing checks that a landing's predecessor fix still holds after a later commit touches the same region.** The close oracle catches this only when the gap has a Class-1 predicate.
4. **Narrowing/recommit churn**: 7 guard edits from 08-29 to 09-25.
5. **Test residue in live state**: 7 or more fixes from 08-28 to 09-29, plus super-repo root litter.
6. **Evidence forging / synthetic success**: d8c93b4 (caught) and patch-with-tools:239 (not caught); earlier dbb2917 (inert landing counted as a fix).
