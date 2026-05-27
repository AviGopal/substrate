# Impulse-Relationship Learning: Signal Verification

Scope: proves that the three-hop pipeline that learns impulse-co-occurrence
relationships preserves signal from execution traces into concept-db edges.
Each hop already has unit tests; this doc walks through the composition and
points at the tests that lock the contracts down at each boundary.

Audience: a reviewer who wants to follow the data from a minibob trace all
the way to a weighted edge between two `impulse_signature` concepts, without
reading the whole codebase.

---

## 1. The chain

```
 [minibob]                 [activity-api]                [concept-db]
                                                        (this repo)

  ExecutedTask  --wire-->  execution_trace row   --read-->  hydrated trace
     |                        (SurrealDB)                         |
     | serialize                                                  | extract
     v                                                            v
  { input_impulse_ids[],    { tasks[].input_impulse_ids[],     CooccurrenceMatrix
    output_impulse_ids[] }    output_impulse_ids[],            { pairs:[
                              impulses_by_id: {                   { a, b,
                                id -> {pointer_type, shape}        success_count,
                              }}                                   a_before_b, ... }]}
                                                                  |
                                                                  | upsert +
                                                                  | EMA (α=0.2)
                                                                  v
                                                        concept_edge rows
                                                        (from,to,edge_type,weight,
                                                         times_traversed)
```

Canonical field names at each edge:

| Hop boundary                         | Load-bearing fields                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| minibob → activity-api (write)       | `tasks[].input_impulse_ids`, `tasks[].output_impulse_ids` (snake_case; camelCase accepted) |
| activity-api storage                 | `execution.trace.tasks[]` with per-task impulse arrays preserved                           |
| activity-api → minibob (read)        | `traces[].impulses_by_id: {id -> {pointer_type, shape}}`, per-task arrays                  |
| minibob extractor → concept-db       | `CooccurrenceStat { a, b, success_count, failure_count, a_before_b, b_before_a, total_tasks_observed }` |
| concept-db storage                   | `concept` (source_type='impulse_signature'), `concept_edge`                                |

---

## 2. A concrete worked example

Three signatures, three observed pairs. This is the scenario exercised by
`repos/concept-db/tests/cooccurrence-pipeline-integration.test.ts`.

| Signature | pointer_type | shape         |
| --------- | ------------ | ------------- |
| fileA     | `file`       | `source_code` |
| memoB     | `memo`       | `memo`        |
| gitDiffC  | `gitDiff`    | `gitDiff`     |

| Pair              | success | failure | a_before_b | b_before_a | total | expected handling                   |
| ----------------- | ------- | ------- | ---------- | ---------- | ----- | ----------------------------------- |
| fileA  ↔ memoB    | 5       | 1       | 4          | 0          | 6     | `sequence_next` edge, weight 5/6    |
| fileA  ↔ gitDiffC | 3       | 0       | 1          | 1          | 3     | `related_to` edge, weight 1.0       |
| memoB  ↔ gitDiffC | 2       | 0       | 2          | 0          | 2     | skipped (below `minCooccurrences=3`) |

### Hop 1: minibob serializes a task, activity-api writes it

**Input (in-memory `ExecutedTask`)**:
```
{ id: "t1", status: "success",
  inputState: { impulses: ["imp-file-1", "imp-memo-1"] },
  result: { metadata: { outputImpulses: [{ id: "imp-patch-1" }] } } }
```

**Expected wire output (minibob's `serializeTasksForTrace`)**:
```
{ task_id: "t1", status: "success",
  input_impulse_ids: ["imp-file-1", "imp-memo-1"],
  output_impulse_ids: ["imp-patch-1"], ... }
```

- Transform: `repos/minibob/src/mcp.ts:123` (`serializeTasksForTrace`)
- Test: `repos/minibob/test/mcp-serialize-tasks.test.ts:26` (`preserves per-task impulse grouping across two tasks`)
- Defensive read on activity-api side: `repos/metabob-activity-api/src/routes/execution-traces.ts:37` (`normalizePersistedTask`) — accepts snake_case, camelCase, and `inputState.impulses` fallback.

### Hop 2: activity-api hydrates a trace for the extractor

**Input** (stored `execution` row with flattened execution-level impulse lists plus per-task arrays — simplified):
```
{ id: "exec_1", success: true,
  input_impulses: ["imp-file-1","imp-memo-1"],
  output_impulses: ["imp-patch-1"],
  trace: { tasks: [{ task_id: "t1", status: "success",
                     input_impulse_ids: ["imp-file-1","imp-memo-1"],
                     output_impulse_ids: ["imp-patch-1"] }] } }
```

**Expected output (`executionTraceWithSignatures` hydrated trace)**:
```
{ id: "exec_1", status: "success",
  input_impulses: ["imp-file-1","imp-memo-1"],
  output_impulses: ["imp-patch-1"],
  impulses_by_id: {
    "imp-file-1":  { pointer_type: "file",    shape: "source_code" },
    "imp-memo-1":  { pointer_type: "memo",    shape: "memo" },
    "imp-patch-1": { pointer_type: "gitDiff", shape: "gitDiff" } },
  tasks: [{ task_id: "t1", task_index: 0, status: "success",
            input_impulse_ids: ["imp-file-1","imp-memo-1"],
            output_impulse_ids: ["imp-patch-1"] }] }
```

- Input validation: `repos/metabob-activity-api/src/routes/execution-trace-with-signatures.ts:132` (`parseInput`)
- Per-task extraction: `repos/metabob-activity-api/src/routes/execution-trace-with-signatures.ts:249` (`extractTasks`) — tolerates snake/camel and `inputState.impulses` historical shape
- Per-trace `impulses_by_id` assembly: `repos/metabob-activity-api/src/routes/execution-trace-with-signatures.ts:485-521`
- Test: `repos/metabob-activity-api/src/routes/execution-trace-with-signatures.test.ts:212` (`extracts per-task input/output impulse ids from inputState/outputState`) and `:269` (`hydrates impulses_by_id for every referenced impulse id`)

### Hop 3: minibob extractor builds a co-occurrence matrix

**Input** (`ExecutionTraceInput[]` — this is what the resolver normalizes to):
```
[
  { impulses_by_id: { /* as above */ },
    tasks: [{ id: "t1", status: "success",
              impulse_ids: ["imp-file-1","imp-memo-1","imp-patch-1"] }] },
  // ... more traces covering the 3 pairs
]
```

**Expected output (`CooccurrenceMatrix`, pair stats only):**
```
pairs: [
  { a:{pointer_type:"file",   shape:"source_code"},
    b:{pointer_type:"memo",   shape:"memo"},
    success_count:5, failure_count:1, a_before_b:4, b_before_a:0, total_tasks_observed:6 },
  { a:{pointer_type:"file",   shape:"source_code"},
    b:{pointer_type:"gitDiff",shape:"gitDiff"},
    success_count:3, failure_count:0, a_before_b:1, b_before_a:1, total_tasks_observed:3 },
  { a:{pointer_type:"memo",   shape:"memo"},
    b:{pointer_type:"gitDiff",shape:"gitDiff"},
    success_count:2, failure_count:0, a_before_b:2, b_before_a:0, total_tasks_observed:2 },
]
```

- Transform: `repos/minibob/src/impulse-cooccurrence.ts:170` (`extractCooccurrenceMatrix`)
- Hydrated-shape normalization: `repos/minibob/src/resolvers/impulse-cooccurrence-resolver.ts:68` (`normalizeHydratedTraces`)
- Test: `repos/minibob/src/impulse-cooccurrence.test.ts:79` (`hand-counted fixture: X+Y always together in success, X+Z never, Y before Z 7:1`)

### Hop 4: concept-db upserts concepts and edges with EMA

This is the hop covered by the new integration test. For each pair where
`success_count >= minCooccurrences` (default 3):

1. Upsert both endpoints as `impulse_signature` concepts (idempotent).
2. Compute `observed_weight = success_count / max(1, total_tasks_observed)`, clamped to `[0.01, 1.0]`.
3. Pick `edge_type = 'sequence_next'` iff `max(a_before_b, b_before_a) > 2 * min(...) AND max >= 2`; otherwise `related_to`.
4. `upsertEdge(...)` — creates on first observation, EMA on subsequent.

**Expected concept_edge rows after one run:**

| from           | to                  | edge_type       | weight | times_traversed |
| -------------- | ------------------- | --------------- | ------ | --------------- |
| fileA-concept  | memoB-concept       | `sequence_next` | 0.8333 | 1               |
| fileA-concept  | gitDiffC-concept    | `related_to`    | 1.0000 | 1               |

(The memoB ↔ gitDiffC pair is not represented — `success_count=2` is below threshold, so the template never invokes `upsertEdge` for it.)

- Signature upsert: `repos/concept-db/src/resolvers/concept.ts:387` (`upsertBySignature`)
- Edge upsert + EMA: `repos/concept-db/src/resolvers/edge.ts:106` (`upsertEdge`)
- Read-back: `repos/concept-db/src/resolvers/edge.ts:318` (`getImpulseCooccurrenceEdges`)
- Integration test: `repos/concept-db/tests/cooccurrence-pipeline-integration.test.ts`
- Per-primitive unit tests: `repos/concept-db/tests/impulse-signature.test.ts` (idempotency), `repos/concept-db/tests/edge-ema.test.ts` (EMA math)
- Route dispatch for `impulseSignatureConcept` / `impulseCooccurrenceEdges`: `repos/concept-db/src/routes/impulses.ts:238` and `:279`

The activity template that orchestrates all of this lives at
`templates/concept-learning/learn-impulse-relationships.json`. The rules for
edge_type choice and observed_weight computation are encoded inline in the
prompt of its `upsert-signature-concepts-and-base-edges` task; the
integration test duplicates those rules as plain-TypeScript helpers so drift
between the template and concept-db would fail the test.

---

## 3. EMA math, worked

Each call to `upsertEdge` on an existing `(from, to, edge_type)` tuple blends
the observed weight into the stored weight using an exponential moving
average with α = `EDGE_WEIGHT_EMA_ALPHA = 0.2` (`repos/concept-db/src/resolvers/edge.ts:19`):

```
new_weight = (1 - α) * old_weight + α * observed_weight
           = 0.8 * old_weight + 0.2 * observed_weight
```

`times_traversed` increments by 1 on every call, regardless of observation.

Worked example (from the pipeline integration test, step (d)):

- Round 1: `fileA ↔ memoB`, `observed = 5/6 ≈ 0.8333`.
  - Edge did not exist → created. `new_weight = 0.8333`. `times_traversed = 1`.
- Round 2: same pair, `observed = min(1.0, 0.8333 * 1.5) = 1.0`.
  - Edge exists → EMA. `new_weight = 0.8 * 0.8333 + 0.2 * 1.0 ≈ 0.8667`. `times_traversed = 2`.

Locked down by `repos/concept-db/tests/edge-ema.test.ts:123` (`applies EMA on second call: 0.3 -> 0.42 for observed=0.9`).

Convergence properties (not re-tested here, but worth stating): repeated
observations at a constant `observed_weight` converge exponentially to that
value with half-life `ln(2) / ln(1/(1-α)) ≈ 3.1` observations. This means a
single anomalous observation can swing the stored weight by at most α = 0.2
from its running value — noise-robust without being stale-biased.

---

## 4. Known limitations

What this verification does NOT cover:

- **No live SurrealDB.** All three concept-db primitives are exercised
  through an in-memory SQL spy. Schema drift between `sql/core/*.surql` and
  the TypeScript query strings would not be caught here — only integration
  against a running cluster catches that.
- **No live activity-api.** The persistence round-trip (write → SurrealDB →
  read) is covered by per-repo tests but not as a single sequence against a
  real service. A real service harness (docker-compose spinning up
  SurrealDB + activity-api + concept-db) would be needed to catch
  serialization bugs that both sides mirror.
- **No cross-repo imports.** The integration test duplicates the
  `Signature` / `CooccurrenceStat` structural types from minibob rather than
  importing them across the workspace. If the extractor's output type
  changes, the integration test won't fail until the types are updated here.
- **No activity-template harness.** The activity-template-encoded rules for
  edge-type choice and observed-weight computation are duplicated as plain
  TypeScript helpers in the integration test. If the template's prompt
  drifts, the test will pass but the live activity will produce different
  edges. A future verification activity could parse the template prompt and
  assert-by-extraction; out of scope here.
- **No LLM-refinement step.** The `classify-strong-edges-with-llm` ribosome
  task is inherently stochastic and not covered by unit or integration
  tests; it's validated by observing its effect on the live edge graph.

Fixing any of these requires a real service harness. That's a separate
effort — recommend layering it on top of this walkthrough rather than
rebuilding it.

---

## 5. How to extend

The natural next integration test is the LLM classifier task
(`classify-strong-edges-with-llm` in the activity template). That hop reads
edges via `impulseCooccurrenceEdges`, looks up each endpoint concept's
summary via `impulseSignatureConcept`, asks the LLM for a refined edge type,
and if confidence is above threshold issues a second `upsertEdge` that
overwrites the `edge_type` while preserving the running EMA weight. An
integration test for that hop would mock the LLM response, feed edges from
the current pipeline's output, and assert that (a) only above-threshold
edges get refined, (b) below-confidence refinements are dropped, and (c)
the EMA weight is preserved across edge-type overwrite. Add that test
alongside the current one and extend section 2 above with a fourth worked
example.
