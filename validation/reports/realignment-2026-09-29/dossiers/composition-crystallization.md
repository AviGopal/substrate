# Dossier: composition-crystallization

**Class key:** `composition-crystallization`. **Scope:** turning reached executions into reusable structure,
then reusing it. That covers ribosome extraction and minting of `learned-*` templates, composition edges,
learned-pathway replay (`recordGoalPath` / `recommendReachingPath`), the reached-command cache, and
first- and last-mile rebind.
**In the terms of CLAUDE.md:** this class is the *ceiling* (learned pathway) and the *middle* (first- and
last-mile adaptation) of the execution expectation. It is also law 4 ("activities are earned by doing").
**Sources:** `classes/composition-crystallization.json` (91 attempts, 19 problems, 13 claims), the
`_mech_chunks` rows for ribosome, pathway, rebind and composition, and the `raw/*.md` notes (live-gaps,
transcripts-4, node2-runtime, git-super-2 and others). The peer dossier `dossiers/trace-store-db.md` covers
the view loss. The live checks were run on 2026-09-29 between 04:40 and 05:00Z, read-only, on
`substrate-live` (node 1, hub) and `compose2-live` (node 2).

---

## 0. One paragraph

The substrate has built the "extract a reached execution into a reusable template" mechanism **four
times**: microplastic on 03-27, activity-api on 05-24, ribosome-vessel, and the goal-host reach→mint path
on 06-22. After that it spent about 13 distinct repair episodes, each announced as "the reason it never
minted", making that mechanism actually persist something. Each episode repaired **one address** on the
path between "this execution reached" and "the extractor can read that execution and write a template
someone can bind". The address that moved each time was one of: a tag or a column, a status vocabulary,
a WS counter or a durable census, a table name, a view, a key.

The current death is the same shape. Since about 09-22 the extractor's point lookup reads
`v_paradigm_execution_traces`, which is no longer a view. Every one of the 1,437 non-failed
`ribosome-extract` runs in the last 7 days finished `status:success` with tasks 2–7 **skipped**. **No
`learned-*` template has been minted since 2026-09-22T07:39Z.**

The parts that do work are all instance-keyed and node-local:

- the goal_hash reached-command cache: 10,624 lines on node 1 and 452 on node 2, nothing shared;
- goal_hash pathway replay: today's log lines still read `via goal_hash`.

The middle tier (rebind) is dead by construction: 0 of 377 organic outcomes were selected in the last
24 h, all refused as `shape-mismatch`.

## 1. Timeline (dated; every "fixed" or "first" claim with what later showed)

| Date | Event (hash / source) | Claimed | What later showed |
|---|---|---|---|
| 03-27 | Ribosome v1 in microplastic, `e5b04851` (git-super-1) | Extraction exists | microplastic was abandoned after March and is now a fossil |
| 05-24 | Ribosome v2 in activity-api (`57e92c06`), then v3 as ribosome-vessel (`3a3ef840`, openspec substrate-explicit-vessels `daf81ce4`) | Vessel live | Duplicate owners: the activity-api and ribosome-vessel paths coexisted (mech chunk 15) |
| 05-28 | "Lift milestone: substrate authored 4+ gap-closing templates autonomously" (memory-adjacent) | **first** autonomous authoring | 06-06: 193/193 drafter proposals could not be consumed. The day's commit `ceb3098` came from an operator-dropped proposal |
| 05-30 | "author→execute→promote loop closed" (`7833ed73`) | loop closed | Never re-verified. The graduated templates analysed the author's own precondition rejections (validation-other-2) |
| 06-02 | 7-task publish composition reused against a vessel repo (`exec_mt2w5985`, development-vessel PR #1) | reuse worked | The composition is absent from later trace windows. It was a single instance |
| 06-04 | "substrate authored 2 templates end to end" | authored | Neither was ever executed again (validation-other-1) |
| 06-17 | composition-edge reconciler `9b193f88`, `65836817` | ongoing reconcile | Aborted every run on `account_id_version`, and no detector noticed |
| 06-22 | Organic `compose-*` / `compose-auto-bridge-*` minting (dev-vessel); a compose-topology timer added and reverted the same day (`06c48140`→`f1348751`); reuse-before-mint in shadow `407e3ed`; goal-host reach→mint chain `15620e7`/`892c342b` | Organic composition | `compose-*`: 220 rows, 98 never ran, 36 runs 0 ok in 5 days. `compose-auto-bridge-*`: 2,815 runs, 33 ok (live-activities) |
| 06-26 | Reuse-before-mint enforced `900bc69` | law 3 enforced | 07-12 `7148d37`: the substrate loosened the gate for its own detector mints. The off/shadow env override remains |
| 06-28 | "Full unsupervised self-development loop complete and running" | complete | 07-08: dev-vessel crash-loop deadlock. 07-31: the activity table was stuck at 3,464 rows, with the last real mint on 07-27 |
| 06-30 | "Capstone: genuine multi-vessel composition reaches AND mints" | **first** reach+mint | Earlier mints were undiscoverable: `output_shapes` was unset until `d105e1ae` (06-30). By 07-31 the capability set was stagnant and honest reach was about 17–19% |
| 07-14 | Seven capability families "declared 7/7" as learned activities (memory-2) | 7/7 | 08-02: `activityDispatch` never existed and `mintReachedTrace` had made 0 mints |
| 07-15 | Composed seam-extraction capability minted from prose; 7 obstacles cleared (`86f35d8` … `ef54c05`, the root fix applied by hand) | reached 5/5 (`dc00c441`) | Handed to the boredom rolling pool (`48ebb26`). No autonomous firing was ever recorded (dormant) |
| 07-21 | Honesty gate `isHonestlyReached` `8d969b4` | stops hollow templates | Worked: hollow templates went from 374 to 2. Only 23 of 62,968 success rows were honestly reached, so eligibility was starved |
| 07-22 | `composition_edge` retired as a fossil (`fcf9499`, migration 169); AET dual-write decommissioned (`2181e96`) | cleanup | 08-03: `fn::update_composition_edge` was created for the first time **after** retirement (contradictory). The legacy trace table AET has been frozen since then (newest row 2026-07-14) |
| 07-23 | Mint only grounded reaches `411417b`; ribosome field nesting `ff292c6` (substrate-authored) | gate fired | The next layer surfaced: direct dispatch refused `use_vessel_discovery` 220 times, 0 dispatches. The 109 broken templates were never deprecated |
| 07-24 | reachedCommandCache exact replay `aef85f8` (substrate-authored); walk_tier persistence `e6bf483` + migration 181 | replay | In-process only and lost on restart. Write-terminal satisfiers never recorded. The WS extraction path had 0 executions; the live path was mintReachedTrace |
| 07-25 | Tier-2 lexical rebind + persistent cache `d38eaa9`, `831dafb`; composite inputShapes from predecessor `27cc619` | 0 false reuses | 383 of 472 legacy rows still leaked impulse ids as inputShapes. See the rebind rows below |
| 07-30..08-02 | Ribosome dispatch storms and dead path (`43a6d0b`, `079c160`, `572cd6c` durable census, `f0322c3` drain removal) | storm fixed | 3,746/3,746 runs failed over 27 days. After the census fix: 0 dispatches, then 334 all failing. `ribosome-extract` had 1,051 executions with 0 successes, yet its alpha was 8.5 |
| 07-31 | mintReachedTrace stamps `'completed'` not `'success'` `f88ba8f`; learned shapes from tasks `d1bb036`/`8b88856`; backfills `ac40337`/`3ccc65f`/`6ee45ea`; ias-executor `0bbd488` | "only 1/1000 templates were ever ribosome-earned" → fixed | 436 `learned-*` by 08-25, but about 83 and 266 old rows remained poisoned, and config was still `{}` (see 08-17) |
| 08-02 | Variant-minting unblock `948d085` | unblocked | A loud `UNRESOLVABLE_GATE` became a silent skip. Nothing was minted |
| 08-03 | `applyExtraction` never passed; one-line fix `5f96ba4` | minting resumes | 13 `learned-*` minted and 16 of 19 used. `variant_promote` is documented but implemented nowhere |
| 08-05 | Self-extraction recursion depth bound `b6a430f` | worked | Before that, `learned-learned-learned-auto-bridge-shellresult` was selected by a live walk |
| 08-06 | "Compositional reuse never recorded" `f84a7d9` | root found | Inert: the root was a ranked-window reader artifact. Revert candidate |
| 08-08..08-10 | ~12 rebind fixes (`d9a2597`, `1df0e02`, `c477e07` …); threshold lowered 0.5→0.25→0.15 | rebind works | A/B: value-only reach 12/16 vs 11/16 (p=1.0). 0 of 112 above 0.15, and 0 fires in 12 h with 635 donors. A third lowering was refused |
| 08-11 | Complexity ladder harness | — | Reach 3/4, but externally correct only 1/4, with **0 producer steps** at every rung (all `satisfier:*`) |
| 08-13 | "Autonomous minting demonstrated" (`31f0972a` … `4d417b6e`) | **demonstrated** | Retracted. Four stacked defects were then fixed (`8d960a8`, `f3c7028`, `62acd51`, `fc559be`). On 08-21, `11859d57` found the ribosome's entire output was **2 templates**, and `activity_templates` had 1 writer and 0 readers |
| 08-16..08-17 | Rule 9a `input_shapes` (`a56fe27`); config:{} fixed across 5 layers (`3b95072`, `5a5aa41`, `9518d4e`, `5030377`, `f71bb56`) | replayable | `f71bb56`: the fix itself named a nonexistent field. All 98 tasks across 26 compositions had carried empty configs. Rule 9a was inert for 11 days because of a stale dist |
| 08-21/22 | Composition edges written at execution time after 12 causes on one function (`cf5370e8`, `18c1490` … `adc0c38`); ingest-time derivation `516fc73` | "the first edges in system history" (1999→2004) | Still live: **9,518 edges in 7 days, 858 updated in the last 24 h**. The `composition-edge-reconcile` timer script is now redundant (204 of 205 runs upsert 0) |
| 08-27 | "Component 2 demonstrated: 34 minted recipe lines" (44a75483) | gaining ground | 17 minutes later: 4 families ever, and 23 of the lines were one goal. The rescue fix was inert and reverted |
| 08-29 | Wilson ranking `785293c` + goal-paths `?? null` fix `86a776d`; "learning loop closed end-to-end; 538 learned-composition executions" (0f5cd43b) | loop closed | Same day: the E2 ceiling experiment was **falsified** (a proven pathway was never reused). On 09-03 only 1.1% of executions were eligible for the ribosome |
| 09-02 | Ribosome read-side contradiction fix `86aebdf` | recovers reached executions | **Reverted the same day** (`5a374df` is ribosome-vessel HEAD). The window showed 44 skipped and 0 extractions |
| 09-05 | Finding: pathways keyed by `goal_hash` lose about 11.9× of pooling; re-key by `path_signature` | filed | Found again on 09-16 and not landed (a recurrence). Today's accepts still log `via goal_hash` |
| 09-06 | "First-mile adaptation fired for the first time in system history" (0b1032b5); 1,644 pathways made addressable | **first** | It was an existence proof, not a rate. Donors went from 1,539 to 3,186 and the reuse rate did not move |
| 09-11 | Rebind punctuation, compute-artifact oracle, bridge non-clobber (`0c7f10e`, `cd011e3`, `d8b1d92`, `abb07ea`) | reuse in 4–7 s vs 60–90 s | Operator-drafted, with no pinned tests |
| 09-12 | Exemplars 0→719 (`c241629`, `39e005a`); cache eviction guard `77d318b` | alive | Exemplars have **no production consumer**. The cache stayed flat at 108→110: "removes one drain, doesn't create gains" |
| 09-18 | Crystallization proof in 4 runs (80ab9659): novel → identical → after restart → variant; `6eed100`, `4c5534d`, `2e8b4cc` (substrate, from a dictated diff) | "**Proven**: crystallization works, is durable, compounds to the class" | The user asked for a trend, not a sample. Trial v2: replay 7/18, **rebind 0/146**, and the class-compounding claim was retracted. The strike counter landed only after the operator dictated the diff |
| 09-22 07:39Z | Last `learned-*` row: `learned-composition-websearchresult-to-llmcompletion-to-substrategap` | — | The view `v_paradigm_execution_traces` vanished at about 09-22 07:01 (trace-store-db dossier). Nothing has been minted since |
| 09-23 | Satisfier-headed pathway chain, six layers (`3d2e52a`, `579f365`, `c37df24`, `49b884e`, dev `dac3c2c`, activity-api `9c376b2`, `249ff89`) | 20/20 goals reach on the first verdict | One product family only. `49b884e`: acceptance is intermittent. The narrowed child **FAILED**, and 4 related gaps are still open |
| 09-24 | Template provider blanks placeholders `2893a93`; operator repair of the trace-store-reconcile variants (restored the `[redacted]`→`{{extract_lease_token_text}}` placeholder that extraction had destroyed) | fixed | The narrowed child is open. Reconcile still fails with `lease_token is required` |
| 09-27 | Joint-liveness detector `70254535`; `debc3da3` "ribosome dispatch targets a retired template" | detection | On 09-28 it filed `severed-joint-ribosome-extraction` (lag 591,566 s) and `severed-joint-ribosome-registered`, both **open**. No repair has fired. **"Retired template" is contradicted live** (see §4) |
| 09-28 | `1f0d70f` restores the view; `d98309e` makes migration 212 `IF NOT EXISTS`; migration 212 applied 11:59:38Z | view restored | **Live 09-29:** the object is a plain `SCHEMALESS` table (no `AS SELECT`) holding 2 rows written at 13:37Z. `IF NOT EXISTS` now guarantees the migration never replaces it |
| 09-28 (reports-7) | "1,788 extract executions in 7 d, all execution_error, pinned to a retired template; self-development has never crystallised" | diagnosis | **Wrong mechanism.** `activity:⟨ribosome-extract⟩` has `deprecated:false`. The failures belong to `compose-auto-bridge-source_code-to-ribosome-extract` (618/7 d). `ribosome-extract` itself **succeeds hollowly** (§4). A "retired template" fix would not have revived it |

## 2. Root causes (distinct, each attested more than once)

1. **The extractor reads its evidence through an address that other work keeps moving.** The chain is:
   reach verdict → trace row → signature resolver → template write → discoverable row. The same class of
   break recurred at each hop:
   - reach tag vs reach column (`7f142af`, `86aebdf` reverted);
   - lifecycle status vocabulary `'success'`/`'completed'` (`f88ba8f`);
   - WS event counter vs durable task census (`572cd6c`);
   - msg field nesting (`ff292c6`);
   - writer table `activity_templates` vs reader table `activity_template` (`11859d57`);
   - AET decommissioned while the point lookup still reads only AET or its view (`2181e96`, then
     `986abbf`'s "skip the paradigm table for point lookups");
   - the view dropped and replaced by a plain table (now);
   - `impulses_by_id` empty for satisfier reaches (`fc559be`);
   - `config:{}` lost in the sink (5 layers, 08-17).

   *Evidence:* git-goalhost says "each fix said the previous path never minted". memory-7 lists "stacked
   plumbing defects (WS counter, field nesting, status vocabulary, gates)".
2. **Extraction fails hollow, not loud.** Each gate sets `skipIfFalse` or a conditional:
   `qualityEligible`, `contains '"tasks"'`, `not-contains 'ELIGIBLE_FALSE'`, `applyExtraction == 'true'`.
   When a gate is false, the chain finishes `status:success` with tasks skipped. Run counts, alpha
   (8.5 on 0 successes, 08-02) and "1,459/1,456 ok" (live-activities, 09-28) therefore all read as
   healthy. Collectors and posteriors both counted status instead of the product (a new template row).
3. **Crystallized knowledge is keyed by instance, not by shape.** Both `goal_execution_paths` and the
   reached-command cache are keyed on `goal_hash`, and today's accepts still log `via goal_hash`. So
   pooling across paraphrases is lost (11.9×, found 09-05 and again 09-16). The rebind cache is keyed to
   shapes the walk no longer targets: 377 outcomes today, all `shape-mismatch`.
4. **Satisfier short-circuits bypass producers, so there is little to extract and few edges to bank.**
   The ladder recorded 0 producer steps. 63.5% of accepted pathways were satisfier-only and discarded.
   Satisfier steps declare no inputs, so no edge forms and alpha is withheld (`b36f0ef` on 09-22 hand-fixed
   one instance). Code-landing composes route before the walk and never reach `mintReachedTrace`
   (reports-7).
5. **Minting does not dedupe, and extraction corrupts what it copies.**
   - The id truncation at 60 characters itself mints near-duplicates. Live examples:
     `learned-composition-substrate-health-tick-to-learned-topology-sna` and `…-snapshot`, minted 11 s
     apart on 09-22 05:12. Also `…federation-verification-report-to-edge-liveness` and `…-report`, minted
     on 09-22 at 03:04 and 04:04.
   - Six or more one-shot compositions exist for one pair of activities (openspec-2).
   - Placeholders are redacted to the literal `[redacted]` (09-24).
   - 76% of activities are duplicate families with 1.2% provenance (reports-5).
6. **Everything crystallized is self-maintenance.** Human goals are matched into vessel-health
   compositions, and no producer carries `webSearchResult` to an answer (reports-4, problem 14). The
   ceiling exists only for the substrate's own chores.
7. **Crystallized state is node-local.** The reached-command cache has 10,624 lines on node 1 and 452 on
   node 2, and nothing is shared (node2-runtime; re-measured today). `ribosome-vessel` is `inactive` on
   compose2-live. Under the stated operating model ("absence in one place is not absence"), a pathway
   learned on one node does not exist for the other.
8. **Products with no consumer.** Exemplars (719 rows), rebind cache lines, the verifier-recipe store
   (0/4 used) and `variant_promote` (never implemented) were each built as writers without a reader.

## 3. Why it recurs: the missing shared capability

The class has recurred about 13 times as "reached executions do not become reusable structure". The
episodes were 06-30, 07-21, 07-23, 07-24, 07-31, 08-02, 08-03, 08-13, 08-17, 08-21, 08-22, 09-02, and
09-22 to now. **Each fix re-pointed one reader at the current address of one signal. None made the
extractor own its inputs as a contract.**

What is missing is a **declared, continuously probed input contract for crystallization**. It would state
"extraction needs: this reach verdict, from this shape; this trace signature, with non-empty `tasks`;
this write, returning a row readable by discover-by-shapes". It would be checked by a positive control
that pushes a known-reached execution through the whole chain on a cadence. A miss would be treated as a
**loud failure of the extractor** rather than a skipped task.

Without it:

- any upstream change (a decommissioned table, a migration re-run, a renamed status, a retention swap)
  silently severs the chain;
- the chain keeps reporting `success`;
- an operator eventually notices "0 templates" in a log, weeks later.

The 09-27 joint-liveness detector (`70254535`) is the **first** piece of this capability: it detected
the 09-22 severance within about 6 days. But it only detects. Nothing owns the repair, and the filed gaps
are open. The second missing half is **shape-keyed, federated storage of what was crystallized**. Today
the ceiling and the middle are keyed by `goal_hash` and live in a node-local file, so even a working
extractor would not compound across paraphrases or across nodes.

## 4. Current verified state (2026-09-29 ~04:40–05:00Z)

**Node 1 (`substrate-live`, hub)**

- **Minting is dead.**
  - `activity` rows whose id contains `learned-`: 515 in total, 10 deprecated.
  - The newest was created at `2026-09-22T07:39:02Z`; 0 have been created since.
  - Of the 19 activity rows created since 09-22 08:00, none is earned: 11 are `auto-bridge-*`, 6 are
    `development-vessel:*` probes or reconcile variants, 1 is `composed-cap-*`, and 1 is
    `invoke-performance-reach-gate`.
- **Extraction runs, and every run is hollow.**
  - Over 7 days, `execution` has 1,440 `ribosome-extract` rows.
  - 1,437 of them have `status:success`, all with the task-status vector
    `[success, skipped, skipped, skipped, skipped, skipped, skipped]`.
  - Of those, 1,086 carry the `ribosome-vessel-dispatch` tag and 351 came from goal-host reach→mint.
  - `reached`: 1,080 false and 360 null, **0 true**. None has more than 1 output impulse.
  - The 3 failures are `UNRESOLVABLE_PLACEHOLDER {{lifecycle.executionId}}`.
- **Why tasks 2–7 skip.** `assess_quality` is gated on `{{impulse:trace_signature}} contains '"tasks"'`.
  `acquire_trace_signature` does a point lookup (`execution_id`). Per source
  `execution-trace-with-signatures.ts:509-516`, that lookup skips the `execution` table and reads only
  `v_paradigm_execution_traces`, which INFO shows is `DEFINE TABLE … TYPE ANY SCHEMALESS` (no
  `AS SELECT`) with **2 rows**.
- **Positive control, same address.** Resolving `executionTraceWithSignatures` with a `since` window
  returns traces (for example `exec_4d5c084a-69e`). A point lookup on **that same id** returns
  `count:0`. The ledger shows migration 212 applied `2026-09-28T11:59:38Z`, so its
  `IF NOT EXISTS` (`d98309e`) now protects the plain table.
- **ribosome-vessel.** It is `active` and logged 1,507 lines in the last hour. Registration failed
  (`register failed: 400`) 64 times in that hour, and heartbeat got 404 (ribosome registers
  `shapes:[]`). It logged 6,620 `extraction ALLOWED` in 24 h, and the
  `extractionEligibilityPolicy unresolved — falling back to literal` WARN still appears.
- **Composition edges.** Derived at ingest: `activity_composition_graph` has 14,960 rows, 9,518 created
  in 7 days and 858 updated in 24 h. This part is alive.
- **Pathway replay.** `goal_execution_paths` has 22,245 rows. Paths executed since 09-22, by `walk_tier`:

  | walk_tier | paths | ok / total executions |
  |---|---|---|
  | learned_pathway | 805 | 528/902 (58.5%) |
  | fresh_derivation | 2,020 | 86/6,381 (1.3%) |
  | satisfier | 1,791 | 775/7,350 |
  | universal_tool_fallback | 519 | 457/9,288 |
  | feature_compose | 20 | **0/54** |

  goal-host logged 62 `pathway reuse: accepted` in 24 h, and the sampled lines read
  `via goal_hash`.
- **Rebind.** 377 `outcome selected=no` in 24 h. The refusals were all `shape-mismatch`, with some
  `scaffold-too-weak`. 14 lines match `selected=true|yes`, none of them organic.
- **Reached-command cache.** `/workspace/.goal-host-reached-commands.jsonl` has 10,624 lines, mtime
  09-29 03:23.

**Node 2 (`compose2-live`)**

- The reached-command cache has **452 lines**, a separate store.
- goal-host logged 107 pathway accepts in 24 h. 0 rebind selections matched `selected=true|yes`
  (852 rebind lines overall).
- `ribosome-vessel` is `inactive`. Extraction for node-2 reaches has no local owner.

**Open gaps (live store, 6,279 gaps)**

- Filed 09-28: `severed-joint-ribosome-extraction`, `severed-joint-ribosome-registered`,
  `systematic-failure-ribosome-extract-zero`,
  `model-reality-phantom-failure-compose-auto-bridge-source-code-to-ribosome-extr`.
- Filed 09-23: `a-learned-pathway-whose-head-is-a-satisfier…-narrowed` plus its recommit, and
  `the-walk-runs-the-terminal-write-satisfier-before-any-producer…` plus its narrowed child.
- Filed 09-19: `gap-rebind-content-swap-reuses-a-prior-goals-write-body` plus its narrowed child.
- Seven `precondition-rejection-activity:⟨learned-composition-*⟩` / `systematic-failure-learned-composition-*`
  gaps from 09-18 to 09-21.
- `orphaned-capability-extractionPolicy` was **rejected** (09-26).

**Corrections to the collector records:**

- (a) "retired template / all execution_error" (reports-7, git-super-2, transcripts-4) is wrong. The death
  is hollow success behind a view that has become a plain table.
- (b) `86aebdf` (attempt 28, "partial") was reverted the same day by `5a374df`.
- (c) The 09-18 "Proven" applies only to compute-goal exact replay, node-local.

**Three grains, which should not be collapsed:**

- (a) exact replay of compute goals: works, node-local;
- (b) goal_hash pathway replay: works for repeated goals and for one product family (09-23);
- (c) earned new templates: 0 since 09-22. Every template ever earned came from self-directed substrate
  work.

## 5. Prior attempts at the shared capability (input contract + probe + federated shape-keyed store)

| Attempt | What it covered | Why it did not hold |
|---|---|---|
| `isHonestlyReached` `8d969b4` (07-21), `411417b` grounded mint (07-23) | A single reach gate at the write side | It gates on the verdict but does not assert that the evidence is readable. It starved when the verdict arrived late or on another column (09-02) |
| Durable task census `572cd6c` (08-02) | Replaced a WS counter with a durable read | It fixed one address. It produced a storm, and success stayed 0 |
| `f88ba8f` status stamp, `ff292c6` nesting, `5f96ba4` applyExtraction | Each aligned one field to what the reader expected | These were point alignments with no contract, and the next layer surfaced each time |
| `11859d57` writer/reader table audit (08-21) | Found 1 writer and 0 readers | It was a one-off audit, not a standing check |
| Extraction deferral guard `7c70178`; honesty/"WITHHELD" | Withholds extraction on uncertain landings | It adds silent skips, so more reasons to be hollow |
| `composition_flow_health_scan` (ran once on 08-15), `orphaned_capability_scan` | Structural detectors | Dormant, or prescribe minting (114/114). No freshness predicate |
| Joint-liveness `70254535` (09-27) | **First** continuous probe of the extraction joint | It detects (it filed the gap on 09-28) but has no repair owner. It watches lag, not a positive control through the chain |
| goal_hash→path_signature re-key (09-05, 09-16), `shape_signature` borrow `9c376b2` | Shape-keyed store | Found twice, landed only as a borrow fallback. The primary key is still goal_hash |
| Persistent reached-command cache `831dafb`, store-backed `2e8b4cc` (09-18) | Durable crystallized store | Durable per node, never federated (10,624 lines vs 452) |
| `1f0d70f` / `d98309e` / migration 212 (09-28) | Restore the view the extractor reads | Applied at 11:59Z. The object is a plain table and `IF NOT EXISTS` protects the wrong object. This is the same "fix the address" pattern, and it is already not holding |

## 6. Keep (earned by evidence; make available, reuse first)

- **Ingest-time composition-edge derivation** (`516fc73`; activity-api `execution-traces.ts`): 9,518
  edges in 7 days. Retire the `composition-edge-reconcile` timer script (204 of 205 runs are no-ops) and
  the `POST /composition` writer (0 callers).
- **`goal_execution_paths` + `recommendReachingPath` + Wilson ranking** (`785293c`), and the
  satisfier-head chain (09-23): learned_pathway runs 58.5% ok vs 1.3% for fresh derivation. Keep it, but
  re-key it by shape signature.
- **Reached-command cache with tombstone/strike discipline** (`f9057a1`, `77d318b`, `2e8b4cc`,
  `6eed100`, `4c5534d`): the only proven replay. Make it a federated shape rather than a jsonl file.
- **`isHonestlyReached` / grounded-mint gate** (`8d969b4`, `411417b`), the recursion depth bound
  (`b6a430f`), deterministic `learned-<slug>` ids (fix the truncation collision), and rule 9a/10 plus the
  config-copy rules in `ribosome-extract.json`.
- **Variant creation and retirement** (activity-api `shouldCreateVariant` / `checkAndRetireTemplate`):
  1,228 of 4,010 rows retired.
- **Joint-liveness detector** (`70254535`): keep it and give it a repair owner plus a positive-control
  mode.
- **Fossils to retire, after their readers are repointed:**
  - the ribosome-vessel WS dispatch path, which duplicates goal-host reach→mint (1,086 hollow runs in
    7 days);
  - `compose-auto-bridge-source_code-to-ribosome-extract` (618/618 failures);
  - the `learned-composition-*` arms at 0% success;
  - `extractionEligibilityPolicy`, which has never been served (WARN every few minutes);
  - the lexical-rebind cache in its current shape-mismatched form;
  - the exemplar writer until it has a consumer;
  - the `ribosome-extract` lifecycle `postExecution` subscription (nothing emits it).

## 7. Retire condition (measurable, checked continuously, on both nodes)

The class is retired only when **all** of the following hold for 14 consecutive days:

1. **Chain liveness by positive control.** A scheduled probe resolves `executionTraceWithSignatures` by
   `execution_id` for an execution the same resolver just listed, and gets `count ≥ 1` with non-empty
   `tasks`. Among `ribosome-extract` executions, the share whose task vector has skipped tasks 2–7 while
   an honestly reached parent exists is **< 5%**. The joint-liveness `ribosome-extraction` binding reports
   lag < 86,400 s on every check.
2. **Product, not status.** At least 1 `learned-*` row per day created with `metadata.extracted_from`
   pointing at an execution whose `reached = true`. At least one per week derives from a goal that is
   **not** substrate self-maintenance (for example a human-surface or `webSearchResult`→answer goal).
3. **Reuse beyond the instance.** At least 1 learned template or pathway per week is selected and
   `reached:true` on a goal whose `goal_hash` differs from its source (accept lines logging
   `via shape_signature` or rebind `selected=true`). The organic rebind selected rate is > 0 on each node.
4. **Federation.** A pathway or command crystallized on node 1 is replayed on node 2, verified by a
   compose2-live accept line citing a donor that exists only in node 1's store, or the reverse.
5. **No near-duplicates.** 0 new `learned-*` ids that differ only by truncation or suffix from an
   existing id with the same `sourceTemplateId`.
6. **Durability (law 7).** No new gap in this class (`severed-joint-ribosome-*`, `systematic-failure-ribosome-*`,
   `lost-reached-verdict-*`, `learned-pathway…dropped`) is opened in the window.
