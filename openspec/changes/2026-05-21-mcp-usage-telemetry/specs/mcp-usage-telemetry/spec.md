# Capability: mcp-usage-telemetry

Closes the "see what the client did" loop for the standalone
product. `metabob-mcp` posts per-tool-call telemetry to user-vessel;
the cloud-dashboard `/mcp` Usage tab reads from user-vessel.
rpc-api is unmodified (frozen 0.16.13) and is no longer in the
read path for MCP usage.

This supersedes the rpc-api-based composition shipped under
`rpc-api-mcp-usage-adapter`: that capability remains the principle
("BFF composes upstreams"); this capability replaces the *specific*
upstream with one that can actually answer "what did this key do."

## Requirements

### R1 — user-vessel exposes telemetry write

`user-vessel` SHALL expose `POST /v2/mcp/usage`:

- Auth: `Authorization: ApiKey <raw-key>` resolved via the standard
  identity-vessel `/v1/auth/resolve` path.
- Body: `{ tool_name, success, duration_ms?, error_code?,
  mcp_version? }`.
- Effect: upsert one row in `mcp_usage_snapshot` keyed by the
  resolved `api_key_id`. On insert, populate `org_id`, `user_id`,
  `first_seen_at`. On update, increment `total_calls`,
  conditionally increment `total_failures`, increment
  `by_tool[tool_name]`, set `last_seen_at`, optionally update
  `mcp_version`.
- Response: `204 No Content` on success.
- Failure: `401` on unresolved key, `400` on missing/invalid body.

### R2 — user-vessel exposes telemetry read

`user-vessel` SHALL expose `GET /v2/mcp/usage?api_key_id=<id>`:

- Auth: `Authorization: Bearer <jwt>`.
- Returns the snapshot row for the given `api_key_id` if it exists
  and the caller's `$token.org_id` matches. Empty (zero-shape
  body) when no row exists.
- Cross-org access is prevented by SurrealDB PERMISSIONS, not by
  application-level filtering.

Response shape (zero-shape sample):
```jsonc
{
  "api_key_id": "<id>",
  "total_calls": 0,
  "total_failures": 0,
  "last_seen_at": null,
  "first_seen_at": null,
  "by_tool": {},
  "mcp_version": null
}
```

Populated-shape adds `org_id`, non-null `last_seen_at` /
`first_seen_at`, populated `by_tool`, and `mcp_version`.

### R3 — Schema

`user-vessel` SHALL contain a `mcp_usage_snapshot` table per
design.md. Fields:
`api_key_id` (string), `org_id` (string), `user_id` (string),
`total_calls` (int), `total_failures` (int),
`last_seen_at` (datetime), `first_seen_at` (datetime),
`by_tool` (object), `mcp_version` (string).
PERMISSIONS scope by `$token.org_id` for all CRUD.

The schema SHALL ship as a new migration file, not modify any
existing user-vessel migration.

### R4 — metabob-mcp emits telemetry

`metabob-mcp` SHALL emit a telemetry POST for every tool-call
resolution (success and failure). The implementation SHALL:

- Run fire-and-forget: telemetry MUST NOT block tool execution and
  MUST NOT propagate errors into the tool response.
- Buffer events in-memory on transport failure; retry on the next
  emission.
- Be disabled entirely when `process.env.METABOB_TELEMETRY === "off"`.
- Target the endpoint indicated by `USER_VESSEL_URL` (default
  `https://user.metabob.com`).
- Authenticate with the same API key the mcp client uses for
  rpc-api access.
- Include `mcp_version` from `package.json`.

### R5 — cloud-dashboard BFF reads from user-vessel

`metabob-cloud-dashboard`'s `/api/mcp/usage` BFF endpoint SHALL
proxy `GET ?api_key_id=<id>` calls to user-vessel
`GET /v2/mcp/usage?api_key_id=<id>`, forwarding the caller's JWT.

The BFF SHALL NOT call rpc-api in the usage read path.

For one release, the BFF MAY accept the legacy
`POST /api/mcp/usage { raw_key, api_key_id }` shape and translate
it to the new GET (ignoring `raw_key`), with a deprecation log
line. A follow-up change removes the POST path.

### R6 — Dashboard Usage tab renders telemetry shape

The `/mcp` Usage tab SHALL render summary cards driven by the new
shape from R2: `total_calls`, `total_failures`, `last_seen_at`, and
a `by_tool` breakdown. When the snapshot is the zero-shape, the
tab SHALL render the existing placeholder copy explaining that no
usage has been recorded for the selected key.

The tab SHALL NOT require the raw API key in any form. The
`rawKeyStash` module from `mcp-info-surface` is dead code after
this change and may be removed in a follow-up.

### R7 — Rubric exercises the full loop

`e2e/rubric/03-observe-mcp-usage.spec.ts` SHALL:

1. Spawn or simulate a `metabob-mcp` invocation against the seeded
   API key, producing at least one telemetry POST (real subprocess
   or a stand-in script — either is acceptable per design.md).
2. Poll user-vessel `/v2/mcp/usage?api_key_id=<seeded>` until
   `total_calls >= 1` (with a sensible timeout).
3. Navigate `/mcp` → Usage → select the seeded key.
4. Assert summary cards render with `total_calls >= 1` and at
   least one entry in `by_tool`.

The spec runs against canary backends. `bun run dev-loop` MUST
return `failed: 0`.

### R8 — rpc-api remains frozen

This capability SHALL NOT modify rpc-api. The telemetry path is
entirely orthogonal to rpc-api's `/session/stats` and `/metrics`.

### R9 — Standalone-product surface preserved

Standalone-product-surface R1-R7 remain in force. In particular,
the dashboard MUST still boot in standalone mode (R1) with the
activity views disabled (R3). The new telemetry hop introduces no
new dependency on activity-api or discovery-vessel.

## Non-requirements

- This capability does NOT specify event-level audit log storage.
  Snapshot only.
- This capability does NOT specify cost attribution. Telemetry is
  volume only; `/v2/costs` covers cost separately.
- This capability does NOT specify cross-org rollups.
- This capability does NOT specify durable on-disk buffering in
  the mcp client.
- This capability does NOT remove the rawKeyStash module from
  cloud-dashboard. That cleanup ships in a follow-up.
