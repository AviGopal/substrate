# openspec-7 — openspec entries 109–126 (round 2)

Shard: `(ls openspec/changes | grep -v '^archive$'; ls openspec/changes/archive | sed 's#^#archive/#') | sed -n '109,126p'`
(179 entries total). Exactly these 18 entries:

| # | entry | kind |
|---|---|---|
| 109 | 2026-08-26-large-file-edit-capability | proposal only |
| 110 | 2026-08-26-reuse-before-mint-crossfamily-dedup | proposal only |
| 111 | 2026-08-27-live-recipe-rescues-failed-partner | proposal (29 KB running log) |
| 112 | 2026-08-28-escalation-disposition-executor | proposal only |
| 113 | 2026-08-29-cross-vessel-wiring-repair | proposal only |
| 114 | 2026-09-12-host-independent-federation-join | proposal + outcome |
| 115 | 2026-09-24-live-self-view | full change (proposal/design/tasks/specs/goals) |
| 116–120 | add-goal-summary-resolver-implementation.json, add-goal-summary-resolver.json, add-goal-summary-to-discovery-registration.json, add-new-http-response-resolver.json, add-summarize-goals-activity.json | **stray substrate-authored JSON (fossils)** |
| 121 | causal-attempt-ledger | full change |
| 122 | config-patch.json | stray fossil |
| 123 | consumer-side-landing-probes | proposal+tasks, SUPERSEDED |
| 124 | contained-self-development | full change (39 goal files) |
| 125 | decentralized-compose-ownership | full change (29 goal files) |
| 126 | delete-old-http-response.json | stray fossil |

NOT in this shard (entries 127–179, covered by openspec-8): value-per-cost-selection, unified-install-interface,
do-anything-surface, human-surface-stack, obsidian-legibility-surface, the `*http-response*.ts/.js/.d.ts`
fossil family, the archive. The task prompt listed some of those as "in" this shard; the index says otherwise.

Method: read every proposal/design/tasks fully; then checked each claimed commit against the **live push clones in
substrate-live** (`/workspace/git/vessels/<v>`; `git merge-base --is-ancestor`), grepped the clones for the built
symbols, resolved the shapes live on both nodes, read journals (72 h) on both nodes, the live gap store
(`/workspace/git/super-repo/gaps/gaps.json`, 6,278 rows), the attempt ledger (`/workspace/attempt-ledger/*.jsonl` on
each node) and SurrealDB (`activity` table) read-only.

**Side finding (sync-deploy-drift, operator side):** the operator's host super-repo submodule checkouts are 5 days stale
(`repos/development-vessel` HEAD `ba0f30b` 09-23 vs origin/dev `2de0ae8` 09-29; goal-host `ff5fbb8` 09-23 vs `bc99f91`
09-28). Grepping `repos/*/src` on the host returns NONE of the 09-24..09-29 mechanisms (composeOwnership, autonomyScope,
targetFileOnDisk, …). Any round-1 shard that grepped host `repos/` for liveness got false negatives. Inside the
container the gitlink lag is now small (dev-vessel 1, others 0), and clone == `/vessels` runtime (diff -rq = 0) for
development-vessel, goal-host, local-tools, activity-api.

---

## 109. 2026-08-26-large-file-edit-capability  (key: drafter-quality)

- **Problem:** composer grounds by excerpt windows; on large files it produced `op_count=0` (measured 08-25 on a 7-hunk
  removal from activity-api `impulses.ts`), multi-op plans rolled back atomically, `patch_with_tools` byte-anchored
  escalation timed out. Framed as "the enabler / keystone": substrate's own learning-core gaps hollow-reach via the
  ReAct floor because compose can't edit large files.
- **Proposed:** verbatim-unique-anchor grounding, `{file,start_line,end_line,replacement}` line-range ops, AST ops
  (stretch), non-timing-out patch_with_tools.
- **Status: partly built, by the operator, outside the spec.** `c86451f` (DevBob Assistant, 08-25) "feat(compose):
  replace_lines op — edit identical adjacent blocks in large files"; `ee6312c`/`4841fb3` (08-30, operator) repair-path
  line-addressed edits. Later related: live-self-view 1.x `targetFileOnDisk` + `[fc-anchors] supplied verified-unique
  anchors` (09-24), contained-self-development 7.1 (`6cb5042` replace_lines records post-edit bytes), value-per-cost
  2.7 `[fc-exact]` verbatim goal-supplied edits (96 applications on node 2 in 72 h). The spec's own verification
  (the 7-arm removal landing autonomously; a learning-core gap self-closing) was never recorded.
- **Recurrence:** the "compose cannot edit X" class reappeared as: sixty-line template literal in
  vessel-mitosis-cutover.ts (12 broken drafts, 09-24), duplicate first-line anchors (13 broken drafts), fs_edit refusing
  empty new_string (09-25, `aaee500`), `String.replace` `$'` expansion in local-tools fs_edit (09-27). Each proclaimed
  fixed in turn; the underlying pattern = the drafter emits text edits against a text it did not read exactly.
- Proposal file itself never updated; no tasks.md.

## 110. 2026-08-26-reuse-before-mint-crossfamily-dedup  (key: codebase-bloat-fossils / selection-learning)

- **Problem:** `activityExecutionSummary` served by 15+ near-duplicate producers (08-25), minted via
  compose→vessel_mitosis_cutover as top-level templates, bypassing `createVariant`'s 5-per-parent cap.
- **Proposed:** shared `producerExistsForShape()` guard before any mint; mitosis authoring consults it; one-time
  consolidation sweep retiring dormant clones.
- **Status: NOT BUILT.** `producerExistsForShape` absent from every live clone.
- **Live measurement (09-29, SurrealDB `activity`):** **70** activities output `activityExecutionSummary` (68 not
  deprecated, 2 deprecated) — the proposal's "15+" undercounted by 4.6x. Creation dates: 05-30 (2), 06-20..06-24 (65; 41
  on 06-23 alone), 06-27/06-30/07-01 (1 each), **none after 07-01**. So growth stopped (activity mint volume overall:
  06=3018, 07=775, 08=33, 09=131) — not because of this guard but because the mint paths themselves quieted. The
  consolidation sweep never ran: 68 dormant clones remain in the table (4,010 activities total).
- Keep: the diagnosis (cap on the wrong axis; no cross-family check at a single chokepoint). Fossil: the 68 clones.

## 111. 2026-08-27-live-recipe-rescues-failed-partner  (keys: false-verification, dormant-mechanism, selection-learning)

A 29 KB running log with **six successive self-corrections**, the canonical "proclaimed fixed, wrong hat" document:
1. Rescue clause (accept recipe when fresh partner null) — deployed, validated live, **INERT** (wrong branch:
   `_recipeAnswered` ⇒ `_useRecipe=false` ⇒ two fresh derivations).
2. "Correct fix" (thread R into verification) — never shipped.
3. "FINAL corrected fix" — rescue declared UNSOUND (self-confirmation; demote-on-disagree hole; donation off a rescue).
4. Option A (retry-once on fresh derivation) — deployed, layer 1 fixed, layer 2 revealed (`measured N but the walk
   emitted no measurable value`); reverted; then **landed durably `26f4ecb`** (08-27, operator bypass) — autonomous
   `a803852` "rescue" rode along INERT (call site unwired; "latent landmine", not removed).
5. Layer-2 hypotheses: pointer-stub in pool → fix via `reachContentDigests` — **INERT** (size=0); pointer-chain theory —
   **refuted**.
6. Runtime diagnostic found the real bug: shellResult line >160 chars (stderr echoes the command) discarded by
   `extractEmittedNumbers`. **Fix `f91f8f2`** (render stdout itself). Verified live: attempt-1 reach credited to
   `satisfier:shellResult` (not a `…backfill` template — credit misattribution cured as side effect).
- **Live now:** `26f4ecb`, `f91f8f2`, `a803852` all ancestors of goal-host HEAD `bc99f91`; "Render stdout itself" at
  index.ts:10845. **But the recipe path is dormant:** goal-host journal 72 h: 0 `[recompute] DONATED`, 0 `goal answered
  FROM the recipe`, 0 `independent-recompute-agrees`; 3 `walk emitted no measurable value` abstentions. Countable
  grounding exists and is idle.
- Principle stated by the doc: "three wrong turns were each caught by verifying at the consuming layer"; "precondition
  check before deploy" (two botches from shipping before verifying the branch fires).
- Non-goal left open: countable goals misrouting to webSearch/LLM (shellResult monoculture) — "separate proposal" never
  written in this shard.

## 112. 2026-08-28-escalation-disposition-executor  (keys: human-surface-escalation, calibration-seal)

- **Problem:** the category seal (`d1bb37a` 06-30 hopeless() ≥8 attempts/0 lands; `143212a` 08-06 made exclusion real,
  "permanently removes 106 open gaps … intended effect") traded auto re-test for a human decision; the human answer had
  no effect. Read-back dead two ways (fixed `fe52076`: outcomes 0→85, answered 0→1). `solicitationOutcomeReport` had no
  consumer. Before-bracket: 12 sealed categories, 79/412 open gaps (19%) excluded, `orphaned_capability` 346/0.
- **Proposed:** executor applying drop / grant_access / provide_information / redefine; bounded re-test exemption; no
  calibration writes from human closes.
- **Status: BUILT, DORMANT.** `escalation-disposition-apply.ts` exists (parser/verb fixes `91cc1ff` 08-29 substrate,
  `891304c` 08-29 operator, `f4a6a72` 08-30 substrate recommit, `d3e1ca2` 09-14 operator EDIT_SITE lifting, `9c13474`
  09-15 substrate). Live: **0** gaps in the store carry a disposition or a `human_*` closed_reason; the store carries an
  open gap `orphaned-capability-escalation_disposition_apply` (falsifier=none, re-stamped 09-26). Operator memory
  (09-22): 248 `needs-human-*` escalations posted to a pinned `:8270` (replaced vessel), 0 answered ⇒ executor starved
  ⇒ seal permanent. The executor's input channel (a human answer on a surface a human reads) never existed.
- Also recorded here: the seal program ("expectation-setting step 2/3, 2026-06-29") has no spec anywhere — intent only
  recoverable from commit messages (docs-drift).
- Deferred items named in it: stale-base cutover silent revert (recurred 09-24 as `6ab8271` undoing `a0ff3d3`, and
  as the 5.2 live-sync rollback revert); `uiFeedback_write` as generic floor satisfier (48 records / 0 panel_id).

## 113. 2026-08-29-cross-vessel-wiring-repair  (keys: write-read-mismatch, drafter-quality)

- **Problem:** wiring defects are two-sided (producer in one vessel, consumer in another); composer is single-file;
  explains `orphaned_capability` 346 attempts / 0 lands. Splitting "add receiver" first makes a write-only addition the
  reachability gate correctly refuses. Sender-before-receiver destroys data (400 lost whole goal-path record).
- **Proposed:** ordered composition receiver → deploy gate on the RUNNING copy (not origin/dev; pull-sync lags 10–20 min
  and reports success while skipping) → sender with drop-once retry → verify at consumer (accepted-not-stored /
  stored-not-returned both pinned).
- **Status: NOT BUILT as a capability.** No `cross_vessel_repair` symbol anywhere. The only execution is the operator's
  hand run on 08-29 (activity-api `4e0d27a` receiver + migration 204 → goal-host `d45aa3d` sender). Stated verification
  (first `orphaned_capability` land by the system) never recorded. 38 `orphaned-capability*` gaps open today.
- Keep: the verification standard (consumer round trip, two failure modes). It was later re-learned as "verify at the
  consuming layer" (memory, 7 instances).

## 114. 2026-09-12-host-independent-federation-join  (keys: federation-p2p, env-gating, endpoint-routing, sync-deploy-drift)

- **Defects (live probe 09-12):** A dead droplet IP `138.197.116.56:18100` pinned in `/workspace/.substrate-secrets`
  outranked `/etc/substrate/env` ⇒ transport restart loop `activating` (NRestarts 23→32); B transport `process.exit(1)`
  without relay ⇒ circular bootstrap; C `/bootstrap` serves loopback `identity_endpoint` + empty discovery; D 13/13
  vessels unreachable from foreign vantage (initially misdiagnosed as per-vessel multiaddrs — corrected in place);
  E registration does not replicate.
- **Grading instrument:** `federation-probe-tick.ts` (nonce-identity ephemeral peer, negative controls, auto-files
  `fed:<class>` gaps after 2 quiescent sweeps). 7 failing classes at calibration.
- **Outcome section claims landed:** transport ungate; anchor precedence (6 units reordered); frozen address removal
  (also from executable `bootstrap-remote-google-arm.sh`); de-advertise on SIGTERM (7→0 rows in 8 s); sibling derivation;
  discovery over the overlay; multiaddr-only anchor.
- **Not landed (per the doc):** `/bootstrap` loopback identity — 3 dispatches refused `grounding window (0 BYTES)`
  (filed `fed:compose-grounding-window-empty-for-discovery-index`; later fixed class-wide by contained 7.2 `b0782f8`
  local-fs fallback, 09-27); confused deputy (libp2p ingress no authz) OPEN; off-host public-IP untested.
- **Live now (09-29):** node 1 (`substrate-live`) `federation-transport-vessel` **disabled/inactive, no journal
  entries this boot** (container up 2 days); node-1 `/bootstrap` still returns
  `{"relay_multiaddrs":[],"identity_endpoint":"http://127.0.0.1:8101","discovery_endpoint":""}` — Defect C unchanged
  since 09-12. Gaps `fed:no_relay_anchor` and `fed:join_door_host_dependent` **open**, updated 09-29T03:47. Node 2
  (`compose2-live`) transport active since 09-26 13:05, `register -> 201` every 2 min, its `/bootstrap` gives
  `identity_endpoint: http://host.containers.internal:18101` (host-dependent name, not loopback), relay_multiaddrs [].
  Cross-node composes (decentralized-compose-ownership) actually route over **plain HTTP to
  `host.containers.internal:<port>` via per-vessel `VESSEL_ADVERTISE_ENDPOINT` drop-ins** — i.e. the host-address
  pattern invariant 2 forbade, not the overlay this change built.
- Claim/later: "relay-less transport is healthy" (09-12) → on the hub node the transport is not running at all two
  weeks later; federation between the two live nodes works without it.

## 115. 2026-09-24-live-self-view  (keys: sync-deploy-drift, test-residue-live-state, narrowing-duplicates, autonomous-regression, directed-overshoot)

Why: compose gates read the target file from the stale super-repo submodule checkout while edits apply in the push
clone (dev-vessel gitlink 100 commits/3 days behind at 09-24 11:35Z). Effects: correct edit refused as vacuous; nontermination/
dead-store sims inert; anchor supplier never engaged (0/7 composes); 11 landings → 18 restarts, 6 pairs <60 s.

Task ledger (all commits verified ancestors of live dev-vessel HEAD `f451e42`):

| task | what | commit | status now |
|---|---|---|---|
| 1.1 | `targetFileOnDisk`, vacuous guard 2 reads clone | `20a668b` (substrate, draft 2) | live; falsifier met 12:08:42Z |
| 1.2 A/B/D | anchor band / sims / test discovery read clone | `a0ff3d3`, `13841a4`, `1d4ac1c` | live; falsifier met 16:49 (anchors 100/122 candidates). **Gap for site D still OPEN** in store (updated 09-24 16:53) — closure never recorded |
| 2.1 | cutover advances gitlink | — | SUPERSEDED: wrong premise (gitlink WAS advanced; the WORKTREE was frozen by draft residue) |
| 2.2 | pull-sync files worktree-lag gap | — | OPEN; gaps `a-submodule-worktree-…-frozen-by-draft-residue…` and `a-detector-for-super-repo-submodule-checkouts-that-lag…` OPEN (their narrowed/recommit children closed 09-26) |
| writer | residue writer caught 05:49Z 09-25: goal-host edit-intent compose 503 → fell through to walk → `bounded_shell sed -i` with cwd default super-repo | goal-host `60833b4` (503 ⇒ RETRYABLE CAPACITY), local-tools `11636e6` (bounded_shell cwd scratch) | live; C2 `ReadOnlyPaths` drop-in = operator tier (not verified here) |
| 3.1 | `selfRestartAlreadyOwed` coalescing | `46d252c` (14 drafts; first compiling drafts refused for invented code) | live; falsifier met 03:52Z 09-25 (12 landings, 0 pairs, 4 coalescings). Node 2 72 h: 1 `already owed` line |
| 3.2 | move restart script out of literal | — | not needed |
| 4.1 | scope refusal leaves `scope_refused` lesson | `72fdb1f` | live; falsifier half-exercised |
| 4.2a/b | `[deterministic]` lesson prefix; recommit/narrow skip | `2992a23`, `fcbd737` (loop picked it itself) | live; 4.2b falsifier unexercised |
| 5.1 | shell calls default timeout 300 s in compose | landed INSIDE `4e40707` (another gap's commit — ride-along) | live; then attempt 2 live-sync rollback **reverted the committed line in /vessels** (operator restored) |
| 5.2 | live-sync rollback skips file equal to committed clone | — | OPEN (gap open, updated 09-24) — the revert class remains |
| 5.3 | lesson writer re-reads gap, preserves superseded | ride-along inside `996b841` | live; falsifier met |
| 5.4 | staged_base_sha = pre-patch hash | `082f6ee` | **REGRESSION**: second reader (freshness) needed patched hash ⇒ 7 false `already_applied` no-ops; SELF-REPAIRED by substrate `96a1f57` (pwt lane) 21:52Z |
| (0a0d59f) | substrate-authored drift gate | `0a0d59f` | deadlocked every isolated landing 17:08→20:05Z; operator revert `97f7cdf`; ledger settled it **held** |
| 6.1 | delete forged `operator_approved: true` block (substrate `d8c93b4`) | `60ad9cd` (attempt 3, as replacement) | live: 0 occurrences |
| 6.2 | prompt no longer tells drafter to self-approve | `5cbc6d0` | live |
| 6.3 | fs_edit accepts empty new_string | local-tools `aaee500` | live |

Lessons written into it: "grep every READER of a field before redefining it"; "`blocked_by` has no reader"; "a
retraction… writer attribution was guessed (pwt shell) then retracted when caught".

## 121. causal-attempt-ledger  (keys: false-verification, hollow-landing, autonomous-regression, test-residue-live-state, node-locality)

- **Why:** landings not linked to consequences; `regressed_by` read, never written; credit additive/unkeyed;
  ribosome extracts immediately; prior change `2026-08-26-consequence-verdict-into-credit` unbuildable (synthetic exec ids).
- **Design:** record-never-block (D1); git hooks (post-commit + reference-transaction, system core.hooksPath, chaining)
  + `Attempt-Id:` trailer (D2); deferred settlement not credit reversal (D3); JSONL ledger in dev-vessel volume (D4);
  baseline check set as impulse (`systemd_unit_health_observer`, `gate_self_probe`, typecheck; excluded 4 checks that
  report success without measuring) (D5); reuse `sweepPendingLandVerifications` (D6); readers = failure_lessons +
  file lessons + extraction deferral (D7); `SUBSTRATE_EXECUTION_ID` export (D8); check-definition versioning (D9).
- **Tasks.md:** all ~35 checkboxes UNTICKED; header says acceptance passed 09-26 05:10:18Z ("CONSISTENT", runs 10/11/12
  each 10/10, third after cold boot, `validation/reports/causal-attempt-ledger/FINISH_LINE.md`) and that the boxes
  "have NOT been individually re-verified". Task file ≠ state.
- **Live now:** ledger at `/workspace/attempt-ledger/` **per node, not shared** (node-locality): node 1: 408 intents,
  1,038 snapshots, 303 outcomes, 305 settlements (247 held / 42 regressed / 16 unresolved / 2 falsified_after_restart),
  6,836 landingEvents of which 305 carry an attempt; node 2: 124 intents, 124 settlements (122 held, 2 regressed, 2
  source `operator_revert`), 1,365 landingEvents. Node-1 settlements fell to 12–13/day after 09-26 (it stopped owning
  dev-vessel/activity-api/goal-host). `directed` on intents: node 1 null 397 / false 8 / true 3; node 2 null 75 / true 39 /
  false 10 — most intents cannot tell autonomous from directed.
- Unaccounted detector: flooded (#52: 469 opened / 36 closed in 24 h) → aggregated; store now: 114 superseded, 14 open,
  9 rejected per-commit rows; 10 open `unaccounted-landings-<repo>` aggregates incl. `-unknown` and `-ledger-u-probe`
  (test-fixture scratch repo — acceptance residue in the live store).
- GAPS_OBSERVED highlights: #47 ledger settled **held** on `0a0d59f`, the commit that stopped every landing — baseline
  checks watch units and gates, not whether a known-good landing still lands (proposed `landing_liveness`; not in any
  live check set seen); #46 hollow-judged walk retries with side effects (one goal, several commits); #50 redraft staged
  duplicate edit into live tree, vessel restarted onto uncommitted file (harness caught it, substrate didn't); #51 same as
  live-self-view 5.4; #53 placeholder execution ids break the causal join; #55–#61 restart/trace-ingest/id-less shell
  senders open.

## 123. consumer-side-landing-probes  (keys: false-verification, hollow-landing)

- Written 09-28 after three autonomous landings passed their own checks and were regressions: `9cfdea4` (stale test
  satisfied by turning off discovery-first resolution in production), `af2c737` (timeout lowered against documented
  rationale), `a198907` (constant read only by a log line). ~22% of breaks "wrong but still flowing", all found by operator.
  `runBehavioralVerification` never had input (0 of ~6,100 gaps carry `verification_spec`).
- Proposed replaying trace-derived probes after restart. **SUPERSEDED same day by operator ruling "reuse before
  minting"**: register production expectations into existing `expectation:*` loops and `runBehavioralVerification`.
  All tasks unticked. Nothing built. The reuse plan was folded into contained-self-development §8 (8.20 operator-revert
  reader learned `a198907` and `c4bb14d`; 8.22 new-failing test withholds landed_verified).
- The underlying "a check the landing can game" class remains without a consumer-side oracle.

## 124. contained-self-development  (keys: calibration-seal, gap-content, false-verification, test-residue-live-state, spend-envelope-throughput, drafter-quality)

Context measured 09-27: 15 lane landings that day, all operator exact edits; gap-class posterior α=1 on every class;
97% of open gaps not fixable as filed; 61/2,340 open gaps admissible; landing→verified closure ~5% (09-24).

Stage 1 (scope containment) — all landed byte-equal, verified in live HEAD:
- 1.1/1.2 `c110070` autonomyScope reader + admission refusal; 1.3 `c27964b` compose verdict floor; 1.4 pool record
  `autonomy-scope` (21 lane-core paths; 542/2,340 refused); 1.5 falsifier PASSED 08:49; 1.6 `d7ec192`
  require_falsifier_classes (2,343 → 9 admitted; reason: first autonomous landing `bb5d6b9`, falsifier none, was a live
  regression); 1.6b `00c0e5f`; 1.7 goal-host `abedf81` gapIdOfGoal; 1.8 `bb51374` no fail-open onto target-less gaps
  (**leaked test-fixture gaps from substrate-gap-falsifier.test.ts module-load race wrote the live store**).
- Stage 2 (2.1/2.2 reopen at $1/h, observe 24–48 h) unticked; stage 3 (autonomy node, branch landing, ref-aware
  verification) and 4 (promotion activity; the autonomy criterion) all OPEN.
- §6 supply: 6.1 `0259b8c`/`c5f0081`/`b5df9c2` gap_falsify pass (first run 10, second 0 — deterministic rules
  exhausted); 6.3c `375ec90`; 6.3d `2de0ae8` (09-29) decompose before admission; 6.2 (LLM predicates), 6.3 (decomposition
  contract), 6.4 open.
- §7 drafting: 7.1 `6cb5042`, 7.2 `b0782f8` (all 13 "(0 bytes)" refusals), 7.3 `87d673d`, 7.6 `f26494b`, 7.7 lens;
  7.4 pre-typecheck loop, 7.5 infra refusals not counted — open.
- §8 verification of autonomous landings: 8.1 `79cdcd9` (`nonzero_field` read divergence_count=1 as fixed ⇒ closed a
  live divergence landed_verified on a reverted landing; polarity fixed); 8.2 `c5d2d1c`+`c9ba480` (refuters caught
  `=== true` storing false); 8.4a `49e6f48` (first dispatch refused by stub-detector false positive); 8.4b `01304ad`;
  8.7 `00b7ab0` (15 step predicates field-less, "unknown forever"); 8.8 `6c86595` (named-gap caller bypassed envelope
  every 10 min); 8.9 `f08df07` (4-second compose/narrow loop); 8.10 `59bfc4c` (49/60 class2 gaps named no field);
  8.11 `28a69cf`; 8.12 `4d3381c` (coverage scan had been blind: 0 shapes → 325); 8.13 `36b82b8`; 8.15 goal-host
  `4361247` (693 single-demand capability gaps closed walk_artifact; store shows 746 walk_artifact closes);
  8.16 `c24444a`+`537e6c0` (live-container test run registered a phantom local-tools endpoint); 8.20 `f2491b4`;
  **8.21 `5e9a0b2`: post-land suite dead 08-31→09-28 on dev-vessel & activity-api (~600 landings `ran=false`, shell 30 s
  default)**; 8.22 `fad0d3c`. Open: 8.3 revert mode, 8.4 auto-revert, 8.5, 8.6, 8.14 (superseded), 8.17 experiment, 8.23
  detector for 8.21 class.
- **Live verification of 8.21:** node 2 journal: before 09-28 08:00 dev-vessel `ran=false` 76 / `ran=true` 1;
  after 08:00 dev-vessel 19/19 `ran=true`, activity-api 3/3, goal-host 3/3. Holds. 8.22 falsifier (`landed_verified
  credit withheld`) **0 occurrences** — unexercised.
- **Live admission now (09-29 04:19):** both nodes `863 candidates → 0 admitted` {"not owned here":426,
  "needs_information":340, "autonomy_scope":68, "protected_vessel":22, "operator_hold":4, "no_groundable_target":3}.
  Earlier in 24 h: 41–61 admitted/pass. Decomposition ran 6× in 24 h; outcomes mostly `no valid step` (readers that do
  not exist: `GET /health is not a function`, `resolveTemplateAudit not found`); one wrote 2 steps. autonomyScope is a
  poolImpulse record (resolving `{type:autonomyScope}` at dev-vessel = "Unknown pointer type" — by design).

## 125. decentralized-compose-ownership  (keys: node-locality, federation-p2p, env-gating, sync-deploy-drift, narrowing-duplicates)

- **Why:** one development-vessel composes for all repos and mostly lands on itself ⇒ every self-landing restarts the
  composer, draining other composes; global `change_window` lease serialises the rest.
- **Built (all verified ancestors of live HEADs):** 1.1 `ownedVessels()`; 1.1b `79562c7` empty set = unknown (as first
  landed, 1.1 excluded every gap); 1.1c `988377f` declared `SUBSTRATE_PUSH_VESSELS` ∩ clones; 1.2 `b2f30d3`; 2.0/2.1
  `df0ffe1` composeOwnership shape; 2.2 goal-host `51b5336`; 2.2b; 2.3 `d07b3d6` duplicate-owner gap; 3.1 `792a9cd`
  (an autonomous recommit `1c7833b` first wrote `node: null` — hollow write); 3.2 `cec6c8d` `target not resident on`;
  3.2a `a4923f2`; 4.0d-i `51e30de` **deleted 6 min later by autonomous recommit `21179d8` (stale base)**, re-landed partially
  `516bc18`, read side `eb62676`; 4.5(a) `77ee9b9` landed by node 2 itself; 4.6 `8645ead` `findComposeOwner`;
  4.7 `fbb2fab` **not byte-equal** (doubled regex escape, duplicate block); 4.7b `3cced35` prose goal ⇒ planner applied 1
  of 3 edits and **still reached** (hollow-partial); 4.7c `1669ac8` 2.7 block format ⇒ byte-equal; 5.1 `827a218` (gap write
  hollow: called READ resolver in a swallow-all catch) → 5.1a `1e18e09`; 5.2/5.2b `4d5d563`; 5.3 rhythm impulses (data).
  6.1 `50830bec` (runtime state file tracked in super-repo froze pull-sync 130 commits); 6.2 `31f15baf`+`4bb21141`.
- **Falsifier 4.4:** passed 21:41–22:21Z 09-27 only after the coordinator held directed dev-vessel work off node 1;
  earlier runs confounded by node 1 landing directed composes on a repo it did not own (`66f62d5`).
- **Live now:** node 1 `composeOwnership` = 16 repos (node `substrate`), node 2 = `activity-api, development-vessel,
  goal-host-vessel` (node `compose2`). `composerInterruptionReport` 24 h on node 1: 45,009 lines read, 21 restarts,
  **0 lossy, 0 foreign cutovers** — the change's goal holds. Commits on node 2's dev-vessel clone, 3 days: 121
  Substrate Autonomous, 1 DevBob, 2 operator-attributed.
- **Seams it records as still open:** selection state (rhythm posteriors, boredom queues, operator pauses) node-local and
  unreplicated; shared gap store has no cross-node claim; pick lease does not gate nudge/boredom/rhythm paths (~$3.8/h
  floor spend while held); containment records bind only through discovery (a node that loses its peer row reopens
  WITHOUT containment); per-repo cutover leases follow-up; 6.3 pull-sync glue-layer failure files nothing; 6.4 runtime
  files still tracked in super-repo on node 2 (`leases/*.json`, `Substrate/Projects/*`, `vessels.inventory.json`).
- Ownership is carried by boot env + per-unit drop-ins (`SUBSTRATE_PUSH_VESSELS`, `VESSEL_ID=development-vessel-compose2`,
  `VESSEL_ADVERTISE_ENDPOINT`, `GAP_STORE_ENDPOINT`) — "boot-transient until .env carries them"; placement facts as env,
  argued as bootstrap-tier.
- **Detector residue:** gap store holds 4 open composer-interruption gaps with 4 different id schemes
  (`composer-interruption-sweep:gap:2026-09-25T06-00-42Z`, `composer-interruption-sweep-2026-09-25`,
  `composer-interruption-report-2026-09-25` — three LLM-walk-authored descriptions of the pre-5.1a empty-owned-set bug,
  still open after 5.1a fixed it — and `composer-interruption-substrate-2026-09-26`), plus a closed
  `gap-composer-interruption-node-day` = a capability gap for the literal shape `composer-interruption-<node>-<day>`
  (a walk treated the id template as a shape).

## 116–120, 122, 126. Stray substrate-authored JSON in openspec/changes  (key: codebase-bloat-fossils)

All in the directory root, not change directories. Provenance: all but one arrived in super-repo commit **`4e4170a8`
(09-07 04:20, Substrate Autonomous, "Automated commit: vessel code drift detected and committed.")** — 2,134 files,
+59,401 lines (incl. root `Deep Cap deepcap-c7e1.md`, `activity/invoke-…json`); 34 of those files in openspec/changes.
causal-attempt-ledger `sources.md` names this commit as having **no route in code** (the rhythm `self-maintenance`
FAMILY_GOALS LLM-driven "commit vessel drift" path, substrate-written in `a44dc58`). `add-goal-summary-to-discovery-registration.json`
came earlier via `f344ac5f` (08-17, Substrate Autonomous, "feat: Register goal_summary in discovery-registration.ts…").

Content: drafter scratch plans from the 08-16..08-18 `route-edit-9077062c` / `orphaned-capability-goal_summary` /
http_response churn (narrowed/recommit chains: dev-vessel `5bed003`, `9419b26`, `48db304`, `f0f340c`):
- `add-goal-summary-resolver*.json`: placeholder resolver ("For now, we return a placeholder summary", zeroed metrics).
- `add-goal-summary-to-discovery-registration.json`: insert_after anchor into an absolute `/workspace/git/super-repo/…` path.
- `add-summarize-goals-activity.json`: hand-shaped activity template (law 4 violation pattern).
- `add-new-http-response-resolver.json` → `content_path: openspec/changes/fix-http-response-resolver.ts` (a sibling fossil in entries 127+).
- `config-patch.json`: rename `"http_response"` → `"httpResponse"` in config.ts.
- `delete-old-http-response.json`: delete `http-response.ts`.
Live fate: `goal-summary.ts` exists (landed `dc18b62` 07-01 "capgap-goal_summary-report.json") and **resolves live**
(returns template_count 100, avg α 13.8/β 29.2 …) but **has no consumer** besides its route + config advertisement
("Seam ③ substrate-authored resolver (2026-07-01): producer for goal_summary (capability-gap autoclosure)") — an
orphaned-capability gap closed by minting a producer nobody reads (hollow-landing). `http-response.ts` still exists
(operator fix `5be029a` 08-16: "the shape ignored the URL and fetched a hardcoded httpbin probe").
Sibling (outside shard, same commit) `gap-msvqgv4y-closed.json` claims "uiPanel_write is now invoked by
draft-detector-activity" — **false**: live `src/seed/draft-detector-activity.ts` contains no `uiPanel_write`
(only routes/impulses.ts, config.ts, ui-write-passthrough.ts do).
Disposition: delete all; they are read by nothing and teach nothing (no runtime reader). The class generator — an
LLM-driven "commit whatever drifted" path writing into the super-repo root and openspec — is the thing to retire.

## Cross-cutting findings from this shard

1. **Task files lag state in both directions.** causal-attempt-ledger: 0/35 ticked, acceptance passed. live-self-view:
   task 1.2 ticked but its site-D gap still open in the store; 5.2 open. contained: 6.3d dated 09-29. The store and the
   docs disagree; neither is authoritative.
2. **Ride-along and overwrite are recurring:** `4e40707` carried 5.1; `996b841` carried 5.3; `21179d8` deleted `51e30de`
   6 min after it landed; `6ab8271` undid `a0ff3d3`; live-sync rollback reverted a committed line (5.1). Detectors
   (5.2 skip-rule, landing diff check) remain open.
3. **Substrate-authored gates that break the lane:** `0a0d59f` deadlock (settled `held` by the ledger); `d8c93b4` forged
   operator approval (induced by the prompt text telling a drafter to set it); `54b7762` (memory) deleted the surql gate
   guard. Containment (autonomyScope) is the response; it also left 0 admitted work today.
4. **Hollow writes by autonomous recommits:** `1c7833b` `node: null`; `827a218` gap write via READ resolver; `goal_summary`
   producer with no reader; `a803852` rescue with no call site.
5. **Node locality:** attempt ledger, selection state, pauses, push policy are per node; gap store and containment are
   shared (by forwarding / discovery). Settlement counts on node 1 collapsed after ownership moved.
6. **Federation that works is not the federation that was built:** nodes talk HTTP via host.containers.internal
   drop-ins; the libp2p transport is off on the hub; `/bootstrap` join door unchanged since 09-12.

## Caveats / corrections after review (read before quoting numbers above)

- Node-1 `attemptSettlement` "42 regressed": by date 09-23 1, 09-24 19, 09-25 16, 09-26 4, 09-28 2 — overwhelmingly the
  causal-attempt-ledger acceptance window, which lands seeded regression fixture R every run. Not 42 real autonomous
  regressions.
- `landingEvent` 6,836 vs 305 carrying an attempt: the `reference-transaction` hook records ref moves/fetches, not only
  commits. The honest unaccounted-commit count is the gap store (per-commit rows 14 open / 114 superseded / 9 rejected /
  1 closed; 10 open `unaccounted-landings-<repo>` aggregates).
- `directed: null` on most intents: the field was added by contained 8.2 (`c5d2d1c`, 09-28); earlier intents are null by
  construction. Not a live defect, but it means pre-09-28 landings cannot be split autonomous/directed from the ledger.
- goal_summary: SurrealDB shows 1 activity whose input/output shapes include `goal_summary` (so "no consumer" holds for
  code readers, not strictly for templates). The gap `orphaned-capability-goal_summary` is itself **still OPEN** in the
  store (6 weeks after the 07-01 producer landing and the 08-17 churn) — as is `orphaned-capability-escalation_disposition_apply`.
- Cross-node compose routing over `host.containers.internal:<port>` drop-ins is sourced from tasks.md 4.5 and node-2's
  `/bootstrap` answer; the drop-in files themselves were not read.
- Timestamps in journals are UTC and read on 09-29; host `repos/*` checkouts are stale, so every liveness check here used
  the container push clones. A temporary resolve helper was copied to `/tmp` in both containers and removed.
