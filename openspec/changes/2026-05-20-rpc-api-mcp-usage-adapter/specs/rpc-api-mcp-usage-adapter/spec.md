# Capability: rpc-api-mcp-usage-adapter

A dashboard-BFF adapter that composes the frozen rpc-api 0.16.13
endpoints into a per-API-key MCP usage shape consumable by the
`/mcp` Usage tab.

This is the first concrete instance of the adapter-layer
principle stated in `standalone-product-surface` R4: rpc-api is
frozen, so new analysis-surface functionality lives in the
dashboard BFF.

## Requirements

### R1 — BFF route

`metabob-cloud-dashboard` SHALL expose a BFF endpoint at
`POST /api/mcp/usage` that returns per-API-key MCP usage data
composed from rpc-api 0.16.13's `/session`, `/session/stats`,
and `/metrics` endpoints.

**Method locked during apply (2026-05-20):** `POST { raw_key, api_key_id? }`.
Rationale: discovery confirmed user-vessel does not reveal raw
API keys after creation (the dashboard's `NewKeyBanner` in
`APIKeysPage.tsx` displays the key exactly once at create time,
and `useApiKeys()` returns only the `prefix` thereafter — see
design.md "Risks" Option 1). The React client therefore stashes
the raw key in `sessionStorage` at create time and submits it in
the BFF request body when calling this route. `api_key_id` is
included in the body purely for echo / display purposes.

- The route SHALL require an authenticated user (existing JWT
  cookie or Bearer token middleware).
- Missing or invalid auth: HTTP 401.
- Missing or invalid `raw_key` in body: HTTP 400.

### R2 — Composition flow

When invoked successfully, the BFF route SHALL:

1. Read `raw_key` from the request body (per R1).
2. Call `POST ${RPC_API_URL}/session { apiKey: raw_key, project: "default" }`
   to obtain a session token.
3. Call `GET ${RPC_API_URL}/session/stats` and
   `GET ${RPC_API_URL}/metrics` in parallel with the session
   token in the `Authorization: Bearer` header.
4. Return a composed JSON body:
   ```jsonc
   {
     "api_key_id": "...",       // echoed from request body if provided
     "session_id": "...",
     "stats": { ... },          // body from /session/stats
     "metrics": { ... } | null, // body from /metrics, or null if /metrics is not authorized for this key (see R3)
     "metrics_status": <N>,     // HTTP status from /metrics (200 on success, e.g. 401 when not authorized)
     "fetched_at": "<ISO8601>"
   }
   ```

The route SHALL NOT call `activity-api` or `discovery-vessel`.
rpc-api is the only analysis-surface upstream.

### R3 — Failure shape

On a non-2xx response from `POST /session` or `GET /session/stats`,
the BFF SHALL return HTTP 502 with body:
```json
{ "error": "rpc_api_unreachable", "upstream_status": <N> }
```
`upstream_status` is the HTTP status from the first failing
upstream call (session first, then stats). This is debuggable;
the client surfaces it in the error UI for support diagnostics.

A non-2xx response from `GET /metrics` is NOT fatal:
the BFF SHALL still return HTTP 200 with `metrics: null` and
`metrics_status: <N>` so the Usage tab can render whatever data
is available (probed against canary 2026-05-20: `/metrics` returns
401 for anonymous keys, while `/session/stats` returns 200).

### R4 — Client hook

The dashboard SHALL expose `useMcpUsage(input)` in
`src/features/mcp/hooks/useMcpUsage.ts`, a React Query hook
returning the composed shape from R2. The hook SHALL:

- Use `enabled: !!input` so it does not fire without a selected
  key.
- Cache for at least 30 seconds (`staleTime`).
- NOT retry automatically on 5xx; the UI exposes a Retry button
  that re-invokes the query.

### R5 — Usage tab

The `/mcp` Usage tab SHALL render:

- An API-key selector populated from the user's API keys
  (existing `useApiKeys()` data source).
- When no key is selected: the placeholder copy from iteration
  3 plus a link to the API Keys page.
- When a key is selected and the hook is loading: a loading
  indicator.
- When a key is selected and the hook returned data: a small set
  of summary cards driven by the composed shape (e.g., total
  calls, last seen, by-tool breakdown if available), plus a
  collapsible `<details>` showing the raw JSON.
- When a key is selected and the hook errored: a single error
  card showing the error message, `upstream_status`, and a
  Retry button.

### R6 — Sidebar mounted

`Layout.tsx` SHALL mount `<Sidebar />` so that the MCP nav entry
introduced in `mcp-info-surface` R1 is visible in the live UI.
This requirement closes the iteration-3 follow-up: the route
existed but the nav entry was unreachable from the main app
shell.

### R7 — No upstream changes

This capability SHALL NOT modify `metabob-rpc-api` (frozen
0.16.13) or `metabob-mcp`. All new behavior lives in
`metabob-cloud-dashboard`.

## Non-requirements

- This capability does NOT specify per-tool-call telemetry (which
  exact tool fired when) beyond what rpc-api `/session/stats` and
  `/metrics` happen to expose. That is future work.
- This capability does NOT specify cross-key or org-level
  aggregate views. First surface is per-key.
- This capability does NOT require the
  `e2e/rubric/03-observe-mcp-usage.spec.ts` placeholder to be
  flipped to a real test; that depends on the rubric-unblock
  change (separate iteration tied to e2e auth-setup).
