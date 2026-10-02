# Prompt 28: Multi-vessel ecosystem health — cross-vessel resolution, lifecycle hooks, clean logs

This prompt verifies that minibob is healthy across the full connected ecosystem: concept-db,
activity-api, and discovery-vessel are all reached via vessel discovery in a single run, lifecycle
hook events appear in the logs, and the run is clean (no unexpected ERROR lines).

**What to verify:**
- `load_impulse` routes to concept-db (shape: `concept_create_write`, vessel: concept-db)
- `load_impulse` routes to activity-api (shape: `activityTemplate`, vessel: metabob-activity-api)
- `load_impulse` routes to discovery-vessel (shape: `vesselCapability`, vessel: discovery-vessel)
- `[Impulse] Resolved via vessel discovery` log line appears for all three vessels
- Lifecycle hook lines appear in stderr (`lifecycle:task:preBinding` OR `lifecycle:task:completed`)
- An impulse relevance write is dispatched (`impulseRelevance_write` or `activityExecutionTrace_write`)
- No `[ERROR]` lines appear in stderr (403 auth errors on `activityTemplate_update` are expected and acceptable)

---

You are running a multi-vessel ecosystem health check. Your goal is to touch concept-db,
activity-api, and discovery-vessel in a single run and produce a health report.

## Step 1 — Query the discovery registry

Use `load_impulse` with pointer `{"type": "vesselCapability", "shape": "activityExecutionTrace"}` to ask discovery-vessel which vessels can resolve the `activityExecutionTrace` shape. Record:
- How many vessels were returned
- The vessel ID(s) and their `resolve_endpoint` fields

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 2 — Fetch an activity template from activity-api

Use `load_impulse` with pointer `{"type": "executionTraceList", "limit": 5, "success_only": false}` to get recent execution traces. Pick the `activity_id` from the most recent trace.

Then use `load_impulse` with pointer `{"type": "activityTemplate", "templateId": "<picked-id>"}` to fetch that template's full structure. Record its `name`, `output_shapes`, and task count.

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 3 — Write a concept to concept-db

Use `load_impulse` with pointer:

```json
{
  "type": "concept_create_write",
  "conceptData": {
    "source_type": "extracted",
    "content": "The vessel discovery contract defines how vessels advertise their resolver endpoints. Each vessel registers with fields: resolve_endpoint, resolve_request_format, auth_scheme, resolve_timeout_ms, and auth_token_source. Minibob uses these fields to route impulse resolution requests directly to the owning vessel without hardcoded endpoints.",
    "summary": "Vessel discovery resolver contract",
    "tags": ["discovery", "vessel", "architecture", "impulse-resolution"]
  }
}
```

Record the returned concept ID (should start with `concept:`).

If concept-db is unreachable (vessel not registered in discovery), record the error and continue — do not fail the entire run.

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 4 — Write /workspace/ecosystem-health.md

Write a markdown file at `/workspace/ecosystem-health.md` with the following sections:

### Discovery Registry
- How many vessels are registered in the discovery registry (from Step 1)
- Which vessel resolves `activityExecutionTrace` and its endpoint

### Activity Template Sampled
- The template ID fetched in Step 2
- Its name, output_shapes, and task count

### Concept Written
- The concept ID returned from concept-db (or "unreachable: <error>" if it failed)
- Whether vessel discovery routed to concept-db or fell back to MCP

### Vessel Resolution Summary
A table with columns: `shape | vessel | result`

Rows:
- `vesselCapability` — which vessel resolved it, success/fail
- `executionTraceList` — which vessel resolved it, success/fail
- `activityTemplate` — which vessel resolved it, success/fail
- `concept_create_write` — which vessel resolved it, success/fail

### Ecosystem Verdict
State: `HEALTHY` if at least activity-api and discovery-vessel resolved successfully, `DEGRADED` if one failed, `UNHEALTHY` if both failed.

## Acceptance criteria

1. `/workspace/ecosystem-health.md` exists with real data (no placeholder strings)
2. `[Impulse] Resolved via vessel discovery` appears in stderr with `vessel: metabob-activity-api` (for any activity-api shape)
3. `[Impulse] Resolved via vessel discovery` appears in stderr with `vessel: discovery-vessel` (for `vesselCapability` or similar)
4. Lifecycle hook lines appear in stderr: at least one of `lifecycle:task:preBinding` or `lifecycle:task:completed` (these fire automatically during activity execution)
5. No `[ERROR]` lines in stderr other than expected 403 auth errors on write shapes requiring admin scope
