# Proposal: MCP Usage Telemetry (client→vessel shim)

## Why

The standalone-product loop archived a `/mcp` Usage tab backed by a
BFF that composes rpc-api `/session` + `/session/stats` + `/metrics`.
Probing canary revealed two structural blockers to the
end-to-end "see what the client did" story:

1. **rpc-api 0.16.13 doesn't recognize identity-vessel-minted keys.**
   `POST /session { apiKey }` returns
   `session_id: "anonymous:default:<uuid>"` for every dashboard-issued
   key — i.e. rpc-api treats the key as anonymous and creates a fresh
   session unrelated to any org. (Reproduced 2026-05-21 against
   `https://ide.metabob.com`.)
2. **Every BFF call mints a NEW session.** rpc-api offers no per-key
   or per-org aggregate (`/metrics` is admin-only and 401s for
   non-admin keys). So even if the apiKey were recognized, the stats
   the dashboard sees come from a single fresh session each call —
   always near-zero, and orthogonal to whatever an external
   `metabob-mcp` client did with its own session.

Net effect: **as the surfaces stand today, an external mcp client
can do real work and the dashboard cannot observe it.** This change
closes that loop without modifying the frozen rpc-api.

## What changes

A small "client→vessel telemetry" shim:

1. **user-vessel**: add a `mcp_usage_snapshot` table + two endpoints.
   - `POST /v2/mcp/usage` — mcp clients post per-tool-call events
     (key-authenticated). Upserts the org-scoped snapshot row keyed
     by `api_key_id`.
   - `GET /v2/mcp/usage?api_key_id=<id>` — dashboard reads the
     snapshot (JWT-authenticated, PERMISSIONS-scoped by
     `$token.org_id`).
2. **metabob-mcp**: a thin telemetry-poster module. After every
   tool-call resolution (success or failure), fire-and-forget a POST
   to `${IDENTITY_ENDPOINT or USER_VESSEL_URL}/v2/mcp/usage`. Buffer
   on transient failure, flush on next call. Disabled when env var
   `METABOB_TELEMETRY=off` is set.
3. **cloud-dashboard BFF**: replace the rpc-api hop in
   `/api/mcp/usage` with a proxy to
   `user-vessel /v2/mcp/usage?api_key_id=`. The raw-key requirement
   goes away — `api_key_id` is sufficient (caller's JWT carries
   org_id; user-vessel PERMISSIONS handle the rest).
4. **rubric `03-observe-mcp-usage`**: spawn a real `metabob-mcp`
   invocation against the seeded API key (one tool call against a
   tiny fixture), then visit `/mcp` Usage tab and assert the
   snapshot for that key shows ≥1 call.

## Non-goals

- Modifying rpc-api (frozen 0.16.13). The new telemetry path is
  entirely orthogonal to rpc-api.
- Tracking individual tool call arguments or outputs. Snapshot
  records counts + last-seen + a per-tool tally only.
- Cross-tenant aggregation. Per-key only; org-level aggregation is
  the user-vessel's existing `/v2/costs` pattern, future iteration.
- Replacing rpc-api `/session/stats` entirely. Future iterations can
  reintroduce it as a secondary signal when rpc-api gets per-key
  authentication; for now this shim is the source of truth.
- mcp client buffering durability (e.g., disk persistence). Buffer
  is in-memory; lost on crash. Acceptable for telemetry.

## Success criteria

- `POST /v2/mcp/usage` with a valid API key creates/updates a
  snapshot row in user-vessel. Verified via direct curl + SQL probe.
- `GET /v2/mcp/usage?api_key_id=<id>` on canary returns the snapshot
  shape; cross-org reads return 403 / empty.
- Dashboard `/mcp` Usage tab shows non-zero counts after a
  metabob-mcp tool invocation against the seeded key.
- Rubric `03-observe-mcp-usage` exercises the full loop: spawn mcp →
  tool call → dashboard reflects it. `failed: 0` against canary.
- rpc-api unchanged. Standalone-product-surface R1-R7 unchanged.
- New capability `mcp-usage-telemetry` archived under
  `openspec/specs/`.

## Out of scope (future iterations)

- Org-level rollups (e.g., "all mcp usage for org X this week").
- Cost attribution (telemetry → cost). user-vessel `/v2/costs`
  already handles cost; this is volume/usage only.
- Bidirectional sync with rpc-api `/session/stats`. Deferred until
  rpc-api gets per-key auth or we ship its replacement.
- mcp tool-argument capture for prompt-engineering analytics.
- A dashboard "live MCP activity feed" view. Snapshot only here;
  event-level feed is a later capability.
