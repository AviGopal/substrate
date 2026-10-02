# Prompt 19: concept-db integration via vessel discovery

This prompt verifies that minibob uses concept-db (via vessel discovery) to store and retrieve structured knowledge, and that concept-db resolves via the public endpoint rather than the cluster-internal URL.

**What to verify:**
- `load_impulse` with shape `concept_create_write` routes to concept-db via discovery
- Concepts are actually written (returned id starts with `concept:`)
- `[Impulse] Resolved via vessel discovery` log line appears with `vessel: concept-db`
- Lifecycle hooks (slot-binding, validator-dispatch) continue to fire
- Impulse relevance records are written

---

You are storing structured knowledge about the Metabob activity system into concept-db.

## Step 1 — Store three concepts

Use `load_impulse` three times, each with pointer type `concept_create_write`. The pointer must have the form:

```json
{
  "type": "concept_create_write",
  "conceptData": {
    "source_type": "extracted",
    "content": "<2-3 sentences describing the concept>",
    "summary": "<short label>",
    "tags": ["<relevant-tags>"]
  }
}
```

Valid `source_type` values: `"extracted"`, `"memo"`, `"llm"`, `"goal"`, `"human_input"`.

Store these three concepts:
1. **impulse-resolution-chain**: How minibob resolves impulses (local types first → custom resolvers → vessel discovery → MCP fallback). Tags: `["minibob", "architecture", "impulse"]`
2. **thompson-sampling**: How activity-api uses Beta distribution Thompson Sampling to select activity templates — alpha increments on success, beta on failure. Tags: `["activity-api", "learning", "thompson-sampling"]`
3. **vessel-discovery-contract**: The contract fields vessels advertise in discovery — resolve_endpoint, resolve_request_format, auth_scheme, resolve_timeout_ms, auth_token_source, auth_delegation_mode. Tags: `["discovery", "vessel", "architecture"]`

You MUST use `load_impulse` for all writes. Do NOT use bash or curl.

## Step 2 — Retrieve a concept

Use `load_impulse` with pointer `{"type": "concept", "concept_id": "<stripped-id>"}` where `<stripped-id>` is the id returned from Step 1 with the `concept:` prefix removed. For example if the write returned `concept:concept_ABC123`, use `concept_id: "concept_ABC123"` (strip the leading `concept:`).

## Step 3 — Write concepts.md

Write `/workspace/concepts.md` containing:
- A table of concepts written (concept_id, summary, first 100 chars of content)  
- The full retrieved concept from Step 2
- A "Data Source" section confirming concept-db was reached via `load_impulse` through vessel discovery

## Acceptance criteria

1. At least 2 concept IDs returned starting with `concept:concept_`
2. `[Impulse] Resolved via vessel discovery` appears in stderr with `vessel: concept-db`
3. `/workspace/concepts.md` exists with real concept IDs
