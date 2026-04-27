# Design: Workbench Simplification & Trajectory Refocus

## Context

The workbench is the human-facing surface for the activity system. Its primary job is to let users understand what activities do and verify that executions proceeded as expected. This requires showing impulse content — not just shape labels. The current layout prevents this: panels are cramped, the right panel vanishes at <1280px, and impulse content is never fetched.

This spec addresses layout, data, and navigation simultaneously because they are coupled: showing impulse content inline requires removing the fixed right panel to reclaim horizontal space; removing the right panel requires moving vessel/goal controls to the top bar; moving controls to the top bar requires the left sidebar to become a narrow tab strip. The changes compose.

---

## D1: Pages Removed

**Decision**: Remove `CompositionBuilderPage` and `StudioPage` from navigation and routes. Redirect their routes to `/trajectory`.

**CompositionBuilderPage** (`repos/workbench/src/pages/CompositionBuilderPage.tsx`):
The DAG canvas (React Flow node editor) was built before the trajectory grid existed. The trajectory grid (`TrajectoryGridWithDnd`) is now the canonical composition surface, with drag-reorder, shape-flow validation, seed shapes, and gap-free deletion. The DAG canvas duplicates this capability with worse UX. It is not referenced from any other page except via the router.

Route: `repos/workbench/src/router.tsx` — change `/compositions/builder` route to `redirect: '/trajectory'` using TanStack Router's `redirect` option in the `beforeLoad` hook.

Navigation entry: remove from `repos/workbench/src/components/layout/Sidebar.tsx` (or equivalent nav component — search for "compositions" or "builder" in nav items).

**StudioPage** (`repos/workbench/src/pages/StudioPage.tsx`):
A developer tool that connects to the react-renderer vessel for live component preview. It has no end-user value, requires a separately running `react-renderer` vessel (`VITE_REACT_RENDERER_URL` env var, default `http://localhost:3000`), and is never referenced from user workflows. Zero test coverage.

Route: `/studio` — redirect to `/trajectory`.

Navigation entry: remove from nav.

**What is NOT removed**: `CompositionPage` (`/compositions`) and its route. That page is distinct from the builder and may contain useful listing/management UI. Audit before removing in a follow-on spec.

---

## D2: Shapes Page — Live Data

**Decision**: Replace the 465-line static `KNOWN_SHAPES` array in `repos/workbench/src/hooks/useShapes.ts` with live queries to two sources: discovery-vessel (shape→vessel mapping) and activity-api (recent impulse examples with content).

### Current state

`useShapes.ts` defines `KNOWN_SHAPES: ImpulseShape[]` — a hardcoded array of ~25 shapes with fake `usageCount` and `successRate` values. The `useShapes()` hook's `queryFn` filters this array client-side. The Shapes page (`repos/workbench/src/pages/ShapesPage.tsx`) calls `useShapes(filters)` and renders `ShapeCard` components. The data is always stale.

### New data model

Replace `KNOWN_SHAPES` with three async fetches, merged per shape name:

**Source 1: Discovery-vessel registry** — reveals which vessels currently resolve each shape.

```
POST /resolve   (discovery-vessel endpoint, configured via VITE_DISCOVERY_URL env)
Body: { pointer: { type: "vesselRegistry" }, filters: { healthy: true } }
```

Parse each vessel's `outputShapes` (or `shapes`) array from the registry response. This tells us: for shape `bash_output`, vessel `minibob-xyz` can resolve it. For shape `activityTemplate`, vessel `activity-api-abc` can resolve it.

If discovery-vessel is unreachable, degrade gracefully: show an empty resolver list per shape, display "Discovery unavailable" banner. Do not block the page.

**Source 2: Activity-api impulse examples** — shows what each shape actually looks like.

```
POST /v2/impulses/resolve
Body: { pointer: { type: "executionTraceList", limit: 20, includeImpulses: true } }
```

This returns recent traces. Each trace's `impulse_resolutions` array contains `{ impulse_id, shape, resolver_id }`. For each unique shape encountered, issue a second resolve call to fetch impulse content:

```
POST /v2/impulses/resolve
Body: { pointer: { type: "activityExecutionTrace", executionId: "<any recent>", includeImpulses: true } }
```

The `impulses_by_id` map in the response contains `{ shape, summary, content }` per impulse. Collect up to 5 examples per shape. Cache under `queryKeys.shapes.liveExamples(shapeName)` with 2-minute stale time.

Alternative direct query (if activity-api exposes impulse table read): 
```
POST /v2/impulses/resolve
Body: { pointer: { type: "impulseExamples", shape: "<name>", limit: 5 } }
```
This shape type may not exist yet — fall back to trace-based extraction if absent.

**Source 3: Impulse relevance metrics** — usage frequency and co-occurrence.

```
GET /v2/activities/templates?limit=100
```

Count how many templates declare each shape in their `inputSchema.required`, `inputSchema.optional`, or `outputSchema.produces` arrays. This gives `templatesUsing` count without a separate endpoint.

### New hook signature

```typescript
// repos/workbench/src/hooks/useShapes.ts

export interface LiveImpulseShape {
  shape: string;
  resolvers: Array<{ vesselId: string; vesselName: string; tier: ResolverTier; endpoint?: string }>;
  examples: Array<{ impulseId: string; executionId: string; content: unknown; summary?: string }>;
  templatesUsing: number;
  // keep these for display convenience, computed from above:
  resolvedBy: string[];   // vessel IDs
}

export function useShapes(params: ShapeQueryParams = {}): UseQueryResult<LiveImpulseShape[]>
export function useShapeExamples(shape: string): UseQueryResult<LiveImpulseShape['examples']>
```

Remove `KNOWN_SHAPES` array entirely. Remove `filterShapes()` function (filtering moves to the hook's queryFn against live data).

### Shapes page display

`ShapesPage.tsx` shows a table/grid of shapes. Each row: shape name, resolver vessels (colored badges by tier: deterministic=green, pattern=amber, llm=purple), `templatesUsing` count, and an expandable examples section.

When expanded, each example shows:
```
impulse exec-b3f2:task-2:output-1
shape: bash_output
content:
  exit_code: 0
  stdout: |
    3 tests passed
    coverage: 87%
```

Content is rendered as formatted JSON if parseable, raw string otherwise. Long content truncated at 500 chars with a "Show more" toggle.

Remove the `alert('Shape creation is not yet implemented...')` stub from the "Add Shape" button. Replace the button with a read-only informational note: "Shapes are registered automatically when vessels connect to discovery."

---

## D3: Search FTS Wiring

**Decision**: Add `?q=` query param to `GET /v2/activities/templates` in activity-api; route to `queryActivitiesByFTS()` when present. Update workbench to use `q` instead of `search`.

### Backend change

File: `repos/metabob-activity-api/src/routes/activities.ts`, handler `app.get('/templates', ...)` starting at line 1276.

After the existing query param extraction block (after line 1315, where `offset` is parsed), add:

```typescript
const q = c.req.query('q') || null;
```

When `q` is present (non-empty), call `queryActivitiesByFTS()` and return its results instead of the standard listing path. This short-circuits the Redis cache check and SurrealDB listing query:

```typescript
if (q && q.trim().length > 0) {
  const ftsResult = await queryActivitiesByFTS(
    q.trim(),
    orgId,
    executionType as 'template' | 'tool' | null,
    limit,
    useRbacJwtQuery ? jwtAuth?.token : null
  );
  return c.json({
    templates: ftsResult.data ?? [],
    total: ftsResult.data?.length ?? 0,
    fts: true,
    tier: 'fts',
  });
}
```

Place this block before the Redis cache check (`const templateIdsSet = ...` on line 1334) so FTS requests never read from cache and never write to it. Existing cache behavior for non-search requests is unchanged.

FTS results are `ParadigmActivity & { fts_score: number }`. The response must match the existing `GetTemplatesResponse` shape that the workbench expects (`templates` array, `total` count). Map `fts_score` onto each template as an optional `score` field if the workbench type allows it; otherwise drop it.

### Frontend change

File: `repos/workbench/src/hooks/useTemplates.ts` — `TemplateQueryParams` interface at line 98 already has `search?: string`. Rename to add `q?: string` and keep `search` as a deprecated alias:

```typescript
export interface TemplateQueryParams extends Record<string, unknown> {
  q?: string;          // FTS natural-language query (routes to ?q= on API)
  search?: string;     // deprecated alias for q
  // ... rest unchanged
}
```

In `buildQueryString`, emit `q` when present, omit `search` (or emit `search` only when `q` is absent, for backward compat with any callers that still pass `search`).

File: `repos/workbench/src/pages/TemplatesPage.tsx` — update the search input placeholder from "Search templates..." to "Describe what you need…" and wire the input value to `q` in `TemplateQueryParams`. Add a debounce of 300ms before triggering the query (if not already present).

### UX additions (same task)

- After FTS results load, show a small "FTS" badge next to the result count: "12 results · full-text search"
- Add `input_shape` and `output_shape` filter chips below the search bar. These map to `hasInputShape` and `hasOutputShape` params already defined in `TemplateQueryParams`. The chips let users narrow "describe what you need" results by shape constraint.
- When `q` is empty, behavior is identical to today (standard listing). No regression.

---

## D4: Top Bar Composition

**Decision**: Move vessel connection (`VesselSelectorPanel`) and goal input (`GoalSubmissionPanel` + `GoalInputBox`) from the left sidebar into a top bar row above the trajectory canvas. Save/Clear/Live-status buttons stay in the existing header row.

### Current header structure

`TrajectoryEditorPage.tsx` renders:
1. A top header `div` (lines ~480–495) with title, Save button, connection indicator.
2. A `flex flex-1 overflow-hidden` content area containing:
   - Left sidebar `w-64` (lines ~499–560): VesselSelectorPanel, Separator, GoalSubmissionPanel, ExecutionHistoryPanel, GoalInputBox, GoalCompletionBar, BackwardChainingPanel, ApplicableActivitiesPanel
   - Center: TrajectoryGridWithDnd
   - (Implicit right): ImpulseStatePanel (from store subscription, conditionally rendered)

### New structure

Extend the header to two rows:

```
Row 1 (existing):  [← Back]  [title]  [mode strip]  [Save ▶]  [Clear]
Row 2 (new):       [● vessel: <VesselSelector>]  [Goal: __________________ ▶ Run]
```

Row 2 is a `flex items-center gap-3 px-4 py-2 border-b border-border/50` div. It contains:
- `VesselSelectorPanel` — rendered inline, compact variant (no section header, just the connection pill + dropdown). Add a `compact` prop to `VesselSelectorPanel`.
- `GoalInputBox` — the free-text goal input, full-width flex-grow. Keep `goalText`, `onGoalTextChange`, `onPathSelected` props unchanged.
- `GoalSubmissionPanel` — the Run button and live-status indicator. Render inline, not as a standalone panel. This component already accepts `isLiveConnected` and `onExecutionStarted` props.

When `GoalCompletionBar` or `BackwardChainingPanel` needs to display (conditional on `goalText && expectedShapes.length > 0`), render them in a collapsible section below Row 2, not in the sidebar. Toggle with a chevron in Row 2.

The left sidebar `w-64 shrink-0` div is removed from the content area (its content moves to the tab strip per D5).

---

## D5: Tab Sidebar (History / Palette)

**Decision**: Replace the `w-64` left sidebar with a narrow tab strip. Two tabs: "History" (ExecutionHistoryPanel) and "Palette" (ActivityPalette + ApplicableActivitiesPanel). One tab visible at a time.

### Layout

```
┌─────────┬────────────────────────────────────────────────────────┐
│ History │                                                        │
│         │  canvas (TrajectoryGridWithDnd)                        │
│ Palette │                                                        │
└─────────┴────────────────────────────────────────────────────────┘
```

The tab strip is a vertical `flex flex-col w-48 shrink-0 border-r` panel. At the top are two tab buttons (History, Palette). Below the buttons, the active panel content renders in a `flex-1 overflow-y-auto` div.

Width change: `w-64` → `w-48`. This recovers 64px of horizontal space. Combined with D8 (removing the right panel entirely), the canvas gains ~256px + 64px = 320px on a 1440px screen.

### History tab

Contains `ExecutionHistoryPanel` with its `onLoadTrace` and `isLive` props, unchanged.

### Palette tab

Contains `ActivityPalette` (the searchable template list). Below it, when `activities.length > 0`, render `ApplicableActivitiesPanel`. This is a straightforward lift-and-shift from the sidebar. The `ApplicableActivitiesPanel` props (`currentShapes`, `previousShapes`, `expectedOutputShapes`, `goalText`, `onActivitySelected`, `excludeTemplateIds`, `onEscalateUnbindableShape`) pass through unchanged from page-level state.

### Default tab

Default to "History" when an `executionId` is present (recalled or live mode). Default to "Palette" when in compose mode (no executionId). Derive from `useTrajectoryStore` connection state.

### Keyboard shortcut

Preserve `Ctrl+I` to toggle the tab panel open/closed (currently it toggles ImpulseStatePanel — reassign to toggle this sidebar).

---

## D6: Impulse Content Inline

**Decision**: Extend `OutputLayer` to load and display the actual `content` field of each produced impulse on expand. This is the primary verification surface.

### Current state

`OutputLayer` (`repos/workbench/src/components/trajectory/OutputLayer.tsx`) accepts `outputImpulseIds: string[]` and `impulseShapeMap: Record<string, string>`. It renders shape badges only — no content.

### Content loading

Add a `useImpulseContent(impulseId: string, executionId: string, mode: 'live' | 'recalled')` hook:

```typescript
// repos/workbench/src/hooks/useImpulseContent.ts

export function useImpulseContent(
  impulseId: string | null,
  executionId: string | null,
  mode: 'live' | 'recalled'
) {
  return useQuery({
    queryKey: ['impulse-content', impulseId, executionId],
    queryFn: async () => {
      if (!impulseId || !executionId) return null;
      const res = await post<{ impulses_by_id: Record<string, ImpulseRecord> }>(
        '/v2/impulses/resolve',
        {
          pointer: {
            type: 'activityExecutionTrace',
            executionId,
            includeImpulses: true,
          }
        }
      );
      return res.impulses_by_id?.[impulseId] ?? null;
    },
    enabled: mode === 'recalled' && !!impulseId && !!executionId,
    staleTime: 5 * 60 * 1000,
  });
}

export interface ImpulseRecord {
  shape: string;
  summary?: string;
  content: unknown;
}
```

For **live mode** (execution in progress), the content arrives via the WebSocket `impulse.resolved` event. The existing WS broadcaster must include `body` for all shapes (not just `validation_result`). The `useTrajectoryExecution` hook already handles `impulse.resolved` events; extend it to store `{ impulseId → body }` in `trajectoryStore.impulseContentMap` (new store field, `Map<string, unknown>`).

The `OutputLayer` receives `impulseContentMap?: Map<string, unknown>` as a new optional prop. When present, content is shown without a network fetch. When absent, the hook fetches for recalled mode.

### Display

Each impulse row in `OutputLayer` becomes expandable with a `▶ / ▼` chevron:

```
▼ bash_output  [exec-b3f2...]
  exit_code: 0
  stdout: |
    3 tests passed
    coverage: 87%
```

Expanded content:
- If `content` is an object or array: render as formatted JSON with `<pre className="text-[9px] font-mono">`.
- If `content` is a string ≤ 500 chars: render inline.
- If > 500 chars: truncate with "Show more" toggle that expands inline (no modal).
- If content is loading: show `<Skeleton className="h-3 w-32" />`.
- If content failed to load: show `<span className="text-[9px] text-destructive">unavailable</span>`.

Expand state is local to the component (`useState<Set<string>>` of expanded impulse IDs). Default collapsed. Expanding one impulse does not collapse others.

### WebSocket broadcaster change (activity-api)

File: `repos/metabob-activity-api/src/routes/activities.ts` (websocket broadcast section).

The `impulse.resolved` WS event currently includes `body` only for `validation_result` shape (per the F-9 fix in v0.3.1). Extend the broadcaster to include `body` for all shapes:

```typescript
wsManager.broadcast({
  type: 'impulse.resolved',
  timestamp: Date.now(),
  data: {
    execution_id,
    impulse_id,
    shape,
    task_id,
    resolver_id,
    resolver_tier,
    latency_ms,
    cost_usd,
    body,   // include for all shapes, not conditional
  }
});
```

The `body` field may be large for some shapes (file contents, trace data). Cap at 50KB in the broadcaster — if `JSON.stringify(body).length > 50_000`, replace with `{ truncated: true, summary: body?.summary ?? null }`. The workbench handles `truncated: true` by showing "content too large — view in trace" with a link to the execution trace page.

---

## D7: Column Width Fix

**Decision**: Change `TrajectoryGridWithDnd` column minimum width from 300px to 260px, and change the sizing strategy to `min-w-[260px]` with `flex-shrink-0` instead of a fixed-width grid.

### Current state

`TrajectoryGridWithDnd.tsx` uses a CSS grid layout. Inspect the grid container class for the column width constraint. The current minimum (300px) means 3 activities require 900px of canvas width. With the old left panel (256px) + padding (~40px), the minimum usable viewport is ~1196px before horizontal scroll appears in the canvas. On 1280px laptops with browser chrome, the canvas is effectively ~950px — barely enough for 3 activities, leaving no margin.

### New strategy

Switch column layout from `display: grid` with fixed `grid-template-columns` to `display: flex; flex-wrap: nowrap; gap: 8px` with each column as `min-w-[260px] flex-shrink-0`. This:
- Allows browser to render columns at natural width (content-driven above 260px)
- Prevents columns from shrinking below 260px (no text truncation)
- Horizontal scroll on the canvas container is expected and correct for >5 activities
- 4 activities at 260px = 1040px; with 48px tab strip + padding = ~1120px, fits at 1280px

The `gridRef` `scrollToActivity` logic is unchanged (it uses `getBoundingClientRect`, works with flex layout).

### Insert column

The `+` button between columns (`onInsertClick` prop) remains. Its column index calculation must be verified against the flex layout (index = position in `activities` array, unchanged).

---

## D8: ImpulseStatePanel Removal

**Decision**: Remove the fixed-position right `ImpulseStatePanel` from the trajectory editor. Its content migrates into two places: impulse content goes inline per D6, and the binding phase / slot state is surfaced as a collapsible section within each `TaskEditor` card.

### Current state

`ImpulseStatePanel` (`repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx`) is rendered conditionally in `TrajectoryEditorPage`. It uses store subscriptions for `bindingPhase`, `taskValidations`, and accumulated shape state. It is hidden below 1280px viewports because the layout collapses it. This means the primary validation surface is invisible on most laptops.

### Migration

**Impulse content** → inline in `OutputLayer` per D6.

**Binding phase / slot state** → the `TaskEditor` expanded panel already shows resolver info and validation results (from v0.3.2 work). Extend it to show the binding phase state when `lifecycle:task:preBinding` data is present for that task:

```
Task: run-tests
  Resolver: bash  [deterministic]
  BindableSlots:
    bash_command  ✓ bound → impulse-a3f1
    test_config   ⚠ unbindable
  Validation: passed (0.92)
```

The `BindableSlots` section is already in `ImpulseStatePanel`; move the relevant store slice (`trajectoryStore.bindingPhase[taskId]`) to `TaskEditor`'s expanded view.

**Accumulated shape provenance tree** (the tree showing which shapes are available at each stage) — deferred. It was useful for understanding composition, but with impulse content now inline, the most important signal is already visible. A future spec can reintroduce a shape-flow overlay as a toggle on the canvas, not a fixed panel.

**`ImpulseStatePanel` component file**: do not delete yet. Remove the import and JSX from `TrajectoryEditorPage.tsx`. Mark the component file with a `// @deprecated — migrated to TaskEditor expanded view` comment. Delete in a follow-on cleanup.

**Keyboard shortcut `Ctrl+I`**: was "toggle ImpulseStatePanel". Reassign to toggle the tab sidebar (D5).

---

## Non-Goals

- Removing `GoalsPage` or `ExecutionsPage` routes — they already redirect to trajectory per the existing 2026-04-26-workbench-trajectory spec.
- Changing the `TaskEditor` component's core editing UX.
- Changing `ActivityCard` component.
- Adding responsive breakpoints (< 1024px mobile) — out of scope, deferred.
- Migrating the FTS endpoint to a separate `/search` route — the `?q=` param on the existing list handler is sufficient.
