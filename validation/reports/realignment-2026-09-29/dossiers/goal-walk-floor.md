# Dossier: goal-walk-floor

The walk cannot reliably turn a natural-language goal into targets and producers. The ReAct floor, which is meant to guarantee parity with a conventional agent, fires often and rarely reaches.

- **Sources:** `classes/goal-walk-floor.json` (86 attempts, 35 problems, 14 claims), the raw notes, `_mech_chunks` 09/11/12/13/16/17/21, and critic §3, which folds `goal-vocabulary-regex` into this class.
- **Live verification:** done read-only on 2026-09-29 between 04:40 and 05:10Z, on node 1 (`substrate-live`) and node 2 (`compose2-live`).
- **Caveat:** node 1's journal starts 2026-09-25 13:10 and node 2's starts 2026-09-26 09:57. Every runtime claim earlier than that rests on reports, memory files and git history, not on logs.

## 1. One line

Given an arbitrary goal, the walk should map a direction along shapes and fall back to a tool-enabled ReAct loop. What actually happens is this:

- Goal→target inference keys on whether a shape *name* appears in the goal text.
- Selection, inference and gap filing each consult a different, partial idea of "who produces what".
- The floor tier reaches about 2% of the time on its reach verdict.

Every repair since 05-27 has joined one pair of these stores through one channel, for one phrasing. The class has come back with a different symptom roughly every week.

## 2. Timeline (claims marked ► with what later showed)

| date | event | claim → later |
|---|---|---|
| 03-20 | Named goals do not run the named template (improvise fallthrough) (git-super-1) | |
| 05-02..03 | minibob head-to-head vs Claude Code, 0/8 → "9/10 at ≤1.5x LLM calls" (84200483, 9022dd67) | ► "ReAct parity" → it measured LLM-*call* parity, not outcome parity. minibob was removed 05-24, and **no floor-parity measurement has existed since**. The 09-19 generality round's ReAct baseline arm was never run. |
| 05-09..25 | Fix deployed, but the executed path (GOAL_RUNTIME vs SearchFirst) never exercises it (openspec-1) | |
| 05-27 | Push-away refusal when no producer exists (4ece17e1, IAL 27.S.6) | ► "active" → F-129 found it overstated. `interventionRefused` had 0 hits on 05-29, and 11 misroute experiments ran on 05-28 (inv-050/056). |
| 05-28 | LLM path silently non-functional substrate-wide: tokens_in=0 on 53 sub-traces (F-148) | |
| 06-24..29 | Reach semantics revised 3× in 5 days (371cba48, 6188faa6, ebb6c46b, d3f56573) | |
| 06-25 / 06-30 | Lever 4: goal→target-shape inference (f85a6d5, `goal-target-inference.ts`) | ► "NL goals REACH end-to-end" → 07-02 plain dev goals misrouted to maintenance ticks. 07-13 6c699b51 returned "no producer" for substrateGap_write. 09-29 "memory" mapped to no shape. The B5 seeding≥0.8 criterion was never measured. |
| 07-01..02 | Shape-action-evidence closure proof | Baseline 13 goals, 0 passable (c60927aa); lift gate 0/24; F1-F5 never done |
| 07-13..16 | Walk sees vessel-resolver producers (5301ae4; ias-executor VesselResolver) | First learned composition minted. The foreign write resolver was still auto-bridged 07-31. |
| 07-23 | ReAct floor: shellResult universal executor + groundedOk-gated loop + command evidence (43247db, f44b27b, 6cba611, da08516) | Floor went 0/3 → 2/3 grounded. **The loop itself had 0 live firings.** Envelope unwrap was a local patch (double-wrap 500s recurred 07-27). |
| 07-24 | Walk LLM call cuts (8a5e15e, 71e0161, 1797a72, 1be9f4f), 145 s → 35 s | |
| 07-25 | Fix A: compute-chain augmentation (e118234) | Composed correctly, but the last-mile command produced 18 instead of 14 |
| 07-26 | Cold-floor self-correction (c7870bd, 6157be4): 2/4 → 4/4 on the held-out suite. Ablation arms (0fe201f) | ► → The floor is ~50% cache-dependent (WARM 4/4, FLOOR 2/4). Later audits found 51% zero-cycle floors. The harness is operator-run and never became standing. |
| 07-30 | Deterministic templating 7 → 14/14 (78faa7b, 2161ada, 9d6a63d, 351ca70, ce83b4b); compositional guard c467e5f; interrogative guard 92d4b428 | ► 14/14 → only for hand-templated families. Two-op reach is honestly 1/8. The 09-19 generality round got R 3/7. |
| 08-02 | Restore floor admission `(groundedOk>0 \|\| finalText)` (f4f983a, substrate-authored); locality tiebreak 36d663e | 5/5 reached, 3 via the floor |
| 08-03..07 | Floor overrode HOLLOW 37/37 with 0 tools. It wrote 0/4,768 goal-path rows (`return uf` before recordGoalPath), was unlooped on timeout, ran tools on the hub, and excluded edit goals (memory-4, mech 12) | Fixed piecemeal (2cb9b26, 825f773 on 08-17) |
| 08-05 | Thrown dispatch status / drain freshness (b3ad44a, df4b700, 6f735c1) | Landed by direct edit (bootstrap deadlock) |
| 08-09..11 | Pathless / behaviour-described goals: vocabulary widening (50d2e69, fea9eab), file-location (44375c6), NORMATIVE_INTENT, 17-commit nine-layer pipeline | Right file 3/6. **5 of 17 fixes inert on arrival.** Harmful landing b222d75 on 08-11. The `goal-vocabulary-regex` class starts here (regex predicates over prose). |
| 08-10 | Capability rounds 1-4: 7/7, 7/8, 6/8, 4/8. Non-filesystem work 4/8, **all via universal_tool_fallback** | ► "structural floor gap for pure-reasoning goals" → retracted in the same doc (starvation) |
| 08-12 | Complexity ladder: every rung reached with producerSteps 0 (satisfier) | |
| 08-13 | Deterministic env-gate route in inference (2183da8) | Per-class |
| 08-15..17 | Io live-measurement goal: ~30 prompt commits (f73faaa..3496df5), then 4 evidence fixes (0223842, 2dcfc12, a68e1ac, 5be029a); depth cap 3→5 (705f1eac) | Io reached exact. **Ganymede then false-reached via web_search.** 2c26fcb: "stating it in the prompt does not hold". Fact delivery reliable at 2 facts, not 3 (1/4). |
| 08-18 | answerBody / pinnableHead (17f2e41, c303d7e); vacuous-edit gate deleted 73.4% of index.ts on analysis | |
| 08-21 | Walk read outputs from a just-cleared store (ias-executor 8676beb, retainOutputs) | Worked: 9 real read-backs, 0 stubs |
| 08-22..23 | Compose BUSY falls through to a walk that cannot edit (2cc8af7, operator direct edit) | Unknown. On 09-28, live-activities shows 441/0 `satisfier:goal-host-walk-failed` over 5 days. |
| 08-25 | Creation routing (13f7440, 632955a, 578b831) | ► "proven end-to-end (3afb1812)" 03:55 → retracted 06:40 as retry-after-debris. Later 3/4 from clean. |
| 08-27 | Investigation floor + citation oracle (752014d, 2757d15, 0af9639, 71d434f, 5e4d045); recipe grounding (26f4ecb, f91f8f2) | ► "both layers of the verifier-recipe chain closed" → 0 DONATED and 0 recipe answers in the 72 h to 09-29 (dormant). `recipeSeed` had 0 journal hits in 7 days. |
| 08-28 | Selector refusal `no_producer_for_expected_shapes` first seen in class (docs-2) | Continues to 09-29 (see §5) |
| 08-29 | ► "Reach rate ~1%" | → retracted 30 min later: 1624/1922 rows were auth telemetry; true 17.3% |
| 09-02 | Walk reach 7.1%/24h. 96.2% of not_achieved = edit-intent-no-landed-edit (reports-8) | |
| 09-03 | Bind args from pool (13b3262, c07cffc) | v1 inert, v2 0/2 |
| 09-10 | Fleet credentials re-issued (939bb55, 978fc40, b032dc9). Empty knownShapes after a discovery 401 had emptied inference. | 0-step terminations 100% → 0. **Reach 10-18% measured before this had been VOID.** Eight-goal pilot: 4/8 correct, 1/8 met the output contract. |
| 09-11 | ► "Ladder reached 7/7" | → same day: measured self-health, not reach (8.6%/24h) |
| 09-12 | ► "Five substrate-authored repairs, reach 22.6%" | → 09-13: baselines were operator-contaminated; autonomous 0.9-2.6%, operator 80% |
| 09-15 | Cannot compose outside `repos/<vessel>/src` | .gitignore fix picked 0 times in 3 h |
| 09-16 | ► "76 resolvers ~91% wired: ReAct floor met" | → 09-18 floor dark on spokes (gap-mu6ejfac). 09-22 the resolve-URL joiner (absolute resolvePath + endpoint → invalid URL) killed llm_completion, web_search, shellResult and the human surface. |
| 09-18 | NL capability goals captured onto victim files by regex edit-intent: 5af332e4, aa1ef6e5, d12205d6 (template-audit.ts fs_edit @0.98). Capability-gap generator starts filing invented shape names. | |
| 09-19 | Generality round 1: R 3/7, V 7/7. ReAct baseline arm never run → parity UNTESTED. | |
| 09-22 | Pool-walk c.slice TypeError (875e137) | |
| 09-24..26 | Execution-id threaded hop by hop (#32→#41→#43→#60→#61) | Closed with falsifier 09-26; there is no single context carrier |
| 09-25 11:02 | ► "Best bucket 51%" | → 8c31cdb broke routing 12:09-12:36; reach definitions not comparable; retracted |
| 09-27 | Dispatch termination: git probe, landed latch, fetch timeout (f3ffd7d, f9001e9, 1942eaf) | Worked |
| **09-28 01:18** | **4361247** (goal-host, `Substrate Autonomous` identity, gap route-edit-7be40f88): capability-gap filer gains a demand gate, auto-closing `walk_artifact` until a 2nd distinct goal needs the shape | ► The class record said "generator untouched". That is half right: *disposition* changed, *minting* did not (§5). |
| 09-28 ~01h | Operator closed 693 capability gaps (`operator:claude-avi`, "single-goal demand, 09-28 audit"). 16 `gap-federation-*` closed 01:26-01:29. | ► **Third bulk close of the same backlog** (06-14, 09-05, 09-28). The federation class recurred at 09-29 00:38 (`gap-detailed-federation-state`). |
| 09-28 18:16 | bc99f91 (live goal-host HEAD): target inference no longer rewrites a repo-relative path into a non-existent absolute path | |
| 09-29 02:30 | ► "supply → autonomy end to end for the first time today" | → retracted 02:43: decomposed steps had landed verified 09-27 |
| 09-29 03:07-03:35 | Memory need 879c4bc6 (hash 721b5154): inference `[]` @0 → pool leftovers → HOLLOW. The same node served `memoryNote`. | ► The check-in says "the ReAct floor did not engage". **The journal contradicts this:** `floor: ENTER universalToolFallback goalHash=721b5154 targetShapes=[]` → `reached=false groundedOk=0 finalTextLen=3000`. The floor engaged, with no target, and failed. |

## 3. Root causes (verified where marked ✓)

1. **Target inference is string-keyed.** ✓ It maps a goal to shapes when a shape name appears literally, and invents names otherwise.
   - Contrast pair from the node 1 journal on 09-29: d12dd9b8 ("Consolidate … memoryNotes") → `["memoryNote"]` @0.9. 721b5154 ("the system cannot remember…") → `[]` @0.
   - When it does not find a name it mints one. Since 4361247 there have been **54 capability-gap mints with 54 unique missing_shape names**, for example `memory`, `improvement`, `invariants_status`, `promotedConceptList`, `detailed_federation_state`, `overall_passing`.
   - This is the `goal-vocabulary-regex` root in another form: routing decisions are made as string predicates over prose (isQuestionGoal, the edit-intent verb whitelist, createIntent adjacency, the localizer bigram). Each instance was patched locally and the class never retired. The typed-decision prototype (jev, 8/8 vs regex 6/8) was never wired.
2. **Producer knowledge sits in stores that are never joined.** ✓
   - The selector's refusal candidate pool is *template output_shapes only* (activity-api `routes/activities.ts` ~7759).
   - Node 1's discovery registry (405 shapes) serves `activityExecutionTrace` and `goal_execution`, yet in 7 days the selector refused 165 requests naming `activityExecutionTrace` and 98 naming `goal_execution`.
   - The refusal suggests `create-shape-provider-goal` every time (84 journal mentions in 7 days). **Nothing consumes it** (mech 03: live-unused).
3. **Vocabulary is node-local in a decentralized system.** ✓ `federation_verification_report` is advertised on node 2 (325 shapes) and absent from node 1's registry. Node 1's inference therefore invented `federation_state_summary`, `federation_overlay_state`, `detailed_federation_state` …, and those were filed as 17 capability gaps. "Absent here" was read as "absent", when the shape existed on the node next door.
4. **The floor is an LLM-shaped fallback with no guaranteed direction.**
   - It fires after `walk.reached===false` (or prose-over-source) and never for edit goals (`index.ts` ~13317 at live HEAD bc99f91).
   - With an empty target it has nothing to aim at. It dispatches to the dev-vessel agentic wrapper, which runs tools internally.
   - As a result, ✓ **every floor execution in both journals records `tools=0/0`**: 1,284 on node 1 since 09-25 and 239 on node 2 since 09-26. groundedOk is 0 on all 80 floor verdicts in node 1's last 24 h.
   - Grounded and recalled answers are therefore indistinguishable in the floor's own record, which is by design (comment at `index.ts` ~5212/5276/5321). The reach judge is the only honesty backstop, and the 08-16 Ganymede and 07-27 GraphQL confabulations show it can be fooled.
5. **The measurement has been void, contaminated or gameable more often than not.**
   - Reach was VOID before 09-10 because of 401s.
   - It was operator-contaminated until 09-13.
   - It was redefined 3× between 06-24 and 06-29 and again around 09-25.
   - Today the floor tier's denominator is dominated by tick goals (§5).
   - The only outcome-parity benchmark was deleted 05-24.
6. **Edit goals leave the floor entirely.** Early edit-intent was lexical: a named repos path counts as an edit even for a question (07-24..08-24, 09-15..18 victim-file capture). BUSY compose fell through to a walk that cannot edit (08-22). Goals outside `repos/<vessel>/src` are unauthorable (09-15).
7. Local mechanical defects, each fixed once and not recurring as-is:
   - the inverted guard 1f24ad1
   - the evict-before-read in 8676beb
   - `return uf` before recordGoalPath
   - the empty knownShapes after a 401
   - the resolve-URL joiner (09-22)
   - execution-id dropping per hop (09-24..26)

## 4. Why it recurs: the missing shared capability

**Missing capability: one producer-knowledge resolver (a "who can produce shape X, and what is X called" service), federated and consulted at all three decision points.** Those three points are:

- **goal→target inference** in goal-host (`goal-target-inference.ts`)
- **selection / refusal** in activity-api (`routes/activities.ts` ~7759)
- **capability-gap filing** in goal-host (`index.ts` ~5716)

It would answer from the union of:

- activity templates,
- local vessel resolvers,
- every peer node's discovery registry, and
- an alias and capability-word index that maps "memory/recall/remember" → `memoryNote`, "federation state" → `federation_verification_report`, and so on.

The alias index would be learned from reached executions, not written by hand.

Without that capability, each decision point keeps its own partial vocabulary. So every fix lands at one point, for one phrasing, on one node, and the same miss reappears at another point, with another phrasing, or on another node. The floor then inherits an empty or confabulated target. It is also the only path that can recover, and because it is LLM-shaped, recovery depends on the model.

Within the goal-host process the seam sits between `inferGoalTargetDecision` and the walk's `knownShapes`. Across the fleet it sits at discovery's `/registry/shapes`, which is node-local today.

The second missing capability is a **standing floor-parity instrument**: a need-phrased probe battery with deterministic oracles and a ReAct baseline arm, run on a rhythm. The class keeps getting declared fixed because nothing continuously measures the contract. minibob did this once, and it was deleted 05-24.

## 5. Current verified state (2026-09-29 ~04:45-05:10Z)

**Walk tiers** (`goal_execution_paths`, grouped by walk_tier over last_executed_at; reach verdict = `success_count`, which differs from `successful_executions`, see note below).

| window | tier | execs | success_count | rate |
|---|---|---|---|---|
| 7d | learned_pathway | 899 | 461 | 51% |
| 7d | satisfier | 7,285 | 121 | 1.7% |
| 7d | universal_tool_fallback | 9,283 | 186 | 2.0% |
| 7d | fresh_derivation | 6,164 | 53 | 0.9% |
| 7d | feature_compose | 54 | 0 | 0% |
| 24h | universal_tool_fallback | 7,197 (46 paths) | 7 | 0.1% |
| lifetime | learned 2,739/650 · satisfier 14,190/852 · floor 11,677/485 · fresh 15,308/168 · compose 60/0 | | | |

- **Note on the two counters.** activity-api `goal-paths.ts` increments `successful_executions` on every validated success (line 592). `success_count` is the separately written reach counter. The class record quoted 2.0% and 4.9% for the same tier without saying which is which. This dossier uses `success_count` throughout.
- **The 24 h floor denominator is 79% tick goals.**
  - `produce a projectThreadScanReport …`: 4,581 execs, success_count 0.
  - `learning-loop-selftest …`: 1,110 execs, 0.
  - The rest are federation_verification_report (364), detect-vessel-code-drift (245), reality-model refresh (204), capabilityCensusReport (197), validation-goal-synth (131), docs_align_tick (124). All are `meta` and all have success_count 0.
  - **The honest floor rate on need-phrased, non-tick goals over the last 24 h is unmeasured.** No standing battery exists.
- **Floor runs, journals over the last 24 h:**

  | node | ENTER | reached | not reached | runs with tools=0/0 | runs with empty target |
  |---|---|---|---|---|---|
  | node 1 | 81 | 16 | 64 | 80/80 | 7 |
  | node 2 | 123 | 20 | 96 | 116/116 | 0 |

  Node 1 floor faults in the same 24 h: 10 dispatch TIMEOUTs at 90 s, 5 HTTP 500s, 3 socket closes.
- **Target inference, last 24 h:** empty on node 1 for 8 of 134 goals, and on node 2 for 0 of 126.
- **Selector refusals:** 9,160 total, 994 in the last 7 days, 111 in the last 24 h. The latest was at 03:21:48Z, for [activityTemplate_update, sql_schema], and `activityTemplate_update` is in node 1's registry.
- **Capability gaps** (live store `/workspace/git/super-repo/gaps/gaps.json`, 6,279 rows):
  - 753 rows have kind `capability_gap`: 693 closed by the operator, 54 minted since 4361247 and all auto-closed at birth, and 19 open.
  - 13 of the open gaps have demand ≥ 2, and they are generic words, not capabilities: `path`, `analysis`, `health-report`, `current-state`, `task-summary`, `success-report` …
  - The minting rate is about 2 per hour, and every name is unique.
- **Live code:** goal-host HEAD is bc99f91 (09-28 18:16). The super-repo submodule pointer is ff5fbb8 (09-23), so the submodule lags live. Floor call sites are at `/vessels/goal-host-vessel/src/index.ts` 13025 (reuse-before-derive, floor as a learned pathway) and 13330 (after a failed walk, `!goalIsEditIntent`).
- **Concept recall:** 94% of concept-db searches return dense_true_empty (24,207 of 25,651, vessel-docs-tooling). Concept recall is not read by universalToolFallback (mech 21).

## 6. Prior attempts at the same capability (a unified producer and vocabulary view) and why each did not hold

| attempt | what it joined | why it did not hold |
|---|---|---|
| 05-27 push-away refusal 4ece17e1 | Templates → an honest "no producer" | The pool was templates only. The refusal became correct-looking, but it now refuses served shapes (§5), and its escalation suggestion has no consumer. |
| 05-28 semantic-mismatch detector / `goal_semantics` / `resolver_registry_query` / `origin_layer` designs (inv-042..079) | Goal semantics ↔ registry | Designed, never built: 0 source hits today (dormant) |
| 06-25/06-30 Lever 4 inference f85a6d5 | Goal text → the shape vocabulary via an LLM classifier | The vocabulary is fetched per node and was starved by the 401 until 09-10. There is no alias layer, so capability words stay unmapped. |
| 07-14 5301ae4 + VesselResolver | Walk ↔ local resolver satisfiers | Local only. The selector (activity-api) still reads templates only. Satisfier arms have no activity row, so they cannot be graded (law 2, mech 13). |
| 08-09..11 vocabulary widening 50d2e69/fea9eab, NORMATIVE_INTENT, nine-layer pipeline | Symptom words → identifiers/files | Regex and bigram predicates, and 5 of 17 were inert. The localizer prefers rare n-grams. This was the start of the `goal-vocabulary-regex` class. |
| 08-13 2183da8 env-gate route, 07-30 deterministic templates, 08-27 investigation routes (752014d…), 45818d0 composition-ask recovery | One phrasing family → one producer | Each is per-family by construction ("covers the phrasing class only"). They do not generalize: generality R 3/7 on 09-19. |
| 08-17 depth cap 705f1eac, 78dbcd6 | More targets per goal | Mean inferred 2.5 shapes. The failure is naming, not arity. |
| 09-10 credential re-issue 939bb55/978fc40 | Restored the vocabulary fetch | Fixed starvation, not coverage. The vocabulary is still node-local (the federation shape is missing on node 1). |
| 9e5b8f7 "registry route was missing from the component that decides"; 6d60248 "a goal naming an advertised shape was routed to bash" | Registry → the inference decision | Only for goals that *name* the shape. Capability-worded goals still miss (721b5154). |
| 09-28 4361247 demand gate + the 09-28 operator bulk close | Filing ↔ demand count | Treats the symptom (backlog), not the source (minting). This is the third bulk close (06-14, 09-05, 09-28; 82% expire, 4% ever composed). The generic-word gaps still accumulate demand. |
| 05-02 minibob parity benchmark; 07-26 ablation harness 0fe201f/75ea589c | The measuring instrument | The benchmark was removed 05-24. The harness is operator-run and never became a standing activity, so every "floor met" claim since has gone unmeasured. |

## 7. Keep and fossils

**Keep (live-used, general):**

- `universalToolFallback` / `runGroundedToolLoop` (the floor itself), including 825f773 (5xx as observation) and the fabricated-transcript refusal
- reuse-before-derive with the floor as a learned pathway (index.ts ~13003)
- the selector honest refusal: *widen its pool, do not remove it*
- failure memory (`.goal-host-failure-memory.jsonl`)
- `deterministic:no-oracle-for-goal-class` (57cd2c3)
- retainOutputs (8676beb)
- the per-vessel credential issue path
- execution-id threading (#61)
- the dispatch-termination latch (f3ffd7d, f9001e9, 1942eaf)
- the demand gate 4361247, kept as a *brake only*

**Fossils or dormant (candidates for retirement):**

- `inferGoalTargetShapes` import and `decideContinuation` (walk-continuation.ts), imported with 0 call sites. The live decision is `inferGoalTargetDecision`.
- `recipeSeed` (0 hits in 7 days)
- `SATISFIER_REUSE_ORDERING_ENABLED` / `SATISFIER_PROVEN_BAD_ARMED`, env-gated, which violates law 1
- the `create-shape-provider-goal` escalation, which is suggested but never consumed. Either wire a consumer or stop suggesting it.
- the in-flight recovery loop (193/193 attempts were "attempt 1/1")
- the minibob benchmark (removed; its intent should be reborn as the instrument below)

## 8. Retire condition (measurable, checked continuously)

The class is retired when all of the following hold over a rolling 7-day window. The checks should run as a standing activity on a rhythm, not by the operator.

1. **Unified producer view:** 0 rows in `refusal_events` whose `expected_output_shapes` intersect the *federated* registry union (all reachable nodes' `/registry/shapes`, plus template output_shapes). Today: 263 of 994 involve just two served shapes.
2. **No confabulated mints:** 0 `capability_gap` mints whose `missing_shape` is served somewhere in the union, or is an alias of a served shape. The mint rate for unique never-served names should fall below 1 per day. Today it is about 2 per hour, all unique.
3. **Floor parity:** a standing need-phrased probe battery reaches at least 90% with a deterministic oracle and runs a ReAct baseline arm. The battery:
   - uses no file paths or shape names, per law 13;
   - covers capabilities served on at least one node;
   - includes cross-node shapes such as federation_verification_report from node 1;
   - excludes tick and operator-rewritten goals.

   Report the floor tier split tick vs need-phrased, and read the floor's reach from `success_count` only.
4. **No same-hat recurrence:** zero re-openings of these gap families after closure for 14 days: `goal-target-inference-*`, capability-gap bulk closes, and `gap-federation-*`.

That instrument does not exist yet. Its absence is itself the first gap to file, and it should be the system's own rhythm activity (law 6).
