# Spec — mcp-outcome-events

## ADDED Requirements

### Requirement: user-vessel MUST persist semantic mcp outcome events
A new table `mcp_outcome_event` stores one row per state-changing mcp tool call, scoped by `org_id` via SurrealDB PERMISSIONS keyed on `$token.org_id`.

#### Scenario: POST /v2/mcp/outcomes records one event
- **GIVEN** an authenticated `Authorization: ApiKey <key>` request
- **WHEN** the body `{ tool_name, outcome_payload }` is well-formed
- **THEN** the server inserts a row with `api_key_id` = caller key, `org_id` = caller org, `user_id` = caller user, `occurred_at` = `time::now()`, and returns 204

#### Scenario: POST /v2/mcp/outcomes rejects JWT callers
- **GIVEN** a `Bearer <jwt>` Authorization header
- **WHEN** POST /v2/mcp/outcomes is invoked
- **THEN** the response is 400 `{ error: "ApiKey_required" }`

### Requirement: user-vessel MUST expose the org-scoped feed
GET /v2/mcp/outcomes returns events for the caller's org, optionally filtered by `api_key_id`, newest first.

#### Scenario: GET with api_key_id returns the per-key feed
- **GIVEN** a valid JWT and rows exist for `<key>` in the caller's org
- **WHEN** `GET /v2/mcp/outcomes?api_key_id=<key>&limit=50` is invoked
- **THEN** the response is `{ events: [...] }` ordered by `occurred_at DESC`, length ≤ 50

#### Scenario: Empty key returns zero-shape body, not 404
- **GIVEN** a valid JWT and no rows for `<unknown_key>`
- **WHEN** the GET is invoked
- **THEN** the response is `200 { events: [] }`

### Requirement: metabob-mcp MUST emit outcome events for state-changing tools
After a successful invocation of `mark_complete`, `annotate_component`, or `assign_git_changes`, the client posts an outcome event with the canonical payload shape.

#### Scenario: mark_complete success emits the verdict
- **GIVEN** `mark_complete({problem_id: "p1", verdict: "endorsed"})` succeeds
- **WHEN** the tool returns
- **THEN** the client posts `{ tool_name: "mark_complete", outcome_payload: { problem_id: "p1", verdict: "endorsed" } }` to `/v2/mcp/outcomes`

#### Scenario: annotate_component success emits a content summary
- **GIVEN** `annotate_component({problem_id, kind: "explain", content})` succeeds
- **WHEN** the tool returns
- **THEN** the client posts `outcome_payload: { problem_id, kind: "explain", content_summary: content.slice(0, 200) }`

#### Scenario: assign_git_changes success emits a file list capped at 20
- **GIVEN** `assign_git_changes({changed_files: [...]})` with 25 entries
- **WHEN** the tool returns
- **THEN** the client posts `outcome_payload: { changed_files: <first 20 entries> }`

### Requirement: cloud-dashboard MUST render an ActivityFeed on the Usage tab
The `<ActivityFeed apiKeyId>` component fetches `/api/mcp/outcomes?api_key_id=<id>&limit=50` and renders each event with a tool-specific human-readable label and relative time.

#### Scenario: Feed renders mark_complete events
- **GIVEN** an outcome with `tool_name: "mark_complete", outcome_payload: { problem_id, verdict }`
- **WHEN** the Usage tab loads
- **THEN** the feed displays "Resolved <problem_id>" (verdict=endorsed) or "Dismissed <problem_id>" (verdict=discarded)

#### Scenario: Feed renders all three event types
- **GIVEN** at least one event each of `mark_complete`, `annotate_component`, `assign_git_changes`
- **WHEN** the Usage tab loads
- **THEN** the feed renders three distinguishable rows (icon + label) and orders newest first
