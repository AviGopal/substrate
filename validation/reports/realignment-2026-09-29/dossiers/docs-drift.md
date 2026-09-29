# Dossier: docs-drift

**What the class is.** A document, an openspec status line, a code comment or a memory note says something about the system that is not true. It may name a path that does not exist, prescribe a command that now refuses, call a mechanism live when it is not, or carry a count or date that was stale before it was pushed. Nothing that reads the claim at use time checks it. The false claims are then fed back in: doc sections are ingested into concept-db as `architecturePrinciple`/`doc_expectation` concepts, and those concepts are dense-searched into the drafter's prompt. So stale docs become stale drafts. Law 9 says "docs are expectations, closure means verifying reality against them". That verification loop exists on paper and in eight resolvers, but it has never closed a single doc gap.

Sources: `classes/docs-drift.json` (34 attempts, 50 problem records, 9 claims). Raw notes: `docs-1`, `docs-2`, `docs-3`, `git-devvessel-1/2`, `git-super-1/2`, `git-deployment`, `git-activityapi`, `memory-1..10`, `memory-adjacent`, `openspec-2/4/9/10`, `transcripts-1..4`, `live-gaps`, `live-resolvers`, `timers-readers`, `vessel-docs-tooling`, `syzygy`. Also `validation/reports/docs-self-management-assessment-2026-09-22/REPORT.md` (DSMA). Live checks were run read-only on 2026-09-29 between 04:50 and 05:10Z on the hub (`substrate-live`) and node 2 (`compose2-live`), plus the host clone and `gh`.

**Size.** The 50 problem records carry self-counted recurrences that sum to over 180. They overlap heavily, because every collector re-found the same pattern in its own shard. Distinct, dated instances with evidence:
- at least 7 whole-corpus realignment passes (this is the seventh);
- 24+1 detector-filed doc gaps, none closed;
- 5 operator doc fixes in the DSMA window, none flagged by the detector;
- 12+ openspec changes whose checkboxes contradict landed state;
- 8 vessel CLAUDE/README files contradicted by reality;
- 606 stale doc concepts that cannot be reaped.

Outcome baseline (DSMA, re-verified): of 113+ commits touching `docs/` since June, all but one are operator-authored. The one substrate commit, `4e4170a8`, was an indiscriminate "drift sweep" and not a doc edit. On the hub clone today, the authors of `docs/ CLAUDE.md README.md` since 06-01 are DevBob Assistant 100, Devbob Agent 36, avi 1 and Substrate Autonomous 1.

---

## 1. Dated timeline (claims and what later showed)

| Date | Event | Claimed | Later |
|---|---|---|---|
| 02-24 → 06-24 | Six foundation/doc realignment passes (`af9d8308`, `1cc4805a`, `28d3ac6c`, `4c57df9a`, `8f8bbe05`, `e53f0266`). Also 04-29 `199fea2c` "child boxes were spec drift", 05-27 docs "second/third/fourth pass" (`15bdb3ba`, `b337aad2`, `a2523e99`), 06-23 `49582530` "align hot-path commands with actual Makefile targets" (git-super-1) | "realigned" | Each pass was manual and after the fact. **The current realignment is the seventh.** |
| 04-24 → 04-27 | jiggle-and-prune: 50 root files archived, 272 removed, docs cut from 86 to 75. The user invoked it 8 times with identical args (memory-adjacent A19) | pruned | Regrowth; see 08-02 |
| 05-01 | `repos/activity-api/CLAUDE.md`: "`/v2/vessels/*` return 410 Gone from 2026-07-01" | deprecation scheduled | Still routed on 09-29 (answers 401) (vessel-docs-tooling) |
| 05-02 | All 13 `activity-api/docs/*.md` last touched | — | Unchanged across about 650 later commits (git-activityapi) |
| 05-15 | `repos/ias-executor-ts/README.md`: "Milestone A scaffold" | — | 7 live vessels depend on it |
| 05-23 | F-004: "63-mode failure matrix" | matrix exists | 6 scenarios on disk; CLAUDE.md cited an archived doc (validation-other-2) |
| 06-01 → 06-04 | LLM-drafted finding cites "Commit [fourth commit]"; research prompt claims unweighted γ=1 when decay already existed (openspec-3) | — | Generated docs are committed without being checked against the repo |
| 06-28 | `3ecc34b6`/`0e9e8d06` docs-as-concepts ingestion | "channel VERIFIED" | 08-04: `ingest-docs.timer` masked, **never ran**; the drafter had zero architectural grounding (memory-5) |
| 07-01 | `a0f40fb2` docs-as-expectation closure detector (Phase 1, report-only). dev-vessel `729af75` `doc_drift_fix` (Phase 2, "reach-gated closure authoring"), with autoland **off by default**. `ef6912fc` status readout (Phase 3). `SHAPE_ACTION_EVIDENCE_EXPECTATIONS.md` has 7 falsifiable claims | loop shipped | Claim-1 status lines drifted within a day. F4 "zero-drift" never certified (openspec-4). `doc_drift_fix` has **no recorded run, ever** (DSMA §3; 0 journal hits in 7d today) |
| 07-08 | `887577bd` watchdog demotion of gap-compose/compose-teacher/funnel-drain | — | SOFTWARE §5 (ingested into the drafter prompt) still describes the old unit semantics on 09-29 (docs-2) |
| 07-09 | dev-vessel CLAUDE.md: "zero LLM-tier resolvers; 19–23 shapes" | — | 51 LLM-referencing files, 264 advertised shapes (vessel-docs-tooling) |
| 07-10 → 07-12 | `ad5f7c0` docs_align_scan v1 (operator). Substrate-authored docs-align-bridge/tick (07-11) and docs-decision solicit/deliver/answer-scan (07-12). `docFixPolicy` shape round-trip proven 07-12 | 8-resolver family | memory-1: minting these orchestrations as *resolvers* was "wrong" (law 2). `orphaned-capability-docs_align_bridge`, `-docFixPolicy`, `-docFixPolicy_write` have been open since 09-26 (0 invoking activities) |
| 07-19 → 07-23 | Ports, MCP tool count, install paths, "views never carry data", "tests never gated", "PERMISSIONS isolation" all contradicted (memory-2). Registry flipped Docker Hub ↔ GHCR the same day | — | Fixed per instance |
| 07-24 | Architecture realized-vs-intended audit: SF blend off, spectral gap metrics-only, TTSA not implemented, credit discount stated 3 incompatible ways, `variant_promote` documented but absent (memory-3) | proposed marking dormant | Lens docs (about 4.9k lines) still have 0 code hits for `spectral_gap`/`harmonic`/`inertial`/`foreign_provenance` on 09-28 and are still ingested as principles (docs-1) |
| 07-26 | Openspec intent audit, 179 agents: 35 implemented / 39 partial / 30 not | re-grounded dispatch list | Only 12/27 items survived re-grounding (agents confabulated file:line) |
| 08-02 | Mass pruning: `d1e60e40` docs/archive 1,866 files; `3b5035d7` 31 proposals retired (929→238 files); `8d3e57ce` 38 scripts. Regex retired-name substitution: 128 replacements | pruned / renamed | The regex pass produced falsehoods (live vessel "removed", fake 410 routes) and was **reverted**. openspec/changes has regrown to **176 dirs, 4 archived** (host, 09-29) |
| 08-05 | `5bb0a326` enables the ingest timer and gives it an eviction (reap) path with a **25% fraction guard**. `1150750f` corrects about 170 falsehoods | eviction path | See 09-04 → 09-29: the guard has refused every reap since |
| 08-05 → 09-16 | Operational docs written, corrected, then reverted to timeless form: `04ea2f3b→72f58abc`, `047e11c5`, `d63eb56e` (RUNTIME_ACTIVITY_TRACING written-not-wired, 0 of ~97k rows), `82d19398` (observe-detect-resolve 9/10 shapes absent), `c7530bf2` (rhythm mechanism asserted that did not exist) | — | The honest-status markers that came out of this are the one pattern that **worked** (docs-1: only 10 of 436 named identifiers absent in those docs) |
| 08-20 → 08-21 | Clean-clone audits: `6ebabec5` "ten defects", `16c9b46b` "building from source silently didn't build", `92e5fb3a` "false PAT prerequisite survived". `DOCUMENTED_LIFECYCLE_VERIFICATION.md` runs every documented command | "checker CLEAN with control" | The hot-patched units reverted on the next boot. On 09-22 the checker was found blind: ~85% FP, 0/5 real drifts (DSMA) |
| 08-21 | `f3933c5` "the docs checker reported 40 findings on correct docs, all false" (the fix anchors path capture at a boundary) | "every one of the 4 setup_enablement findings was this bug" | **The fix moved the false positive rather than removing it.** Anchoring now captures `validation/scripts/failure-mode-harness.ts`, but `live_truth.existing_paths` still lists only `scripts/`, so the correctly anchored path is still "missing". Live 09-29 03:40: `docs-drift-CLAUDE-md` re-filed with exactly that path, which exists |
| 08-22, 08-28, 08-29 | `ddbfdc4`. Accuracy invariant enabled by `90a1e31` (substrate) and reverted in 2 min by `18a4e3c` (it FP'd into the sealed `documentation_drift` category, gaps 23→29). Re-enabled by `14e530e` with a synthetic control. `9abb4bd` | "4 FP docs → 0 findings; control → 1" | transcripts-1: the accuracy invariant **never executed**; the caller omits it and its precondition is never supplied |
| 09-04 | Operator gaps: ingest reap permanently refused (596 candidates vs limit 460, refused 18/18); `docs-align-tick-never-executes`; `config-surface-probe` has no caller (transcripts-1/2) | filed | These gap ids are absent from today's store (the earliest row is 09-18), and the reap still refuses |
| 09-14 | docs-drift escalations: 60/66 path claims are false positives; 6 real stale paths named: `check-shape-dispatch.ts`, `generate-secrets.sh`, `init-database.ts`, `validate-security.sh` (memory-10) | — | **The same 4 real paths are still flagged and still unfixed on 09-29** (verified below) |
| 09-16 | `faba5acd`/`8183a698` write measured readings into SUBSTRATE_AS_DYNAMICS | "annotation" | Out of date before push; the user called it "irrelevant". Rewritten as invariants in `3c113703` ("the defect in a new costume") |
| 09-18 16:48Z | docs_align_tick files 24 `docs-drift-*` gaps, all `falsifier: none` | detection | **0 closed at 09-29.** The 25th (`FEDERATION-GENRES`) was filed 09-20 |
| 09-22 | `37b18ec0`: operator hand-aligns docs/SUBSTRATE.md + README after `vessel-ctl install human-surface-vessel` began refusing. Human-filed gap `docs-prescribed-a-command-the-tooling-now-refuses-and-the-docs-align-loop-never-noticed`. DSMA: ~85% FP (`node_modules` filled the walk cap), 0/5 behavioural drifts caught, `doc_drift_fix` never ran, `deriveVesselFromPath` cannot target super-repo docs, category calibration 11 attempts / 0 lands, so hopeless-sealed. SYZYGY_LOCAL_SURFACE.md written with "local setup succeeds … board reads hub-owned dispatches" | "docs aligned" | 37b18ec0 itself added a false README claim (openspec-10: 55 setup defects, 17 never fixed, 2 regressed). The SYZYGY claim is false on 09-29, and the file is **untracked** but linked from `docs/README.md:150` (verified) |
| 09-23 | `ffbabd7` "deterministic install-surface checks, and stop walking node_modules". `5c02dd20` "a refused reap files a gap instead of only logging". `d043bde5` README Installation is the only setup page. `e375d716` acceptance harness executes install fences | FP engine fixed; refusal visible; executable docs | `existing_paths` is still `walkScripts(join(DOC_ROOT,"scripts"),2000)` (docs-align-tick.ts:577-578, both nodes). The reap-refused gap now exists with `falsifier: none` and has been re-updated every run. Acceptance runs **report-only** (see current state) |
| 09-24 | `docs-reap-refused` filed (04:59Z). `4e4db180` "nine fleets usable" | — | Later: the image exceeded the Docker layer limit; CI proves *served* not *usable* (transcripts-4) |
| 09-26 | causal-attempt-ledger header "accepted 3×10/10"; `606414b2` decentralized-compose-ownership "37/37 done" | done | tasks.md 0/36 ticked. Node-local pause, calibration and memory were found 09-26..09-29 (openspec-9, transcripts-4) |
| 09-28 07:16 / 07:37Z | Substrate attempts the human-filed docs-align gap twice via feature_compose (predicted p=0.9, then 0.7) | — | Neither landed (`TS2345` at docs-align-tick.ts:229). A verbatim `-narrowed` child was minted at 07:40, `falsifier: none` |
| 09-28 21:18Z | `/workspace/doc-fix-policy.json` becomes `{"autoland":true,"set_by":"system","reason":"testing docFixPolicy_write resolver"}` | — | A test or walk flipped the live autoland gate. The writer string is not in dev-vessel source, so the writer is unlocated (test-residue-live-state) |
| 09-28 20:11 | Host working tree un-ticks the unified-install tasks and restores deleted Makefile lanes (openspec-10) | — | Uncommitted. `git status` shows `openspec/changes/unified-install-interface/tasks.md` and `scripts/substrate/Makefile` modified |
| 09-29 01:22Z | ingest-docs run: `reap:"refused", reapCandidates:606, reapLimit:472, reapGap:"filed"` | — | 19/19 journaled runs this boot are identical (75/75 since 09-25 per docs-3) |
| 09-29 03:40Z | docs_align_tick execution (`success`), 19 `docs-drift-*` gaps re-stamped | — | 14 of 18 distinct "missing" paths exist (verified). The 4 real ones date from 09-14 |

---

## 2. Root causes

1. **Docs are written as status, not as checkable expectations.** Examples: counts, dates, instance names, "done" headers, checkboxes, "accepted 10/10", "observed result: setup succeeds". These are true for an instant and false after (09-16 `faba5acd`, 09-22 SYZYGY, 09-26 ledger header). Law 9 is a writing discipline with no enforcement. The detector's `timelessness` check is a date regex and caught 5 claims, while it missed dated headings in GOAL_EXECUTION_PATHS_SCHEMA.
2. **The detector's truth set is a subset of reality, and it never reads code or runtime.** `live_truth.existing_paths = walkScripts(join(DOC_ROOT,"scripts"), 2000)` (docs-align-tick.ts:577-578). Any correctly cited path outside `scripts/` is "missing". Its four invariants are lexical (dates, legacy names, `scripts/…` existence, advertised shape names). It cannot express behavioural claims: "this command works", "this default is X", "this mechanism is live", "this route is 410". Those are the drifts that matter, and it caught 0/5 of them (DSMA).
3. **Detection has no closure.** Every one of the 25 `documentation_drift` gaps plus `docs-reap-refused` carries `falsifier: none`, so none can be closed by a predicate. `expectation-calibration.json` still records `documentation_drift: {attempts: 11, lands: 0}`, so `hopeless()` (gap-to-feature.ts:1184) excludes the whole category from auto-pick. `doc_drift_fix` has never run. The targeted lander cannot write super-repo docs: `deriveVesselFromPath` (apply-proposal-as-patch.ts:325-332) accepts only `repos/<v>/…` or `/vessels/<v>/…`. Comment-only changes are refused by the vacuity gate (memory-3), so the substrate also cannot fix comments. The loop is detect → file → nothing.
4. **Ingestion without retirement.** Doc sections enter concept-db with no superseded or retired field. 96 sections are double-ingested (two source types), and about 25% describe deleted text. The only eviction path, the reap, has a 25% fraction guard that cannot tell a truncated walk from a real restructure. The supervised reap it defers to has never been run. So 606 retired sections (for example `CLAUDE.md#2-minibob-repos-minibob` and `#current-implementation-status-known-issues`) stay eligible for `consultPrinciples` top-4, and the unfiltered goal-host recall surfaces them too. Wrong docs are read back as fact at prompt-build time (law 8, inverted).
5. **Status lives in several hand-maintained places with no single owner.** These are tasks.md checkboxes, prose headers, commit messages, memory files and vessel CLAUDE.md files. They disagree in both directions: live changes at 0% ticked, dormant changes mostly ticked, 176 change dirs with 4 archived. Parallel descriptions of one mechanism are never reconciled. For the ribosome, CLAUDE.md and the foundation say it mints templates, README says `applyExtraction=false`, and GLOSSARY and CORE_IDIOMS contradict each other on `postExecution`.
6. **Coverage holes.** docs_align_tick reads only root `CLAUDE.md`, `README.md` and `docs/**`. It does not read `repos/*/*.md` (8 contradicted vessel docs; 10 core vessels have no doc at all), `openspec/`, code comments or memory. Code moves without the doc edit in the same commit (d63d64b6, reports-8).
7. **Verification by reading, and by the operator's own harness on one host.** Audits 08-05..09-22 ran the docs warm-state with operator drivers. The fixes landed outside the artifact (hot-patched units reverted on boot). The one harness that executes documented commands (install acceptance) runs **report-only** and files nothing.

---

## 3. Why it recurs: the missing shared capability

The system has no **executable expectation**. That would be a claim extracted from a document, bound to a machine-checkable falsifier, evaluated against the running system, and treated like any other gap: a gap that can close by predicate, be landed by the system, and cause the superseded text to be retired from recall.

Every attempt so far built one leg: extraction (docs_align_tick), storage (ingest-docs), a fixer (doc_drift_fix), a policy (docFixPolicy), or a harness (install acceptance). No attempt joined them at the seam where code gaps already close. That seam is the gap store's falsifier path: `classifyFalsifier`/`verifyGapCondition` → `sweepPendingLandVerifications` (gap-to-feature.ts) → `landed_verified`. Doc gaps arrive at that seam with `falsifier: none` and a land path that cannot reach their files, so they are born unclosable. That forces every correction through the operator: 112/113 doc commits, seven realignments. It also means the same drift reappears in a new hat, because nothing checks the claim again after the hand fix. 37b18ec0 fixed the prose, but no probe re-runs the command.

**Seam.** Two joints:
- (a) `docs_align_tick` claim extraction → gap `classification_metadata.falsifier`. Today the gap stores `drift_report.claims[].quote`. Instead, each claim would store a predicate: path-exists over the whole super-repo, command-exit, shape-advertised via discovery, identifier-present, or HTTP route status.
- (b) The land path for super-repo `docs/` (`deriveVesselFromPath`), plus a retirement write into concept-db that fires when a claim's source section changes or disappears.

The operating model's other properties follow from putting these at the gap seam rather than in a doc-specific path. The walk can route around a doc it cannot trust, because the claim's predicate is queryable. A drift detected on one node is visible from all nodes through the gap store and discovery, not only on the hub's timer.

---

## 4. Prior attempts at that same capability and why each did not hold

| # | Attempt | Date / ref | Leg built | Why it did not hold |
|---|---|---|---|---|
| 1 | Six manual realignment passes | 02-24..06-24 (`af9d8308` … `e53f0266`) | none (manual) | No reader. Each pass decays until the next one. The seventh is this report |
| 2 | jiggle-and-prune ×8; mass prune 08-02 (`d1e60e40`, `3b5035d7`, `8d3e57ce`) | 04-24; 08-02 | deletion | No archive/closure step owned by anything, so openspec regrew 79 → 176 dirs |
| 3 | Docs-as-concepts ingestion | 06-28 `3ecc34b6`/`0e9e8d06` | storage | Declared "VERIFIED". The timer was then masked and never ran until 08-05. There is no retirement field, and no reader filters `doc_expectation` (DSMA §1) |
| 4 | Docs-as-expectation loop Phases 1–3: closure detector (report-only), `doc_drift_fix`, status readout | 07-01 `a0f40fb2`, `729af75`, `ef6912fc` | extract + fix | Autoland off. `doc_drift_fix` never ran. Its header describes a diff-triggered doc↔change tie that was never wired (DSMA §2) |
| 5 | SHAPE_ACTION_EVIDENCE_EXPECTATIONS, 7 falsifiable claims | 07-01..02 | claims in prose | The claims are prose, not predicates. Status lines drifted in a day. F4 was never certified. The "standing invariant" learner last wrote 09-16 on zero evidence |
| 6 | docs_align_scan v1 + substrate-minted bridge/tick/decision resolvers | 07-10 `ad5f7c0`; 07-11/12 | extraction | Behaviour was minted as resolvers (law 2 violation). bridge, docFixPolicy and docFixPolicy_write are orphaned (0 activities). docs-decision-* have 0 executions |
| 7 | `docFixPolicy` shape as the autoland gate (law 1) | 07-12 | policy | Round-trip was proven. On 09-28 21:18 an unlocated "testing docFixPolicy_write" writer set `autoland:true` on the hub. The gate is now in an unintended state, and nothing reads it, because doc_drift_fix never runs |
| 8 | Ingest reap with a 25% guard | 08-05 `5bb0a326` | retirement | The guard refused 18/18 runs by 09-04 (596/460), 589/464 on 09-22, and 606/472 on every run to 09-29. The supervised reap has never been exercised |
| 9 | Reap refusal files a gap | 09-23 `5c02dd20` | visibility | `docs-reap-refused` has `falsifier: none`, sits in a hopeless-sealed category, and is re-stamped every 6h. The refusal is visible but still does not close |
| 10 | docs-align FP reworks | 08-21 `f3933c5`, 08-22 `ddbfdc4`, 08-28 `18a4e3c`/`14e530e`, 08-29 `9abb4bd`, 09-23 `ffbabd7` | extraction precision | Each fixed one FP instance, and none widened the truth set. `f3933c5` moved the FP from `scripts/…` to `validation/scripts/…`. `ffbabd7` skipped `node_modules` but kept `existing_paths` scripts-only. The accuracy invariant never executes (transcripts-1). Precision tuning on a lexical detector cannot reach behavioural drift |
| 11 | Clean-clone and documented-lifecycle audits | 08-05..08-21 (`6ebabec5`, `16c9b46b`, `92e5fb3a`, `1150750f`, DOCUMENTED_LIFECYCLE_VERIFICATION) | execution (operator) | These were operator harnesses, not activities, run warm on one host. Hot patches reverted on the next boot. "Checker CLEAN" was certified with a checker later shown blind |
| 12 | Timeless-docs law + reverting measurement docs | 08-05..09-16 (`72f58abc`, `3c113703`, `047e11c5`, `d63eb56e`, `82d19398`, `c7530bf2`) | writing discipline | This worked for the docs it touched (honest "specified, not implemented" markers). It is not enforced, and 09-22 SYZYGY and 09-26 headers repeated the defect |
| 13 | Operator hand alignment + a human-filed generator gap | 09-22 `37b18ec0`; gap `docs-prescribed-…-never-noticed` | instance fix + demand | The docs were fixed, and a false README claim was added. The generator gap had 2 substrate compose attempts on 09-28 (typecheck fail), then a `-narrowed` duplicate, `falsifier: none` |
| 14 | README single setup page + acceptance harness executing install fences + `install-acceptance.yml` | 09-23 `d043bde5`, `e375d716`; CI | executable docs (the only one) | Runs **report-only**. Latest run 36505437797 (09-29 00:55Z) concluded `success` while logging `usable fail … no LLM arm completed` and "verdict: report-only". Posting to the hub is unwired, and no gap is filed (openspec-10) |
| 15 | Openspec intent audit | 07-26 (wf_27e8c8c6, wf_ad069f1c) | one-shot status reconcile | 179 agents, one-shot, no standing reader. Checkboxes drifted again (causal-attempt-ledger 0/36 while "accepted") |

The pattern across all 15: each leg was declared working on its own check, and none was measured end to end ("a doc drift appears → a gap with a predicate → a landed fix → the predicate passes → the old text leaves recall").

---

## 5. Current verified state (2026-09-29, 04:50–05:10Z)

**Hub (`substrate-live`, image `ghcr.io/avigopal/substrate:dev`)**
- **Detector runs and is wrong.** `satisfier:docs_align_tick` has 28 executions in the trace store (09-24 07:11 → 09-29 03:40Z), 27 `success` and 1 failure, about 4/day, all rhythm-driven. `docs-align-tick.ts:577-578`: `const scriptsDir = join(DOC_ROOT, "scripts"); const existing_paths = walkScripts(scriptsDir, 2000);`, unchanged since `ffbabd7` (09-23).
- **Doc gaps**, in `/workspace/git/super-repo/gaps/gaps.json` (6,279 rows):
  - 25 open `documentation_drift` gaps (24 from 09-18 16:48Z, 1 from 09-20, plus `docs-reap-refused` 09-24), 0 closed, all `falsifier: none`. 19 were re-stamped at 09-29 03:40Z.
  - 49 claims: 41 `setup_enablement`, 5 `timelessness`, 3 `naming_alignment`.
  - Of the 18 distinct paths flagged "not in live_truth.existing_paths", **14 exist** in the hub's super-repo clone, including `validation/scripts/failure-mode-harness.ts` cited by `docs-drift-CLAUDE-md`. The 4 that are really missing (`scripts/check-shape-dispatch.ts`, `scripts/init-database.ts`, `scripts/validate-security.sh`, `repos/deployment/scripts/generate-secrets.sh`) are the same 4 named on 09-14 and are still cited by docs.
  - Also open: `docs-prescribed-…-never-noticed` and its `-narrowed` child (`self_maintenance`, `human_reported`, `falsifier: none`, 2 unlanded approach decisions 09-28), and `orphaned-capability-docs_align_bridge`, `-docFixPolicy` and `-docFixPolicy_write` (09-26). `gap-docsaligntickreport` was closed by an operator on 09-28 as `walk_artifact`.
- **Calibration seal is intact.** `/workspace/expectation-calibration.json` → `"documentation_drift":{"attempts":11,"lands":0}`, the same as 09-22.
- **Actuation absent.** 0 `doc_drift_fix` / `docFix` executions in the trace store and 0 journal mentions in 7d. `deriveVesselFromPath` is unchanged (apply-proposal-as-patch.ts:325-332, `docs/…` → null). `/workspace/doc-fix-policy.json` = `autoland:true, set_by:system, set_at 2026-09-28T21:18:40Z, reason:"testing docFixPolicy_write resolver"`. This is live state written by a test or walk. The writer is not located in dev-vessel source.
- **Retirement blocked.** `ingest-docs.timer` is active, last run 01:22:13Z, next 07:22Z. All 19 journaled runs this boot show `reap:"refused", reapCandidates:606, reapLimit:472, reaped:0, reapGap:"filed"`. The ingest walk covers 80 docs (66 `docs/*.md` + root + 13 vessel md), so the walk is not truncated. The 606 candidates are a real restructure (the gap sample lists deleted CLAUDE.md sections such as `#2-minibob-repos-minibob`).
- **Super-repo doc commits.** The container clone's last doc commit is `b7ea55fa` (09-24, operator). No substrate-authored doc edit exists.

**Node 2 (`compose2-live`, `localhost/substrate:compose-ownership`)**
- The same `docs-align-tick.ts` (lines 577-578 identical, same `ffbabd7` head).
- **No `ingest-docs` timer or service** (`0 timers listed`, no journal).
- The local gap store has 70 rows, last written 09-26 12:07, with **0 doc gaps**. So doc-drift detection and doc-concept freshness are hub-only. Node 2 depends on the hub for both, and nothing on node 2 would notice if the hub's loop stopped (node-locality).

**Host clone (`/home/avi/documents/work/substrate`)**
- `docs/guides/{SYZYGY_LOCAL_SURFACE,CONTAINER_NETWORK_LIFECYCLE,HUMAN_PROJECT_LIFECYCLE}.md` are untracked. `docs/README.md` (modified, uncommitted) links two of them at lines 149-150.
- `docs/API_V2_ACTIVITY.md:22` still gives `activity-api.activity-system.svc.cluster.local:8080` as the Development URL.
- README 318-324 still prescribes `repos/obsidian-vessel/install.sh` as the human-interface install, while the served surface is human-surface-vessel.
- README:480 carries the `applyExtraction=false` ribosome correction that CLAUDE.md's ontology does not.
- `openspec/changes`: 176 entries, 4 archived.

**CI.** `install-acceptance.yml` concluded `success` on 5 of 5 recent runs, and the latest (36505437797) logged `usable fail` under "verdict: report-only".

---

## 6. Retire condition (measurable, checked continuously)

The class is retired when all of the following hold together for 30 consecutive days, measured on the hub **and** reproduced from node 2 through discovery:

1. **Truth-set correctness:** 0 `documentation_drift` claims cite a path, identifier or shape that exists or is advertised (today 14/18 distinct paths are false). Checked each tick by re-running the claim's own predicate.
2. **Every doc gap is closable:** 100% of `documentation_drift` gaps carry `falsifier ≠ none` (today 0/26).
3. **Closure by the system:** at least 1 `documentation_drift` gap per week is closed `landed_verified` by a Substrate-Autonomous commit whose predicate passes after the next pull-sync, and `expectation-calibration.documentation_drift.lands > 0` (today 0 closes ever; 11/0).
4. **Positive control:** a seeded drift is filed as a doc gap with a predicate within one tick (≤ 6h), without operator authorship of the goal. Examples: a documented command that now refuses, or a cited path deleted in a commit. Today's baseline: 0/5 behavioural drifts caught.
5. **Retirement:** `reapCandidates` returns to 0 within one ingest cycle after any docs change. Stale doc sections never appear in a `consultPrinciples` top-4 (today 606 unreaped).
6. **Executable docs judge:** install acceptance fails its job and files a gap when any README fence's verdict (including `usable`) fails (today report-only green).
7. **Durability (law 7):** the count of operator commits that correct a doc claim the detector had not already filed is 0 over the window (today about 100% of corrections are operator-first). No 8th realignment pass is needed.

---

## 7. Keep / demote / fossil

**Keep, and repair at the seam**
- `ingest-docs-as-concepts.ts` + timer. Keep the fraction guard, but add the supervised or churn-relative reap and a retirement field.
- `docs_align_tick` as the claim extractor. Its truth set must become "exists anywhere in the super-repo / advertised via discovery", and its output must be predicates.
- `docFixPolicy` shape (law 1). Reset the test-written state.
- The install-acceptance harness, as the only executable-docs mechanism. Switch it from report-only to judging, with gap filing.
- The honest-status doc markers ("specified, not implemented", retraction headers, DECIDED).
- Law 9 timeless writing.

**Demote from drafter context (theory, not principles)**
- The MDP/DEC/REPRESENTATION/NETWORK/FLEET/LITERATURE lens docs (~4.9k lines, ~0 code hits).

**Fossil / rewrite**
- `docs_align_bridge` and the `docs-decision-*` trio (0 executions).
- `doc_drift_fix`, unless it is wired to the super-repo land path; its header describes an unbuilt design.
- The volume-only `/workspace/active-scripts/docs-align-{scan,status}.ts`.
- `API_V2_ACTIVITY.md`; the retired-CLI guides (ACTIVITY_TASK_CONTEXT_PROPAGATION, INTERACTIVE_ACTIVITIES…, CONCEPT_INTEGRATION_TEMPLATES, DASHBOARD_ANALYTICS, EXTERNAL_VALIDATION, IDENTITY_VESSEL_CURL_EXAMPLES).
- The untracked SYZYGY guide.
- The 172 unarchived openspec changes: reconcile against landed state, then archive.

**Related classes:** dormant-mechanism (doc_drift_fix, bridge, accuracy invariant), false-verification (report-only acceptance, "CLEAN" from a blind checker), calibration-seal (11/0), gap-content (`falsifier: none`), memory-recall (stale principles in the drafter prompt), codebase-bloat-fossils (openspec regrowth, 8-resolver family), sync-deploy-drift (hot patches reverted, image vs README), test-residue-live-state (doc-fix-policy flipped), node-locality (hub-only detection and ingest), narrowing-duplicates (`-narrowed` twin).
