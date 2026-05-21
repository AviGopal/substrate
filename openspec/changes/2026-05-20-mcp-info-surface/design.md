# Design: MCP Info Surface

## Scope and rationale

Three competing options for "where does the tool catalog live":

- **A — mcp HTTP endpoint.** Add `GET /v1/catalog` to
  `metabob-mcp`. Pro: live, single source of truth. Con: every
  customer install becomes a catalog source — n versions, n
  endpoints, dashboard has to query each. Also pulls mcp into the
  dashboard runtime dependency graph.
- **B — rpc-api endpoint.** Out of bounds. rpc-api is frozen at
  0.16.13.
- **C (chosen) — static dashboard-side data, hand-written this
  iteration.** Catalog is a frozen list shipped with the dashboard
  release. Pros: no runtime fetch, no version coupling, customer
  installs of mcp don't have to do anything. Cons: catalog can drift
  from real mcp tool registry — addressed below.

Option C wins because the customer's mental model is "what does the
metabob product offer through MCP?" — that's a product-marketing
shape, not a per-install live query. When iteration 5 lands the BFF
adapter for *usage*, it will hit rpc-api per-key; the catalog stays
static.

## Drift control

A `metabob-mcp` change that adds or removes a tool needs to update
`src/data/mcp-catalog.ts` in cloud-dashboard. To avoid silent drift:

- The catalog file has a leading comment: `// Mirror of
  metabob-mcp@<version>/src/tools/index.ts. Update this file
  whenever the mcp tool registry changes.`
- A future iteration may add a `scripts/verify-mcp-catalog.ts`
  that diffs the catalog against a known-good registry dump.
  Iteration 4 doesn't ship that script; the leading comment is the
  load-bearing reminder.

The `since` field on each entry records the mcp version that
introduced the tool (best-effort from git history; defaults to
`"0.x"` if unknown). The `tier` field is the resolution tier
(`local`, `api`, `dual`) per the audit in iteration 1's findings.

## Route + tabs structure

TanStack Router file-based, mirroring the existing routes
(`execution-traces.tsx`, `usage-analytics.tsx`, `api-keys.tsx`,
etc.). Single file `src/routes/mcp.tsx`:

```tsx
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { MCPSurfacePage } from "@/features/mcp/MCPSurfacePage";

export const mcpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mcp",
  component: MCPSurfacePage,
});
```

`MCPSurfacePage` is a thin tabs container around three tab
components. shadcn/ui has `Tabs` primitives the existing pages
already use — reuse.

```tsx
<Tabs defaultValue="tools">
  <TabsList>
    <TabsTrigger value="tools">Tools</TabsTrigger>
    <TabsTrigger value="install">Install</TabsTrigger>
    <TabsTrigger value="usage">Usage</TabsTrigger>
  </TabsList>
  <TabsContent value="tools"><ToolCatalogTab /></TabsContent>
  <TabsContent value="install"><InstallTab /></TabsContent>
  <TabsContent value="usage"><UsagePlaceholderTab /></TabsContent>
</Tabs>
```

### ToolCatalogTab

Simple table:

| Tool | Tier | Since | Summary |
|---|---|---|---|
| `predict_cochanges` | local | 0.4 | Predict files likely to change together |
| ... | ... | ... | ... |

Row click expands an accordion below the row showing the parameter
schema (JSON-formatted, syntax highlighted with the existing
`<CodeBlock>` component if present, otherwise `<pre>`).

### InstallTab

Two code blocks:

1. Install + invoke:
   ```bash
   npx metabob-mcp@latest \
     --analysis-url https://ide.metabob.com \
     --identity-url https://identity.metabob.com
   ```
2. Env-var version (for IDE / Claude Desktop / etc.):
   ```bash
   export METABOB_API_KEY="<from dashboard>"
   export ANALYSIS_API_URL="https://ide.metabob.com"
   ```

Below: a link to `docs/PRODUCT_BOUNDARIES.md` and a link to the
API Keys page (since the customer needs a key first).

### UsagePlaceholderTab

A single `<Card>`: heading "MCP usage by key", body "Per-key MCP
usage will appear here once the BFF adapter ships (iteration 5 of
the standalone-product loop). Until then, see API Keys → Sessions
for raw session counts." Cross-link to API Keys.

## Sidebar entry

The sidebar lives at `src/shared/components/Sidebar.tsx` (per
iteration 1's audit — currently only carries an API Keys entry).
Add an "MCP" entry directly under "API Keys" with an icon (lucide
`Box` or similar — match existing aesthetic) and `to="/mcp"`. No
`activityViewsEnabled()` gate — MCP is part of the standalone
product, always shown.

## Catalog data shape

```ts
// src/data/mcp-catalog.ts

export interface McpToolEntry {
  name: string;
  tier: "local" | "api" | "dual";
  since: string;
  summary: string;
  parameters: Record<string, McpParameterDescriptor>;
}

export interface McpParameterDescriptor {
  type: "string" | "number" | "boolean" | "object" | "array";
  required?: boolean;
  description?: string;
  enum?: readonly (string | number)[];
}

export const MCP_TOOL_CATALOG: readonly McpToolEntry[] = [
  // ten entries...
] as const;
```

The actual entries are populated from
`repos/metabob-mcp/src/tools/*.ts` — the implementer should open
each tool file and read its zod schema, then translate to the
descriptor shape. Don't import zod schemas directly (mcp's zod
version may conflict with the dashboard's).

## Why no fetch from mcp in the Usage tab now

Two reasons:

1. The customer's mcp install runs **on their machine**, not in
   our cloud. The dashboard cannot reach it. Aggregate usage has
   to come from rpc-api (which sees every `/session` call) — and
   that's iteration 5.
2. Even if we could reach the customer's mcp, the surface needs an
   auth model and a discovery mechanism that don't exist yet for
   the standalone product. Out of scope.

## Risks

- **Drift from mcp.** Mitigated by the leading-comment reminder
  and a future verify-script. If mcp ships a tool change before
  the verify-script lands, the catalog stays stale until a manual
  update.
- **Empty Usage tab feels half-baked.** Acceptable — the
  placeholder names iteration 5 explicitly so customers see this
  is intentional, not broken. Alternative was to hide the tab
  entirely; we prefer visible scaffolding.

## Out of scope

- Iteration 5 — rpc-api adapter for live usage; hydrates the Usage
  tab.
- Live tool-call telemetry (per-call timing, errors). Future.
- mcp-side `/v1/catalog` endpoint. Not needed for this product.
