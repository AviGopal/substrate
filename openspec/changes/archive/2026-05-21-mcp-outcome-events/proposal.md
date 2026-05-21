# MCP Outcome Events

## Why
`mcp-usage-telemetry` captures aggregate counters per `api_key_id` (total calls, failure count, per-tool tally), but the dashboard owner cannot tell *what the agent actually did*. Was a problem resolved or dismissed? Which files did it touch? What was annotated? Today the team lead sees `mark_complete: 1` and has to ask the agent operator for context.

Semantic outcome events close that gap. When a tool that changes user-visible state runs (`mark_complete`, `annotate_component`, `assign_git_changes`), the mcp client also posts a structured outcome event capturing the tool arguments. The dashboard renders a chronological activity feed alongside the existing counter cards.

## What Changes
- user-vessel:
  - New `mcp_outcome_event` SCHEMAFULL table (migration 006), `org_id`/`api_key_id` PERMISSIONS, wildcard-typed `outcome_payload` object.
  - `POST /v2/mcp/outcomes` — ApiKey auth, insert one event, return 204.
  - `GET /v2/mcp/outcomes?api_key_id=&limit=` — JWT auth, ordered descending by `occurred_at`, default limit 50, cap 200.
- metabob-mcp:
  - Telemetry gains an `outcome()` helper that posts to `/v2/mcp/outcomes` with per-tool extracted payloads:
    - `mark_complete`: `{ problem_id, verdict }`
    - `annotate_component`: `{ problem_id, kind, content_summary }` (truncated to 200 chars)
    - `assign_git_changes`: `{ changed_files }` (string array, capped at 20)
- cloud-dashboard:
  - BFF route `GET /api/mcp/outcomes` proxying to user-vessel.
  - `useMcpOutcomes(apiKeyId)` React Query hook.
  - `<ActivityFeed>` component on the Usage tab rendering human-readable labels with relative-time and tool-class icons.

## Impact
- New table requires `bun run scripts/apply-migrations.ts` (or pod restart triggers `init_migrations`).
- Wire format additive — existing telemetry flow is unchanged.
- Dashboard now shows *what the customer did*, not just *how many times they invoked something*.
