# Design: rpc-api MCP Usage Adapter

## Scope and rationale

This is the **first concrete BFF adapter** under the principle in
`docs/PRODUCT_BOUNDARIES.md` R4. The shape of the adapter sets a
precedent for future cases (cross-key aggregation, project-level
budgets, etc.), so a few decisions matter:

- **Composition lives in the dashboard server, not the React
  client.** The client gets one JSON shape, fully composed, with
  one network round-trip per render. Doing composition client-side
  would expose internal endpoints to the browser and require
  serial network hops.
- **rpc-api is the only upstream this adapter calls.** No
  activity-api, no discovery. That keeps the standalone-mode
  guarantee intact (R1 of `standalone-product-surface`).
- **The adapter does not cache** beyond React Query's 30-second
  window. rpc-api owns the authoritative numbers; persistent
  caching would require invalidation we don't need yet.

## BFF route shape

`GET /api/mcp/usage?api_key_id=<id>` — read-only.

Implementation in `repos/metabob-cloud-dashboard/src/index.ts`,
placed alongside the existing proxy routes. Pseudocode:

```ts
if (pathname === "/api/mcp/usage" && req.method === "GET") {
  const apiKeyId = url.searchParams.get("api_key_id");
  if (!apiKeyId) return errorResponse("api_key_id required", 400);

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return errorResponse("unauthorized", 401);

  // 1. Fetch the actual API key value from user-vessel.
  //    user-vessel exposes the org-scoped list; we resolve id → key.
  const keyResp = await fetch(`${USER_VESSEL_URL}/v2/api-keys/${apiKeyId}/reveal`, {
    headers: { authorization: authHeader },
  });
  if (!keyResp.ok) return errorResponse("api_key_not_found", 404);
  const { key } = await keyResp.json();

  // 2. Exchange key for rpc-api session.
  const sessionResp = await fetch(`${RPC_API_URL}/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey: key, project: "default" }),
  });
  if (!sessionResp.ok) {
    return new Response(
      JSON.stringify({ error: "rpc_api_unreachable", upstream_status: sessionResp.status }),
      { status: 502, headers: { "content-type": "application/json" } }
    );
  }
  const { session } = await sessionResp.json();

  // 3. Fetch stats + metrics in parallel.
  const headers = { authorization: `Bearer ${session}` };
  const [statsResp, metricsResp] = await Promise.all([
    fetch(`${RPC_API_URL}/session/stats`, { headers }),
    fetch(`${RPC_API_URL}/metrics`, { headers }),
  ]);
  if (!statsResp.ok || !metricsResp.ok) {
    return new Response(
      JSON.stringify({
        error: "rpc_api_unreachable",
        upstream_status: statsResp.ok ? metricsResp.status : statsResp.status,
      }),
      { status: 502, headers: { "content-type": "application/json" } }
    );
  }

  return Response.json({
    api_key_id: apiKeyId,
    session_id: session,
    stats: await statsResp.json(),
    metrics: await metricsResp.json(),
    fetched_at: new Date().toISOString(),
  });
}
```

Note: `user-vessel`'s `/v2/api-keys/<id>/reveal` endpoint may not
exist by that exact name — the implementer should grep user-vessel
proxy table and adjust to the actual endpoint the dashboard uses
when surfacing keys today. If user-vessel only returns key
*metadata* (not the raw key), this design needs revisiting (see
"Risks" below).

## Risks and adjustments

- **Risk: user-vessel may not expose the raw key value via API
  after creation.** Most key-management systems return the raw key
  exactly once (at create time) and store only a hash thereafter.
  If that's the case here, the BFF cannot exchange `api_key_id` →
  rpc-api session via user-vessel.

  **Mitigation paths** (pick during apply):
  1. The dashboard client already has the raw key in-memory only
     at create time. We could persist it briefly in
     `sessionStorage` for the current browser session and have the
     client send the raw key in the BFF request body (move from
     `GET /api/mcp/usage?api_key_id=…` to
     `POST /api/mcp/usage { raw_key }`). Acceptable security
     posture if scoped to a single session.
  2. Add a user-vessel endpoint to mint a short-lived rpc-api
     session on behalf of `(org_id, api_key_id)`. That requires
     extending user-vessel, not rpc-api — still within the adapter
     principle, just moved one hop. Larger change; defer.
  3. Cache the raw key in a server-side store keyed by user
     session. Worst option (extra surface for key leakage).

  Implementer should grep user-vessel for `api-keys/.*/reveal` or
  similar; if absent, pick option 1 for this iteration and note
  option 2 as follow-up.

- **Risk: rpc-api `/session/stats` and `/metrics` may not contain
  the data shape we assume.** The implementer should call them
  manually first (against canary `ide.metabob.com` with a test
  key) to learn the actual shapes. The Usage tab adapts to what's
  available — even raw counts are an improvement over the
  placeholder.

- **Risk: the dashboard runs locally during this iteration; we
  may not have an org+key+rpc-api triple ready to test
  end-to-end.** Acceptable to verify the BFF route returns a
  meaningful 502 when called without setup, and confirm the
  composed-success path on canary post-deploy.

## Sidebar mount

`Layout.tsx` currently renders only `<Header />` + `<main>`.
Mount `<Sidebar />` per the existing pattern (probably a flex
container with sidebar on the left, main on the right). Match
existing widths if there are any sidebar styles already in
`Sidebar.tsx`. **Don't** redesign anything; the goal is "the MCP
nav entry shows up." If the sidebar styles need work, that's a
separate change.

## Usage tab UI

Replace the placeholder. Top: a `<Select>` (the existing shadcn
primitive) bound to the user's API keys list (reuse
`useApiKeys()`). Bottom: a small grid of cards driven by
`useMcpUsage(selectedKeyId)`.

Cards:

- **Total calls** — `stats.total_calls` or equivalent.
- **Last seen** — relative time from `stats.last_seen_at`.
- **By tool** — small list if the response includes a breakdown.
- **Raw shape** — collapsible `<details>` that dumps the raw
  composed JSON, useful for debugging.

Loading: replace cards with skeletons or a spinner.
Error: a single card with the `error` field + `upstream_status` +
a "Retry" button (just re-runs the query).

## Out of scope

- Per-tool-call telemetry beyond what `/session/stats` and
  `/metrics` happen to expose. Future work.
- Cross-key aggregation, project-scoped views, alerting.
- Modifying rpc-api or mcp.
