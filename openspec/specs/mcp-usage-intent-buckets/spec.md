# Capability: mcp-usage-intent-buckets

Re-buckets existing per-tool MCP usage counts into four intent
categories (`exploring`, `resolving`, `documenting`, `shipping`) and
surfaces them on the API Keys page and the `/mcp` Usage tab. Pure
UI derivation over the `by_tool` data already collected by
`mcp-usage-telemetry`; no new telemetry, no schema changes.

## Requirements

### R1 — Intent field on the tool catalog

`repos/metabob-cloud-dashboard/src/data/mcp-catalog.ts` SHALL declare
an `intent` field on `McpToolEntry`. The field's type SHALL be the
union `"exploring" | "resolving" | "documenting" | "shipping"`,
exported as `McpIntent`.

Every entry in `MCP_TOOL_CATALOG` SHALL have a non-null `intent`.
The mapping for the v0.2.6 catalog SHALL be:

- `exploring`: `init_workspace`, `get_problems`, `search_codebase`,
  `analyze_impact`, `predict_cochanges`, `get_analysis_context`,
  `get_metrics`.
- `resolving`: `mark_complete`.
- `documenting`: `annotate_component`.
- `shipping`: `assign_git_changes`.

When the catalog is updated to mirror a new `metabob-mcp` release,
any new tool MUST receive an `intent` assignment in the same change
that adds it.

### R2 — IntentBreakdown component

A new component SHALL exist at
`src/features/mcp/components/IntentBreakdown.tsx` with props:

```ts
interface IntentBreakdownProps {
  byTool: Record<string, number>;
  variant?: "inline" | "card";  // default "inline"
}
```

Behaviour:

- Derive a `Map<McpIntent, number>` by iterating `byTool` entries
  and looking up each `tool_name` in `MCP_TOOL_CATALOG`.
- Tools NOT present in the catalog SHALL contribute to neither
  any rendered bucket nor an `"unknown"` rendered bucket. They
  SHALL produce one `console.warn` per session (deduped by tool
  name) so version skew is visible without leaking UI clutter.
- The rendered output SHALL be a flex row of exactly four badges,
  one per intent, sorted `exploring → resolving → documenting →
  shipping`.
- Badges with `count === 0` SHALL render with
  `text-muted-foreground` and `opacity-60` (visible but dimmed).
- Each badge SHALL display an icon (lucide), a numeric count, and
  the intent label.
- The `card` variant SHALL include hover tooltips listing which
  tools count toward each bucket. The `inline` variant SHALL NOT
  include tooltips (keeps the row tap-friendly on mobile).
- The container SHALL expose `data-testid="intent-breakdown"` and
  each badge SHALL expose `data-intent="<intent>"`.

### R3 — API Keys page wires inline variant

`APIKeysPage`'s `KeyRow` SHALL render
`<IntentBreakdown variant="inline" byTool={usage?.by_tool ?? {}} />`
on a new flex row positioned below the existing `<UsageBadge>` row
and above the existing meta row. The component SHALL be rendered
only when the key is `active` (parity with `UsageBadge`).

`UsageBadge` SHALL remain unchanged; the existing rubric assertion
"`\d+ calls`" continues to assert on `UsageBadge`, not on
`IntentBreakdown`.

### R4 — /mcp Usage tab wires card variant

The `UsageTab` component SHALL render
`<IntentBreakdown variant="card" byTool={snapshot.by_tool} />` as a
full-width card positioned above the existing per-tool summary
cards. The card SHALL render even when `snapshot.total_calls === 0`,
with all four buckets reading 0; the rendered all-zero state is
informative (it communicates "no activity in any intent" rather
than hiding the surface).

### R5 — Rubric assertion (light)

`e2e/rubric/01-onboard.spec.ts` SHALL include one additional
assertion: after navigating to `/api-keys` for the seeded user,
the seeded key's row SHALL contain an element with
`[data-testid="intent-breakdown"]` that contains at least one
badge with a non-zero count. The seed already emits one telemetry
POST for `init_workspace` (in `global-setup.ts`), so the
`exploring` badge MUST be non-zero by the time this spec runs.

`bun run dev-loop` MUST continue to return `failed: 0` with this
new assertion in place.

### R6 — Standalone surface and adjacent contracts preserved

This capability SHALL NOT introduce dependencies on `activity-api`,
`discovery-vessel`, or `rpc-api`. It SHALL NOT modify
`UsageBadge`'s contract or `McpUsageResponse`'s shape.
`mcp-usage-telemetry` R1-R9 and `team-lead-key-overview` R1-R7
remain in force.

## Non-requirements

- This capability does NOT specify time-windowed slicing
  (this-week vs. all-time).
- This capability does NOT specify per-user aggregation.
- This capability does NOT specify a click-through to a
  filtered view.
- This capability does NOT specify localisation of intent labels
  (English-only ships).
- This capability does NOT modify the on-wire `by_tool` shape,
  user-vessel's schema, or `metabob-mcp`.
