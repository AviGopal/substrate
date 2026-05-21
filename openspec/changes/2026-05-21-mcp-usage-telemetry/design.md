# Design: MCP Usage Telemetry

## Scope and rationale

This is the cleanest of the three paths investigated 2026-05-21:

- **A (chosen) — client→vessel telemetry shim.** mcp publishes
  per-call events to user-vessel; dashboard reads from user-vessel.
- B — share rpc-api session_id between mcp and dashboard. Couples
  two processes' sessions; breaks on mcp restart; doesn't generalize
  to multi-IDE installs.
- C — mock the telemetry in the rubric only. Pretends a gap doesn't
  exist; the production dashboard still shows zeros forever.

A wins because it (a) makes the observation contract explicit
rather than implicit in rpc-api's session model, (b) survives the
rpc-api freeze and any future rpc-api replacement, (c) uses the
table that already owns api_key lifecycle (user-vessel), and (d) is
small — one table, two endpoints, one mcp module, one dashboard BFF
edit.

## Data model

New table in user-vessel: **`mcp_usage_snapshot`** (SCHEMAFULL,
SurrealDB).

```sql
DEFINE TABLE mcp_usage_snapshot SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $token.org_id
    FOR create, update, delete WHERE org_id = $token.org_id;

DEFINE FIELD api_key_id ON mcp_usage_snapshot TYPE string
  ASSERT $value != NONE;
DEFINE FIELD org_id ON mcp_usage_snapshot TYPE string
  ASSERT $value != NONE;
DEFINE FIELD user_id ON mcp_usage_snapshot TYPE string
  ASSERT $value != NONE;
DEFINE FIELD total_calls ON mcp_usage_snapshot TYPE int VALUE $value OR 0;
DEFINE FIELD total_failures ON mcp_usage_snapshot TYPE int VALUE $value OR 0;
DEFINE FIELD last_seen_at ON mcp_usage_snapshot TYPE datetime;
DEFINE FIELD first_seen_at ON mcp_usage_snapshot TYPE datetime
  VALUE $before OR time::now();
DEFINE FIELD by_tool ON mcp_usage_snapshot TYPE object DEFAULT {};
DEFINE FIELD mcp_version ON mcp_usage_snapshot TYPE string
  DEFAULT "unknown";

DEFINE INDEX idx_mcp_usage_by_key ON mcp_usage_snapshot FIELDS api_key_id;
DEFINE INDEX idx_mcp_usage_by_org ON mcp_usage_snapshot FIELDS org_id;
```

One row per `api_key_id`. `by_tool` is `{ tool_name: count }`
(SurrealDB object, no schema on inner fields). Upsert semantics: an
event for a key that has no row creates the row; subsequent events
increment counters and update `last_seen_at`.

Why snapshot (not event log)? Two reasons:
- The read surface (`/mcp` Usage tab) wants aggregates. Querying an
  event table at every render is wasteful.
- Storage is bounded by `(orgs × keys)`, not call volume.

The event-level audit log is a future capability if needed.

## API contracts

### `POST /v2/mcp/usage` (mcp → user-vessel)

Auth: `Authorization: ApiKey <raw-key>`. user-vessel resolves to
`(org_id, user_id, api_key_id)` via the existing identity-vessel
resolve path.

Body:

```jsonc
{
  "tool_name": "predict_cochanges",   // string
  "success": true,                     // bool
  "duration_ms": 420,                  // int, optional
  "error_code": null,                  // string, optional
  "mcp_version": "0.2.6"               // string, optional
}
```

Behavior:
- Resolve key → `(org_id, user_id, api_key_id)`. On unresolvable
  key: 401.
- Upsert `mcp_usage_snapshot` row keyed by `api_key_id`:
  - `total_calls += 1`.
  - `total_failures += (success ? 0 : 1)`.
  - `by_tool[tool_name] = (by_tool[tool_name] OR 0) + 1`.
  - `last_seen_at = time::now()`.
  - `org_id`, `user_id` set on first write; immutable thereafter
    (PERMISSIONS prevent cross-org writes; an api_key can only ever
    belong to one org).
  - `mcp_version` updated if provided.
- Returns 204 No Content on success. Errors return 4xx/5xx with
  `{ error, message }`.

### `GET /v2/mcp/usage?api_key_id=<id>` (dashboard BFF → user-vessel)

Auth: `Authorization: Bearer <jwt>`.

Returns:

```jsonc
{
  "api_key_id": "key_abc",
  "org_id": "organizations:foo",
  "total_calls": 142,
  "total_failures": 3,
  "last_seen_at": "2026-05-21T18:00:00Z",
  "first_seen_at": "2026-05-21T09:00:00Z",
  "by_tool": { "predict_cochanges": 30, "get_problems": 100, ... },
  "mcp_version": "0.2.6"
}
```

When no snapshot exists (key never used): 200 with
`{ api_key_id, total_calls: 0, by_tool: {}, last_seen_at: null }`.
Cross-org reads naturally return empty via PERMISSIONS.

## metabob-mcp telemetry module

New file `src/telemetry.ts`:

```ts
interface TelemetryEvent {
  tool_name: string;
  success: boolean;
  duration_ms?: number;
  error_code?: string;
  mcp_version: string;
}

class Telemetry {
  private buffer: TelemetryEvent[] = [];
  private endpoint: string;
  private apiKey: string;
  private enabled: boolean;

  constructor(opts: { endpoint?: string; apiKey?: string; mcpVersion: string }) {
    this.endpoint = opts.endpoint ?? "https://user.metabob.com";
    this.apiKey = opts.apiKey ?? "";
    this.enabled = process.env.METABOB_TELEMETRY !== "off"
      && !!this.apiKey;
  }

  record(event: TelemetryEvent): void {
    if (!this.enabled) return;
    this.buffer.push(event);
    void this.flush(); // fire-and-forget
  }

  private async flush(): Promise<void> {
    while (this.buffer.length > 0) {
      const ev = this.buffer.shift()!;
      try {
        await fetch(`${this.endpoint}/v2/mcp/usage`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "Authorization": `ApiKey ${this.apiKey}`,
          },
          body: JSON.stringify(ev),
        });
      } catch {
        // Put it back and bail until next call
        this.buffer.unshift(ev);
        return;
      }
    }
  }
}
```

Wire-in: in `src/index.ts`, instantiate `Telemetry` next to
`AuthService`. In the tool-dispatch loop (wherever
`TOOL_REGISTRY[name](params)` is called), wrap with timing +
`telemetry.record(...)` on both success and exception.

Fire-and-forget by design — telemetry MUST NOT block tool
execution. Buffer is in-memory; lost on process exit. A future
iteration can add disk persistence if usage data turns out to be
load-bearing for billing.

`METABOB_TELEMETRY=off` disables emission entirely (for users who
opt out, or for unit tests).

## cloud-dashboard BFF rewrite

`src/index.ts` `/api/mcp/usage` handler today:

```ts
// 1. Validate auth
// 2. POST rpc-api /session { apiKey: raw_key }
// 3. GET rpc-api /session/stats + /metrics in parallel
// 4. Compose
```

Rewrites to:

```ts
if (pathname === "/api/mcp/usage" && req.method === "GET") {
  const apiKeyId = url.searchParams.get("api_key_id");
  if (!apiKeyId) return errorResponse("api_key_id required", 400);

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return errorResponse("unauthorized", 401);

  const upstream = await fetch(
    `${USER_VESSEL_URL}/v2/mcp/usage?api_key_id=${encodeURIComponent(apiKeyId)}`,
    { headers: { authorization: authHeader } }
  );
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}
```

Method changes from `POST { raw_key }` to `GET ?api_key_id=`. The
raw-key stash + the sessionStorage shim in mcp-info-surface become
redundant — but **we leave the rawKeyStash module in place** for
now, with a deprecation comment. Removing it touches the API Keys
page and is out of scope for this iteration.

## Rubric `03-observe-mcp-usage` extension

The current spec asserts the BFF call fires and either summary
cards or an error card render. The extended spec:

1. `beforeAll`: spawn `bunx metabob-mcp` as a subprocess with the
   seeded API key and `METABOB_TELEMETRY=on`. Invoke a single
   `init_workspace` tool via the MCP stdio handshake against a
   throwaway 3-file fixture under `e2e/fixtures/mcp-workspace/`.
   Wait for the response. Confirm `POST /v2/mcp/usage` succeeded
   (curl user-vessel to verify the snapshot exists).
2. Then run the existing assertions: navigate `/mcp` → Usage tab →
   select seeded key → assert summary cards render with
   `total_calls >= 1` and `by_tool.init_workspace >= 1`.
3. `afterAll`: kill the mcp subprocess. Best-effort delete the
   snapshot via direct user-vessel query (test cleanliness).

Implementation note: spawning a real mcp subprocess in CI is
heavier than the rest of the rubric. If CI feedback shows it's
flaky/slow, fall back to a small Node script that just emits the
telemetry POST directly (skipping the mcp binary). The contract
the dashboard cares about is the snapshot, not the protocol layer.

## Migration

New table only — no schema changes to existing user-vessel tables.
The migration ships as `repos/user-vessel/sql/00X-mcp-usage-snapshot.surql`
appended to the existing migration list. user-vessel's init flow
runs it on next startup.

## Risks

- **PII**: `mcp_usage_snapshot` rows do NOT contain user input,
  file paths, or tool arguments. Just counts + tool names. Standard
  RBAC scoping by `$token.org_id` matches the existing pattern. No
  new privacy surface.
- **Rate**: an mcp client could spam telemetry. user-vessel's
  existing rate limiter (per API key) absorbs this; if it doesn't,
  the snapshot update is a single UPSERT so cost stays bounded.
- **Cross-process drift**: a deployed dashboard might still send
  `POST /api/mcp/usage { raw_key }` if it's older than the BFF
  rewrite. Migration: change BFF to accept BOTH `GET ?api_key_id=`
  AND legacy `POST { raw_key }` for one release, then drop POST.

## Out of scope

- Replacing rawKeyStash. Dashboard keeps it temporarily; clean it
  up in a follow-up.
- Event log table (separate from snapshot). Future capability.
- Per-tool latency histograms. Snapshot stores total counts only;
  histograms need a separate aggregation path.
- mcp telemetry persistence across crashes. In-memory buffer only.
- Surfacing telemetry in cloud-dashboard's `/usage-analytics`.
  That page is gated by `VITE_ENABLE_ACTIVITY_VIEWS`; cost-axis
  view is a separate iteration.
