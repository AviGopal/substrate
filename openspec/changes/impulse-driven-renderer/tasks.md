## 1. Vessel Registration and Discovery

- [x] 1.1 Fix shape name bug in `src/index.ts` — change `uiComponent` to `ui_component` in the discovery registration shapes array
- [x] 1.2 Add all new shapes to discovery registration: `layout_change`, `style_change`, `component_change`, `data_source_change`, `ui_event`, `composition_metric`, `design_token`
- [x] 1.3 Enable discovery registration by default — set `discovery.enabled: true` in config and `vessel.json`
- [x] 1.4 Derive `vesselId` from `VESSEL_ID` env var with fallback to `react-renderer-${HOSTNAME || "local"}`
- [x] 1.5 Wire heartbeat to 60-second interval using VesselClient `startHeartbeatManager()`
- [x] 1.6 Register SIGTERM/SIGINT handlers to call `discoveryClient.shutdown()` before process exit
- [x] 1.7 Add `Authorization: ApiKey` middleware to all `POST /resolve/*` routes; return 401 on missing/invalid key
- [x] 1.8 Update `vessel.json` to declare all nine resolvers and three activities with their endpoint paths and template paths

## 2. Vite Browser Build Setup

- [x] 2.1 Add dev dependencies: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`
- [x] 2.2 Add runtime dependencies: `@tanstack/react-router`, `@tanstack/react-form`, `@tanstack/react-virtual`, `@tanstack/react-query-persist-client`, `@tanstack/query-sync-storage-persister`
- [x] 2.3 Create `vite.config.ts` — React plugin, proxy `/api` and `/ws` to `localhost:3000`, output to `dist/`
- [x] 2.4 Create `tailwind.config.ts` — configure content paths for `src/client/**/*.tsx`
- [x] 2.5 Create `src/client/index.html` — root HTML entry point with `<div id="root">`
- [x] 2.6 Create `src/client/main.tsx` — `ReactDOM.createRoot` mounting `<App />`
- [x] 2.7 Add `"build:client": "vite build"` and `"dev:client": "vite"` scripts to `package.json`
- [x] 2.8 Serve `dist/` static files from Bun at `/app` route in `src/index.ts`

## 3. ImpulseQueryBridge and Hooks

- [x] 3.1 Create `src/client/lib/impulse-query-bridge.ts` — `ImpulseQueryBridge` class subscribing to `impulseStore` events and calling `QueryClient.setQueryData()`
- [x] 3.2 Implement `start()` — initial cache population from `impulseStore.getAll()` before subscribing
- [x] 3.3 Implement `stop()` — unsubscribe from impulse store
- [x] 3.4 Handle `state_sync` WebSocket message — replace full cache, clear old `['impulse', id]` entries
- [x] 3.5 Create `src/client/hooks/useImpulseStore.ts` — `useImpulseStore()` hook returning sorted impulse list with `staleTime: Infinity`
- [x] 3.6 Create `src/client/hooks/useImpulse.ts` — `useImpulse(id)` hook for single impulse subscription
- [x] 3.7 Write unit tests: bridge `created/updated/deleted/cleared` events, `state_sync` replacement, `useImpulse` targeted re-render

## 4. App Shell and TanStack Router

- [x] 4.1 Create `src/client/App.tsx` — `QueryClientProvider` wrapping `RouterProvider`; mount `ImpulseQueryBridge` in `useEffect`; connect WebSocket
- [x] 4.2 Define TanStack Router with `/app` route and search param schema: `impulseId`, `sort` (`column:asc|desc`), `filter`, `step`, `panel`
- [x] 4.3 Create `src/client/components/ImpulseViewport.tsx` — renders sorted impulse list from `useImpulseStore()`; applies position-mode layout (flow / absolute / center)
- [x] 4.4 Configure `persistQueryClient` + `createSyncStoragePersister` to persist QueryClient cache to `localStorage` with 24-hour TTL
- [x] 4.5 Wire WebSocket reconnect → `state_sync` handler: on reconnect, server sends full `state_sync`; bridge replaces cache

## 5. shadcn/ui Primitive Layer

- [x] 5.1 Initialise shadcn/ui: `npx shadcn@latest init` in `repos/react-renderer` — configure Tailwind, add `src/client/components/ui/`
- [x] 5.2 Add shadcn components: `button`, `badge`, `card`, `table`, `input`, `progress`, `textarea`, `select`, `checkbox`, `radio-group`, `separator`
- [x] 5.3 Update `container.tsx` — use shadcn `Card` wrapper; support `layout: vertical|horizontal|grid|absolute`; forward `className` and `variant` props
- [x] 5.4 Update `text.tsx` — use `react-markdown` with Tailwind prose classes; forward `className`
- [x] 5.5 Update `badge.tsx` — use shadcn `Badge` with `variant` prop (default, destructive, outline, secondary)
- [x] 5.6 Update `button.tsx` — use shadcn `Button`; dispatch `ui_event` action on click via WebSocket
- [x] 5.7 Update `progress.tsx` — use shadcn `Progress`; animate bar transitions with CSS transition
- [x] 5.8 Update `code.tsx` — keep `react-syntax-highlighter`; add `className` forwarding
- [x] 5.9 Add `design_token` primitive handler — on `design_token` impulse, apply `content` object as CSS custom properties on `:root`
- [x] 5.10 Add `animation` enter/exit handling to `ImpulseCard` — fade/slide/scale using CSS keyframes; delay unmount for exit animation (200ms)

## 6. TanStack Table Primitive

- [x] 6.1 Refactor `data-table-tanstack.tsx` — accept `columns` as array of `{ key, header, type?, sortable?, width? }` objects; build `ColumnDef<Record<string, unknown>>[]` dynamically
- [x] 6.2 Add column type renderers: `date` (format with `Intl.DateTimeFormat`), `number` (right-aligned), `status` (shadcn `Badge`), `text` (default)
- [x] 6.3 Wire `sorting` and `columnFilters` state to TanStack Router search params (`?sort=`, `?filter=`)
- [x] 6.4 Add global filter input above table using shadcn `Input`
- [x] 6.5 Add pagination controls below table using shadcn `Button` for prev/next; show page X of Y
- [x] 6.6 Implement TanStack Virtual for rows: activate when `virtual: true` or row count > 200; use `useVirtualizer` from `@tanstack/react-virtual`
- [x] 6.7 Wire row click to WebSocket `action` message: `{ type: "action", action: primitive.onRowClick, payload: { row: rowData } }`
- [x] 6.8 Write unit tests: dynamic column build, type renderers, sort URL encoding, virtual threshold

## 7. TanStack Form Primitive

- [x] 7.1 Create `src/client/primitives/form.tsx` — accepts `fields` array from primitive spec; uses `@tanstack/react-form` for field state
- [x] 7.2 Support field types: `text`, `number`, `date`, `select` (with `options`), `checkbox`, `radio`, `textarea`
- [x] 7.3 Implement per-field validation from `primitive.fields[n].required` and `primitive.fields[n].errorMessage`
- [x] 7.4 Implement form submission — dispatch WebSocket `action` message with `{ action: "form_submit", payload: { values: {...} } }`
- [x] 7.5 Add `step` support — when primitive has `steps` array, render one step at a time; sync current step to URL `?step=N`
- [x] 7.6 Write unit tests: required field validation, form submission action, step navigation URL encoding

## 8. Five Write Resolvers

- [x] 8.1 Create `src/resolvers/layout-change.ts` — update `position`, `size`, `layer` on existing impulse; broadcast `impulse_update`; return 404 for unknown ID
- [x] 8.2 Create `src/resolvers/style-change.ts` — patch `className` and/or `variant` on root primitive; preserve primitive structure
- [x] 8.3 Create `src/resolvers/component-change.ts` — replace entire primitive spec; preserve position/size/layer/animation unless overridden; support `animation` on swap
- [x] 8.4 Create `src/resolvers/data-source-change.ts` — update `data` field on `data-table`, `data-table-v2`, `chart` primitives; return 422 for inapplicable types
- [x] 8.5 Create `src/resolvers/ui-event.ts` — maintain an in-process pending event queue; `action` WebSocket messages enqueue events; resolver dequeues one; return `null` content when empty
- [x] 8.6 Create `src/resolvers/composition-metric.ts` — write to activity-api `impulse-relevance` endpoint; create `composition_metric` impulse in store
- [x] 8.7 Register all six resolvers in `src/resolvers/index.ts` via `registerResolver()`
- [x] 8.8 Add `POST /resolve/layout_change`, `/style_change`, `/component_change`, `/data_source_change`, `/ui_event`, `/composition_metric` routes in `src/index.ts`

## 9. synthesize-ui-from-data Activity

- [x] 9.1 Populate `config/shape-mapping.json` with entries for: `tabular_data`, `markdown_document`, `bash_output`, `activity_execution_trace`, `activityTemplate`, `executionTraceList`, `concept`, `conceptGraph`, `validation_result`, `goal`, `source_code`, `problem_detection`
- [x] 9.2 Create activity template `templates/synthesize-ui-from-data.json` — three tasks: (1) `lookup_mapping` (deterministic resolver reads shape-mapping.json), (2) `transform_data` (bash or LLM transforms data to match primitive schema), (3) `emit_ui_component` (calls `ui_component` resolver)
- [x] 9.3 Implement column type inference in the transform task — detect ISO dates, numeric strings, status strings
- [x] 9.4 Add `code` JSON fallback for shapes not in the mapping (no LLM invoked)
- [x] 9.5 Add LLM fallback task for schema-conformant shapes where data doesn't match expected structure
- [x] 9.6 Sync `synthesize-ui-from-data` template to activity-api via template-sync on vessel startup

## 10. Error Boundaries

- [x] 10.1 Create `src/client/components/ErrorBoundary.tsx` — class-based React `ErrorBoundary` with `componentDidCatch`; renders error fallback card (red border, type, message, collapsible stack)
- [x] 10.2 On `componentDidCatch`: fire `POST /impulses/:id/errors` (fire-and-forget)
- [x] 10.3 On `componentDidCatch`: call `impulseStore.create({ type: "render_failure", ... })` with `priority: "high"`
- [x] 10.4 Implement boundary reset on impulse update — use `getDerivedStateFromProps` with impulse `updatedAt` as reset key
- [x] 10.5 Wrap each `ImpulseCard` in `ErrorBoundary` in `ImpulseRenderer.tsx`
- [x] 10.6 Wrap each `renderChild` output in `PrimitiveRenderer.tsx` with `ErrorBoundary` up to depth 10
- [x] 10.7 Create `templates/record-interaction-metric.json` — activity with conditional task watching for `render_failure` impulses and calling `composition_metric` resolver
- [x] 10.8 Write unit tests: error isolation (sibling survives), fallback UI content, reset on update, depth-10 cap

## 11. Five UI Pattern Activity Templates

- [x] 11.1 Create `templates/render-live-execution-monitor.json` — progress + badge strip + task-log table + code streaming; input shape: `activity_execution_trace`
- [x] 11.2 Create `templates/render-data-exploration.json` — grid layout with KPI cards, chart, sortable table; input shapes: `tabular_data`, `activityMetrics`
- [x] 11.3 Create `templates/render-wizard.json` — multi-step form using TanStack Form primitive; input shape: `goal`
- [x] 11.4 Create `templates/render-dashboard.json` — 4-column KPI grid + two charts + alert table; input shape: `vesselPerformanceMetrics`
- [x] 11.5 Create `templates/render-conversation.json` — scrolling message thread with structured UI responses; input shape: `user_intent`
- [x] 11.6 Sync all five templates to activity-api via template-sync on vessel startup

## 12. Integration Verification

- [x] 12.1 Start react-renderer with `DISCOVERY_ENDPOINT` set; verify registration via `GET ${DISCOVERY_ENDPOINT}/shapes`
- [ ] 12.2 Run minibob goal "show me a table of the last 5 execution traces" — verify `synthesize-ui-from-data` fires, `ui_component` impulse arrives at react-renderer, table renders in browser at `/app`
- [x] 12.3 Call `POST /resolve/layout_change` and verify browser re-renders card in new position
- [x] 12.4 Click a table row in `/app`; verify `ui_event` resolver returns the action and minibob receives it
- [x] 12.5 Trigger a render error (malformed primitive); verify error boundary shows fallback, sibling cards survive, `/debug/errors` logs the error
- [x] 12.6 Disconnect and reconnect WebSocket; verify `state_sync` repopulates the browser correctly
- [x] 12.7 Run `bun run typecheck` in `repos/react-renderer` — zero errors
- [x] 12.8 Run `bun test` in `repos/react-renderer` — all tests pass
