# Tasks: Workbench Simplification & Trajectory Refocus

Status key: `[ ]` not started · `[x]` complete · `[-]` skipped/deferred

---

## Phase 1: Removals & Redirects

Low-risk changes. No new UI, no API changes. Each task is independently deployable.

### T1.1 — Remove CompositionBuilderPage route [x]

**Files**:
- `repos/workbench/src/router.tsx` (or wherever TanStack Router routes are defined — search for `CompositionBuilderPage` import)

**Change**: Find the route entry for `/compositions/builder`. Replace the `component` with a `beforeLoad` that throws `redirect({ to: '/trajectory' })` using TanStack Router's `redirect()` utility. Remove the `CompositionBuilderPage` import.

**Acceptance**:
- Navigating to `/compositions/builder` redirects to `/trajectory` with status 302 (or client-side redirect).
- No 404 or blank page.
- `CompositionBuilderPage` is not imported anywhere after this change.

---

### T1.2 — Remove StudioPage route [x]

**Files**:
- `repos/workbench/src/router.tsx`

**Change**: Same pattern as T1.1 for `/studio` route. Redirect to `/trajectory`. Remove `StudioPage` import.

**Acceptance**:
- Navigating to `/studio` redirects to `/trajectory`.
- `StudioPage` is not imported anywhere after this change.

---

### T1.3 — Remove nav entries for removed pages [x]

**Files**:
- `repos/workbench/src/components/layout/Sidebar.tsx` (or equivalent — search for nav items containing "Studio" or "Composition" or "builder")

**Change**: Remove nav items for "Studio" and "Composition Builder" (or "Compositions" if the builder was the only entry under Compositions). Do not remove a "Compositions" nav item if `CompositionPage` (`/compositions`) still exists and is useful.

Search first:
```
grep -rn "Studio\|builder\|CompositionBuilder" repos/workbench/src/components/layout/
```

**Acceptance**:
- Nav does not show "Studio" or "Composition Builder" entries.
- No console errors about missing routes.
- `bun test` in `repos/workbench` passes.

---

## Phase 2: Search FTS Wiring

One backend change (activity-api) and one frontend change (workbench). Independent.

### T2.1 — Add `?q=` param to `GET /v2/activities/templates` [x]

**File**: `repos/metabob-activity-api/src/routes/activities.ts`

**Location**: `app.get('/templates', ...)` handler, after line 1315 where `offset` is parsed (around line 1315–1334, before the Redis cache check).

**Change**: After the `offset` extraction, add:

```typescript
const q = c.req.query('q') ?? null;
```

Then, immediately before `const redis = RedisClient.getInstance();` (line ~1333), insert:

```typescript
if (q && q.trim().length > 0) {
  logger.info('GET /v2/activities/templates — FTS path', { q: q.slice(0, 80), orgId, limit });
  const ftsResult = await queryActivitiesByFTS(
    q.trim(),
    orgId,
    executionType as 'template' | 'tool' | 'composition' | 'vessel_function' | null,
    limit,
    useRbacJwtQuery ? (jwtAuth as { token?: string })?.token : null
  );
  return c.json({
    templates: ftsResult.data ?? [],
    total: ftsResult.data?.length ?? 0,
    fts: true,
  });
}
```

The return shape must match what the workbench `GetTemplatesResponse` type expects. If `GetTemplatesResponse` is defined elsewhere, verify it accepts `fts?: boolean` or strip that field.

**Acceptance**:
- `curl 'https://activity.metabob.com/v2/activities/templates?q=fix+auth+bug' -H 'Authorization: ApiKey ...'` returns a JSON body with `templates` array and results semantically related to "fix auth bug".
- `curl '.../templates'` (no `q`) returns the normal listing unchanged.
- `bun test repos/metabob-activity-api/src/routes/activities.test.ts` passes (no regressions).
- Add one new test: `GET /templates?q=nonexistent-zxqwerty` returns `{ templates: [], total: 0, fts: true }`.

---

### T2.2 — Update workbench search to use `?q=` [x]

**Files**:
- `repos/workbench/src/hooks/useTemplates.ts`
- `repos/workbench/src/pages/TemplatesPage.tsx` (or wherever the search input is rendered for the templates list)

**Change in `useTemplates.ts`**: In `TemplateQueryParams`, add `q?: string` field. In the `buildQueryString` call inside `useTemplates()` (or `queryFn`), emit `q` when present. Keep `search` as a fallback: if `q` is absent but `search` is present, emit `q` from `search` value (backward compat). The API now only reads `q`; `search` param is silently ignored by the API already.

**Change in `TemplatesPage.tsx`**: Update the search `<input>` or `<SearchInput>` component:
- `placeholder`: change to `"Describe what you need…"`
- Wire `onChange` to set `q` in the query params (not `search`).
- Add debounce: 300ms using `useDebounce` (check if `@/hooks/useDebounce` exists; if not, use a `useEffect` + `setTimeout` pattern or install `use-debounce`).
- After results load when `q` is set: show a `<Badge variant="secondary">full-text search</Badge>` next to the results count line.

Add `input_shape` and `output_shape` filter chips below the search bar:
- Two `<Input placeholder="input shape…">` + `<Input placeholder="output shape…">` chips (or use the existing filter bar pattern if one exists in the page).
- Wire to `hasInputShape` and `hasOutputShape` in `TemplateQueryParams`.

**Acceptance**:
- Typing "fix auth bug" in the search bar sends `GET /v2/activities/templates?q=fix+auth+bug&limit=50`.
- Results change after 300ms debounce, not on every keypress.
- "full-text search" badge appears when `q` is non-empty.
- Clearing the input returns to standard listing (no `q` param).
- Existing filter behavior (category, scope, etc.) still works alongside `q`.

---

## Phase 3: Layout Restructure

Changes to `TrajectoryEditorPage.tsx` and related components. Higher coordination cost — do T3.1, T3.2, T3.3 sequentially (each builds on the previous).

### T3.1 — Add compact variant to VesselSelectorPanel [x]

**File**: `repos/workbench/src/components/trajectory/VesselSelectorPanel.tsx`

**Change**: Add `compact?: boolean` prop. When `compact=true`, render only the connection pill (status indicator + vessel name) and dropdown trigger, without the section header ("Vessel Connection") and without the full detail rows. Height when compact should be ~32px, suitable for embedding in a toolbar.

This is a pure addition — no existing rendering path changes.

**Acceptance**:
- `<VesselSelectorPanel compact />` renders a single-row connection pill.
- `<VesselSelectorPanel />` (no prop) renders identically to today.

---

### T3.2 — Move vessel/goal controls to top bar [x]

**File**: `repos/workbench/src/pages/TrajectoryEditorPage.tsx`

**Change**: Restructure the JSX. Current header is one row of title + buttons. Add a second row below it:

```tsx
{/* Row 2: vessel + goal controls */}
<div className="flex items-center gap-3 px-4 py-2 border-b border-border/50 bg-background shrink-0">
  <VesselSelectorPanel compact />
  <div className="flex-1">
    <GoalInputBox
      goalText={goalText}
      onGoalTextChange={setGoalText}
      onPathSelected={handlePathSelected}
    />
  </div>
  <GoalSubmissionPanel
    isLiveConnected={isLive}
    onExecutionStarted={(id, url) => {
      setTimeout(() => {
        clearTraceData();
        setActiveExecutionId(id);
        setActiveWsUrl(url ?? null);
      }, 0);
    }}
    submitTrajectory={submitTrajectory}
  />
</div>
```

Remove `VesselSelectorPanel`, `GoalInputBox`, `GoalSubmissionPanel` from the left sidebar section (`w-64` div). Also remove `Separator` that was between VesselSelectorPanel and GoalSubmissionPanel.

`GoalCompletionBar` and `BackwardChainingPanel` are conditionally rendered. Move them to a collapsible `<details>` element below Row 2 (or a `useState`-controlled collapse toggle). They remain in the page-level JSX, not the sidebar.

**Acceptance**:
- Vessel pill and goal input are visible at 1280px viewport without scrolling.
- Executing a goal via the Run button still works (full flow: vessel selection → goal text → submit → execution starts → WS events arrive).
- `GoalCompletionBar` and `BackwardChainingPanel` still appear when their conditions are met.

---

### T3.3 — Replace left sidebar with tab strip [x]

**File**: `repos/workbench/src/pages/TrajectoryEditorPage.tsx`

**Change**: Replace the `<div className="relative z-10 w-64 shrink-0 ...">` containing the old sidebar content with a tab strip component:

```tsx
{/* Tab strip */}
<div className="relative z-10 w-48 shrink-0 border-r border-border/50 bg-card h-full flex flex-col">
  {/* Tab buttons */}
  <div className="flex shrink-0 border-b border-border/50">
    <button
      className={cn("flex-1 py-2 text-xs font-medium", activeTab === 'history' ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}
      onClick={() => setActiveTab('history')}
    >
      History
    </button>
    <button
      className={cn("flex-1 py-2 text-xs font-medium", activeTab === 'palette' ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}
      onClick={() => setActiveTab('palette')}
    >
      Palette
    </button>
  </div>
  {/* Tab content */}
  <div className="flex-1 overflow-y-auto p-2" style={{ contain: 'inline-size' }}>
    {activeTab === 'history' && (
      <ExecutionHistoryPanel onLoadTrace={handleLoadTrace} isLive={isLive} />
    )}
    {activeTab === 'palette' && (
      <>
        <ActivityPalette ... />
        {activities.length > 0 && <ApplicableActivitiesPanel ... />}
      </>
    )}
  </div>
</div>
```

Add `const [activeTab, setActiveTab] = useState<'history' | 'palette'>('palette')` to the page state. Initialize to `'history'` when `executionId !== null` (auto-switch to history when recalled/live), `'palette'` otherwise.

Update `Ctrl+I` keyboard shortcut (search for the existing `useEffect` on `keydown` in `TrajectoryEditorPage`) to toggle between the two tabs instead of toggling `ImpulseStatePanel`.

**Acceptance**:
- Clicking "History" tab shows `ExecutionHistoryPanel` and hides palette.
- Clicking "Palette" tab shows `ActivityPalette` + `ApplicableActivitiesPanel` and hides history.
- `Ctrl+I` cycles between tabs.
- Loading a recalled execution auto-switches to "History" tab.
- Width is 192px (w-48), not 256px.

---

## Phase 4: Shapes Live Data

### T4.1 — Replace static KNOWN_SHAPES with live discovery query [x]

**File**: `repos/workbench/src/hooks/useShapes.ts`

**Change**:
1. Delete the `KNOWN_SHAPES` array (lines 77–466).
2. Delete the `filterShapes()` function (lines 471–507).
3. Rewrite `useShapes()` to fetch live data:

```typescript
export function useShapes(params: ShapeQueryParams = {}) {
  return useQuery<LiveImpulseShape[]>({
    queryKey: queryKeys.shapes.list(params),
    queryFn: async () => {
      // Fetch vessel registry from discovery
      let vesselList: Array<{ id: string; name?: string; outputShapes?: string[]; endpoint?: string }> = [];
      try {
        const registryRes = await post<{ vessels?: unknown[] }>('/discovery/resolve', {
          pointer: { type: 'vesselRegistry', filters: { healthy: true } }
        });
        vesselList = (registryRes.vessels ?? []) as typeof vesselList;
      } catch {
        // discovery unreachable — degrade gracefully
      }

      // Build shape → resolver map from vessel registry
      const shapeResolverMap = new Map<string, LiveImpulseShape['resolvers']>();
      for (const vessel of vesselList) {
        for (const shape of vessel.outputShapes ?? []) {
          const existing = shapeResolverMap.get(shape) ?? [];
          existing.push({ vesselId: vessel.id, vesselName: vessel.name ?? vessel.id, tier: 'deterministic' });
          shapeResolverMap.set(shape, existing);
        }
      }

      // Fetch template list to count templatesUsing per shape
      let templates: Array<{ inputSchema?: { required?: Array<{ type: string }>; optional?: Array<{ type: string }> }; outputSchema?: { produces?: Array<{ type: string }> } }> = [];
      try {
        const tRes = await get<{ templates: typeof templates }>('/v2/activities/templates?limit=100');
        templates = tRes.templates ?? [];
      } catch { /* ignore */ }

      const shapeCounts = new Map<string, number>();
      for (const tmpl of templates) {
        const shapes = [
          ...(tmpl.inputSchema?.required ?? []),
          ...(tmpl.inputSchema?.optional ?? []),
          ...(tmpl.outputSchema?.produces ?? []),
        ];
        for (const s of shapes) {
          shapeCounts.set(s.type, (shapeCounts.get(s.type) ?? 0) + 1);
        }
      }

      // Merge all known shape names from both sources
      const allShapeNames = new Set([
        ...shapeResolverMap.keys(),
        ...shapeCounts.keys(),
      ]);

      // Build LiveImpulseShape array
      let results: LiveImpulseShape[] = Array.from(allShapeNames).map((shape) => ({
        shape,
        resolvers: shapeResolverMap.get(shape) ?? [],
        resolvedBy: (shapeResolverMap.get(shape) ?? []).map(r => r.vesselId),
        examples: [],  // loaded lazily via useShapeExamples
        templatesUsing: shapeCounts.get(shape) ?? 0,
      }));

      // Apply client-side filters from params
      if (params.search) {
        const s = params.search.toLowerCase();
        results = results.filter(r => r.shape.toLowerCase().includes(s));
      }
      if (params.vesselId) {
        results = results.filter(r => r.resolvedBy.includes(params.vesselId!));
      }

      return results;
    },
    staleTime: 2 * 60 * 1000,  // 2 min
    gcTime: 10 * 60 * 1000,
    ...('options' in params ? {} : {}),  // forward any extra UseQueryOptions if signature changes
  });
}
```

Note: the discovery endpoint for the workbench may need a proxy or CORS configuration. If the workbench api-client (`repos/workbench/src/lib/api-client.ts`) only points to activity-api, add a `/discovery/*` proxy in the workbench dev server config (`vite.config.ts`) or handle via activity-api proxy endpoint. Confirm with existing `VesselSelectorPanel` how it fetches vessel data — it likely already has a discovery call path to follow.

4. Add `useShapeExamples(shape: string)` hook that fetches recent impulse examples for one shape (lazy, only when the card is expanded in the UI):

```typescript
export function useShapeExamples(shape: string, enabled = false) {
  return useQuery({
    queryKey: ['shape-examples', shape],
    queryFn: async () => {
      // Fetch from impulses endpoint via activity-api
      // Try the direct impulseExamples shape first; fall back to trace scan
      try {
        const res = await post<{ examples: ImpulseRecord[] }>('/v2/impulses/resolve', {
          pointer: { type: 'impulseExamples', shape, limit: 5 }
        });
        if (res.examples?.length) return res.examples;
      } catch { /* shape type not supported */ }
      // Fallback: scan recent traces
      return [];  // empty graceful fallback — content is supplementary
    },
    enabled: enabled && !!shape,
    staleTime: 2 * 60 * 1000,
  });
}
```

**Acceptance**:
- `ShapesPage` loads and shows shapes from the live registry. If discovery is unreachable, page loads with empty resolver list and a "Discovery unavailable" banner (not a crash).
- Shape names visible in the page match shapes actually advertised by currently-registered vessels.
- Static `KNOWN_SHAPES` array no longer exists in `useShapes.ts`.
- `bun test repos/workbench` passes — update or delete any tests that depend on `KNOWN_SHAPES`.

---

### T4.2 — Update ShapesPage to use live model + show examples [x]

**File**: `repos/workbench/src/pages/ShapesPage.tsx`

**Change**:
1. Update imports: replace `import type { ImpulseShape, ... } from '@/hooks/useShapes'` with `import type { LiveImpulseShape, ... }`.
2. Replace `ShapeCard` and `ShapeDetails` usage with components that accept `LiveImpulseShape`. Either update those component prop types or inline the rendering.
3. Add example expansion: in the shape detail view (the sheet/dialog that opens on click), call `useShapeExamples(shape.shape, true)` and render examples with formatted content. Format:
   ```
   Example impulse: exec-b3f2 · task-2
   ─────────────────────────────────────
   exit_code: 0
   stdout: "3 tests passed\ncoverage: 87%"
   ```
4. Remove the "Add Shape" button and its `alert(...)` handler. Replace with a `<p className="text-sm text-muted-foreground">Shapes are registered automatically when vessels connect to discovery.</p>` note.
5. Remove the `Alert` component ("Shape Registry" info alert) — it references the static registry.

**Acceptance**:
- Opening a shape's detail view shows resolver vessels with tier badges.
- If examples are available, they render with formatted content.
- No "Add Shape" button visible.
- `templatesUsing` count matches the count from live template list.

---

## Phase 5: Impulse Content Inline

### T5.1 — Add `useImpulseContent` hook

**File**: `repos/workbench/src/hooks/useImpulseContent.ts` (new file)

**Change**: Create the hook as specified in D6:

```typescript
import { useQuery } from '@tanstack/react-query';
import { post } from '@/lib/api-client';

export interface ImpulseRecord {
  shape: string;
  summary?: string;
  content: unknown;
}

export function useImpulseContent(
  impulseId: string | null,
  executionId: string | null,
  enabled: boolean
) {
  return useQuery<ImpulseRecord | null>({
    queryKey: ['impulse-content', impulseId, executionId],
    queryFn: async () => {
      if (!impulseId || !executionId) return null;
      const res = await post<{ impulses_by_id?: Record<string, ImpulseRecord> }>(
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
    enabled: enabled && !!impulseId && !!executionId,
    staleTime: 5 * 60 * 1000,
  });
}
```

**Acceptance**:
- Hook exists, exports `useImpulseContent` and `ImpulseRecord`.
- `bun run typecheck repos/workbench` passes.

---

### T5.2 — Add impulse content store field to trajectoryStore

**File**: `repos/workbench/src/stores/trajectoryStore.ts`

**Change**: Add a new field `impulseContentMap: Map<string, unknown>` to the store state and an `setImpulseContent(impulseId: string, body: unknown) => void` action.

Search for the store definition (`create<TrajectoryStore>`) and add the field alongside existing state fields. Initialize to `new Map()`.

The `setImpulseContent` action:
```typescript
setImpulseContent: (impulseId, body) =>
  set((s) => ({ impulseContentMap: new Map(s.impulseContentMap).set(impulseId, body) })),
```

**Acceptance**:
- `trajectoryStore.getState().impulseContentMap` is a `Map`.
- `setImpulseContent('foo', {bar: 1})` updates the map.
- `bun run typecheck repos/workbench` passes.

---

### T5.3 — Wire WS `impulse.resolved` body into store

**File**: `repos/workbench/src/hooks/useTrajectoryExecution.ts`

**Change**: In the WebSocket message handler where `impulse.resolved` events are processed (search for `'impulse.resolved'` in this file), extract the `body` field and call `trajectoryStore.getState().setImpulseContent(event.data.impulse_id, event.data.body)` when `body` is present and non-null.

This captures live-execution impulse content as it arrives over the WS stream.

**Acceptance**:
- During a live execution, after a task completes, `trajectoryStore.getState().impulseContentMap` contains entries for impulse IDs that arrived with `body` in the WS event.

---

### T5.4 — Extend OutputLayer with expandable content

**File**: `repos/workbench/src/components/trajectory/OutputLayer.tsx`

**Change**: Expand the component to accept new props and show content:

```typescript
interface OutputLayerProps {
  outputImpulseIds: string[];
  impulseShapeMap: Record<string, string>;
  executionId?: string | null;               // for recalled mode content fetch
  impulseContentMap?: Map<string, unknown>;  // for live mode content from WS
}
```

Add `const [expanded, setExpanded] = useState<Set<string>>(new Set())` to track expanded impulse IDs.

For each impulse row, add a `▶`/`▼` chevron button. When expanded:
1. If `impulseContentMap?.has(id)`: use content from map (live mode, no fetch needed).
2. Else if `executionId` is present: render `<ImpulseContentExpanded impulseId={id} executionId={executionId} />` which internally calls `useImpulseContent(id, executionId, true)` (recalled mode).
3. Else: show nothing (compose mode — no execution context).

Create `ImpulseContentExpanded` as a small local component in the same file:

```tsx
function ImpulseContentExpanded({ impulseId, executionId }: { impulseId: string; executionId: string }) {
  const { data, isLoading } = useImpulseContent(impulseId, executionId, true);
  if (isLoading) return <Skeleton className="h-3 w-32 mt-1" />;
  if (!data?.content) return <span className="text-[9px] text-muted-foreground/50 pl-2">unavailable</span>;
  return <ImpulseContentDisplay content={data.content} />;
}
```

Create `ImpulseContentDisplay` as a separate export in `repos/workbench/src/components/trajectory/ImpulseContentDisplay.tsx`:

```tsx
// Renders impulse content: formatted JSON, truncated string, or "too large" notice
export function ImpulseContentDisplay({ content }: { content: unknown }) {
  const [showMore, setShowMore] = useState(false);
  if (content && typeof content === 'object' && (content as Record<string, unknown>).truncated) {
    return <span className="text-[9px] text-muted-foreground/50 pl-2">content too large</span>;
  }
  const str = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  const truncated = !showMore && str.length > 500;
  return (
    <div className="pl-2 pt-0.5">
      <pre className="text-[9px] font-mono text-muted-foreground whitespace-pre-wrap break-all">
        {truncated ? str.slice(0, 500) + '…' : str}
      </pre>
      {str.length > 500 && (
        <button className="text-[9px] text-primary" onClick={() => setShowMore(!showMore)}>
          {showMore ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
```

**Acceptance**:
- In a recalled execution, expanding an impulse row fetches and shows content.
- In a live execution, expanding an impulse row shows content from the WS-populated store (no fetch).
- Content > 500 chars truncates with a "Show more" toggle.
- If content is unavailable, shows "unavailable" in muted text.
- Expanding one row does not collapse others.

---

### T5.5 — Extend WS broadcaster to include `body` for all shapes

**File**: `repos/metabob-activity-api/src/routes/activities.ts` (WebSocket broadcast section — search for `'impulse.resolved'` broadcast call)

**Change**: Find the `wsManager.broadcast(...)` call(s) for `impulse.resolved` events. Currently `body` is conditionally included only for `validation_result`. Change to always include `body`, with size guard:

```typescript
const bodyForWs = (() => {
  if (!body) return undefined;
  const serialized = JSON.stringify(body);
  if (serialized.length > 50_000) {
    return { truncated: true, summary: (body as Record<string, unknown>)?.summary ?? null };
  }
  return body;
})();

wsManager.broadcast({
  type: 'impulse.resolved',
  timestamp: Date.now(),
  data: {
    execution_id,
    impulse_id,
    task_id,
    shape,
    resolver_id,
    resolver_tier,
    latency_ms,
    cost_usd,
    body: bodyForWs,
  },
});
```

If there are multiple broadcast call sites (for different event paths), update all of them consistently.

**Acceptance**:
- WS client receives `body` for `bash_output` impulses (non-validation shapes).
- For a large impulse body (> 50KB): receives `{ truncated: true, summary: null }` instead of the full body.
- Existing `validation_result` body still included (not broken by this change).
- `bun test repos/metabob-activity-api` passes.

---

### T5.6 — Update TaskEditor to pass executionId to OutputLayer

**File**: `repos/workbench/src/components/trajectory/TaskEditor.tsx`

**Change**: Find where `OutputLayer` is rendered (line ~356). Add `executionId` and `impulseContentMap` props:

```tsx
<OutputLayer
  outputImpulseIds={outputImpulseIds}
  impulseShapeMap={impulseShapeMap}
  executionId={executionId}                        // new: pass down from TaskEditor props
  impulseContentMap={impulseContentMap}            // new: pass down from TaskEditor props
/>
```

Ensure `TaskEditor` accepts `executionId?: string | null` and `impulseContentMap?: Map<string, unknown>` props. Trace where `TaskEditor` is called (in `ActivityCard.tsx` or similar) and pass these values from the page-level execution state. The `executionId` is already available in `TrajectoryEditorPage` state (`activeExecutionId`). The `impulseContentMap` comes from `useTrajectoryStore((s) => s.impulseContentMap)`.

**Acceptance**:
- In recalled mode (`executionId` set, no live WS), expanding an impulse in `OutputLayer` triggers `useImpulseContent` fetch with the correct `executionId`.
- In live mode, expanding an impulse shows content from the store map without a fetch.
- In compose mode (no `executionId`), expanding shows nothing (no fetch, no error).

---

## Phase ordering note

Phases 1 and 2 are fully independent — run in parallel if possible. Phase 3 (layout) is independent of Phase 4 (shapes) and Phase 5 (impulse content). Phase 5 depends on T5.1 (hook) before T5.4 (component) and T5.3 (store wiring) before T5.6 (TaskEditor pass-through). T5.5 (broadcaster) can be done any time but should land before T5.3/T5.4 to get live content working end-to-end.

Recommended sequence for a single implementer:
```
T1.1 → T1.2 → T1.3  (30 min)
T2.1 → T2.2          (1.5 hr)
T3.1 → T3.2 → T3.3  (2 hr)
T4.1 → T4.2          (2 hr)
T5.1 → T5.2 → T5.3 → T5.5 → T5.4 → T5.6  (3 hr)
```
