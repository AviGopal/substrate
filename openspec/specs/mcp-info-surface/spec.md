# Capability: mcp-info-surface

A dashboard surface that lets customers understand what
`metabob-mcp` offers and how to install it. Lives at the `/mcp`
route. Static in this iteration; live per-key usage hydrates via
the rpc-api BFF adapter (separate capability, later iteration).

## Requirements

### R1 — `/mcp` route exists and is always visible

`metabob-cloud-dashboard` SHALL register a `/mcp` route. The
sidebar nav SHALL include an "MCP" entry that navigates to it.
Neither the route nor the nav entry SHALL be gated by
`VITE_ENABLE_ACTIVITY_VIEWS`; the MCP surface is part of the
standalone product surface.

### R2 — Tool catalog tab

The `/mcp` route SHALL render a "Tools" tab listing every MCP
tool in `metabob-mcp`, sourced from a frozen TypeScript module
`src/data/mcp-catalog.ts`. Each entry SHALL expose:

- `name` — the tool identifier.
- `tier` — one of `local`, `api`, `dual`.
- `since` — the mcp version that introduced the tool.
- `summary` — one-line human-readable description.
- `parameters` — structured parameter schema (each parameter has
  `type`, optional `required`, optional `description`, optional
  `enum`).

The tab SHALL render a table or list of all entries. The
parameter schema SHALL be inspectable per-tool (e.g.,
click-to-expand). The catalog module SHALL carry a leading
comment naming the mcp version it mirrors and instructing readers
to update it whenever the mcp tool registry changes.

### R3 — Install tab

The `/mcp` route SHALL render an "Install" tab containing:

- A copy-pasteable `npx metabob-mcp@latest` invocation pointing
  at `https://ide.metabob.com` (analysis) and
  `https://identity.metabob.com` (identity).
- An environment-variable form (`METABOB_API_KEY`,
  `ANALYSIS_API_URL`) suitable for IDE / Claude Desktop / MCP
  client configuration.
- A link to `docs/PRODUCT_BOUNDARIES.md`.
- A link to the dashboard's API Keys page (since an API key is
  required to use mcp).

### R4 — Usage placeholder tab

The `/mcp` route SHALL render a "Usage" tab containing a
placeholder card stating that per-key usage data will appear once
the rpc-api BFF adapter ships (referencing the standalone-product
loop's iteration 5). The tab SHALL NOT fetch any backend data in
this iteration. The card SHALL cross-link to the API Keys page's
sessions panel for raw session counts.

### R5 — No backend changes

This capability SHALL NOT introduce new BFF proxy routes, new
dashboard-server endpoints, or any calls to `activity-api`,
`discovery-vessel`, or `mcp` itself. The catalog is static
dashboard data; usage is a deferred adapter.

### R6 — Type-cleanliness

The new code SHALL type-check under the dashboard's existing
TypeScript configuration (`bun run build` succeeds). No `any`
escapes from the catalog data shape; `MCP_TOOL_CATALOG` is typed
as `readonly McpToolEntry[]`.

## Non-requirements

- This capability does NOT specify automatic catalog generation
  from `metabob-mcp` sources. The catalog is hand-maintained;
  drift detection lives in a follow-up capability if needed.
- This capability does NOT require modifying `metabob-mcp` (no
  `/v1/catalog` endpoint, no schema export).
- This capability does NOT specify the live-usage adapter; that
  belongs to the iteration-5 capability tied to the rpc-api
  adapter layer.
- This capability does NOT require flipping
  `e2e/rubric/03-observe-mcp-usage.spec.ts` to a real test; that
  spec stays as a `test.skip(...)` placeholder until iteration 5
  hydrates the Usage tab.
