# Reconnection record: five needed behaviours (2026-10-10)

This is a read-only regression archaeology. Nothing in it was filed, edited, dispatched or restarted.

For each behaviour the system is expected to show by default (CLAUDE.md, "the execution expectation"), this record gives:
- when it last worked;
- what broke it;
- the restore;
- **who may perform the restore under the current scope**.

It is evidence only. Restores marked LANE or LEARNED-LAYER are candidate **needs for the system**. They are not operator builds.

## Sources and limits

- **Code:** origin/dev, at these commits:

  | Repo | Commit |
  |---|---|
  | super-repo | 7ae5e785 |
  | goal-host | fa73254 |
  | development-vessel | 51c04d50 |
  | activity-api | 66689bb |

- **Live stores:** node 1.
  - The goal-host journal starts 10-05 22:19Z.
  - The dispatch store starts 10-04 03:49Z.
  - The trace store holds nothing for September.
  - The goal-paths table (27,037 rows) is the only source for anything older.
- **Scope:** the live `autonomyScope` record in the pool has 59 `excluded_paths`: the 56 of the committed seed `scripts/substrate/autonomy-scope.json` (31f1d987), plus 3 scope earn-in **tightening holds**.
  - The holds are `repos/goal-host-vessel/src/goal-target-inference.ts`, `repos/development-vessel/src/resolvers/composer-interruption-sweep.ts` and `repos/concept-db/tests/write-shapes.test.ts`.
  - All three were placed by `scope_earn_in_apply` on 2026-10-09T00:08Z and expire 2026-10-12T00:08Z. While a hold is in place, only the regression repair named by its lineage is admitted.
  - The scope classes below use the **live** record, because it is the one admission reads. A path under a hold is OPERATOR until the hold expires, and LANE after that unless it is re-tightened.
  - Visibility finding: time-boxed holds live only in the pool record. A reader of the committed seed alone cannot see them.

## Scope classes

| Class | Meaning |
|---|---|
| **LANE** | The edit site is outside the live `excluded_paths`. The system can make this change now, so it is a need or gap for the system. |
| **OPERATOR** | The edit site is excluded (goal-host `index.ts`, the judge files, or a listed file). Only an operator change can make it, unless the judge/walk split moves the code out. |
| **USER RULING** | Held by a standing decision that has not been made yet. |
| **LEARNED-LAYER** | The change is a state change in a learned store (retire, re-extract), made by an existing mechanism, with no code change. |

## 1. The six everyday goals reaching

**Last worked: never genuinely.** Every recorded reach was one of three things:
- a model-memory answer given before the grounding gate existed (1377504, 10-03). The system's own WIRING.md H5 calls this a false reach;
- a judge flip on raw search snippets. 5e297a4b was marked reached on 10-09; the same shape was rejected on 10-06 and 10-08 ("news articles … without a summary");
- junk. "Who am I?" got a blank uiQuestion panel plus a web page that was a "Who am I?" quiz (WIRING H10).

**What did work, for headline-phrased goals only:** the satisfier pair `web_search → llm_completion`.
- It reached 4× on 10-02/03. One was b2be565f, "top ten headlines for yesterday", via composite `composition:web-search-to-llm-completion`.
- It reached only after operator surgery: 0174b66 and 7fe068c (the news route), plus decb28c and 462a277 (check-first tests). REALIGNMENT §7 step 1 records these as L12 interventions.

**Broke 10-03 14:25Z.**
- From then on the walk selects `learned-composition-web-search-to-llm-completion`. It has failed 12 of 12 runs (10-03 → 10-10) and is still selectable.
- Its `llm_completion` step finishes in 2–21 ms, so it never calls a model. Its `resolved_config` is `{"type":"llm_completion"}`, with no prompt bound.
- UNVERIFIED: the template contents, and when and by what it was minted.

**Also open:**
- The grounding gate leaks. On 10-07 a c1dfc244 retry was marked REACHED from an unsourced one-step `llm_completion_dispatch`.
- After a HOLLOW verdict, the retry widens its targets to raw shapes with no writer step. This is already filed (REACH.md L48).
- None of the six goals matches the `newsTerms` pattern of 0174b66.
- `deterministicWebSearchRoute` (6f2d6b6) runs only on the `empty` fallback.

| Restore | Edit site | Class |
|---|---|---|
| Retire the 0/12 arm, or re-extract it with the `llm_completion` prompt bound to the `web_search` output | learned store (`activity`, VPM) | LEARNED-LAYER (see §6) |
| Close the grounding-gate leak | reach judge in goal-host `index.ts` / reach-grounding | OPERATOR |
| News route and HOLLOW-retry targets | `goal-target-inference.ts` | OPERATOR until the earn-in hold expires 2026-10-12T00:08Z (its own regression repair is admitted under the hold), then LANE unless re-tightened |

## 2. The floor's toolset (ReAct parity)

**Best measured:** 09-26 → 10-01, while the floor had a shell with curl egress. Reach was about 25% (node 1 110/438, node 2 132/470). The floor never had a web search, memory, trace or feed tool on origin/dev.

**Broke on 10-02, deliberately.**
- 5b10279 removed `shellResult` after floor run 27c1c600 wrote `GPT-5.md` into the live super-repo through the "read-only" shell.
- Reach was 14% that day and 10% over 10-05 → 10 (6/371 on 10-10).
- Answers saying "I have no tool" rose from 0.9% to 8.8%, then settled at 5.9%.

**Broke silently on 10-03/04.**
- analysis-vessel was retired (58e0ebac) and is masked on both nodes, so discovery returns 0 producers for `source_code`. As a positive control, `fs_grep` resolves 3 producers through the same address.
- `source_code` is still listed in three places:
  - first in `goal-host src/floor-tools.ts:16`;
  - as a fallback named in the `fs_grep` description at `:24`;
  - in dev-vessel `src/resolvers/llm-completion-dispatch.ts:101` `DEFAULT_LLM_TOOLS`.
- Errors mentioning `source_code` rose from 0.6% to 3.7%.

**Confound.** The deterministic gates (76bb373, 1377504, bef051b, f031f26) change how runs are judged. Counting only runs they did not judge, reach still fell from 21–29% to 2–15% a day. The decline is real; its exact size is UNVERIFIED.

| Restore | Edit site | Class |
|---|---|---|
| Swap `source_code` for `fs_read`, including the `fs_grep` description | `goal-host src/floor-tools.ts` (not excluded); dev-vessel `llm-completion-dispatch.ts` (not excluded) | **LANE** |
| Report already-executed tool records in a separate field, never as pending `tool_calls` (that would run every tool twice). This fixes the `tools=0/0` counter, an open gap since 09-30. | dev-vessel `llm-completion-dispatch.ts` | **LANE** |
| Add read-only `web_search` (results only), `memoryNote` read, `executionTraceList` and `fleetActivityFeed`, all advertised live. Keep `http_fetch`, `web_resource` and `FLOOR_FORBIDDEN_TOOLS` (`:29`) as they are. Change the "NO internet tool" prompt sentence in the same edit. | `floor-tools.ts` | **USER RULING** (REALIGNMENT §9.0 hold; hardcoding APPROACH §9 decision 2). Vehicle: open gap `the-floor-read-toolset-offers-no-web-producer…` |

## 3. Failure memory changing selection

**Last worked: never decided selection.**
- `recommendExcluding` (980240b, 06-22) was bypassed, incidentally, by 4947765 (06-24).
- Eviction from the reached-command cache does work (414).
- REALIGNMENT's attribution to `callerPinned` is wrong. The bypass is the `!goal` branch.

**Defects:**
- `rememberGoalFailure` (goal-host `index.ts` ~:17721) records the LAST pick, not the satisfier that failed.
- The proven-bad satisfier hold (`SATISFIER_PROVEN_BAD_ARMED`, an env var: a law-1 violation) has been off since 08-19. Its re-baseline gap was never filed.

| Restore | Edit site | Class |
|---|---|---|
| Record each attempt's failing satisfier, then feed exact-goal failures into `suppressSatisfierShapes` (~:13985) on the first walk | goal-host `index.ts` | OPERATOR |

## 4. Human verdicts counting

**Last worked: never changed a learning sink.**
- fc297b4 (07-20) was dead from the start: its latch ran before the fetch, and it wrote to the wrong table.
- d9dc600 (07-27) removed it deliberately as "double-count".
- Today `oracle-label-consumer.ts` (~:117–140) sets only `record.reached`. `posterior-update.ts` has 0 label reads.

| Restore | Edit site | Class |
|---|---|---|
| In the disagreement branch, call `evictReachedCommand` (with the `deterministic:` prefix), `rememberGoalFailure`, `recordGoalPath(false)` and `deliverReachVerdict` | goal-host `src/oracle-label-consumer.ts` (not excluded) | **LANE** |
| A supersede flag on `/reach`, so that a human verdict replaces an earlier automatic one | activity-api `src/routes/execution-traces.ts:4951` (not excluded) | **LANE** |
| Inject those functions as deps into the consumer | goal-host `index.ts` | OPERATOR |

## 5. Rendered output on the surface

**Last worked:** through 10-02 (c688fb5e, `answerBody` prose).

**Broke because:**
- the final writer step stopped firing;
- the `answerBody` builder pastes the raw Basis;
- the surface leads with the largest raw output;
- `bestOutput` was deleted.

The surface components (RunView, AnswerBody) already render `answerBody`.

| Restore | Edit site | Class |
|---|---|---|
| A final `llm_completion` writer step | goal-host `src/walk-pool.ts` (not excluded) | **LANE** |
| The matching target change | `goal-target-inference.ts` | OPERATOR until 2026-10-12T00:08Z (earn-in hold), then LANE unless re-tightened |
| The `answerBody` builder uses the prose | goal-host `index.ts` | OPERATOR |

## 6. Why the 0/12 arm was not retired (LEARNED-LAYER)

The mechanism that should retire it is `checkAndRetireByPosterior` (activity-api `src/services/variant-creator.ts:476`). It fires from `POST /v2/activities/execution-traces` on a graded failure, and retires an `activity` row when two conditions hold:
- `total_executions ≥ RETIREMENT_MIN_EXECUTIONS`. This is a shaped tuning row; the fallback is 20.
- The posterior mean `α/(α+β)` is below `RETIREMENT_SUCCESS_FLOOR` (fallback 0.3).

Why it has not fired:

1. **Below the evidence floor, by design.** 12 < 20, so the sweep returns before the posterior is read. This is the rule working as written: the arm has not yet earned retirement under the current threshold.

   **The rule's blind spot:** an arm whose step provably never runs a model fails for a structural reason. The evidence floor is set for noisy outcomes; a deterministic defect needs no 20-run sample to prove itself. That is a class for a detector (§7, item 3), not a reason to lower the floor.

2. **The row may not be found.** UNVERIFIED for this arm:
   - The lookup strips `organizations:` from the org id (`:496`). The layer inventory suspects VPM rows keep the prefix, and retire-by-posterior has retired 0 arms.
   - The arm's graded failures may not reach its own VPM row at all. Under the ungraded asymmetry, ungraded failures charge β, but whether these 12 were graded against this arm id is not checked.

   **Decisive check:** read this arm's VPM row and its `total_executions`, through the activity-api read surface, not a root DB read.

3. **Variant-first is not reached either.** `autoCreateVariantIfNeeded` is the law-3 "variant-first repair" path. It has the same trigger path and its own failure-pattern threshold, and its output for this arm was not checked (UNVERIFIED).

Law 4/5 reading: retiring or re-extracting this arm belongs to the system's own sweep. An operator record edit would be the hand-completion that law 6 forbids. The system's need is a sweep that reaches arms which fail structurally before the statistical floor.

## 7. The three missing detector classes: reuse check

Two existing organs are candidates, and both edit sites are outside `excluded_paths`:

- **`orphaned_capability_scan`** (dev-vessel `src/resolvers/orphaned-capability-scan.ts`) computes the shapes live in the registry minus the resolvers invoked by any activity task, and emits one `substrateGap` per orphan. Note: the layer inventory recorded this scan as blacklisted from scheduling. Whether it runs now is UNVERIFIED.
- **joint-liveness** (`scripts/substrate/joint-liveness-tick.ts`) checks a `BINDINGS` list of `(table, timeCol, maxLagSec, reader)`. It asserts that each table's newest write keeps pace with `execution`, and emits a `substrateGap` per severed joint. It has one binding (`decision_outcome`). The `reader` field is only a label; nothing checks that the named reader runs.

| Missing class | Extends | How |
|---|---|---|
| **A tool listed with 0 producers** (`source_code`) | `orphaned_capability_scan`: **yes, directly** | It is the complement of the same two sets. The scan already fetches registry shapes and every invocation site. The new set is "named by a task or tool list" minus "advertised with ≥1 producer". The extension also needs to read tool lists (`floor-tools.ts`, `DEFAULT_LLM_TOOLS`) as invocation sites; today it reads only activity tasks. |
| **A verdict sink with 0 readers** (human labels written, read by nothing) | **Partly.** joint-liveness checks write *freshness*, and here the writes are fresh. What is missing is a *read*, which neither organ measures. | The nearest fit is joint-liveness's binding model with the direction reversed: check that the declared reader has consumed the writer's rows, using a read-side marker or the reader's own trace. That is the "hollow_write" class (a field nothing reads). As a static form, `orphaned_capability_scan`'s set difference could run over fields: written minus read. Either way the extension is real work inside an existing organ. Neither organ detects this class as built. |
| **An LLM step that never calls a model** | **Neither.** This class is a step whose resolved config lacks its required input, observable as a model step finishing in milliseconds. | Its natural home is the place a pathway is born: the ribosome extraction or the birth judge, refusing to mint a step with no prompt binding. The extraction site was not located in this pass (UNVERIFIED). If it is in goal-host `index.ts`, it is OPERATOR. As a runtime detector, it fits joint-liveness's binding pattern ("a model step's latency must exceed a floor"), but that stretches the organ's purpose. |

## Cross-cutting findings

1. **One missing piece, three symptoms.** The missing writer step lies behind:
   - the snippet "reaches" (§1);
   - the raw surface (§5);
   - the dead learned composition (§1, §6), whose writer step has no prompt.
2. **Three of the five never worked (§1, §3, §4).** "Restore" there means connecting an existing function to the consumer that should read it. It is not a revert, and it needs no new machinery.
3. **Every OPERATOR item is in goal-host `index.ts`, or in `goal-target-inference.ts` while its earn-in hold lasts.** This strengthens the judge/walk split as the change that turns these into LANE items.
4. **Time-boxed scope holds live only in the pool record.** The live record has 59 paths: the 56-path committed seed plus 3 earn-in tightening holds expiring 2026-10-12T00:08Z. A reader of the committed seed alone cannot see the holds, and would class `goal-target-inference.ts` as LANE while it is held.
