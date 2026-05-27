# Concept Integration Templates

**Landed:** Super-repo commit `6bb1993` (2026-04-23)  
**Source:** `templates/concept/` directory  
**Vessel:** `repos/concept-db` (advertises shapes); activities call shapes through `POST /v2/impulses/resolve`

## Foundation alignment

The `concept`, `conceptGraph`, `relatedConcepts`, `conceptUsageStats`, and `conceptSequence` shapes are **owned by the concept-db vessel**. Concept-db is the system's text-formatted, labeled knowledge graph: it is the vessel that contributes the "context/concept" learning parameter to the decentralized learning loop. Other vessels (activity-api, the implicit Thompson Sampling vessel) contribute their own learning parameters independently — there is no central learning store. Treat anything below as a description of what concept-db chooses to advertise; templates consume those shapes through the standard `POST /v2/impulses/resolve` path that any vessel-owned shape uses.

> Note: the system's minimum self-stable set (Impulse, Pointer, Resolver, Vessel) is a working hypothesis. The concept shapes here are derived — `concept` is an impulse with a pointer of shape `concept` resolved by concept-db. They are not primitives.

## Overview

Concept-db advertises five impulse shapes that model reusable knowledge extracted from past executions:

- `concept` — A single reusable pattern, error signature, decision, or snippet with metadata (shape, relevance, creation date)
- `conceptGraph` — A subgraph rooted at a query concept with `N` hops and a minimum relevance threshold
- `relatedConcepts` — Related concepts with relevance scores (easier for prompt injection than the full graph)
- `conceptUsageStats` — How often a concept has been referenced vs. ignored (success rate, last-used date, load count)
- `conceptSequence` — A time-ordered list of concepts appearing in a goal's execution trace

Until commit `6bb1993`, no templates consumed these shapes — concept-db registered them and nothing asked for them. Three new templates close the loop, demonstrating the full impulse-driven cycle: extract → store → consume.

## Template 1: `prime-context-for-task` (tool, category)

**Location:** `templates/concept/prime-context-for-task.json`  
**Pattern:** Pre-execution enrichment via impulse resolution

### Idea

Before executing a development task, load concept-graph context and prepend it to the task prompt so the LLM reasons with prior learnings. Three concept-resolved impulses feed into the first task:

1. **`root-concept`** (pointer type `concept`) — Query concept-db for the root concept matching the goal description. Resolved via concept-db's `concept` shape with `resolve_by: summary_match`.
2. **`neighbors`** (pointer type `relatedConcepts`) — Two-hop subgraph from the root, minimum relevance 0.4, capped at 12 concepts. Resolved via concept-db's `relatedConcepts` shape.
3. **`root-usage`** (pointer type `conceptUsageStats`) — Usage statistics for the root concept over the last 30 days (success rate, load count, last-used date). Resolved via concept-db's `conceptUsageStats` shape.

All three impulses are declared at the template level (in the top-level `impulses[]` array) and marked `priority: high`, so the executor pre-resolves them before task execution begins.

### Tasks

**Task 1: `load-concept-context` (LLM)**

Takes the three resolved impulses and assembles them into a single markdown context block:

```markdown
## Root concept
[summary]

## Related concepts
- [concept A] (shape, relevance)
- [concept B] (shape, relevance)

## Usage stats
Success rate: X% | Loaded Y times | Last used [date]
```

Stores the result as a `memo` impulse with id `primed-context-{{goalDescription}}`. Output validation forbids raw JSON (`"pointer":` pattern) to ensure the block is human-readable.

**Task 2: `inject-into-task-prompt` (LLM)**

Depends on task 1. Takes the primed context and the user-supplied `taskPrompt`, prepends the context block, and executes the task with it as part of the prompt. The LLM is instructed to prefer patterns/decisions the context surfaces over inventing new approaches.

**Task 3: `record-relevance` (LLM)**

Depends on task 2. After execution, the LLM re-reads the two concept impulses (root + neighbors), inspects the output of task 2, and decides per concept:

- `helped` — Referenced in reasoning or a tool call
- `noise` — Present in context, never used
- `missing` — Would have helped but was absent

For each concept, POSTs to concept-db's usage-tracking endpoint with `outcome: "success" | "failure"` (mapping `helped` → success, `noise` → failure). This feeds the concept-db's learning loop: concepts that help more often increase in relevance.

### Key Design Points

- **Impulses at template level** — Following the Unified Impulse-Driven Architecture pattern (see CLAUDE.md §Unified Impulse-Driven Architecture), the top-level `impulses[]` array lets the executor pre-resolve shapes before any task runs. Executors that don't yet support this array ignore it gracefully; executors that do get lazy-loading for free.
- **Closed-loop feedback** — Task 3 closes the loop: contexts used feed usage stats that adjust relevance for the next run.
- **Schema coexistence** — This template uses camelCase field names (matching `demonstrate-activity-system.json`); the older `library-learning/generate-library-activities.json` uses snake_case. Schema unification is out of scope.

---

## Template 2: `extract-concepts-from-trace` (learning, category)

**Location:** `templates/concept/extract-concepts-from-trace.json`  
**Pattern:** Ribosome pattern applied to concepts

### Idea

The ribosome pattern (activities that create activities from executions) extends to concepts. Read a successful execution trace, propose reusable concept candidates, dedupe against the existing concept graph, and persist new concepts linked back to the trace.

### Impulses

**`source-trace`** (pointer type `activityExecutionTrace`) — The trace to extract concepts from. Includes state and tool calls for full context.

**`existing-neighborhood`** (pointer type `conceptGraph`) — A 2-hop subgraph rooted at the trace's topic, capped at 40 concepts. Used for deduplication.

### Tasks

**Task 1: `analyze-trace-for-concept-candidates` (LLM)**

Reads the trace and proposes 3–8 reusable concept candidates across four classes:

- `code_pattern` — A tool-call sequence or code structure that succeeded
- `error_signature` — An error shape and the fix that resolved it
- `decision` — A choice made with reasoning ("used X over Y because Z")
- `snippet` — A small reusable code block

For each candidate, outputs:

```json
{
  "summary": "one-sentence generalization",
  "shape": "code_pattern | error_signature | decision | snippet",
  "content": "1-3 sentences or code block",
  "source_trace_ref": "tool-call index or task-id inside the trace"
}
```

Stores the list as a `memo` impulse with id `candidates-{{traceId}}`. Does not POST to concept-db yet.

**Task 2: `dedupe-against-existing-graph` (LLM)**

For each candidate, computes similarity against every concept in the neighborhood impulse. If similarity ≥ 0.8, marks as `duplicate` and records the matched concept id. Otherwise marks as `novel`.

Overwrites the `candidates-{{traceId}}` impulse with the annotated list and prints: `novel=N duplicate=M`. Conservative heuristic: "when in doubt, mark novel. Better to create two related concepts than to drop a useful one."

**Task 3: `create-new-concepts` (LLM)**

POSTs each novel candidate to concept-db's `/concepts/from-source` endpoint with `source_type: "extracted"`. Collects the returned concept ids.

**Task 4: `link-concepts-to-trace` (LLM)**

Creates a `derived_from` edge from each new concept back to the source trace's id. Ensures the concept-db graph can navigate "which trace taught us this?".

### Key Design Points

- **Ribosome closure** — Completes the cycle: successful executions → concepts → consumable in future prompts.
- **Conservative deduplication** — Err on the side of creation to avoid knowledge loss.
- **Bidirectional links** — Concepts point back to their source traces for audit trails.

---

## Template 3: `link-concepts-for-composition` (learning, category)

**Location:** `templates/concept/link-concepts-for-composition.json`  
**Pattern:** Composition-graph to concept-graph projection

### Idea

Activity composition traces show which activities co-occur in successful chains. This template learns from those patterns: extract pairs of activities that co-occurred, let the LLM classify the relationship, and create edges in the concept-db graph.

### Impulses

**`compositionEdges`** (pointer type `compositionSuccess`) — Edges from the activity composition graph: pairs `(activity_A, activity_B)` that have co-occurred in successful chains, with success count and failure count.

**`existingConceptEdges`** (pointer type `conceptGraph`) — The current concept graph; used to avoid re-creating edges.

### Tasks

**Task 1: `propose-relationship-types` (LLM)**

Reads composition edges and proposes relationship types. For each edge (e.g., activity A followed activity B N times successfully):

- `prerequisite` — A must precede B
- `refinement` — B improves on A's output (e.g., "draft then review")
- `alternative` — A and B solve the same problem differently; co-occurrence is weak signal
- `unrelated` — Low co-occurrence; discard

Stores the list as a `memo` impulse with id `relationships-{{compositionWindow}}`.

**Task 2: `check-for-existing-edges` (LLM)**

For each proposed edge, checks impulse `existingConceptEdges` for a matching concept→concept edge. Avoids duplicate link creation.

**Task 3: `create-composition-edges` (LLM)**

POSTs novel edges to concept-db's edge-creation endpoint with `source_type: "composition"` so the graph can distinguish composition-derived edges from trace-derived edges.

### Key Design Points

- **Composition as learning signal** — Successful activity pairs reveal domain structure without explicit human labeling.
- **Edge attribution** — `source_type` field lets concept-db weight edges by their origin (composition vs. manual vs. extracted from traces).

---

## Unification: Unified Impulse-Driven Architecture

All three templates follow the pattern established in CLAUDE.md §Unified Impulse-Driven Architecture:

```json
{
  "id": "template-id",
  "impulses": [
    {
      "id": "impulse-id",
      "pointer": { "type": "shapeName", "...": "..." },
      "budget": N,
      "priority": "high|medium|low"
    }
  ],
  "tasks": [
    {
      "id": "task-id",
      "dependencies": [],
      "prompt": { "template": "...", "variables": [...] }
    }
  ]
}
```

Key properties:

- **Lazy loading** — Impulses are resolved before task execution; the executor loads them asynchronously and injects them into task prompts.
- **Forward compatible** — Executors that don't recognize the `impulses[]` array ignore it; executors that do get pre-resolved shapes for free.
- **No single-use queries** — Every impulse type is advertised by a vessel (concept-db, activity-api, etc.) and callable from any template.
- **Resource budgets** — Each impulse declares its budget (typically rows returned or bytes loaded). The executor respects budgets when loading.

---

## Sibling Concepts: Template-Dispatchable Resolvers

These templates complement the resolver-extraction work documented in [`TEMPLATE_DISPATCHABLE_RESOLVERS.md`](./TEMPLATE_DISPATCHABLE_RESOLVERS.md):

- **Resolvers** (extracted from `goal-processor.ts`) — Deterministic deciders callable from template JSON. Used for branching, filtering, and state tracking.
- **Concept shapes** (advertised by concept-db) — Universal data-access patterns. Used for enriching prompts with prior learnings.

Together, they demonstrate the three core patterns:

1. **Resolver dispatch** — Activities call named resolvers via `"resolver": "name"` in task JSON
2. **Impulse resolution** — Activities declare impulse needs at the template level; the executor pre-resolves them
3. **Closed-loop learning** — Concepts extracted from traces feed back into prompts; usage patterns refine relevance scores

---

## Related

- [`TEMPLATE_DISPATCHABLE_RESOLVERS.md`](./TEMPLATE_DISPATCHABLE_RESOLVERS.md) — Resolver extraction and registry pattern
- [`../architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](../architecture/IMPULSE_ACTIVITY_FOUNDATION.md) — Core impulse model
- [`ACTIVITY_TASK_CONTEXT_PROPAGATION.md`](./ACTIVITY_TASK_CONTEXT_PROPAGATION.md) — Impulse pool propagation and shape-aware selection
- [`../architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](../architecture/IMPULSE_ACTIVITY_FOUNDATION.md) — Extended template-level impulse declaration patterns and the unified impulse-driven architecture
- `repos/concept-db` (submodule) — Concept-db vessel and shape advertisement
