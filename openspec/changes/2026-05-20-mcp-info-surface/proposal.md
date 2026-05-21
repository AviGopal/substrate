# Proposal: MCP Info Surface in cloud-dashboard

## Why

Iterations 1 and 2 established the boundary contract and the
driveable dev loop. The standalone product still has a gap: a
customer who installs `metabob-mcp` has no place in the dashboard
to **see what MCP exposes or what their key has been doing through
it**. The product story "manage API keys, observe usage,
understand MCP" is incomplete without that view.

Today:

- `metabob-mcp` ships ten MCP tools (`src/tools/index.ts`); the
  catalog is fixed per release.
- MCP authenticates per-call to rpc-api with a `Bearer <session>`
  token derived from the customer's API key. rpc-api offers
  `GET /session/stats` and `GET /metrics` (frozen 0.16.13 surface)
  which expose per-session counts.
- The dashboard already manages API keys and shows a usage panel
  (gated by `VITE_ENABLE_ACTIVITY_VIEWS` in iteration 1). There is
  no MCP-specific view.

Adding a `/mcp` route surfaces the static tool catalog (no
backend required) and — once the rpc-api adapter lands in
iteration 5 — a per-key usage view. This iteration ships the
**static** part: tool catalog, install instructions, and a
placeholder for usage that the iteration-5 BFF will hydrate.

It also exercises the **adapter-layer principle** stated in
`docs/PRODUCT_BOUNDARIES.md` R4: the tool catalog lives in the
dashboard repo (not as a new rpc-api endpoint, not as an addition
to mcp's HTTP surface), as a generated TypeScript module derived
from `metabob-mcp/src/tools/index.ts`.

## What Changes

This change ships static UI. No new rpc-api calls. No live MCP
queries.

1. **New TypeScript module**
   `repos/metabob-cloud-dashboard/src/data/mcp-catalog.ts`
   exporting `MCP_TOOL_CATALOG: McpToolEntry[]` — a frozen list of
   the ten tools (`predict_cochanges`, `analyze_impact`,
   `get_problems`, `annotate_component`, `mark_complete`,
   `get_metrics`, `search_codebase`, `init_workspace`,
   `assign_git_changes`, `get_analysis_context`).
   Each entry: `{ name, summary, parameters, tier, since }`. The
   list is **hand-written** in this iteration (not auto-generated)
   because the mcp tool registry is non-trivial to introspect at
   build time; a generation script is a follow-up.

2. **New route**: `/mcp` at
   `repos/metabob-cloud-dashboard/src/routes/mcp.tsx`. Tabs:
   - **Tools** — table of `MCP_TOOL_CATALOG` with name, summary,
     tier badge, "since" version. Click-to-expand shows the
     parameter schema.
   - **Install** — copy-pasteable install snippet for the customer's
     MCP client (`npx metabob-mcp`, env-var setup pointing at
     identity.metabob.com + ide.metabob.com, link to docs).
   - **Usage** — placeholder card: "Per-key MCP usage will appear
     here once the BFF adapter ships (iteration 5)." No fetch.

3. **Sidebar nav entry**: "MCP" entry, visible regardless of
   `VITE_ENABLE_ACTIVITY_VIEWS` (the MCP surface is part of the
   standalone product, not gated by the research-mode flag).
   Placed under the existing API Keys entry.

4. **No backend changes.** No new BFF proxy routes. The Usage tab
   is a placeholder.

5. **Rubric link-up**: `e2e/rubric/03-observe-mcp-usage.spec.ts`
   keeps its `test.skip(true, ...)` for now; iteration 5 (or a
   future iteration tied to the rpc-api adapter) flips the skip
   when the Usage tab has real data.

## Non-Goals

- Live tool-call telemetry. Iteration 5 (rpc-api adapter).
- Auto-generation of the catalog from `metabob-mcp`. Follow-up.
- Versioned tool-catalog comparison ("what changed between mcp
  0.x and 0.y"). Future work.
- Modifying `metabob-mcp` to expose a catalog endpoint. Out of
  scope; the catalog is dashboard-side data.

## Success Criteria

- `/mcp` route renders with three tabs: Tools, Install, Usage.
- Tools tab lists all ten current MCP tools with their parameter
  schemas inspectable.
- Install tab shows a working install snippet and points at
  PRODUCT_BOUNDARIES.md.
- Usage tab shows a placeholder card naming iteration 5.
- Sidebar shows "MCP" entry; clicking navigates to `/mcp`.
- `bun run build` succeeds; new code is type-clean.
- New capability spec `mcp-info-surface` archived under
  `openspec/specs/mcp-info-surface/spec.md`.
