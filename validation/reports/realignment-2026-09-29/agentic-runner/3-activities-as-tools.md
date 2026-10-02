# Agentic runner, track 3: activities as tools

2026-10-01. Read-only census. Nothing was edited, dispatched or restarted, and no write shape was resolved. This is a
proposal to the coordinator, who owns REALIGNMENT.md.

**Sources.**
- Live goal-host source = `origin/dev` `a72918f`. Line numbers below are live; the local clone `7d38196` is behind.
- Live ias-executor-ts = `/workspace/git/vessels` `c563ab5`; `engine.ts` is byte-identical to the local `4719cb4`.
- Live activity-api source was read in the container (`/vessels/activity-api`).
- minibob: `repos/deployment/vessels/minibob` (its own git, HEAD `677f8ff`).
- REALIGNMENT is read from `origin/dev`, the version with §9.
- Prior tracks: [agentic-floor APPROACH](../agentic-floor/APPROACH.md) and its A–E track files, [output-shapes APPROACH](../output-shapes/APPROACH.md).

**Windows and method.**
- "7d" means `created_at > time::now() - 7d`, run at about 10-01 23:00Z.
- The trace store is under retention, so every child count is "retention permitting". One 09-25 parent's children were already gone.
- Two query traps hit and corrected:
  - `tasks[WHERE …] != []` matches rows whose `tasks` is `NONE` (48 rows). Every count below uses `array::len(… ?? []) > 0`.
  - `activity.total_executions` is 0 on every row. Execution counts come from `execution` / `execution_trace_content`, never from that column.

---

## 0. Summary

1. **The engine can already run an activity as a step of another one.** Three paths exist:
   - `compose` / `compose_parallel`;
   - activities-as-resolvers (a task whose `resolver` is an activity id);
   - the `activity` resolver.

   All three link the child by `parent_execution_id` + `composition_chain`. Only the activities-as-resolvers path is used for capability composition. **0 of 3,978** templates carry `resolver:"compose"`, because development-vessel rewrites it away at registration (`3ba1c45`).
2. **The `activity` resolver is used by the lifecycle machinery. It loses data, and its main caller is dead.**
   - A task naming it appears on 60,404/137,055 traces (7d), but 59,693 of those traces have the task skipped by its gate. It actually ran in 641.
   - `validator-dispatch.dispatch_validators` failed **586/586** times it ran: its config carries no `templateId`. It relied on minibob's `extractSelectedActivityId`, which the port did not bring over.
   - It returns one `activityExecutionSummary` in place of the child's outputs.
   - It passes the child no impulses, no tags, no template-cycle chain and no budget, and it records no `child_activity_id`.
   - IMPULSE_ACTIVITY_FOUNDATION.md:1130 cites this resolver as proof that "the target shape is already demonstrated to work one level down". That claim is about linkage only; the data flow is lossy.
3. **Being used as a tool does not earn credit the way being picked by the walk does.**
   - Credit ascends the chain only (`propagateCreditAlongChain`).
   - A goal-host execution with no reach tag is `ungraded`, whether it succeeded or failed.
   - So a **nested** child under a goal-host dispatch is credit-inert in both directions: success gives {0,0}, and failure gives at most β to the child itself (only via the `failedByTask` path), never to its ancestors.
   - A walk step is an **ancestor** of the graded execution and earns λ^d.
   - Measured: **369/369** composed children found in 7d are `success:true`, untagged and `dispatcher_used:goal-host`, so they earned 0.
4. **`parent_execution_id` means three different things.** A lifecycle subscriber, a composed child and the walk's next step all carry the same parent id and the same chain form (demonstrated under `exec_pb3x8fa9`). The edge-derivation code at ingest cannot tell them apart.
5. **No existing door gives a runner an activity tool with an observation.**
   - `activity_execution` (goal-host `/resolve`) runs a whole pinned goal dispatch and returns **no content**.
   - The `activity` shape on activity-api is a stub that returns `{}`.
   - The walk's in-process `host.runTemplate` step is the only path that reads the child's outputs back.
6. **Writes and re-entry.**
   - **1,017/2,778** live templates contain an `fs_write` / `git_*` task.
   - The 10-01 containment (`a72918f`) checks write *shapes* at the two satisfier sites only. A template step passes no such gate.
   - 23 live templates re-enter goal-host.

**Recommendation.**
- The runner's activity tool **is a walk step**: the walk's existing step (d)+(e) code, extracted once and called from both places. It is not a new entry point, and not a nested `compose`.
  - The trace is a chain sibling: parent = the previous step, and its id is pushed onto `chainExecIds`.
  - So extraction sees a node with edges, and credit is the walk's credit.
- Before anything is offered as a tool, gate the offered set on three properties, each computed in code from the template: no write task, no re-entry, not an ancestor.
- Fix the `activity` resolver's losses (b) so the documented unified path is true one level down.
- Keep remote `activity_execution` as a tool **held**, under §9.0 and also because it returns no content.

---

## 1. Prior art (before any proposal)

### 1.1 What minibob did (behaviour)

| Mechanism | Where | What it did | What it lost |
|---|---|---|---|
| `runActivity` / `activity` LLM tools | `src/tools.ts:361-412`, handlers `:1236-1312` | Ran a template by id with variables. `runActivity` took impulse ids but folded them into `variables.impulse_refs` (with the comment "TODO: Proper impulse injection"). | Returned `JSON.stringify(result)` as text; no shaped output. |
| Default `onActivityExecute` in minibob's executor | `src/activity.ts:1434-1640` | **Cycle check** on `activityCallStack`; **depth cap 3**; **context isolation** (no inherited custom tools, only the variables passed); **budget propagation** (the nested cap is the parent's headroom, and the nested cost folds back via `recordExternalCost`); `parentActivityId` / `parentExecutionId`; then **`mcp.recordComposition`** with input/output impulse ids and shapes inferred from the child's tool calls. | Nothing structural. This was the most complete version of the idea. |
| `CompositionObserver.wrapConfig` | `src/composition-observer.ts:65-110` | Wrapped `onActivityExecute` to record parent → child start/finish/blocked events and per-child metrics. | In-process metrics only. |
| GoalImproviser `activity` tool ("macro tools") | `src/improviser.ts:155-240`, prompt `:980-1070` | Offered Thompson-suggested activities to the step loop and pre-loaded their templates. Every step recorded `expected_output_shape` and `actual_output_shape`. | Returned **task status lines, not content**. Set **no parent execution id**. Extraction (`:1340-1400`) wrote `tasks[{action: step.action}]`, so the step became `action:"activity"` **without the activity id**: the composed activity was inlined and lost as a node. |
| `ImproviserResolver` | `src/resolvers/improviser-resolver.ts` | Wrapped GoalImproviser with an `activityExecutor`. | **Dead at `677f8ff`.** `src/resolvers/index.ts` is imported nowhere, and nothing constructs the resolver. The standalone path runs `GoalProcessor`, not the improviser (`cli/processor.ts:905-980`). |

The spec `discovery-to-tools-bridge.md` was **not found** by `find` across `repos/` (including the minibob tree), and no improviser spec was found under `docs/specs` or minibob `docs/specs`. Stated as not found, not as absent.

### 1.2 What was ported, and its state today

| Item | Commit | State |
|---|---|---|
| `compose` (nested sub-activity) + budget | `e1edaeb` 05-15 | **Ported. Live code, unused by templates.** 0/3,978 templates carry `resolver:"compose"` (positive control: `http_fetch` on 2,461). |
| `activity` resolver ("minimal port of minibob activity-resolver.ts, 455 LOC") | `2c59a11` 05-21 | **Ported, lossy, and mostly skipped or failing** (§2.2). The port reads only `config.template` / `config.templateId`. `validator-dispatch.dispatch_validators` passes neither: it relied on minibob's `extractSelectedActivityId` (named in the template's own `notes`), which was not ported. So it fails 586/586 times its gate opens (7d). |
| Lifecycle subscriber + nested execution test | `ad6e275`, `6ac1b0f` 05-19 | **Live.** The contract test is structurally incompatible with `8f1343c`'s (05-30) fire-and-forget dispatch: its premise is that the child has run by the time the parent returns (test comment `:111-114`). Pull-sync confirmed it red at `4719cb4` and filed it on 09-30 (gap `failing-test-ias-executor-ts-test-nested-subscriber-dispatch-test-ts-gen-assert`, class2, `operator_hold`). **The test is wrong, not the source.** |
| Forward depth cap `maxCompositionDepth` (16) | `beb6351` 06-01 | **Live** on `compose` / activities-as-resolvers. |
| `compose_parallel` + `siblingGroupSize` credit averaging | `5010b84` 06-13 | **Live code, unused.** 0 templates. |
| Activities-as-resolvers + template-id cycle guard | `7ba0322` 06-21 | **Live. This is the path used.** |
| Placeholder provenance `consumedFromTaskIds` / `childActivityId` | `c366be6` 06-22 | **Live on the wire.** |
| development-vessel normaliser `resolver:"activity"\|"compose"` → the activity id | `3ba1c45` 06-22 | **Live** (`activity-create-variant.ts:492-514`). Its commit body is the last time this was attempted end to end: one authored composition moved `genuine_edges` 94 → 95. |

### 1.3 What was dropped, and why

- **`recordComposition`, minibob's explicit edge write, has no caller.** activity-api's own comment calls `POST /composition` / `activityComposition_write` "the sole edge writer [that] has no caller".
  - It was replaced by `deriveCompositionEdgeFromParent` at ingest (`execution-traces.ts:1790-1830`), which reads the child's `parent_execution_id`.
  - That keeps the edge but drops the impulse-flow fields minibob sent (input/output ids and shapes).
- **`child_execution_id` is dropped at the wire.**
  - The trace sink sends `child_activity_id` (`activity-api-trace-sink.ts:306`) but not `childExecutionId`.
  - The stored task on `exec_6xild8ov` confirms this.
  - SEAM_INVENTORY 08-21 (`:1072-1079`) flagged it, and it is still true.
  - So the parent → child link is recoverable only from the child's side.
- **No LLM-visible activity tool survived the port.**
  - llm-resolver's tools are shapes.
  - The floor's tools are the 5 hand-written `UNIVERSAL_READ_TOOLS` (agentic-floor A §1.1).
  - Nothing offers an activity.
- **Why it did not hold.**
  - minibob's version lived in a central executor that was retired whole.
  - The port took the deterministic resolver (template-to-template) but not the tool (LLM-to-template). The one consumer that would have exercised it, the improviser, was already dead.
  - Each later attempt (`7ba0322`, `3ba1c45`) fixed composition *between templates*, so the floor never had an activity tool to lose.

### 1.4 Gaps touching this area

| Gap | State | Bearing |
|---|---|---|
| `failing-test-ias-executor-ts-test-nested-subscriber-dispatch-…` | open, `operator_hold` | Reclassify: the test is wrong since `8f1343c`. Its proper replacement asserts the chain on the *eventual* child trace. |
| `reach-gap-activity-execution` | open, `falsifier:none` | The walk cannot reach `activity_execution` cold (the producer is `auto-bridge-activity_execution`). An `activity_execution` target is a symptom, not a need. |
| `precondition-rejection-activity:⟨auto-bridge-activity_execution⟩-2026-09-30` | open | The same bridge is pre-flight rejected: 1 ms, 0 tasks. |
| `gap-activityexecutionsummary` | closed (`walk_artifact`) | The walk asked for a producer of the `activity` resolver's summary shape. That shape is a resolver artefact, not a deliverable. |
| `gap-composition-edge-unlabeled-by-intent` | rejected (expired, "not evidence of repair") | Composition edges carry no step-source label (§4.2). |

---

## 2. Q1: the `compose` contract in ias-executor

### 2.1 The three nested-dispatch paths

| | `compose` | activities-as-resolvers | `activity` resolver |
|---|---|---|---|
| Trigger | `task.resolver === "compose"` + `subActivityId` (`engine.ts:691`) | the resolver id is not registered and `templateProvider.getTemplate(resolver)` returns a template (`:740-870`) | `task.resolver === "activity"` + `config.templateId` or an inline `config.template` (`resolvers/activity.ts`) |
| Template source | `runtime.templateProvider`: the in-memory catalogue first, then activity-api with a 60 s TTL cache (`hosts/goal-host.ts:181-230`) | same | same, via `context.templateProvider` |
| Depth cap | `compositionChain.length >= maxCompositionDepth ?? 16` throws `safety_breach` **before** the child starts (`:1615`) | same (it calls `dispatchCompose`) | `chain.length >= config.maxDepth ?? 10` returns an `activityExecutionError` impulse |
| Cycle guard | `compositionTemplateChain.includes(subActivityId)` → `safety_breach` (`:1625`) | same | **None.** No `compositionTemplateChain` is passed to the child (`activity.ts:100-115`). |
| Child inputs | the parent task's bound `inputImpulses` + accumulated variables + budget + tags | same | **variables only.** No impulses, no budget, no tags. |
| Child outputs back to the parent | `childTrace.outputImpulseIds` → `store.get`, re-stamped with `outputImpulseKey` per named slot; projected into `{{taskId}}` / `{{taskId_shape}}` | same (`:770-850`) | **one `activityExecutionSummary` memo**; the child's outputs are not returned |
| Linkage | child: `parentExecutionId = parent exec id`, `compositionChain = [...chain, parentExec]`; parent task: `childExecutionId`, `childActivityId` | same | child: same `parentExecutionId` / chain (with an optional override for backfill); parent task: **no `childActivityId`** |
| Failure | a child `failed` throws, and the parent task fails | same | caught, and turned into an `activityExecutionError` impulse with `degraded:true`. The engine's all-outputs-degraded check (`engine.ts:1033-1051`) then fails the task. |
| Cost | the child's `costUsd` is added to the parent | same | not added |
| Store retention | nested runs evict only their seeded inputs; outputs survive for the parent (`evictExecutionScope`, `:1529-1584`) | same | same |

`compose_parallel` (`:1688-1790`) is the breadth dual of `compose`:
- Each child shares the parent's chain.
- The join is tolerant: the task fails only if every sibling fails.
- `siblingGroupSize = k` is stamped on each child, so ancestor credit is divided by k.

### 2.2 Who invokes it (7d, retention permitting)

| Measure | Value | Denominator |
|---|---|---|
| Templates with a `compose` task | **0** | 3,978 with tasks (48 have `tasks = NONE`) |
| Templates with a `compose_parallel` task | **0** | same |
| Templates on the activities-as-resolvers path | **201** (194 live) | same; 46 tasks name a bare id, the rest the `activity:⟨…⟩` form; 25 tasks name 13 ids that do not exist |
| Templates with an `activity`-resolver task | **283** (252 live) | same |
| Parent traces with a `child_activity_id` task | **263** | 137,055 trace-content rows; by day 09-25 12, 09-26 14, 09-27 2, 09-28 48, 09-29 56, 09-30 100, 10-01 29 |
| Composed children (`auto-bridge-problem_detection` 162, `proposed_pattern_authored_http_response_json_extraction` 62, `concept-relevance-backfill-v2` 54, …) | **369** found | of 376 child tasks; all `success:true` |
| Traces containing an `activity`-resolver task | **60,404** | 137,055 |
| … with that task **skipped** by its conditional gate (`status:"skipped"`, `success:true`) | **59,693** | 60,404 |
| … with that task actually run | **641** | 60,404 |
| `dispatch_validators` runs that failed | **586/586** | all runs of that task |
| `dispatch_audit` / `dispatch_debug` (audit-then-debug-tests) runs | 35 + 35 succeeded, 12 `dispatch_audit` failed | — |
| Earlier 6 h sample | 1,340: `dispatch_validators` 1,121 + `escalate_unbindable` 219, all `output_shapes: []` (skips) | 1,340 |

So the composing that actually happens is mostly `auto-bridge-*` / `compose-auto-bridge-*` templates (D: autonomous self-maintenance). The `activity` resolver is a lifecycle-subscriber organ, and in practice:
- **Skipped 99%.** 59,693/60,404 of the traces carrying it record a skipped task with `success:true`.
- **Validator dispatch is dead.** In a 30-parent sample of the 641 runs, the children found by `parent_execution_id` were `audit-test-report` and `debug-failing-audit` (8 each, from the audit-then-debug template), plus subscriber and walk rows. **No validator children** were found.
- **This is the 08-21 class.** A skipped task records `success:true`, so a template whose central step never runs grades as green.

---

## 3. Q2: how a runner step can execute an activity today

| Door | What it does | Observation returned | Verdict |
|---|---|---|---|
| **Walk step (d)+(e)**: goal-host `index.ts:10855-10911` (single pick) and `:10489-10500` (the horizontal bundle) | `getTemplateLocalFirst(id)` → `host.runTemplate(template, poolVars(), {impulses: poolImpulses, parentExecutionId: lastExecId, compositionChain: chainExecIds, tags, goalContext})`. It pushes `trace.id` to `chainExecIds`, then reads each successful task's `outputImpulseIds` from the shared store into the pool. It runs `ledgerStep` and `recordStep`. | **Yes**: real content per produced shape (`addToPool`), falling back to stubs. | **The organ.** It already is "run activity X as the next step, seeded with the pool". |
| `activity_execution` shape: goal-host `/resolve` `:17351-17440` | `target_template_id` → `runGoalWithRecovery({firstTarget, callerPinned:true, maxAttempts:2})` → `host.runGoal(...)`: a whole dispatch with a reach judge, a rate breaker and the `__resolveInFlight` guard. | **No.** Returns `{executionId, status, selectedTemplateId, completionShapes, attempts, goalReachReason}`. | Unusable as a ReAct observation. **Held** by §9.0: goal-host `/resolve` is not among the authenticated routes, per REALIGNMENT §9.0; not re-verified here. Its recursion guard keys on `goalHashOf(goal ?? "")`, so all goal-less calls share one key. |
| `activity` shape: activity-api `impulses.ts:4071-4073` | `return {shape:'activity', body:{}}` | No | A stub, advertised in the registry. |
| `activity` resolver inside a template | §2.1 | A summary memo only | Lossy. It is the doc's named target path (§3.1). |
| `runGoal(targetTemplateId)` in-process | `hosts/goal-host.ts:760-1000` | The trace | A goal-level wrapper. Same objection as `activity_execution`. |

### 3.1 The doc expectation this collides with

IMPULSE_ACTIVITY_FOUNDATION.md "Unified Execution Path" (`:1126-1130`) says the **direction** is that goal- and `activity_template`-shaped pointers resolve through the activity resolver. Until then, "treat a new in-process execution entry point as a regression".

Two consequences for this track:
1. The runner must **not** add a third `host.runTemplate` call site. Reusing the walk's step function adds no entry point; it consolidates the two that exist (single pick and bundle) into one. When the unified path lands, that one function is the single place to switch.
2. The doc's "already demonstrated to work one level down" is **false for data**. The `activity` resolver drops outputs, impulses, tags, budget, the cycle chain and `childActivityId` (§2.1). That is a §5 doc-expectation row. The doc should say so, or the resolver should be fixed (P3).

### 3.2 The tool definition

The definition is generated from the activity row, not hand-written:
- `name`: `activity` (one universal tool, as minibob had);
- `activity_id`: an **enum of the ids offered this turn**, i.e. the candidates track 2's `activity_search` returned, after the P2 gate;
- `bindings`: `{<declared input shape>: <pool impulse id>}` for every entry in `activity.input_shapes`;
- `variables`: optional.

The description carries each offered activity's `description`, `input_shapes` → `output_shapes` and posterior. Of the 2,778 live templates:
- 1,978 have non-empty `input_shapes`;
- 2,778 have non-empty `output_shapes`;
- 139 are goal-only (`input_shapes = ['goal']`).

The required inputs are therefore known from data in most cases. A binding is checked deterministically: the impulse id must be in the pool, and its `metadata.shape` must equal the key. This mirrors llm-resolver `offeredToolNames` / `toolPointer` (`tool-dispatch.ts:13-26`), where the dispatcher, not the model, owns what runs.

---

## 4. Q3: what the trace must record, and how credit flows

### 4.1 Contract (cross-checked against agentic-floor C §7)

For each activity-as-tool step, the runner's record must carry:

| C §7 item | For an activity step | Comes free from the walk step? |
|---|---|---|
| 1 `tasks[]` one per step, `resolverId` re-executable | `resolverId = <activity id>`. It replays through activities-as-resolvers (`engine.ts:740`), and the ribosome keeps resolvers verbatim (rule 7). So the activity is preserved **as a node**, not inlined. | Yes. `buildCompositeTraceFromChain` sets `resolverId = chain[i]` (`:7005`). |
| 2 `inputShapes` / `outputShapes` | The bound input shapes; the **produced** shapes (from the child's successful tasks). | **No.** For a template step the builder writes `outputShapes: producedShapes.includes(templateId) ? … : []`, which is `[]` (`:7012-7016`). Track B's positional-edge defect (B2); cite it, don't redo it. |
| 3 real `input_impulse_ids` / `output_impulse_ids` | The pool ids bound, and the child's own output ids. | **No.** The walk re-mints outputs as `walk-<shape>-<n>` with `producedBy:"goal-host-walk"` (B §1). It needs track B's ledger. |
| 4 `resolved_config` | `{activity_id, bindings}` | No. |
| 6 `compositionChain` ≥ 2 | The step's own trace id pushed onto `chainExecIds`. | Yes. |
| 11 failed steps as tasks | A refused or failed tool call is a task with `success:false` and the reason. | Partly. The walk records a failure in `recordStep` but excludes and continues. |
| new: **step source** | A step-source tag on the step trace: `step_source:runner-tool` vs `walk-pick`. | No (§4.2). |

The rule this track adds: **a tool call is recorded as a chain sibling, not as a nested child.**
- Its trace's `parentExecutionId` = the previous step.
- Its id is appended to the chain.
- That is what the walk's step code already does.
- A nested `compose` under some "runner" execution would make it a descendant of the graded execution, and it would earn nothing (§4.3).

### 4.2 `parent_execution_id` means three relations

Under one parent, `exec_pb3x8fa9` (10-01), the store holds:
- `slot-binding`, chain `[pb3x]`: a **lifecycle subscriber**;
- `auto-bridge-problem_detection`, chain `[w622, pb3x]`: a **composed child** (the parent task carries `child_activity_id`);
- `walk-satisfier-1-…`, chain `[w622, pb3x]`: the **next walk step**.

Over the 263 parents (7d), 364 non-composed rows share parent ids with the 369 composed children. `deriveCompositionEdgeFromParent` writes the same producer → consumer edge for all three relations; `activity_composition_graph` holds 15,344 rows. Two consequences:
- An extractor or edge reader cannot tell "A called B" from "B ran after A" or from "B was triggered by A's lifecycle event".
- Whatever the runner adds will be indistinguishable too, unless the relation is stamped.

The cheapest carrier is the tag set the walk already stamps (`satellite:non_terminal`, `satisfier_shape:<s>`): add `step_source:<walk-pick|runner-tool|compose-child|subscriber>`. It needs no new field. The rejected `gap-composition-edge-unlabeled-by-intent` is the same need.

### 4.3 Credit: being used as a tool is not the same as being picked

The code (activity-api `posterior-update.ts`, `reach-classify.ts`):
- `classifyReach` checks, in order:
  - `reached:true` → α;
  - `telemetry:` / `declined:` → ungraded;
  - `reached:false` → β;
  - satisfier satellite → ungraded;
  - **`dispatcher_used:goal-host` with no reach tag → ungraded, whether it succeeded or failed**;
  - otherwise, an untagged failure → β and an untagged success → ungraded.
- An ungraded row gets {0,0}. The one exception is `failedByTask`: `success:false` with `failure_count > 0` or `task_count === 0` gives β to the row itself.
- Chain propagation is gated on `!ungraded` (`posterior-update.ts:1379`).
- The walk posts one reach verdict, for `record.executionId` (the final or composite trace) (`deliverReachVerdict`, goal-host `:1139`, `:16846`).
- `propagateCreditAlongChain` (`:763-890`) walks **up** `composition_chain` from that graded leaf with weight λ^d, up to depth 4, divided by `siblingGroupSize`. It never walks down.

Therefore, for executions under a goal-host dispatch (every composed child inherits `dispatcher_used:goal-host`, as do all rows under `exec_pb3x8fa9`):

| Role | On success | On failure |
|---|---|---|
| Walk-picked step k, an ancestor of the graded execution | α·λ^d (d = distance to the leaf; 0 beyond 4) | β·λ^d |
| The graded execution itself | α | β |
| **Nested child** (`compose`, activities-as-resolvers, `activity` resolver) | **0** | β to the child itself only via `failedByTask` (unverified whether ingest rows carry those counts); **nothing to ancestors** |

The nested-child row is conditional on the tags. A child under a non-goal-host dispatcher (e.g. light-dispatch, no `dispatcher_used:goal-host`) falls to the last branch: an untagged failure is β, and it does propagate to ancestors.

- **Measured:** 369/369 composed children (7d) are `success:true` and untagged, so their posterior moved by 0.
- **Positive control** that a reach tag does land on step rows: under the same parent, `walk-satisfier-1-1790813215602` carries `reached:false`.
- Under goal-host, nesting is credit-inert in both directions: a tool called as a nested child is never graded for what it contributed. The REALIGNMENT §2.2 "verdict reaches credit through one reader" item is where a downward-credit rule would live. That is `posterior-update.ts`, which is **excluded, so (a)**.
- Recording the tool call as a chain sibling (§4.1) gives it the walk's credit with no change to the credit code.

---

## 5. Q4: risks

| Risk | Evidence | What bounds it today | Gap |
|---|---|---|---|
| **Recursion through goal-host** | 09-26: one goal recursed about 2 h through `goal_execution` → `/resolve` (~66 walks/min, 588 shells/min, every LLM provider exhausted; `7f0425d`). **23 live templates** re-enter goal-host (18 by `:8210`/`/run-goal` URL, 5 by pointer or resolver). | `__resolveInFlight` per goal hash (only on `/resolve`). `withDispatchExecutionId` (`fa9ca77`), which makes the dispatch's id win on tool calls, so the floor-lineage guard can read it. **Neither sees a template task that re-enters by URL.** | An activity tool that may pick any of 2,778 ids reaches the 23 directly. |
| **Cycles** | The cycle guard exists only on `compose` / activities-as-resolvers. | A runner step is top-level, so its `compositionTemplateChain` is `[]`. | Pass the dispatch's template chain (the ids already run in this dispatch) as `compositionTemplateChain`, so A → … → A is refused. |
| **Depth** | Caps differ by path: 16 (`compose`), 10 (`activity` resolver), 3 (minibob). The lifecycle subscriber has its own cap (`c033b87`). | Per path. | One cap read from the existing `walkBudget` shape, not a fourth literal. |
| **Cost** | The walk passes **no `budget`** to `runTemplate`, although `ExecutionBudget{maxCostUsd, maxDurationMs, maxTaskCount}` exists and propagates to children. 2,468 template tasks are `llm_completion_dispatch`. | None per step. Only the dispatch-level spend breaker. | Pass the dispatch's remaining headroom as `budget` (minibob's "Option A"). |
| **An activity that writes** | **1,017/2,778** live templates contain an `fs_write`/`git_add`/`git_commit`/`git_push` task. `a72918f` (10-01) refuses `FS_WRITE_SHAPES` at the two satisfier sites (`:8354`, `:10036`). The template step (`:10867`) checks nothing. | Nothing at the template level. An LLM choosing an id would bypass the containment that just landed. | Offer only templates with no write task (P2). |
| **Untraced or uncredited work** | Children of an `activity`-resolver call carry no `childActivityId`, so no edge is reconciled from the parent's side. Composed children under goal-host are credit-inert (§4.3). A skipped central task grades green (§2.2). | — | P3, P4. |
| **§9.0** | In process: `host.runTemplate` on a template the walk could already pick adds **no new address and no new writable route**. Remote: offering `activity_execution` makes goal-host `/resolve` reachable on the model's choice. That route is unauthenticated per REALIGNMENT §9.0 ("only discovery and activity-api authenticate"); not re-verified here. | — | In-process allowed. Remote **held**. |

---

## 6. Proposals

Builder labels follow the live `autonomyScope`:
- goal-host `index.ts` and activity-api `posterior-update.ts` are excluded, so (a);
- ias-executor, the trace sink, activity-api routes, development-vessel `llm-completion-dispatch.ts` and other goal-host files are (b) with a class2 falsifier.

Each item is one landing (law 12).

### P1 — one walk-step function; the runner's activity tool calls it (a + b)
- **Seam.** Extract goal-host `index.ts:10855-10911` (fetch → `runTemplate` → push chain → merge outputs → `ledgerStep` → `recordStep`) into one function. The bundle at `:10489` calls the same inner run.
  - It can live in a new goal-host module (`walk-step.ts`, b), with the call sites in `index.ts` (a).
  - Consumers: the walk's single pick, the walk's bundle, and the runner's `activity` tool. That is two existing callers plus the new one, not a file written just to exist.
- **Gate (in code).** The `activity_id` must be in this turn's offered set; otherwise refuse with the reason, recorded as a `success:false` task.
- **Trace.** A chain sibling, with `step_source:runner-tool`, plus the C §7 fields in §4.1.
- **Verification.**
  - Positive: a runner turn that calls an offered read-only activity yields a step trace whose `parent_execution_id` = the previous step and whose id is in the final chain. Its output content is in the next turn's observation.
  - Must-fail: an un-offered id is refused, and no `execution` row is created for it.
  - Count control: in-process entry points before and after = 2 (`runTemplate` in the walk step and the bundle). The doc's "new entry point is a regression" holds.
- **Status.** New as wiring. It is the agentic-floor APPROACH step 5 "goal-host executes each call" applied to the activity tool, and is gated on that step's parity battery.

### P2 — the offered-set gate: no write, no re-entry, not an ancestor (b)
- **Seam.** A pure function over an `activity` row, computed in code from `tasks[].resolver` / `config`. It sits in activity-api's `activity_search` handler as a filter field (`impulses.ts:4075+`, b), or in the P1 module.
  - It excludes templates whose tasks write (`FS_WRITE_SHAPES` ∪ `git_*` resolvers ∪ any `*_write` shape) or re-enter goal-host (`goal_execution`, `activity_execution`, `goalDispatch*`, or a `:8210`/`/run-goal` URL).
  - It excludes any id already in the dispatch's template chain.
- **Verification.**
  - Must-fail: each of the 1,017 write-bearing templates and the 23 re-entering ones is absent from the offered set.
  - Positive: a known read-only producer, e.g. `auto-bridge-problem_detection`, is present.
  - Reuse: the same predicate is what `a72918f` should have applied to the template step (§5). File that as the sibling call site.
- **Status.** New predicate. The rule extends `a72918f` and the llm-resolver offered-set rule.

### P3 — make the `activity` resolver true to the doc (b, ias-executor)
- **Seam.** `resolvers/activity.ts:100-140`. Changes:
  - pass `compositionTemplateChain`, `tags`, `budget` and the bound input `impulses` to the child;
  - return the child's output impulses (`trace.outputImpulseIds` → `store.get`), with the summary added alongside, not instead;
  - have the engine stamp `childActivityId` / `childExecutionId` on the task record for this resolver as it does for `compose` (`engine.ts:1297-1299`);
  - send `child_execution_id` from the sink (`activity-api-trace-sink.ts:306`, b) and land it in `normalizePersistedTask` (activity-api route, b).
- **Verification.**
  - Positive: a non-skipped `dispatch_audit` task shows the child's real output shapes (not only `activityExecutionSummary`) and a `child_activity_id`.
  - Must-fail: an A → A template via the `activity` resolver is refused by the cycle guard, where today it is only depth-capped at 10.
  - Watch: the 641 non-skipped runs per 7d, not the 60,404 skips. `audit-then-debug-tests` (`dispatch_audit` / `dispatch_debug`) is the live consumer whose behaviour changes.
- **Separately, validator dispatch.** `dispatch_validators` fails 586/586 because it names no `templateId`. Either port `extractSelectedActivityId` (read `select_validator_per_shape_result.activity_id` into `templateId`, ias-executor template, b), or retire validator-dispatch as a fossil (§4 of REALIGNMENT).
  - Must-fail control: today's 586/586.
  - Positive control: one validator child whose `parent_execution_id` = a `validator-dispatch` run.
- **Status.** Not in REALIGNMENT. It is the precondition the doc's "Unified Execution Path" assumes.

### P4 — stamp the relation; leave credit as is (b now, (a) only if a downward rule is wanted)
- **Seam.** The step-source tag (§4.2):
  - ias-executor `dispatchCompose` / the `activity` resolver stamp `step_source:compose-child`;
  - the lifecycle dispatcher (`hosts/goal-host.ts:589-625`) stamps `step_source:subscriber`;
  - P1 stamps `step_source:runner-tool` or `walk-pick` ((a) for the `index.ts` half).
  - `deriveCompositionEdgeFromParent` (activity-api route, b) copies it onto the edge as `edge_kind`.
- **Verification.**
  - Positive: under one parent, three rows with three distinct `step_source` values, as under `exec_pb3x8fa9`.
  - Must-fail: an edge written without a `step_source` is counted by a §2.1 evaluator row, not silently accepted.
- **Credit.** No change is proposed. P1 makes tool use earn as a chain sibling. Whether nested children should earn α when the graded ancestor reaches is a decision (§8). It is `posterior-update.ts`, so (a).

### P5 — fix the red contract test (b)
- **Seam.** `test/nested-subscriber-dispatch.test.ts:45-135`. Await the fire-and-forget dispatch (poll the sink for the child's `execution:succeeded`), then assert the same chain.
- **Verification.** The test is red at HEAD and green after. A mutant that drops `parentExecutionId` from the dispatcher turns it red again.
- **Gap action.** The gap's `operator_hold` should be released with "test premise stale since `8f1343c`".

### Held
- **`activity_execution` as a runner tool.** Held by §9.0 (an unauthenticated route on the model's choice). It is independently useless, because it returns no content. Any revival first needs P1's in-process step to have shown parity.
- **The activity-api `activity` stub** (`impulses.ts:4071`). Retire the advertisement or give it the `activity_search` body. That is a decision for track 2 (search), not here.

---

## 7. Proposed REALIGNMENT amendments

1. **§2.0b output chaining: add the precondition.** A step's relation (pick / tool / child / subscriber) is recorded, because `parent_execution_id` carries all three today (§4.2).
2. **§2.2: tool use and nesting earn differently.** Under a goal-host dispatch a nested child is credit-inert: it gets 0 on success, and on failure at most self-β, with no ancestor blame. 369/369 composed children (7d) earned 0. Only chain siblings are credited.
3. **§5 doc-expectation row.** IMPULSE_ACTIVITY_FOUNDATION `:1130` "demonstrated to work one level down" is true for linkage and false for data (§3.1).
4. **§9.0 containment: the sibling call site.** `a72918f` covers the satisfier sites, not template steps. 1,017 live templates write.

## 8. Decisions needed (the user's)

1. **Downward credit.** Should a nested child earn α when its graded ancestor reaches (a, `posterior-update.ts`)? Or is "tools are chain siblings" (P1) the only way tool use earns?
2. **The `activity` resolver's role.** Fix it as the unified path (P3)? Or retire it in favour of activities-as-resolvers, which already carries outputs, and rewrite `validator-dispatch` / `slot-binding` to use that path?
3. **Offering write-bearing activities at all**, after §9.0 and with the edit-intent lane's write grant, or never from a runner.

## 9. Verification status

- Every proposal is specified, not run.
- Measured directly:
  - the template census (3,978 rows with tasks);
  - the 7d `child_activity_id` parents (263) and their children (369 composed, 364 other);
  - the 7d `activity`-resolver split: 59,693 skipped, 641 run, `dispatch_validators` 586/586 failed;
  - write-bearing (1,017) and re-entering (23) live templates;
  - the `exec_pb3x8fa9` three-relation example.
- Code-derived, not measured: the credit table (§4.3). The 369 untagged successes are the measurement of its success row. The failure row, and whether ingest rows carry `failure_count` / `task_count` for `failedByTask`, were not sampled.
- Validator children: none were found in a 30-parent sample. "None exist" is inferred from the missing `templateId`, not from a full count.
