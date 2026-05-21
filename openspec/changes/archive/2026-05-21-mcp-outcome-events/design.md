# Design — mcp-outcome-events

## Schema (user-vessel sql/006-mcp-outcome-event.surql)
```surql
DEFINE TABLE OVERWRITE mcp_outcome_event SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $token.org_id
    FOR create, update, delete WHERE org_id = $token.org_id;

DEFINE FIELD OVERWRITE api_key_id ON mcp_outcome_event TYPE string ASSERT $value != NONE;
DEFINE FIELD OVERWRITE org_id ON mcp_outcome_event TYPE string ASSERT $value != NONE;
DEFINE FIELD OVERWRITE user_id ON mcp_outcome_event TYPE string ASSERT $value != NONE;
DEFINE FIELD OVERWRITE tool_name ON mcp_outcome_event TYPE string ASSERT $value != NONE;
DEFINE FIELD OVERWRITE outcome_payload ON mcp_outcome_event TYPE object DEFAULT {};
DEFINE FIELD OVERWRITE outcome_payload.* ON mcp_outcome_event TYPE any;
DEFINE FIELD OVERWRITE occurred_at ON mcp_outcome_event TYPE datetime
  VALUE $before OR time::now();

DEFINE INDEX OVERWRITE idx_outcome_by_key ON mcp_outcome_event FIELDS api_key_id, occurred_at;
DEFINE INDEX OVERWRITE idx_outcome_by_org ON mcp_outcome_event FIELDS org_id, occurred_at;
```
Same `org_id TYPE string` pattern as `mcp_usage_snapshot`; same `outcome_payload.* TYPE any` wildcard pattern that mcp-usage-telemetry validated for SCHEMAFULL nested objects.

## Outcome extractors (mcp client side)
Selection: only the three tools that mutate user-visible state. `init_workspace`, `get_problems`, `get_metrics`, `search_codebase`, `predict_cochanges`, `analyze_impact`, `get_analysis_context` are pure reads with no outcome to capture.

| Tool | Payload |
|---|---|
| `mark_complete` | `{ problem_id, verdict }` |
| `annotate_component` | `{ problem_id, kind, content_summary: content.slice(0, 200) }` |
| `assign_git_changes` | `{ changed_files: files.slice(0, 20) }` |

Outcome events are POSTed only on success. Failure events stay in the existing usage-snapshot path (which already records `total_failures`).

## Dashboard feed
`<ActivityFeed apiKeyId>` renders a vertical list, newest first:
- `mark_complete`: lucide `CheckCircle2` icon + "Resolved <problem_id>" (or "Dismissed" if verdict=discarded)
- `annotate_component`: lucide `MessageSquare` + "Annotated <problem_id> (<kind>): <content_summary>"
- `assign_git_changes`: lucide `GitCommit` + "Mapped change to N files: <a, b, c …>"
- Relative time (e.g. "2m ago") on the right.
Empty state: "No outcome events yet — invoke a tool that changes state to see entries here."

## Out of scope
- Outcome events for read-only tools (`get_problems`, `search_codebase`). Adds noise without observability value.
- Cross-key feeds (org-wide outcome roll-up). Single-key view is enough for v1.
- Server-side aggregation. The feed renders raw events; rollups can be a follow-up.

## Verification
- user-vessel unit test for the new route.
- Real-mcp-client invocation against canary must produce ≥ 3 events visible in `GET /v2/mcp/outcomes`.
- Playwright on /mcp Usage tab confirms feed renders with all three event types.
