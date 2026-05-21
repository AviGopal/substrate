# Capability: team-lead-key-overview

Surfaces cross-key MCP activity inline on the dashboard's API
Keys page so a team lead can see who is using metabob from a
single screen, and removes a UI leak that exposed raw API keys
in option labels.

Complements `mcp-usage-telemetry` (per-key snapshot collection)
with an org-scoped batch read path. Does not introduce new
telemetry semantics.

## Requirements

### R1 — Org-scoped batch read

`user-vessel` SHALL accept `GET /v2/mcp/usage` with NO
`api_key_id` query param. Authentication: JWT Bearer token.

Behavior:
- Returns `{ snapshots: McpUsageSnapshot[], total: int }`.
- `snapshots` contains every row whose `org_id` matches the
  caller's `$token.org_id`. SurrealDB PERMISSIONS enforce the
  filter at the database layer; the handler MUST NOT add
  application-side filtering.
- Response is capped at 500 rows. `total` reflects the count
  before capping; when `total > 500`, the handler SHALL log a
  warning so operators can see when pagination becomes necessary.
- An empty result returns `{ snapshots: [], total: 0 }` with HTTP
  200, never 404.

The existing single-key behavior — `GET /v2/mcp/usage?api_key_id=<id>`
returning the single snapshot or zero-shape — SHALL be preserved
exactly. The handler branches on the presence of the query param.

### R2 — Raw key never in list response

`identity-vessel`'s `GET /v1/keys` list endpoint SHALL NOT
return the raw API key in its response body. Each entry SHALL
expose `key_id` (stable identifier) and `key_prefix` (first 12
chars of the raw key, sufficient for visual identification).

The raw `key` field is removed from the list response. It
remains in the `/v1/keys/issue` (create) response — that is the
"shown once" path defined by the existing API contract.

If the existing `GET /v1/keys` handler is already clean (raw
key never included), this requirement is satisfied without code
change; the spec captures the invariant for future regression
protection.

### R3 — Dashboard surfaces inline usage

The dashboard's API Keys page (`/api-keys`) SHALL render, per
key row, an inline badge derived from the snapshot returned by
the batch endpoint (R1):

- When a snapshot exists with `total_calls > 0`: show
  `<N calls · last seen <relative-time>>`. If
  `total_failures > 0`, also show a `<M failed>` warn-styled
  sub-badge.
- When no snapshot exists or `total_calls === 0`: show
  `<no activity yet>` with muted styling.

The badge SHALL use a relative time format ("5 min ago",
"2 hrs ago", "Yesterday", etc.) computed in the client. Refresh
cadence is 30 seconds (React Query `staleTime`).

The page SHALL include `data-key-id={key_id}` on each row's
outer container so E2E tests can target rows reliably.

### R4 — Dropdown labels carry prefix only

The `/mcp` Usage tab's key-selector dropdown SHALL show option
labels in the form
`${name || key_id} · ${key_prefix or truncated-key}`. No option
SHALL include the full raw API key.

A transitional fallback may compute `truncate(key, 12)` when
identity-vessel still returns raw `key`. Once R2 is in force,
`key_prefix` is always present and the truncate path is
unreachable; the fallback may be removed in a follow-up.

### R5 — BFF proxies the batch read

The dashboard BFF's `/api/mcp/usage` handler SHALL accept GET
requests with NO query param and proxy them to user-vessel's
`GET /v2/mcp/usage` (no param). The existing
`?api_key_id=<id>` path remains. The legacy
`POST { raw_key, api_key_id }` shape from `mcp-usage-telemetry`
remains accepted with a deprecation log; removal is a future
change.

### R6 — Rubric asserts both improvements

`e2e/rubric/01-onboard.spec.ts` SHALL include:

- A test that navigates to `/api-keys` after telemetry has been
  emitted in `globalSetup` and asserts the inline badge for the
  seeded key shows `\d+ calls` and `last seen` text.
- A test that visits the `/mcp` Usage tab and asserts NO
  `<option>` text content matches the heuristic raw-key regex
  `mb-[A-Za-z0-9+/=_-]{30,}`.

Both run against canary backends. `bun run dev-loop` MUST
return `failed: 0` after this capability lands.

### R7 — Standalone product surface preserved

This capability SHALL NOT introduce dependencies on
`activity-api` or `discovery-vessel`. It SHALL NOT modify
rpc-api (frozen 0.16.13). Standalone-product-surface R1-R7 and
mcp-usage-telemetry R1-R9 remain in force.

## Non-requirements

- This capability does NOT specify a per-user (vs per-key)
  rollup view.
- This capability does NOT specify time-windowed slicing
  ("calls this week").
- This capability does NOT specify an event log (per-call
  detail).
- This capability does NOT specify pagination semantics beyond
  the 500-row cap.
- This capability does NOT specify a metabob-mcp release on
  npm.
- This capability does NOT remove the `rawKeyStash.ts` dead
  code in cloud-dashboard.
