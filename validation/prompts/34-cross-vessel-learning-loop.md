# Prompt 34: Cross-vessel learning loop — full ecosystem validation

This prompt validates the complete learning ecosystem end-to-end. Minibob must exercise
discovery-vessel, activity-api, and concept-db together, proving that:
- Resolvers in other vessels get used (not just local resolution)
- Thompson posteriors are real (α > 1 for frequently-executed templates)
- Lifecycle hooks fire (slot-binding, validator-dispatch)
- concept-db stores codebase knowledge
- Activities run to improve other activities
- Impulse relevance scores update after each cross-vessel resolution

**What to verify:**
- `vesselCapability` and `vesselRegistry` shapes resolve through discovery-vessel
- `activityTemplateRecommendation` returns α > 1 for at least one template (real posterior)
- `activityExecutionTrace` retrieves real traces from activity-api
- `concept` and `conceptGraph` shapes resolve through concept-db
- `impulseRelevance_write` succeeds for at least 3 distinct shapes used
- Lifecycle hook lines appear in stderr
- `activityExecutionTrace_write` records the entire cycle as a new trace
- `activityTemplate_update` (or improved-template.json) shows a structural improvement

---

You are running a full cross-vessel ecosystem validation. You will exercise every
major vessel in the system and record what you learn.

## Step 1 — Discover the vessel ecosystem

Use `load_impulse` to get the full vessel registry:
```json
{"type": "vesselRegistry"}
```

From the response, record:
- How many vessels are registered
- Which vessels advertise which shapes (list at least 3 vessel→shape pairs)
- Whether activity-api, discovery-vessel, and concept-db are all present

Then use `load_impulse` to check your own vessel's capabilities:
```json
{"type": "vesselCapability", "vesselId": "activity-api"}
```

Record: which shapes activity-api advertises (list at least 5).

You MUST use `load_impulse` — do NOT use bash or curl for these.

## Step 2 — Get Thompson recommendations with real posteriors

Use `load_impulse`:
```json
{
  "type": "activityTemplateRecommendation",
  "goal": "analyse execution traces to identify improvement opportunities and update activity templates",
  "limit": 5
}
```

For each recommendation, record:
- template_id
- alpha (α)
- beta (β)
- sample_count

**Critical check**: Is any α > 1? If yes, the learning loop has real posteriors — record which
template and its α/β. If all are α=1 β=1 sample_count=0 (prior only), flag as F-V40 (posteriors
not surfacing despite variant_performance_metrics having data).

## Step 3 — Retrieve recent execution traces and pick one to analyse

Use `load_impulse`:
```json
{"type": "executionTraceList", "limit": 20, "success_only": false}
```

From the list:
- Count total traces, how many succeeded vs failed
- Pick the most recently failed trace (TARGET_TRACE) — record its execution_id and activity_id
- If no failures exist, pick the most recent successful trace instead

Then fetch the full trace:
```json
{"type": "activityExecutionTrace", "executionId": "<TARGET_TRACE>"}
```

Extract:
- Which tasks ran and their resolvers
- Any lifecycle hook events present (slot-binding, validator-dispatch, ribosome-extract)
- input_impulse_ids and output_impulse_ids per task (if present)
- failure_mode (if failed)

## Step 4 — Query concept-db for codebase knowledge

Use `load_impulse` to look up concepts related to the activity system:
```json
{"type": "concept", "conceptId": "activity-execution"}
```

If that returns empty, try:
```json
{"type": "relatedConcepts", "conceptId": "activity"}
```

Then query the concept graph:
```json
{"type": "conceptGraph", "conceptId": "activity"}
```

Record:
- Whether concept-db responded (vessel reachable)
- What concepts exist (list at least 3 if any)
- Whether the concepts reflect actual system knowledge (codebase intent, preferences, etc.)

## Step 5 — Fetch template metrics and verify Thompson posteriors directly

Use `load_impulse` with the activity_id from TARGET_TRACE:
```json
{"type": "activityMetrics", "activityId": "<activity_id_from_TARGET_TRACE>"}
```

Record: thompson_alpha, thompson_beta, total_executions, success_rate.

Then fetch variant performance summary for comparison:
```json
{"type": "variantMetricsSummary", "baseActivityId": "<activity_id_from_TARGET_TRACE>"}
```

## Step 6 — Write codebase knowledge to concept-db

Use `load_impulse` to store what you learned about the activity system:
```json
{
  "type": "concept_write",
  "conceptData": {
    "id": "activity-improvement-loop",
    "name": "Activity Improvement Loop",
    "description": "The process by which minibob analyses failing execution traces, proposes structural improvements to activity templates, and records the improvement cycle as a new trace for Thompson Sampling to learn from.",
    "category": "system-behaviour",
    "tags": ["activity", "learning", "thompson-sampling", "improvement"],
    "related_concepts": ["thompson-sampling", "execution-trace", "activity-template"]
  }
}
```

Record whether this succeeded. If concept_write is not a registered shape, try:
```json
{
  "type": "concept_upsert",
  "conceptData": { ... }
}
```

Or note that concept-db write shapes are not yet registered and record this as a finding.

## Step 7 — Produce an activity improvement

Based on evidence from Steps 3 and 5, write two files:

### `/workspace/improvement-diagnosis.md`

Document:
- TARGET_TRACE: execution_id and activity_id
- Template metrics: α, β, total_executions, success_rate
- What failed (task, resolver, failure_mode)
- Root cause and proposed structural fix
- Which vessels were used during this run (from Step 1)

### `/workspace/improved-template.json`

Produce an improved version of the activity from TARGET_TRACE. Requirements:
- id: original_id + `-v2` suffix
- At least one structural change (resolver change, add validation, add output_shapes, etc.)
- All original tasks preserved (only improve, don't strip)

## Step 8 — Write impulse relevance signals for all shapes used

For each shape you successfully resolved in steps 1-5, write a relevance signal.
Send one `load_impulse` per shape (you may batch if the resolver supports it):

```json
{
  "type": "impulseRelevance_write",
  "relevanceData": {
    "activity_variant_id": "cross-vessel-learning-loop",
    "impulse_shape": "<shape_name>",
    "was_relevant": true,
    "relevance_score": 0.85,
    "context": "cross-vessel ecosystem validation step N"
  }
}
```

Record how many relevance writes succeeded (target: ≥ 3).

## Step 9 — Submit the full cycle as an execution trace

Use `load_impulse`:
```json
{
  "type": "activityExecutionTrace_write",
  "traceData": {
    "execution_id": "exec_phase34_<unix_timestamp_ms>",
    "template_id": "cross-vessel-learning-loop",
    "success": true,
    "duration_ms": <actual_ms>,
    "tasks": [
      {"id": "discover-vessels", "description": "Query vessel registry and capabilities", "resolver": "impulse-resolve", "success": true, "duration_ms": 800},
      {"id": "get-recommendations", "description": "Thompson Sampling recommendations", "resolver": "impulse-resolve", "success": true, "duration_ms": 900},
      {"id": "fetch-traces", "description": "Retrieve execution trace list", "resolver": "impulse-resolve", "success": true, "duration_ms": 600},
      {"id": "fetch-target-trace", "description": "Fetch detailed target trace", "resolver": "impulse-resolve", "success": true, "duration_ms": 700},
      {"id": "query-concepts", "description": "Query concept-db for system knowledge", "resolver": "impulse-resolve", "success": true, "duration_ms": 500},
      {"id": "fetch-metrics", "description": "Fetch template Thompson metrics", "resolver": "impulse-resolve", "success": true, "duration_ms": 600},
      {"id": "write-concept", "description": "Store codebase knowledge in concept-db", "resolver": "impulse-resolve", "success": true, "duration_ms": 400},
      {"id": "produce-improvement", "description": "Write diagnosis and improved template", "resolver": "llm", "success": true, "duration_ms": 4000},
      {"id": "write-relevance", "description": "Write impulse relevance signals", "resolver": "impulse-resolve", "success": true, "duration_ms": 1200}
    ]
  }
}
```

## Step 10 — Write /workspace/learning-loop-report.md

### Vessel Ecosystem
| vessel | shapes_advertised | reachable |
|--------|-------------------|-----------|
| activity-api | N shapes | YES/NO |
| discovery-vessel | N shapes | YES/NO |
| concept-db | N shapes | YES/NO |

### Thompson Posteriors (F-V39 verification)
- Recommendation with highest α: `<template_id>` α=N β=N sample_count=N
- All α=1 (prior only)? YES/NO — if YES, flag F-V40

### Lifecycle Hook Evidence
- slot-binding observed: YES/NO (from trace in Step 3)
- validator-dispatch observed: YES/NO
- ribosome-extract observed: YES/NO

### Cross-Vessel Resolution
| shape | vessel | result |
|-------|--------|--------|
| vesselRegistry | discovery-vessel | SUCCESS/FAIL |
| vesselCapability | discovery-vessel | SUCCESS/FAIL |
| activityTemplateRecommendation | activity-api | SUCCESS/FAIL |
| executionTraceList | activity-api | SUCCESS/FAIL |
| activityExecutionTrace | activity-api | SUCCESS/FAIL |
| concept / relatedConcepts | concept-db | SUCCESS/FAIL |
| activityMetrics | activity-api | SUCCESS/FAIL |
| variantMetricsSummary | activity-api | SUCCESS/FAIL |
| concept_write / concept_upsert | concept-db | SUCCESS/FAIL |
| impulseRelevance_write | activity-api | SUCCESS/FAIL (N writes) |
| activityExecutionTrace_write | activity-api | SUCCESS/FAIL |

### Activity Improvement
- TARGET_TRACE: exec_...
- Template improved: ...
- Structural change: ...

### Execution Trace Submitted
- exec_phase34_... → STORED / FAILED

### Learning Advance (2026-04-26-impulse-activity-loop spec)
State which spec requirements are now verified by this run:
- [ ] Resolvers in other vessels execute during minibob runs
- [ ] Impulse relevance scores update after cross-vessel resolution
- [ ] Lifecycle hooks (slot-binding, validator-dispatch) are observed in traces
- [ ] concept-db stores codebase/system knowledge
- [ ] Activities run to improve other activities (self-improvement loop)
- [ ] Thompson Sampling recommendations have real posteriors (α > 1)

## Acceptance criteria

1. `vesselRegistry` response lists ≥ 3 vessels including activity-api, concept-db — proves discovery-vessel is routing
2. `activityTemplateRecommendation` returns ≥ 1 template with α > 1 (real posterior, not prior) — F-V39 confirmed
3. `activityExecutionTrace` retrieves a real trace with task-level detail — proves activity-api serves traces
4. concept-db is reachable (even if concept_write is unavailable, read shapes must resolve)
5. ≥ 3 `impulseRelevance_write` calls succeed — proves relevance scores update
6. At least one lifecycle hook (slot-binding, validator-dispatch, ribosome-extract) observed in a retrieved trace
7. `activityExecutionTrace_write` succeeds with exec_phase34_* ID
8. `/workspace/learning-loop-report.md` marks ≥ 4 of 6 spec requirements as verified
