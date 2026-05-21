# Capability: stylesheet-refresh

Targeted UI debt cleanup for the cloud-dashboard, scoped to
observable violations from the `ui-audit` baseline. Replaces a
hand-rolled tabs control with the shadcn Tabs primitive, swaps
Sidebar emoji icons for lucide-react, constrains the API-key
fingerprint display, tightens the meta-row layout, and
introduces a design-token surface wired into Tailwind. No new
features; no theme overhaul.

## Implementation requirements

R1-R5 below are SATISFIED by the bbcdf5c canary deploy
(2026-05-21). R7-R8 are scoped to the dev-loop rubric and the
no-cross-contract invariant; both held at deploy time.

Implementation note: `bunx shadcn add tabs` was blocked in the
sandboxed dev environment (no outbound network for the shadcn
CLI). As a substitute, `src/shared/components/ui/tabs.tsx` was
hand-written with the same Radix-style API
(`Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`) so the rest of
the spec stays drop-in compatible. A future swap to the
shadcn-installed primitive is a pure re-export and does not
require touching `MCPSurfacePage.tsx`.

## Requirements

### R1 — Tabs primitive replaces hand-rolled control

`src/features/mcp/MCPSurfacePage.tsx` SHALL use the shadcn
`Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` components
from `src/shared/components/ui/tabs.tsx` (added by
`bunx shadcn add tabs`).

The hand-rolled `role="tablist"` / `role="tab"` / `role="tabpanel"`
markup at the top of the component SHALL be removed.

The visible tab order (`Tools` / `Install` / `Usage`) and the
default active tab (`Tools`) SHALL be preserved.

### R2 — Sidebar uses lucide-react icons

`src/shared/components/Sidebar.tsx` SHALL import icons from
`lucide-react` (at minimum `Key` for the API Keys entry and
`Boxes` for the MCP entry) and render them via an icon
component reference, not via a string→emoji map.

The inline `Icon` helper component and its emoji glyph map
SHALL be removed. Rendered icons SHALL use `className="h-5 w-5"`.

### R3 — API key fingerprint constrained and copyable

The `<code>` element rendering `maskKey(apiKey.prefix)` in
`APIKeysPage.tsx`'s `KeyRow` SHALL be:

- Wrapped in a `flex items-center gap-2 min-w-0` container.
- Styled with `truncate max-w-xs font-mono text-xs`.
- Carry `title={maskKey(apiKey.prefix)}` so the full masked
  fingerprint is available on hover.

Immediately after the `<code>` element, a copy-to-clipboard
button SHALL be rendered. The button SHALL:

- Copy `apiKey.prefix` (the un-masked 12-char identifier, NOT
  the raw key — which the dashboard does not have post-creation).
- Render the lucide `Clipboard` icon, switching to `Check` for
  2 seconds after a successful copy.
- Be at least 24×24 CSS px (matches `ui-audit` tap-target floor).
- Carry `aria-label="Copy key prefix"`.
- Gracefully no-op when `navigator.clipboard` is unavailable
  (no error toast; button visually disabled).

### R4 — Meta-row tightened

The `KeyRow` meta-row (containing `created X`, `N/M conn`,
optional `show usage`) SHALL use class string
`flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground tabular-nums`.

The previous mix of `gap-x-3 gap-y-0.5` SHALL be removed.

### R5 — Design tokens

`src/styles/tokens.css` SHALL exist and SHALL define CSS custom
properties under `@layer base` for:

- Type scale: `--text-scale-xs`, `--text-scale-sm`,
  `--text-scale-base`, `--text-scale-lg`, `--text-scale-xl`.
- Spacing scale: `--space-scale-1` through `--space-scale-6`.
- Radii: `--radius-sm`, `--radius-md`, `--radius-lg`,
  `--radius-full`.
- Focus ring: `--ring-color`, `--ring-width`.

The values SHALL match the current visual scale (no visual
change from this requirement in isolation; the file is a
re-statement of the existing scale in token form).

`src/styles/index.css` SHALL import `tokens.css` BEFORE the
Tailwind layer directives.

`tailwind.config.ts` SHALL extend `theme.extend.fontSize` and
`theme.extend.borderRadius` to reference the CSS custom
properties via `"var(--...)"` strings. The spacing scale and
colour palette are NOT extended in Tailwind in this capability
(reserved for a future change).

## Measurement gate — satisfied 2026-05-21

The `ui-audit` capability shipped on 2026-05-21 with the post-refresh
baseline captured against the deployed bbcdf5c dashboard. No
pre-refresh baseline is available — the refresh shipped before this
audit existed — so the original R6 ratio comparison (50% drop) is
unverifiable in principle. In its place, the audit run against the
refreshed dashboard satisfies the gate by producing zero axe critical
or serious violations (the hard-fail bar in
`07-ui-quality.spec.ts`). Two pre-existing serious findings discovered
in the process (48× `color-contrast` on `UsageBadge` and 1×
`scrollable-region-focusable` on `<pre>` snippets) were fixed as part
of the ui-audit ship. Baseline numbers are recorded in the ui-audit
change's `design.md` `## Captured baseline (2026-05-21)` section.

### R6 — Measurement gate (satisfied; see note above)

A baseline `ui-audit.json` SHALL be captured against the
pre-refresh dashboard (i.e. before bbcdf5c was deployed); the
canonical artifact lives at `e2e/results/ui-audit.json` in the
dashboard repo and is referenced from the ui-audit change's
`design.md` `baseline-counts:` block (not committed under
`openspec/changes/`).

A post-refresh `ui-audit.json` SHALL be captured against the
deployed bbcdf5c dashboard.

The post-refresh report SHALL satisfy:

- `summary.axe_count.critical <= baseline.summary.axe_count.critical`.
- `summary.axe_count.serious <= baseline.summary.axe_count.serious`.
- `summary.overflow_count + summary.truncation_count +
  summary.tap_target_count <= 0.5 * (baseline overflow + truncation
  + tap_target)`. If the baseline sum is < 4 (too small for a
  meaningful ratio), the absolute post-refresh sum SHALL be
  `<= baseline_sum - 1`.

### R7 — Rubric stays green

`bun run dev-loop` SHALL return `failed: 0` after the refresh.
This includes the `07-ui-quality.spec.ts` gate from the
`ui-audit` capability.

If the migration to the shadcn Tabs primitive (R1) breaks an
existing rubric assertion (e.g., a spec that targets the inline
`<button role="tab">` by attribute), the spec assertion SHALL be
updated to target the new primitive's accessible name; the
primitive's behaviour SHALL NOT be modified to preserve the old
spec.

### R8 — Standalone surface and adjacent contracts preserved

This capability SHALL NOT introduce dependencies on
`activity-api`, `discovery-vessel`, or `rpc-api`. It SHALL NOT
modify env-var contracts. It SHALL NOT alter the
`McpUsageResponse` shape, `UsageBadge` rendering contract, or
`IntentBreakdown` props. Standalone-product-surface R1-R7,
mcp-usage-telemetry R1-R9, team-lead-key-overview R1-R7,
mcp-usage-intent-buckets R1-R6, and ui-audit R1-R10 remain in
force.

## Non-requirements

- This capability does NOT introduce a dark-mode theme switcher.
- This capability does NOT rewrite component-level Tailwind
  utility classes to consume the new spacing tokens.
- This capability does NOT add a `?theme=` URL param or any
  per-user theme persistence.
- This capability does NOT modify `UsageBadge`, `IntentBreakdown`,
  or any component outside `APIKeysPage`, `MCPSurfacePage`,
  `Sidebar`, the new `tokens.css`, and `tailwind.config.ts`.
- This capability does NOT specify dark-mode contrast tuning.
- This capability does NOT migrate to Radix Themes, CSS-in-JS, or
  any alternative styling layer.
- This capability does NOT specify a Storybook setup.
- This capability does NOT add Playwright visual-regression
  snapshots.
- This capability does NOT modify backend services, the BFF
  proxy, env vars, or the rpc-api contract.
