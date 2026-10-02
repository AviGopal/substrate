# 1 — How the ribosome reads a trace, and the renderer it needs

2026-10-02. Read-only. No goals were dispatched, nothing was written, and no unit was restarted. Live
reads only: SurrealDB `SELECT`s, `executionTraceWithSignatures` resolves (a read shape) against
activity-api on `127.0.0.1:8080` inside the container, journals, and live source under `/vessels/*/src`.

**Windows used throughout.**
- **Pre-fix:** 2026-09-26T00Z until the `784a162` landing at 2026-09-29T16:27Z.
- **Post-fix:** from that landing to about 2026-10-02T09:40Z.
- **Journals:** goal-host and ribosome-vessel both begin at 2026-09-26T16:26Z.

**Source versions.**
- The live goal-host `src/index.ts` is newer than the operator checkout. It has `stepEdges` (agentic-floor
  B2), and every goal-host line number below is from the live file.
- ribosome-vessel, the `ribosome-extract.json` template and activity-api's
  `execution-trace-with-signatures.ts` are byte-identical between the live copy and the checkout.

---

## 0. Summary

- **Where the 2→1 collapse happens (agentic-floor C §3.3 and §9 left this open).** The trace read is
  correct and the LLM is not the root cause. The collapse happens in the **executor's slot resolution**:
  - goal-host runs every `ribosome-extract` in one process-wide `ImpulseStore`;
  - `{{impulse:trace_signature}}` resolves to the first impulse in that store carrying the key;
  - any top-level execution that completes evicts every other run's impulses.

  The three collapse cases all had the composite's own terminal satisfier being extracted at the same
  moment (3 of 3). Both runs' validate prompts carry the same cross-contaminated proposal.
- **Concurrency is the normal case.**
  - **Overlap:** 165 of 260 post-fix runs overlap another extraction.
  - **Borrowed ids:** at least 47 of 239 proposal ids belong to a concurrent extraction.
  - **Empty slot:** 11 of 247 synthesis prompts received the literal unresolved `{{impulse:trace_signature}}`.
    The model then invented the body (`resolver_used_in_trace`, `shellResultProcessor`).
- **The fields that must be deterministic are left to the LLM, and it gets them wrong.** 62 of 239 proposal
  ids break the slug rule. The minted rows carry 0 edges: 0 of 2,080 tasks across 528 `learned-*` rows have
  `dependencies` or `inputImpulses`.
- **The rendered input is lossy before the LLM sees it.**
  - **Absent:** the goal text, the reach reason, step content, error text and edges.
  - **Dropped by the read:** the persisted `consumed_from_task_ids` and `tool_calls`.
  - **Config:** only 67 of 301 source tasks carry their arguments.
  - **The input itself is not kept:** the executor cuts each recorded string to 600 characters, so what the
    extractor was shown cannot be recovered afterwards.
- **The proposal.** goal-host already holds the full trace, edges included, in memory at `mintReachedTrace`.
  - A **deterministic template projection** of that trace should produce the template's structure.
  - The LLM keeps only `name`, `description` and the choice of which literals become variables.
  - The `activityTemplate_write` handler refuses any proposal whose structure differs from the source trace.
  - Most of this extends plan items V4, V5 and C3. Execution-scoped slots in the executor are **new**.

---

## 1. Prior art (what happened last time)

| Era | What was built | What held / why not |
|---|---|---|
| ≤04-27, minibob | `assembleTemplateFromExecution` (`deployment/vessels/minibob/src/template-generator.ts:400`). It was deterministic code: one task per executed task, `config: resolver.config` verbatim, `inputImpulses`, `outputImpulses: task-N-output`, and **`dependencies: [task-(i-1)]`** | Removed 04-27. `ribosome-extract.json`'s `synthesize_template` note says it "mirrors `assembleTemplateFromExecution`", but **it is an LLM**. The port dropped two things: the determinism, and the (linear) dependency edges. |
| 04-04 → 04-27 | Improviser success extraction (`mb:87f101e`) | Registration failed until 04-14. On 04-14, 3 of 3 novel goals produced 3 templates, **each with 1 task**, and their reuse was never measured. It was removed 04-27 (template `metadata.supersedes`). Source: agentic-runner/5-history.md:91-94 and 158. |
| 04-27 → 06-30 / 08-03 | `ribosome-extract.json` with `applyExtraction` defaulting to false | **Off by default:** until 06-30 on goal-host and until 08-03 on ribosome-vessel (plan of record §3). |
| 06-25 → 07-14 | Deterministic id **by prompt rule** (`fdcd0ec`), store-contract fields (`26ce11f`), marker-token eligibility gate (`f174656`) | The id rule is a sentence in a prompt. §3.3 measures 62 of 239 violations. |
| 07-31 → 08-17 | **The five-layer `config:{}` saga.** Prompt "copy VERBATIM" (`0bbd488`), then the `{type}` shim in the read (`3ccc65f`), a backfill of 160 rows (`6ee45ea`), executor recording (`3b95072`, `5a5aa41`), the sink forward (`9518d4e`), redaction at the wire (`ff3df57`), persist and surface (`93029ad`), and prompt wording (`5030377`, `f71bb56`) | **Fields restored, structure not.** Each layer fixed one hop. Today 648 of 2,080 learned tasks still carry an empty or `{type}`-only config. The saga ended at "tell the LLM to copy", never "copy in code". |
| 08-13 → 08-21 | Per-task shapes preserved (`62acd51`). `impulses_by_id` hydrated from task shapes (`fc559be`). Composite inputShapes (`27cc619`). The store read-back fix `8676beb` | `8676beb` fixed the **sequential** case of the store-eviction class: the walk read its outputs from a store it had just cleared. It assumed one top-level execution at a time. §3.2 is the **concurrent** case of the same class. |
| 09-18 | The crystallization proof (memory `crystallization-mechanism-proven-end-to-end`) | It ran through the **reached-command cache** (deterministic, store-backed, keyed by goal_hash), **not** the ribosome. The one replay on record that works copies structure in code. |
| 09-22 → 09-29 | The extractor's input was severed. The legacy trace table was decommissioned and the point lookup missed every trace. Gap `severed-joint-ribosome-extraction` is still open. | Re-pointed by **substrate-authored** commits `c546ec9` (16:21Z) and `784a162` (16:27Z) in `execution-trace-with-signatures.ts`. Measured effect (§3.1): every pre-fix run skipped the LLM tasks, and every post-fix run reached them. Still "fix the address" (dossier composition-crystallization §3). No input contract was added. |
| 09-29 → 10-02 | agentic-floor C: "nodes not edges", the 2→1 collapse "unverified", proposal C3 (copy edges, code-side id, refusal gate) | Plan items V4 and V5 (agentic-runner APPROACH §4, `8bf102d5`). This track supplies the mechanism C left open. |

---

## 2. The input end to end

### 2.1 Triggers (two owners, one dead subscription)

1. **goal-host `mintReachedTrace`** (live `index.ts:7155`).
   - **Call sites (3):** `:11936` (last template trace), `:11994` (walk composite), `:14668` (selected
     template).
   - **Gates:**
     - grounded reach;
     - the unaccounted-landing defer;
     - `learned-` depth no greater than `extractionPolicy` (fallback 1);
     - the trivial skip: one task or fewer **and** `compositionChain` empty.
   - **Run:** `host.runGoal("extract reusable template from execution <id>", {targetTemplateId:"ribosome-extract", variables:{executionId, lifecycle, applyExtraction:true}})`, in-process.
2. **ribosome-vessel `onExecutionCompleted`** (`src/index.ts:287`).
   - **Trigger:** the WS `execution_completed` event.
   - **Gates:** `reached`, the durable task census (all tasks terminal and successful), the
     ribosome-prefix check, and the depth bound. There is **no trivial skip**.
   - **Run:** it POSTs goal-host `/run-goal` with the same target. **The payload it sends is poorer:**
     `outputShapes: []`, `goalSignature: null`, `templateAuthor: ""`, `depth: 0`, `impulseCount: 0`.
     Both owners end up running inside the **same goal-host process**.
3. **The `lifecycle:activity:postExecution` subscription** in the template is **dead**.
   - The only `postExecution` hits across `repos/*/src` are the template JSON itself and one workbench
     component.
   - Nothing in ias-executor or goal-host emits the event. This confirms dossier §6.

**Post-fix extractions by owner and source** (257 runs that reached `assess_quality`, of which 204 wrote):

| Owner | Source kind | Tasks in source | Runs | Written |
|---|---|---|---|---|
| ribosome-vessel | `walk-satisfier-*` | 1 | 128 | 109 |
| ribosome-vessel | `walk-composite-*` | 2–3 | 51 | 42 |
| goal-host | `walk-composite-*` | 2–3 | 50 | 30 |
| either | `exec_*` | 1–5 | 28 | 23 |

- **Single-satisfier mints.** goal-host's own rule (live `:11920`) says not to mint a single satisfier.
  ribosome-vessel mints 109 of them anyway, as `learned-satisfier-*` rows that each wrap one shape resolve.
  This is a law 3 duplicate of the shape's producer.
- **Every composite is extracted twice,** once by each owner, typically 5–15 s apart. That interval is where
  §3.2's cross-talk happens.

### 2.2 The read: `executionTraceWithSignatures`

The template's first task resolves it with `{execution_id, limit:1}`. The code is activity-api
`src/routes/execution-trace-with-signatures.ts`.

- **Lookup:** a point lookup `FROM type::thing("execution", $id)`. The tasks are grafted from
  `execution_trace_content` (the split write), and per-impulse signature hydration is skipped.
- **Projection (`extractTasks`, `:227-330`).** Each task is reduced to:
  - task id and index;
  - status;
  - started and completed times;
  - input and output impulse ids;
  - resolver;
  - `config`;
  - description;
  - input and output shapes.
- **Where `config` comes from:**
  1. `resolved_config` when the task has one;
  2. otherwise `{type: resolver}` for a shape-routed step;
  3. otherwise nothing, for the meta-resolvers.

### 2.3 What the persisted task carries, and what survives to the LLM

Census of the 204 post-fix **source** traces (301 tasks) in `execution_trace_content`:

| Field | Persisted (`normalizePersistedTask`) | Non-empty in the 301 source tasks | In the rendered signature | In the minted template |
|---|---|---|---|---|
| `resolver_id` / shapes / description / status | yes | 301 | yes | yes (when not cross-talked, §3.2) |
| `input_impulse_ids` / `output_impulse_ids` | yes | 99 / 297 | yes, as positional id lists | **no**. 0 of 2,080 tasks carry `inputImpulses` or `dependencies` |
| `consumed_from_task_ids` (placeholder provenance, an edge) | yes, when sent | **0** | **dropped** by `extractTasks` | no |
| `dependencies` | **not in the whitelist** | — | no | no |
| `resolved_config` | yes, if 4,000 characters or fewer serialized (dropped whole if over) | **67** (synthetic composite and satisfier steps never carry one) | yes, else the `{type}` shim | 648 of 2,080 tasks empty or `{type}`-only |
| declared config (with `{{placeholders}}`) | **not persisted** | — | no | no. Only the post-interpolation literal exists (§3.4) |
| `tool_calls`, `resolver_tier`, `success`, `cost_usd`, `duration_ms`, `child_activity_id` | yes | 301 (`tool_calls` key) | **dropped** | no |
| step content / output body | never (human-surface track 1: no store) | — | no | no |
| goal text | no. Only `lifecycle.goalSignature`, a hash, which is `null` on the ribosome-vessel path | — | no | the hash only |
| reach reason / judge verdict | no | — | no | no |
| per-task error text, failed steps | status only | — | status only | — |
| `impulses_by_id[output].shape` | — | — | **`null`** (see the defect below) | — |

**Defect: output shapes read `null` in `impulses_by_id`.**
- **Where:** `runExecutionTraceWithSignatures`, `:770-800`.
- **What goes wrong:** the code pre-fills every `row.output_impulses` id with
  `{pointer_type:null, shape:null}`. The task-shape fallback then fills only ids that are *not already
  present*, so it never fires for those outputs.
- **Live example:** `walk-satisfier-1-1790766882934` shows
  `"walk-vessel_health_report-8":{"shape":null}` for its output, while its inputs show their shapes.

### 2.4 A reconstructed rendered input

The case is `walk-composite-websearchresult-to-memorynote-write-1xbdet6`, a 2-task composite. Runs:
`exec_n45gd01i` (goal-host) and `exec_j8mzu9oz` (ribosome-vessel).

**The two lifecycle payloads** (`synthesize_template` prompt header):

| Field | goal-host | ribosome-vessel |
|---|---|---|
| templateId | `composition:websearchresult-to-memorynote-write` | `composition:websearchresult-to-memorynote-write` |
| taskCount | 2 | 2 |
| outputShapes | `["webSearchResult","memoryNote_write"]` | **`[]`** |
| goalSignature | `<goal_hash>` | **`null`** |
| templateAuthor | `""` | `""` |

**The TRACE SIGNATURE** (resolved today; it matches the prefix captured in the prompt):

```json
{"traces":[{"id":"walk-composite-websearchresult-to-memorynote-write-1xbdet6",
 "activity_id":"composition:websearchresult-to-memorynote-write","task_count":2,
 "composition_chain":["walk-satisfier-1-1790773795673","walk-satisfier-2-1790773799157"],
 "input_impulses":["walk-webSearchResult-3"],
 "output_impulses":["walk-webSearchResult-3","walk-memoryNote_write-4"],
 "impulses_by_id":{"walk-webSearchResult-3":{"shape":null},"walk-memoryNote_write-4":{"shape":null}},
 "tasks":[
  {"task_id":"compose-step-1","resolver":"webSearchResult","config":{"type":"webSearchResult"},
   "input_shapes":[],"output_shapes":["webSearchResult"],"input_impulse_ids":[],"output_impulse_ids":["walk-webSearchResult-3"]},
  {"task_id":"compose-step-2","resolver":"memoryNote_write","config":{"type":"memoryNote_write"},
   "input_shapes":["webSearchResult"],"output_shapes":["memoryNote_write"],
   "input_impulse_ids":["walk-webSearchResult-3"],"output_impulse_ids":["walk-memoryNote_write-4"]}]}]}
```

**What the input lacks:**
- the goal (only a hash, or `null`);
- the search query and what the note said;
- why the run reached;
- any configured argument for either step.

**What it does carry:** an explicit edge (`walk-webSearchResult-3` produced by step 1 and consumed by
step 2). That edge is the structure the extractor needs, and it is exactly what the template does not keep.

**The minted row** `learned-composition-websearchresult-to-memorynote-write` has **one** task:
`satisfier-resolve`, `"resolve memoryNote_write via connected vessel"`. That is the description string of a
*satisfier* trace (goal-host `:10069` / `:10705`), not of this composite. The next section shows how it got
there.

---

## 3. Measurements

### 3.1 The read: dead before the re-pointing, alive after

`ribosome-extract` executions: 848 since 09-26T00Z.
- **Origin:** 650 dispatched by ribosome-vessel, 198 in-process.
- **Cross-check:** two query forms gave 848. A third, `count() … WHERE a AND b GROUP ALL`, returned the
  **unfiltered** 145,341, so that form is a false-number trap.

**Task status vectors** from `execution_trace_content`:

| Window | Runs | `assess_quality` skipped (the trace slot lacked `"tasks"`) | Reached the LLM tasks | Full 7/7 (written) |
|---|---|---|---|---|
| Pre-fix (09-26 → 09-29T16:27Z) | 582 | **582 / 582** | 0 | 0 |
| Post-fix (→ 10-02T09:40Z) | 257 | **0 / 257** | 257 (11 on 09-29, then 120 / 76 / 50 per day) | 204 |

A further 9 runs failed at task 1, spread across both windows. The substrate-authored re-pointing restored the read completely. Everything below is about what happens
**after** a correct read.

### 3.2 Collapse: the executor's process-wide slot store

**The mechanism** (live `node_modules/@avigopal/ias-executor-ts/src`):
- **One store per process.** `GoalHost` builds one `ExecutionRuntime`, whose constructor builds one
  `ImpulseStore` (`runtime.ts:63`). Every `runGoal` in goal-host shares it, including both owners'
  extractions and every walk step.
- **First match wins, with no scoping.** `resolveImpulseSlot` (`engine.ts:355-375`) scans
  `this.runtime.store.all()` and returns the **first** impulse whose `metadata.outputImpulseKey === slot`.
  It falls back to the first by shape. Nothing filters by execution.
- **Completion evicts everyone else's impulses.** `evictExecutionScope` (`engine.ts:1525-1570`) runs when any
  top-level execution completes. It deletes **every** impulse in the store except that run's own outputs.
  A concurrent run's `trace_signature` and `extracted_template` vanish mid-chain.

**Evidence, post-fix window:**

| Observation | Count / case |
|---|---|
| Runs whose wall-clock span overlaps another `ribosome-extract` run (median duration 28 s) | **165 / 260**. This is a lower bound: walk steps also evict. |
| Composite-to-template collapses among the source→template pairs with retained source content | **3 / 3 had a concurrent extraction of the composite's own terminal satisfier**, 2–17 s apart |
| Example: `…-nzueoi` (3 tasks) became 1 task | Runs `exec_pqnsxtmz` (composite) and `exec_fnfo28kb` (`walk-satisfier-1-1790766882934`). **Both validate prompts carry the identical proposal:** id `learned-composition-activity-learned-…`, and input_shapes `[filePaths, llm_completion_result, problem_detection, httpResponse, json_extracted_value]`. Those are the satisfier trace's inputs, and the composite's signature has no task with them. |
| Example: `…-7inwqk` (2 tasks) became 1 task | Its satisfier `walk-satisfier-2-1790806657481` was extracted 6 s later, and both proposals carry the composition id |
| Example: `…-1xbdet6` (2 tasks) became 1 task | Three runs within 15 s: goal-host composite, ribosome-vessel composite, ribosome-vessel satisfier. All three proposals carry the composition id. |
| Proposal ids equal to the deterministic slug of a **different** source extracted within ±120 s | **≥ 47 / 239**. The usual pair is `learned-satisfier-memorynote-write` and `learned-composition-shellresult-to-memorynote-write`, swapped. |
| `synthesize_template` prompts containing the literal `{{impulse:trace_signature}}` (slot evicted between task 2 and task 3) | **11 / 247**. In each, `assess_quality`, one task earlier, did see the trace. |
| What the model writes when the slot is empty | `learned-satisfier-docs-align-tick` has tasks `[{resolver:"resolver_used_in_trace", inputShapes:["input_shape_from_trace"], config:{args:"values_from_trace"}}]`, an echo of the prompt's schema placeholders. `learned-composition-shellresult-to-memorynote-write` has the invented resolvers `shellResultProcessor` and `memoryNoteWrite` with `config:{}`. |

**Where the loss happens.**
- **Not the trace read.** The signature for each collapse case resolves correctly, with all tasks and the
  edge.
- **Not an LLM "decision".** The LLM was shown the wrong trace (or none). The fault is the executor binding
  the synthesis task's input slot across executions.
- **The write amplifies it.** The deterministic-id UPSERT is last-writer-wins: the cross-talked 1-task write
  overwrites a correct 2-task one, and `metadata.extracted_from` is overwritten with it.
- **This resolves the open item.** agentic-floor C §3.3 and §9 listed "where the 2→1 collapse happens" as
  unverified.

### 3.3 Fidelity of what was written

**Source→template pairs.** There are 33 pairs where the template's `extracted_from` source still has content.
The caveat is last-writer-wins, as above.

| Result | Pairs |
|---|---|
| Task count, resolvers and config all preserved (comparing config without `type`) | **26** (1→1: 18; 2→2: 6; 5→5: 2) |
| Collapse (cross-talk, §3.2) | 3 (2→1, 2→1, 3→1) |
| Invented resolvers (empty slot) | 2 |
| Config frozen to the ribosome's goal text (§3.4) | 2 |

**Id determinism.** Of 239 proposal ids:
- 130 match `learned-<slug(templateId)>`;
- at least 47 are cross-talk;
- 6 are case or underscore variants of the right slug, for example `learned-auto-bridge-uiPanel-write` and
  `learned-auto-bridge-uipanel-write`, two rows written from one execution (`exec_gdusu0cl`) 1 s apart;
- about 56 are other violations: the model does not truncate at 60 characters, mis-slugs
  `satisfier:substrateGap` as `learned-satisfier-substrategy`, or swaps prefixes.

Dossier root cause 5 (near-duplicates from the id rule) is this, measured.

**The whole `learned-*` store** (528 rows):

| Measure | Value |
|---|---|
| Rows with 0 tasks | 41 |
| Rows with 1 task | 56 |
| Rows with empty `input_shapes` | 132 |
| Tasks with `dependencies` or `inputImpulses` | **0 of 2,080** |

**Do they earn?** Since 09-26 there were 5,235 executions of 164 distinct `learned-*` ids.
- **Success:** 1,751 (33%).
- **Reach column:** `reached=true` 42, `false` 284, `null` 4,909. Most are ungraded, so the 42 is not a reach
  rate.
- **Counters:** every row's `total_executions` is 0. The activity-table counters are vestigial (memory,
  09-08).

### 3.4 Generalisation is destroyed twice

1. **The trace records only the post-interpolation literal** (`resolved_config`). The template therefore
   replays the instance. For example, `learned-activity-auto-bridge-code-quality` replays
   `filePath:"/vessels/local-tools-vessel/src/index.ts"`. That is no first-mile adaptation: the template
   cannot be bound to a different file.
2. **A placeholder that does survive is frozen by the extractor's own interpolation.**
   - **Source:** `exec_gdusu0cl`'s persisted config was `{"items":"{{goal}}"}`.
   - **Stored:** the template written from it holds
     `{"items":"extract reusable template from execution exec_gdusu0cl"}`. That is the ribosome run's own
     `variables.goal`, set by `GoalHost.runGoal`.
   - **Extent:** 7 tasks across 6 rows carry this string, and a learned-of-learned row propagates it
     (`exec_whbo0lhs` carries `exec_j141tzbj`'s string).
   - **Mechanism, inferred:** the executor interpolates `{{goal}}` inside the merged slot content on its way
     to `activityTemplate_write` (`pointerFromImpulseSlots`). To verify: test the interpolation pass over
     merged slot content.

### 3.5 The machine consumer's input is not auditable

**The extractor's prompt is not kept.** `redactResolvedConfig` (`ias-executor-ts engine.ts:55`) cuts every
string value to 600 characters, and redaction is applied again at the wire. So every recorded `prompt` reads
`…[+14 chars]`, about 612 characters. The trace-signature section and the proposal fall past the cut.

**Consequences:**
- What the LLM was actually given is reconstructable only by re-resolving the source trace, as §2.4 did. If
  retention has deleted the source, nothing is left.
- The synthesized proposal (`dev:llm_completion_dispatch_*`) is not persisted either, which is why
  agentic-floor C could not locate the collapse.

**Why the case was diagnosable at all:** the first 600 characters happened to include the proposal's `id`
and `input_shapes`.

---

## 4. The renderer the ribosome needs

### 4.1 The contrast with the human contract

The human-surface contract (human-surface-impulse-rendering track 3 §2.4) has six rules:
1. read by `(executionId, impulse_id)` and never re-run;
2. no scraping;
3. completeness stated on the content;
4. form by form, never by shape name;
5. provenance is the trace;
6. order comes from edges.

The ribosome breaks most of them at the machine grain:
- **(1) It re-reads over two hops,** then binds the result through a slot that can belong to another run.
- **(6) Edges** are in the input but not in the output.
- **(3) Completeness is never stated.** A config dropped at 4,000 characters, a `{type}` shim and an absent
  config all look alike.
- **The LLM's job is to re-describe structure** that already exists as data.

**The human renderer and the machine renderer differ in what they must preserve:**

| | Human renderer | Machine renderer for extraction |
|---|---|---|
| Unit | the impulse (content by reference) | the **step graph** (structure), with content as references |
| Must preserve | the answer, the evidence it consumed, and the verdict | nodes, edges, declared config and bindings, shapes, the answer role, and the need |
| May drop | log text | content bodies (a template replays the producer, not the output) |
| LLM role | none (forms are deterministic) | naming, description, and *proposing* which literals become variables |

### 4.2 What to render (a deterministic, canonical projection)

The projection is a function over **the in-memory `ExecutionTrace` that goal-host already holds** at
`mintReachedTrace`.
- **Why that source:** the composite comes from `buildCompositeTraceFromChain` with `stepEdges`
  (agentic-floor B2), and the template trace from `result.trace`.
- **Fallback:** the same function over `execution_trace_content` for the out-of-process path.
- **What it removes:** the round trip trace → DB → signature resolver → executor slot → LLM, which is where
  every loss in §3 happens.

```
TemplateProjection v1  (sorted keys, stable ids, no timestamps; hash = sha256 of the canonical JSON)
  source:   { executionId, templateId, reached:true, grounded:bool, goalSignature, need:[target shapes] }
  nodes[i]: { id: "step-<i>", resolver, tier,
              declared_config   (the template's config BEFORE interpolation, {{placeholders}} intact),
              bound_values      (placeholder → resolved literal, redacted, and
                                 completeness: full | truncated:N | absent),
              input_shapes, output_shapes, status }
  edges:    [{ from:"step-j", to:"step-i", shape, impulse_id }]
            from output_impulse_ids ∩ input_impulse_ids (and consumed_from_task_ids when present)
  answer:   step id(s) producing the reached target shape(s)
  boundary: input_shapes = ∪inputs − ∪(outputs of earlier steps)   (rule 9a, in code)
            output_shapes = shapes produced by a step on the path to the answer
  id:       learned-<slug(templateId)>   (code; one function shared by both owners)
```

**Deterministic code:**
- task list and order;
- `dependencies` (from `edges`; the engine runs tasks in array order and binds by shape, agentic-floor C
  §3.3, so the dependencies must be ones the engine reads);
- resolver;
- `declared_config` copied byte for byte;
- `input_shapes` and `output_shapes`;
- id;
- `metadata` (`extracted_from`, `goalSignature`, author, the projection hash).

**LLM, constrained to a patch over the projection:**
- `name` and `description`;
- tags;
- **variable proposals:** "`bound_values.filePath` should become a template variable `{{filePaths}}`".

The proposal is accepted only when it is a key of `bound_values` and the replacement is a declared input
shape or variable. The LLM can never add, drop or reorder a node.

**Existing organs to extend (law 3). No new service.**
- **`buildCompositeTraceFromChain` plus `StepEdge`** (live goal-host `:7027`, `walk-pool.ts:101`). These
  already carry real per-step input and output ids. The projection's edges are a join over them.
- **`normalizePersistedTask`, `extractTasks` and `runExecutionTraceWithSignatures`** (activity-api). Add
  `dependencies`, `consumed_from_task_ids` and `declared_config` to the persist whitelist, and stop dropping
  them in the read.
- **`activityTemplate_write`** (activity-api `routes/impulses.ts:2679`). It already stamps `goalSignature`
  deterministically and defaults `description` in code. That is the precedent for the refusal gate.
- **minibob `assembleTemplateFromExecution`.** The deterministic assembler that was ported away. Its task
  loop is the shape of the code-side builder.
- **`deriveSignatureShapes`** (`execution-traces.ts:165`). This is the signature tier rule. The projection's
  `boundary` should call it rather than re-derive it.

---

## 5. Asks to the coordinator (proposals, never edits)

**Builder classes.**
- **(a) operator bootstrap:** goal-host `src/index.ts`.
- **(b) dispatched goal:** everything else named here (ias-executor-ts engine and templates; activity-api
  routes).

### E1. Execution-scoped impulse slots in the executor (new)

- **Seam:** ias-executor-ts `engine.ts`:
  - `resolveImpulseSlot` (`:355`) and the config interpolation that uses it (`:521-530`);
  - `evictExecutionScope` (`:1525`);
  - the reap at execution entry (`:195-210`).
- **The change:** stamp every stored impulse with its owning `executionId`. Resolve slots only among the
  current execution's impulses (plus its ancestors' for nested runs). Evict only one's own impulses.
- **Gate:** a slot that does not resolve in scope fails the task loudly. It must not render the literal
  `{{impulse:…}}`.
- **Builder:** (b).
- **Verification:**
  - **Must-fail (today it passes):** two concurrent `runGoal("ribosome-extract")` calls on different
    executions → each `synthesize_template` prompt names its own execution id. A test fixture can replay
    `exec_pqnsxtmz` and `exec_fnfo28kb`.
  - **Must-fail:** run B completing mid-way through run A → A's next slot read still resolves.
  - **Positive:** 8676beb's `engine-output-readback.test.ts` stays green.
- **Prior art:** this is the concurrent half of `8676beb`. The class is wider than the ribosome. Every
  `{{impulse:}}` slot in any template run by goal-host is exposed. Gap
  `horizontal-bundle-pools-metadata-stubs-…` may share the root.

### E2. Retire the second owner's dispatch path, or make it share one gate (already in plan)

- **Already in:** dossier §6 and agentic-floor C §3.2, with gap
  `ribosome-extraction-subsumed-by-goalhost-mint-retire-decision`.
- **New evidence:**
  - 128 of 257 post-fix extractions are single-satisfier mints that goal-host's own rule refuses;
  - every composite is extracted twice, and the double extraction is the cross-talk's supply.
- **Builder:** (b) for ribosome-vessel.
- **Must-fail:** a reached `walk-satisfier-*` trace → no `ribosome-vessel-dispatch` run.

### E3. A deterministic projection, with the LLM limited to a patch (extends V5 / C3)

- **Seam:**
  - goal-host `mintReachedTrace` (live `:7155`) computes `TemplateProjection` from the in-memory trace and
    passes it as a variable;
  - `ribosome-extract.json` `synthesize_template` receives the projection and returns only
    `{name, description, tags, variables[]}`;
  - a code task merges the two.
- **Builders:** (a) for goal-host; (b) for the template.
- **Gate:** see E4.
- **Verification:**
  - **Positive:** `…-1xbdet6`'s trace → a 2-task template with `dependencies:["step-0"]` on step 1, and
    `input_shapes:[]`, `output_shapes:["memoryNote_write"]`.
  - **Must-fail:** a patch that adds a task or changes a resolver is refused.
- **Overlap:** C3's "code-side id" and "copy edges". **New:** the projection carries the declared config
  and bound values, and the LLM is restricted to a patch.

### E4. A refusal gate in `activityTemplate_write` for `author: ribosome-pattern` (extends C3)

- **Seam:** activity-api `routes/impulses.ts:2679`.
- **The check:** read `execution_trace_content` for `metadata.sourceExecutionId` and refuse the write when
  any of these holds:
  - `tasks.length` ≠ the source's successful task count;
  - any `resolver` ≠ the source task's resolver;
  - `id` ≠ `learned-<slug(sourceTemplateId)>`, computed with the same function as E3;
  - any config string contains the literal `extract reusable template from execution`, or an unresolved
    `{{impulse:`.
- **Builder:** (b).
- **Verification (must-fail, each from a live row):**
  - `…-7inwqk` (2 tasks) with a 1-task proposal;
  - `learned-satisfier-substrategy` against `satisfier:substrateGap`;
  - `learned-auto-bridge-uiPanel-write`, the second-case duplicate;
  - `learned-satisfier-docs-align-tick` (`resolver_used_in_trace`).
- **Positive:** the 26 faithful pairs of §3.3 still write.

### E5. Persist and read the structure the extractor needs (extends V4 / B1-B2)

- **Seam:**
  - `normalizePersistedTask`: add `dependencies` and `declared_config` (the pre-interpolation config,
    redacted) to the whitelist;
  - `extractTasks`: pass through `consumed_from_task_ids`, `dependencies` and `declared_config`;
  - `runExecutionTraceWithSignatures` `:770-800`: let the task-shape fallback overwrite placeholder `null`
    shapes.
  - On the executor side, record `declared_config` next to `resolved_config` where `3b95072` records the
    latter.
- **Builder:** (b).
- **Verification:**
  - **Positive:** `walk-satisfier-1-1790766882934` shows `shape:"vessel_health_report"` for its output.
  - **Must-fail:** a trace whose task carried `consumed_from_task_ids` reads back without it, which is
    today's behaviour.
  - Extend the key-agreement test `trace-key-agreement.test.ts` (`5c57ff9`, "every write key has a reader")
    to the new keys.

### E6. Stop interpolating inside copied template bodies (new)

- **Seam:** the executor's `pointerFromImpulseSlots` merge into `activityTemplate_write`.
- **The change:** treat slot content as opaque data, so no `{{…}}` expansion happens inside it.
- **Builder:** (b).
- **Verification:**
  - **Must-fail:** source config `{"items":"{{goal}}"}` must be stored as `{{goal}}`, which is today's
    `exec_gdusu0cl` failure.
  - **Positive:** the template's own pointer fields (`goalSignature: {{lifecycle.goalSignature}}`) still
    interpolate.

### E7. Make the machine consumer's input auditable (new; small)

- **Seam:** `ribosome-extract.json`: emit the projection hash and the synthesized proposal as a persisted
  impulse.
- **Alternative:** exempt `prompt` keys under 16 KB from the 600-character value cap for `ribosome-pattern`
  runs only.
- **Builder:** (b).
- **Verification:** for any written `learned-*` row, the input it was synthesized from can be read back by
  execution id, and its hash equals a recomputed projection of the source.
- **Why:** without this, the next defect of this class is unlocatable read-only, as C §9 found.

### E8. A detector for the class (law 6)

What detects this class without an operator: a **positive-control projection probe** on the
joint-liveness cadence.
- **What it does:** for each `learned-*` row written in the last day, recompute the projection from its
  source and compare node count, resolvers, edges and id.
- **When it fires:** a mismatch is the loud extractor failure that dossier §3 says is missing.
- **Where it belongs:** the `ribosome-extraction` binding of the joint-liveness detector (`70254535`), which
  today watches lag only, as the second mode the dossier asks for.
- **Builder:** (b).
- **Must-fail:** it fires on the three collapse rows and on `learned-satisfier-docs-align-tick`.

**Order:**
1. E1 (without it, any projection is still bound through a cross-talking slot).
2. E2 (it removes most of the concurrency).
3. E5 and E6.
4. E3 and E4 (V5/C3).
5. E7 and E8.

E3 and E4 sit inside the plan's slice acceptance "minted `learned-*` row carries `dependencies`". E1 is a
precondition that slice did not list.

---

## 6. Method and caveats

- **Pairing:** `extracted_from` pairs reflect the last writer only.
- **Overlap count:** derived from `executed_at − duration_ms`. It counts only `ribosome-extract` runs, not
  the walk steps that also evict.
- **Cross-talk count:**
  - it counts proposal ids equal to the slug of another source extracted within ±120 s, so it is a lower
    bound;
  - the "other" 56 include probable cross-talk outside that window, for example
    `satisfier:learned_topology_snapshot` → a composition id.
- **Proposal ids** were read from the first 600 characters of each `validate_proposal` prompt (§3.5).
- **SQL:** `SELECT * … LIMIT 1` first to learn field names, and no `ORDER BY` on large tables. The trap:
  `count() … WHERE a AND b GROUP ALL` on `execution` ignored the filter and returned 145,341. The correct
  848 was confirmed by `GROUP BY` and `array::len`.
- **Process listings:** none were used.
