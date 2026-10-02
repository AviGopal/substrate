# Prompt 32: Concept accumulation — storing knowledge about codebase, intent, and preferences

This prompt verifies that minibob uses concept-db to build a persistent knowledge base about the
system: architecture, intent, preferences, and patterns. Multiple concepts are written across
domains, and we verify they are retrievable by querying concept-db afterwards.

**What to verify:**
- Multiple concept writes succeed via vessel discovery → concept-db
- Concepts span multiple domains: architecture, preferences, patterns, lessons
- concept-db returns valid concept IDs for each write
- Written concepts are retrievable via `concept` or `relatedConcepts` shape queries
- Impulse relevance is updated for concept shapes after the run

---

You are building a persistent knowledge base about the metabob system. Your goal is to write
several meaningful concepts to concept-db and verify they are stored correctly.

## Step 1 — Write architecture concept

Use `load_impulse` with pointer:
```json
{
  "type": "concept_create_write",
  "conceptData": {
    "source_type": "extracted",
    "content": "The impulse-activity foundation defines three state types: instructional (vessel/template), transient (process-of-becoming, the execution in flight), and functional (the realized outcome). All learning flows from the transient state: traces capture what happened, Thompson Sampling ranks what to try next, and the ribosome extracts successful patterns into new templates.",
    "summary": "Three-state ontology: vessel → becoming → instance",
    "tags": ["architecture", "ontology", "learning-loop", "thompson-sampling"]
  }
}
```

Record the concept ID. If this fails, record the error and try the next steps anyway.

## Step 2 — Write a preference concept

Use `load_impulse` with pointer:
```json
{
  "type": "concept_create_write",
  "conceptData": {
    "source_type": "observed",
    "content": "When resolving impulses, always prefer the shortest resolution path. Local shapes (file, memo, directoryTree, gitDiff) resolve in-process. Discovery-vessel shapes use STEP 2.5 short-circuit for vesselCapability. All other shapes route through discovery → vessel HTTP call. Never hardcode vessel endpoints — always use the resolver contract fields from the discovery registry.",
    "summary": "Impulse resolution order: local → short-circuit → discovery → vessel HTTP",
    "tags": ["impulse-resolution", "preferences", "architecture", "discovery"]
  }
}
```

Record the concept ID.

## Step 3 — Write a lessons-learned concept

Use `load_impulse` with pointer:
```json
{
  "type": "concept_create_write",
  "conceptData": {
    "source_type": "observed",
    "content": "Thompson Sampling works best when variant families have sufficient execution history. α starts at 1 (prior), β starts at 1 (prior). After 10 executions with 8 successes: α=9, β=3, mean=0.75. A prior (sample_count=0) means the system is improvising — the LLM picks whatever seems reasonable, not what has worked before. Warm posteriors (sample_count > 20) are reliable selection signals.",
    "summary": "Thompson Sampling α/β interpretation guide",
    "tags": ["thompson-sampling", "learning", "statistics", "activity-selection"]
  }
}
```

Record the concept ID.

## Step 4 — Write a pattern concept

Use `load_impulse` with pointer:
```json
{
  "type": "concept_create_write",
  "conceptData": {
    "source_type": "extracted",
    "content": "The lifecycle hook pattern: slot-binding subscribes to lifecycle:task:preBinding events and selects the best available impulses for each task input slot. validator-dispatch subscribes to lifecycle:task:completed and runs validation rules against the task output. ribosome-extract subscribes to lifecycle:execution:succeeded and writes the successful execution as a new activity template. These three hooks close the learning loop automatically without explicit orchestration.",
    "summary": "Three lifecycle hooks that close the learning loop",
    "tags": ["lifecycle-hooks", "slot-binding", "validator-dispatch", "ribosome", "learning-loop"]
  }
}
```

Record the concept ID.

## Step 5 — Query back a concept to verify persistence

Use `load_impulse` with pointer:
```json
{
  "type": "concept",
  "conceptId": "<concept_id from Step 1>"
}
```

Verify the content matches what was written. Record whether the query succeeded.

If `concept` shape lookup is not supported, try `relatedConcepts` with a relevant tag.

## Step 6 — Write /workspace/concept-accumulation-report.md

Write a report with:

### Concepts Written
| step | concept_id | summary | tags | result |
|------|-----------|---------|------|--------|
| 1 | id | summary | tags | SUCCESS/FAIL |
| 2 | id | summary | tags | SUCCESS/FAIL |
| 3 | id | summary | tags | SUCCESS/FAIL |
| 4 | id | summary | tags | SUCCESS/FAIL |

### Concept Retrieval
- Concept ID queried: ...
- Retrieved successfully: YES/NO
- Content matched: YES/NO

### Vessel Route Used
For each concept write: did it route via discovery → concept-db, or fall back to MCP?

### Learning Value
Brief paragraph: what knowledge did we just persist that will help future executions?

## Acceptance criteria

1. `/workspace/concept-accumulation-report.md` exists with real concept IDs (not placeholders)
2. At least 3 of 4 concept writes succeed (real concept IDs returned, format `concept:*`)
3. `[Impulse] Resolved via vessel discovery` appears in stderr for `concept_create_write`
4. Step 5 retrieval attempt completes (success or documented failure)
5. No `[ERROR]` lines unrelated to expected auth/scope issues
