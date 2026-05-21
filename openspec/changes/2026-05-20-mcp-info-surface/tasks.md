# Tasks: MCP Info Surface

Iteration 3 of the standalone-product loop. Ships static UI for the
`/mcp` route; live usage data deferred to iteration 5.

## §1 Catalog data

- [x] 1.1 Read each of the ten tool implementations in
      `repos/metabob-mcp/src/tools/*.ts` to extract: name, zod
      schema, summary, tier classification.
- [x] 1.2 Create
      `repos/metabob-cloud-dashboard/src/data/mcp-catalog.ts` with
      the `McpToolEntry` + `McpParameterDescriptor` types and the
      `MCP_TOOL_CATALOG` constant containing all ten entries.
      Leading comment must say: `// Mirror of
      metabob-mcp@<version>/src/tools/index.ts. Update this file
      whenever the mcp tool registry changes.`
- [x] 1.3 Tools and their tiers:
      - `predict_cochanges` — local
      - `analyze_impact` — local
      - `get_problems` — api
      - `annotate_component` — api
      - `mark_complete` — api
      - `get_metrics` — api
      - `search_codebase` — api
      - `init_workspace` — api
      - `assign_git_changes` — dual
      - `get_analysis_context` — dual

## §2 Route + page

- [x] 2.1 Create `repos/metabob-cloud-dashboard/src/routes/mcp.tsx`
      registering `/mcp` with `MCPSurfacePage` as the component.
- [x] 2.2 Create
      `repos/metabob-cloud-dashboard/src/features/mcp/MCPSurfacePage.tsx`
      — a tabs container with three tabs (Tools, Install, Usage).
      Use shadcn `Tabs` primitives.
- [x] 2.3 Create
      `repos/metabob-cloud-dashboard/src/features/mcp/ToolCatalogTab.tsx`
      — table over `MCP_TOOL_CATALOG`; click-to-expand parameter
      schema rendered as JSON in a `<pre>` (no syntax-highlighting
      dependency).
- [x] 2.4 Create
      `repos/metabob-cloud-dashboard/src/features/mcp/InstallTab.tsx`
      — two code blocks (npx + env-var), links to API Keys page
      and to `docs/PRODUCT_BOUNDARIES.md`.
- [x] 2.5 Create
      `repos/metabob-cloud-dashboard/src/features/mcp/UsagePlaceholderTab.tsx`
      — single Card naming iteration 5; cross-link to API Keys
      → Sessions.

## §3 Sidebar entry

- [x] 3.1 Open `src/shared/components/Sidebar.tsx`. Find the API
      Keys entry. Add a sibling "MCP" entry below it with a
      relevant lucide icon and `to="/mcp"`. Do NOT gate this entry
      on `activityViewsEnabled()`.

## §4 Verification

- [x] 4.1 `bun run build` succeeds; new code is type-clean.
- [x] 4.2 Boot `bun --hot src/index.ts`; navigate to `/mcp` in the
      browser; confirm three tabs render and the Tools tab shows
      ten entries. Capture a brief stdout / screenshot evidence.
- [x] 4.3 No regression in API Keys / login routes.

## §5 Commits & archive

- [x] 5.1 One commit inside cloud-dashboard on `dev`:
      `feat(cloud-dashboard): add /mcp route with tool catalog +
      install + usage placeholder`. No `Co-Authored-By`. Push.
- [x] 5.2 One commit in super-repo on `dev`:
      `docs(boundaries): note /mcp route + mcp-info-surface spec`.
      Bumps the submodule pointer; adds a brief paragraph to
      `docs/PRODUCT_BOUNDARIES.md` under a new "MCP surface in
      dashboard" section pointing at the route. No
      `Co-Authored-By`. Push.
- [ ] 5.3 Archive: move change dir to
      `openspec/changes/archive/2026-05-20-mcp-info-surface/` and
      lift the spec to `openspec/specs/mcp-info-surface/spec.md`.
