## ADDED Requirements

### Requirement: metabob-mcp emits time-stamped event stream

`metabob-mcp` SHALL emit time-stamped events (not aggregate snapshots) to `metabob-analysis-api` at `POST /v2/events/mcp`. Each event SHALL carry `session_id`, a high-resolution timestamp `ts` (unix milliseconds), and any kind-specific payload. Events SHALL be batched (flush every 5 seconds or 50 events, whichever first) with fire-and-forget semantics and exponential-backoff retry on transient failure.

#### Scenario: Tool call event includes file reference
- **GIVEN** the agent invokes `get_problems({ file: 'src/foo.ts' })` and the sidecar resolves it
- **WHEN** the next event batch is flushed
- **THEN** the batch contains an entry `{ kind: 'tool_call', ts, tool_name: 'get_problems', success: true, duration_ms, file: 'src/foo.ts' }`

#### Scenario: Buffered events survive transport failure
- **GIVEN** the analysis-api is unreachable for 30 seconds
- **WHEN** 10 events are recorded in that window
- **THEN** when the analysis-api becomes reachable again, all 10 events are delivered in a single batch with their original `ts` values intact

### Requirement: seed_read events close the read-feedback loop

When the sidecar serves a cached seed to the agent (via any MCP read tool), it SHALL record a `seed_read` event in the next event batch, identifying the seed and the tool that surfaced it.

#### Scenario: Cached seed surfaced via get_problems
- **GIVEN** a cached seed with `id = S1` exists
- **WHEN** the agent invokes `get_problems` and S1 is returned in the results
- **THEN** the next event batch contains `{ kind: 'seed_read', ts, seed_id: 'S1', tool_name: 'get_problems' }`

#### Scenario: Same seed read multiple times records each
- **GIVEN** the agent invokes `get_analysis_context` twice within 10 seconds, both calls returning seed S1
- **WHEN** events are flushed
- **THEN** two `seed_read` events for S1 are recorded with distinct timestamps

## MODIFIED Requirements

### Requirement: R1 — Server-side telemetry write endpoint

`metabob-analysis-api` SHALL expose `POST /v2/events/mcp` accepting `Authorization: ApiKey <key>` with a batched event payload:

```jsonc
{
  "session_id": "<uuid>",
  "events": [
    { "kind": "tool_call", "ts": 1716800000000, "tool_name": "get_problems", "success": true, "duration_ms": 12, "file": "src/foo.ts" },
    { "kind": "seed_read", "ts": 1716800000050, "seed_id": "abc", "tool_name": "get_problems" }
    // ...
  ]
}
```

The endpoint SHALL persist each event row with the API-key-resolved `api_key_id`, the caller's `org_id`, the inferred `user_id` (from identity-vessel resolution), and the event's payload. Response `204` on success. The legacy `POST /v2/mcp/usage` snapshot endpoint on `user-vessel` SHALL be retired once all live metabob-mcp clients have migrated to the new path; until then, both paths SHALL be served.

#### Scenario: Batch of events stored individually
- **GIVEN** an authenticated batch with 30 events
- **WHEN** the endpoint processes the batch
- **THEN** 30 rows are written to the event table, each carrying the resolved `api_key_id` and `org_id`, and the response is `204`

#### Scenario: Unauthenticated request refused
- **GIVEN** a request without `Authorization: ApiKey`
- **WHEN** the endpoint is invoked
- **THEN** the response is `401`

#### Scenario: Legacy snapshot path remains during migration
- **GIVEN** a metabob-mcp v0.2.x client posts to the legacy `user-vessel` `POST /v2/mcp/usage`
- **WHEN** the request is processed
- **THEN** the legacy snapshot path is served unchanged and dashboard reads via the new aggregation still see the data

### Requirement: R2 — Telemetry read endpoint serves aggregate snapshots

Snapshot reads for the dashboard (the `by_tool` counts, `total_calls`, `last_seen_at`, `first_seen_at`) SHALL be served from `metabob-analysis-api` aggregations over the new event stream, not from the legacy user-vessel snapshot table. The dashboard endpoint shape SHALL remain compatible: `GET /v2/dashboard/usage-snapshot?api_key_id=<id>` returning the same fields as the prior `GET /v2/mcp/usage?api_key_id=<id>`.

#### Scenario: Aggregated snapshot returns equivalent shape
- **GIVEN** event stream rows for api_key K aggregating to 47 calls across 3 tool types
- **WHEN** `GET /v2/dashboard/usage-snapshot?api_key_id=K` is invoked
- **THEN** the response matches the v0.2.x snapshot shape with `total_calls: 47`, `by_tool: {...}`, `last_seen_at`, `first_seen_at`, plus the new `total_failures` and `mcp_version`

#### Scenario: Org isolation still enforced
- **GIVEN** rows exist for org A's keys
- **WHEN** an org B JWT calls the endpoint with api_key_id from org A
- **THEN** the response is the zero-shape (`total_calls: 0, by_tool: {}, ...`)

### Requirement: R4 — metabob-mcp emits telemetry continuously

`metabob-mcp` SHALL emit one or more telemetry events for every tool-call resolution (success and failure). The implementation:

- Runs fire-and-forget: telemetry MUST NOT block tool execution and MUST NOT propagate errors into the tool response.
- Buffers events in-memory; flushes every 5 seconds or on reaching 50 events. On transport failure, retries with exponential backoff (max 5 attempts).
- Disabled entirely when `process.env.METABOB_TELEMETRY === "off"`.
- Targets `ANALYSIS_API_URL` (previously `USER_VESSEL_URL`).
- Authenticates with the same API key the MCP uses for analysis-api access.
- Includes `mcp_version` in the first event of every batch.

#### Scenario: Failure event recorded
- **GIVEN** a tool call that throws an error
- **WHEN** the tool call resolves
- **THEN** an event `{ kind: 'tool_call', ts, tool_name, success: false, duration_ms, error_code }` is buffered

#### Scenario: METABOB_TELEMETRY=off disables emission
- **GIVEN** the sidecar starts with `METABOB_TELEMETRY=off`
- **WHEN** tool calls are made
- **THEN** no batches are flushed and no HTTP requests target the telemetry endpoint

### Requirement: R6 — Dashboard Usage tab renders telemetry shape

The `/mcp` Usage tab SHALL render summary cards driven by the aggregated snapshot from R2, plus an event feed driven by the same event stream. The summary cards continue to show `total_calls`, `total_failures`, `last_seen_at`, and a `by_tool` breakdown. The event feed adds a chronological list of recent `tool_call` and `seed_read` events for the selected key.

#### Scenario: Summary cards render aggregated values
- **GIVEN** the selected key has aggregated 200 calls, 5 failures, last seen 3 minutes ago
- **WHEN** the Usage tab loads
- **THEN** the summary cards show "200 calls", "5 failures", "last seen 3m ago" and a per-tool breakdown

#### Scenario: Event feed shows recent activity
- **WHEN** the Usage tab loads with recent events
- **THEN** a feed renders the last N events (`tool_call` and `seed_read`) with relative timestamps, in newest-first order

#### Scenario: Empty key shows zero-shape with placeholder
- **WHEN** the selected key has no event rows
- **THEN** summary cards render the zero-shape and the event feed shows a placeholder explaining no activity yet

## REMOVED Requirements

### Requirement: R3 — Schema (user-vessel snapshot table)

**Reason:** The snapshot table is superseded by an event-stream table in `metabob-analysis-api`. The user-vessel snapshot table remains in place during migration but is no longer the authoritative source for dashboard reads.

**Migration:** Dashboard reads switch to `metabob-analysis-api` aggregations. The legacy user-vessel snapshot row is no longer updated after the new MCP client ships; legacy rows remain readable but are eventually superseded.
