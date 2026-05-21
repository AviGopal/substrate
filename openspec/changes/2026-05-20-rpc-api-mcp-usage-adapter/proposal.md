# Proposal: rpc-api MCP Usage Adapter (BFF)

## Why

Iteration 3 shipped the `/mcp` route with a Usage tab placeholder
that names this iteration. The placeholder is honest scaffolding,
not a deliverable: a customer who logs in, copies their API key,
and runs `metabob-mcp` against rpc-api gets no observability into
their own usage. The product story needs that loop closed.

This iteration is the **first concrete exercise of the adapter-
layer principle** from `docs/PRODUCT_BOUNDARIES.md` R4: rpc-api is
frozen at 0.16.13, so net-new analysis-surface functionality lives
in the dashboard BFF, not as a patch to rpc-api.

What rpc-api exposes (frozen 0.16.13 surface, per
`repos/metabob-mcp/src/api-client.ts`):

- `POST /session { apiKey, project }` → opaque session token.
- `GET /session/stats` → per-session counts.
- `GET /metrics` → aggregate metrics.

Neither endpoint returns "usage by API key" directly. The BFF must
compose: dashboard knows the user's API keys (from user-vessel /
identity-vessel); per key, it exchanges to a rpc-api session and
queries `/session/stats` + `/metrics`. That composition is exactly
the dashboard-BFF adapter pattern the boundaries doc describes.

## What Changes

This change ships **one BFF route + one React Query hook + the
Usage tab wiring**. No mcp changes. No rpc-api changes.

1. **New BFF proxy route** in `repos/metabob-cloud-dashboard/src/index.ts`:
   `GET /api/mcp/usage?api_key_id=<id>`. Behavior:
   - Reads the JWT cookie / Bearer token; extracts the user's
     org_id (existing auth middleware).
   - Calls user-vessel to fetch the actual API key value for
     `api_key_id`, scoped to the org. (Reuses the existing
     user-vessel proxy plumbing.)
   - With that key, performs `POST ${RPC_API_URL}/session` and
     then `GET /session/stats` + `GET /metrics`.
   - Returns a composed JSON shape:
     ```jsonc
     {
       "api_key_id": "...",
       "session_id": "...",
       "stats": { /* /session/stats body */ },
       "metrics": { /* /metrics body */ },
       "fetched_at": "<ISO8601>"
     }
     ```
   - On any upstream failure: HTTP 502 with
     `{ error: "rpc_api_unreachable", upstream_status: N }`.

2. **React Query hook** at
   `repos/metabob-cloud-dashboard/src/features/mcp/hooks/useMcpUsage.ts`:
   `useMcpUsage(apiKeyId: string | null)` — returns the composed
   shape. `enabled: !!apiKeyId`. 30-second cache. No retries (the
   BFF already absorbs transient flakes; a user-visible "Retry"
   button suffices).

3. **Usage tab hydration**: replace the placeholder card body in
   `src/features/mcp/UsagePlaceholderTab.tsx` (or rename to
   `UsageTab.tsx`) with:
   - An API-key selector at the top (reuses the existing API keys
     list — the customer's keys, no creation here).
   - When a key is selected: a small summary card per metric
     (calls, tokens, last-seen, by-tool breakdown if available).
   - When no key is selected: the existing placeholder copy
     pointing at the API Keys page.
   - Loading / error states: spinner; on error, render the
     fetched-with-error state with a friendly message that
     includes `upstream_status` for support diagnostics.

4. **Mount the sidebar**: iteration 3 surfaced that
   `Sidebar.tsx` isn't actually rendered in `Layout.tsx`. The MCP
   nav entry is invisible today. This iteration mounts Sidebar in
   Layout so the entry shows up. **Scope contained**: don't
   redesign the sidebar; mount with current styles.

5. **Spec capability**: `rpc-api-mcp-usage-adapter` documenting
   the BFF contract, the composition flow, and that rpc-api is
   the only upstream (no activity-api).

## Non-Goals

- Per-tool-call telemetry (which exact tool fired when). rpc-api
  doesn't surface that at the granularity needed; future work
  via a vessel-side log if the demand justifies it.
- Cross-key aggregate views ("usage by org"). Out of scope; first
  surface is per-key. Aggregate is iteration-6+ material.
- Modifying rpc-api or mcp.
- Flipping `e2e/rubric/03-observe-mcp-usage.spec.ts` from skipped
  to active. The rubric remains blocked on `auth.setup.ts`;
  unblocking happens in its own change. Once unblocked, that
  spec can target the live Usage tab.

## Success Criteria

- `GET /api/mcp/usage?api_key_id=<id>` returns the composed
  JSON shape for a valid key + org; returns 502 on rpc-api
  unreachability with a debuggable body.
- `/mcp` Usage tab shows live data after selecting a key,
  loading state during fetch, error state on 502.
- Sidebar is mounted in Layout; MCP nav entry visible.
- `bun run build` succeeds; type-clean.
- Capability spec archived under
  `openspec/specs/rpc-api-mcp-usage-adapter/spec.md`.
