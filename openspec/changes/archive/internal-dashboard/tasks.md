## 1. Repository Setup

- [x] 1.1 Create `repos/metabob-internal-dashboard/` directory structure with Bun + React 19 + TypeScript
- [x] 1.2 Initialize package.json with dependencies: react, react-dom, @radix-ui/*, tailwindcss, lucide-react
- [x] 1.3 Configure Bun.serve with HTML imports and WebSocket support
- [x] 1.4 Create base index.html with dark theme and centered layout
- [x] 1.5 Add tailwind.config.ts with Metabob color scheme
- [x] 1.6 Create tsconfig.json with path aliases (@/components, @/lib)

## 2. Helm Chart & Deployment

- [x] 2.1 Create `helm/charts/metabob-internal-dashboard/Chart.yaml` with dependencies
- [x] 2.2 Create `helm/charts/metabob-internal-dashboard/values.yaml` with configurable MiniBob endpoint
- [x] 2.3 Create deployment.yaml template with resource limits and health probes
- [x] 2.4 Create service.yaml template exposing port 3001
- [x] 2.5 Add VirtualService for `internal.metabob.local` routing via Istio
- [x] 2.6 Add release to `helm/activity-system-minimal.yaml.gotmpl` with correct dependencies

## 3. WebSocket Communication Layer

- [x] 3.1 Create `src/lib/websocket-handler.ts` with reconnection logic and message queuing
- [x] 3.2 Define TypeScript types for WebSocket protocol messages (query, impulse_create, impulse_update, etc.)
- [x] 3.3 Create `src/hooks/useMiniBobConnection.ts` React hook for WebSocket state
- [x] 3.4 Implement connection status indicator component
- [x] 3.5 Add exponential backoff reconnection with max retry limit

## 4. Impulse-Driven UI Architecture (Aligned with impulse-pointer-mvp)

- [x] 4.1 Create `src/lib/impulse-types.ts` with UIComponentImpulse interface following impulse-pointer-mvp metadata pattern
- [x] 4.2 Define UIComponentPointer type with dataRef support for referencing data impulses
- [x] 4.3 Define UIImpulseMetadata type with componentType, position, dataShape, summary fields
- [x] 4.4 Create `src/store/impulse-store.ts` for managing UI impulse state
- [x] 4.5 Create `src/components/ImpulseRenderer.tsx` that maps impulse type to React component
- [x] 4.6 Implement dataRef resolution - load referenced data impulse before rendering
- [x] 4.7 Implement impulse CRUD operations (create, update, delete) triggered by WebSocket messages
- [x] 4.8 Add `deletable: false` protection for query input impulse
- [x] 4.9 Implement impulse state reconciliation on WebSocket reconnect
- [ ] 4.10 Implement metadata updates when data changes (re-compute dataShape, summary)

## 5. Query Interface

- [x] 5.1 Create `src/components/QueryInput.tsx` floating centered text input
- [x] 5.2 Style input with glassmorphism effect and dark theme
- [x] 5.3 Implement Enter key submission sending query to MiniBob
- [x] 5.4 Add loading state indicator during MiniBob processing
- [x] 5.5 Implement "thinking" message display from MiniBob
- [x] 5.6 Create query history with up/down arrow navigation
- [x] 5.7 Persist query history to localStorage (last 50 queries)
- [x] 5.8 Add /clear command to reset UI state

## 6. Rendering Primitives (Unbounded Rendering System)

### 6.1 Core Primitive Renderer
- [x] 6.1.1 Create `src/components/PrimitiveRenderer.tsx` - recursive renderer for any primitive composition
- [x] 6.1.2 Implement unknown primitive fallback (debug info, don't crash)
- [ ] 6.1.3 Implement dataRef resolution for primitives that reference data impulses

### 6.2 Layout Primitives
- [x] 6.2.1 Create `ContainerPrimitive` with layout modes: vertical, horizontal, grid, absolute
- [x] 6.2.2 Implement gap, padding, columns props for layout control
- [x] 6.2.3 Support arbitrary nesting of containers
- [x] 6.2.4 Implement style prop passthrough for custom CSS

### 6.3 Text Primitives
- [x] 6.3.1 Create `TextPrimitive` with format: plain, markdown, code
- [x] 6.3.2 Implement variant styles: heading, subheading, body, caption, label
- [x] 6.3.3 Create `CodePrimitive` with syntax highlighting and line numbers

### 6.4 Data Primitives
- [x] 6.4.1 Create `DataTablePrimitive` with dynamic columns (any shape)
- [x] 6.4.2 Implement column render modes: text, number, date, badge, progress, custom
- [ ] 6.4.3 Add sorting by any column
- [x] 6.4.4 Add pagination with configurable page size
- [x] 6.4.5 Implement rowAction for row click → MiniBob tool call
- [ ] 6.4.6 Support streaming rows via impulse updates

### 6.5 Chart Primitives
- [x] 6.5.1 Create `ChartPrimitive` supporting: bar, line, pie, scatter, area (placeholder, needs recharts integration)
- [x] 6.5.2 Implement gauge chart type for single values (placeholder)
- [x] 6.5.3 Implement sparkline for inline trends (placeholder)
- [ ] 6.5.4 Support multi-series with colors
- [ ] 6.5.5 Support dynamic axis configuration (xAxis, yAxis keys)
- [ ] 6.5.6 Support streaming data updates

### 6.6 Graph Primitive
- [x] 6.6.1 Create `GraphPrimitive` for node/edge visualization (placeholder, needs react-force-graph integration)
- [x] 6.6.2 Implement layout modes: force-directed, hierarchical, circular, grid (placeholder)
- [ ] 6.6.3 Support edge weights and labels
- [ ] 6.6.4 Implement nodeAction for node click → MiniBob tool call
- [ ] 6.6.5 Support streaming nodes/edges

### 6.7 Interactive Primitives
- [x] 6.7.1 Create `InputPrimitive` with types: text, number, date, select, checkbox, radio
- [x] 6.7.2 Implement onSubmit → MiniBob tool call
- [x] 6.7.3 Create `ButtonPrimitive` with variants: primary, secondary, danger, ghost
- [x] 6.7.4 Implement confirm dialog for dangerous actions
- [x] 6.7.5 Create `BadgePrimitive` with variants: success, warning, error, info, neutral
- [x] 6.7.6 Create `ProgressPrimitive` with types: bar, circle, gauge

### 6.8 Media Primitives
- [x] 6.8.1 Create `ImagePrimitive` supporting base64 and URL sources
- [ ] 6.8.2 Create `CustomPrimitive` for raw HTML/SVG (with security considerations)
- [ ] 6.8.3 Implement fallback rendering for custom primitives

### 6.9 Composition Support
- [ ] 6.9.1 Implement progressive composition (create container, add children via updates)
- [x] 6.9.2 Support layer/z-index for overlapping components
- [x] 6.9.3 Implement animation on mount: fade, slide, scale
- [x] 6.9.4 Support position modes: below-input, center, float, absolute {x,y}

## 7. MiniBob Tools - UI Control (Primitive-Based)

- [x] 7.1 Add `create_ui_component` tool accepting ANY primitive composition
  - [x] 7.1.1 Define primitive schema (container, text, data-table, chart, graph, input, button, badge, progress, code, image)
  - [x] 7.1.2 Support nested primitive compositions
  - [x] 7.1.3 Support dataRef for referencing data impulses
  - [x] 7.1.4 Support position, layer, animation options
- [x] 7.2 Add `update_ui_component` tool for incremental composition
  - [ ] 7.2.1 Support partial updates to nested structures
  - [ ] 7.2.2 Support appending children to containers
  - [ ] 7.2.3 Support streaming data into tables/charts
- [x] 7.3 Add `delete_ui_component` tool
- [x] 7.4 Add `clear_ui_components` tool with `except` parameter
- [x] 7.5 Create UIComponentImpulse type supporting arbitrary primitive trees
- [x] 7.6 Implement WebSocket broadcast of impulse changes to connected dashboards
- [x] 7.7 Add primitive validation (warn on unknown primitives, don't fail)
- [ ] 7.8 Document primitive API in tool description for LLM

## 8. MiniBob Tools - System Introspection

- [ ] 8.1 Add `query_kubernetes` tool with pod/service/event resource support
- [ ] 8.2 Configure ServiceAccount RBAC for read-only access to activity-system namespace
- [ ] 8.3 Add `query_surrealdb` tool with parameterized query support
- [ ] 8.4 Implement SELECT-only restriction for query_surrealdb
- [ ] 8.5 Add `check_service_health` tool for activity-api, analysis-api, surrealdb
- [ ] 8.6 Add latency measurement to health checks
- [ ] 8.7 Add `query_system_health` tool calling `/v2/metrics/system-health`
- [ ] 8.8 Add `query_tool_patterns` tool calling `/v2/metrics/tool-patterns`
- [ ] 8.9 Add `query_composition_patterns` tool calling `/v2/metrics/composition-patterns`
- [ ] 8.10 Add `query_peer_anomalies` tool for behavioral anomaly detection
- [ ] 8.11 Add `get_circuit_breaker_state` tool
- [ ] 8.12 Add `set_circuit_breaker` tool with authorization check

## 9. MiniBob WebSocket Server

- [x] 9.1 Add WebSocket upgrade handler to MiniBob HTTP server
- [x] 9.2 Implement session management for connected dashboards
- [x] 9.3 Create message routing for query and action message types
- [x] 9.4 Implement impulse state broadcast to all connected clients
- [x] 9.5 Add full state sync on new client connection
- [x] 9.6 Handle client disconnect and cleanup

## 10. Bootstrap Activity Templates (Optional Optimizations)

**Note:** These templates are performance optimizations, NOT capability gates. The system MUST work with zero templates via improvisation. Successful improvisations automatically create templates via Ribosome.

### 10.1 Learning System Templates
- [ ] 10.1.1 Create `templates/internal-dashboard/hidden-high-performers.json` - templates with high success, low selection
- [ ] 10.1.2 Create `templates/internal-dashboard/impulse-failure-correlation.json` - impulses correlated with failures
- [ ] 10.1.3 Create `templates/internal-dashboard/composition-patterns.json` - reliable multi-step patterns
- [ ] 10.1.4 Create `templates/internal-dashboard/cost-duration-tradeoffs.json` - variant cost vs speed analysis
- [ ] 10.1.5 Create `templates/internal-dashboard/tool-usage-patterns.json` - tool call frequencies
- [ ] 10.1.6 Create `templates/internal-dashboard/goal-execution-paths.json` - compare goal completion paths
- [ ] 10.1.7 Create `templates/internal-dashboard/impulse-reliability-timeline.json` - impulse type success over time

### 10.2 Kubernetes/Ops Templates
- [ ] 10.2.1 Create `templates/internal-dashboard/unhealthy-pods.json` - pods not ready
- [ ] 10.2.2 Create `templates/internal-dashboard/service-health.json` - API health and latency
- [ ] 10.2.3 Create `templates/internal-dashboard/minibob-cluster-status.json` - replica and boredom status
- [ ] 10.2.4 Create `templates/internal-dashboard/storage-utilization.json` - SurrealDB storage check
- [ ] 10.2.5 Create `templates/internal-dashboard/data-pipeline-status.json` - MiniBob → API → DB flow
- [ ] 10.2.6 Create `templates/internal-dashboard/resource-utilization.json` - CPU/memory near limits
- [ ] 10.2.7 Create `templates/internal-dashboard/istio-routes.json` - gateway routing status

### 10.3 Multi-tenant Admin Templates
- [ ] 10.3.1 Create `templates/internal-dashboard/orgs-over-limit.json` - seat limit violations
- [ ] 10.3.2 Create `templates/internal-dashboard/inactive-instances.json` - MiniBob instances idle 7+ days
- [ ] 10.3.3 Create `templates/internal-dashboard/expired-instances.json` - expired but still active
- [ ] 10.3.4 Create `templates/internal-dashboard/org-admins.json` - admins per org with last login
- [ ] 10.3.5 Create `templates/internal-dashboard/unused-api-keys.json` - keys never used, 30+ days old
- [ ] 10.3.6 Create `templates/internal-dashboard/access-denied-audit.json` - security audit events
- [ ] 10.3.7 Create `templates/internal-dashboard/free-plan-upsell.json` - free orgs with 3+ projects

### 10.4 Observation Hierarchy Templates
- [ ] 10.4.1 Create `templates/internal-dashboard/explain-circuit-breaker.json` - why boredom paused
- [ ] 10.4.2 Create `templates/internal-dashboard/failure-correlation.json` - correlated vs independent failures
- [ ] 10.4.3 Create `templates/internal-dashboard/tool-sequences.json` - common tool sequences
- [ ] 10.4.4 Create `templates/internal-dashboard/template-diversity.json` - creation rate and depth
- [ ] 10.4.5 Create `templates/internal-dashboard/chain-vs-standalone.json` - composition success comparison
- [ ] 10.4.6 Create `templates/internal-dashboard/peer-anomalies.json` - flag unusual behavior
- [ ] 10.4.7 Create `templates/internal-dashboard/system-health-summary.json` - can we resume?

### 10.5 Meta Templates
- [ ] 10.5.1 Create `templates/internal-dashboard/clear-and-reset.json` - /clear command handler
- [ ] 10.5.2 Create `templates/internal-dashboard/show-as-graph.json` - convert table to graph
- [ ] 10.5.3 Create `templates/internal-dashboard/show-as-table.json` - convert graph to table
- [ ] 10.5.4 Create `templates/internal-dashboard/detail-row.json` - expand row detail
- [ ] 10.5.5 Create `templates/internal-dashboard/filter-results.json` - apply filter to current view

## 11. MiniBob Integration (In-Process Library)

- [ ] 11.1 Create MiniBob library entry point for embedding in dashboard
- [ ] 11.2 Configure MiniBob with system-scope auth (cross-org read access)
- [ ] 11.3 Implement WebSocket message handler integration
  - [ ] 11.3.1 Route 'query' messages to goal processor
  - [ ] 11.3.2 Route 'action' messages to tool executor
  - [ ] 11.3.3 Stream 'thinking' messages during task execution
  - [ ] 11.3.4 Stream 'tool_call' progress messages
  - [ ] 11.3.5 Stream 'impulse_create/update/delete' on UI changes
- [ ] 11.4 Connect activity callbacks to WebSocket streaming
- [ ] 11.5 Implement conversation context for follow-up queries
- [ ] 11.6 Integrate with Ribosome for improvisation → template extraction

## 12. System-Scope Authentication

- [ ] 12.1 Define SYSTEM access method in SurrealDB auth schema
- [ ] 12.2 Create internal_dashboard_credentials table with secret hashing
- [ ] 12.3 Update PERMISSIONS clauses to allow system-scope read access
- [ ] 12.4 Create JWT claims structure for system scope
- [ ] 12.5 Configure dashboard deployment with system credentials secret
- [ ] 12.6 Implement authorization check for destructive actions (circuit breaker)

## 13. Integration & Testing

### 13.1 Core Infrastructure
- [ ] 13.1.1 Test WebSocket connection establishment and reconnection
- [ ] 13.1.2 Test impulse create/update/delete round-trip
- [ ] 13.1.3 Test query submission and response rendering
- [ ] 13.1.4 Test Kubernetes query tool with local cluster
- [ ] 13.1.5 Test SurrealDB query tool with learning_loop database
- [ ] 13.1.6 Test component streaming updates
- [ ] 13.1.7 Deploy to local Kubernetes and verify Istio routing
- [ ] 13.1.8 Test cross-org data access with system scope

### 13.2 Unbounded Rendering Tests
- [ ] 13.2.1 Test novel visualization request: "Show as pie chart" for data that's never been pie-charted
- [ ] 13.2.2 Test complex composition: "Show a grid with gauges and tables"
- [ ] 13.2.3 Test comparison: "Compare template A vs B side by side"
- [ ] 13.2.4 Test progressive build: container created, children added via updates
- [ ] 13.2.5 Test streaming: table rows appear incrementally
- [ ] 13.2.6 Test unknown primitive graceful fallback

### 13.3 Improvisation Tests (Zero Templates)
- [ ] 13.3.1 Delete all templates, verify system still answers queries
- [ ] 13.3.2 Test novel query: "Show cost per success by category as a bar chart"
- [ ] 13.3.3 Test ambiguous query: "Is the system healthy?" with no health template
- [ ] 13.3.4 Verify Ribosome creates template from successful improvisation
- [ ] 13.3.5 Verify next similar query uses the newly created template
- [ ] 13.3.6 Test improvisation failure handling (explain what went wrong)

### 13.4 Context & Follow-up Tests
- [ ] 13.4.1 Test follow-up query context resolution: "Show more detail on the first one"
- [ ] 13.4.2 Test visualization change: "Show this as JSON instead"
- [ ] 13.4.3 Test filter refinement: "Only show failures"
- [ ] 13.4.4 Test conversation reset: "/clear" command

## 14. Layout Control System

- [x] 14.1 Implement viewport tracking
  - [x] 14.1.1 Send viewport dimensions on connection: `{ type: 'viewport', width, height }`
  - [x] 14.1.2 Send viewport resize events: `{ type: 'viewport_resize', width, height }`
- [x] 14.2 Implement position modes
  - [x] 14.2.1 `flow` - document flow (default)
  - [x] 14.2.2 `below-input` - anchored below query input
  - [x] 14.2.3 `absolute` - exact {x, y} coordinates
  - [x] 14.2.4 `anchor` - relative to another component
  - [x] 14.2.5 `region` - docked to viewport region (top, bottom, left, right, center)
- [x] 14.3 Implement sizing system
  - [x] 14.3.1 `auto` - fit content
  - [x] 14.3.2 `explicit` - { width, height } with units
  - [x] 14.3.3 `fill` - expand to available space
- [x] 14.4 Implement z-index layering
  - [x] 14.4.1 Default layer 0
  - [x] 14.4.2 Overlay layers (1+) for modals/tooltips
  - [x] 14.4.3 Protected z-index for query input (always on top)
- [ ] 14.5 Add `get_layout_state` tool for MiniBob
  - [ ] 14.5.1 Return viewport dimensions
  - [ ] 14.5.2 Return component bounds (x, y, width, height)
  - [ ] 14.5.3 Return available regions
- [x] 14.6 Create layout state impulse for LLM context

## 15. Playwright Validation Suite

### 15.1 Test Infrastructure
- [x] 15.1.1 Create `tests/` directory with Playwright config
- [x] 15.1.2 Configure WebSocket message interception
- [x] 15.1.3 Add test data attributes to components (`data-component-type`, `data-component-id`, etc.)
- [ ] 15.1.4 Create test fixtures for common scenarios

### 15.2 Basic Control Tests
- [ ] 15.2.1 Test: query creates table component
- [ ] 15.2.2 Test: query creates chart component
- [ ] 15.2.3 Test: query creates composed layout
- [ ] 15.2.4 Test: component positions below input
- [ ] 15.2.5 Test: multiple components stack without overlap

### 15.3 Update Control Tests
- [ ] 15.3.1 Test: component updates without remounting (same ID)
- [ ] 15.3.2 Test: streaming rows appear incrementally
- [ ] 15.3.3 Test: filter refines existing component

### 15.4 Interaction Tests
- [ ] 15.4.1 Test: button click triggers MiniBob action
- [ ] 15.4.2 Test: table row click triggers detail query
- [ ] 15.4.3 Test: form submit triggers MiniBob tool

### 15.5 Improvisation Tests
- [ ] 15.5.1 Test: novel query handled via improvisation
- [ ] 15.5.2 Test: comparison query creates side-by-side layout
- [ ] 15.5.3 Test: unfamiliar visualization request produces result

### 15.6 Layout Tests
- [ ] 15.6.1 Test: MiniBob avoids overlapping components
- [ ] 15.6.2 Test: /clear resets UI (only input remains)
- [ ] 15.6.3 Test: complex multi-component layout is logical

### 15.7 WebSocket Verification
- [x] 15.7.1 Test: observe thinking → tool_call → impulse_create sequence
- [x] 15.7.2 Test: verify impulse structure matches primitive schema
- [x] 15.7.3 Test: verify activity_complete sent after query

### 15.8 CI Integration
- [ ] 15.8.1 Create GitHub Actions workflow for Playwright tests
- [ ] 15.8.2 Configure docker-compose for test environment
- [ ] 15.8.3 Add test reports as artifacts

## 16. Documentation

- [x] 16.1 Create README.md for repos/metabob-internal-dashboard
- [ ] 16.2 Document WebSocket protocol in docs/INTERNAL_DASHBOARD_PROTOCOL.md
- [ ] 16.3 Add internal dashboard section to CLAUDE.md
- [ ] 16.4 Document MiniBob UI control tools in repos/minibob/README.md
- [ ] 16.5 Document rendering primitives and composition
- [ ] 16.6 Document layout control system (positions, sizing, layers)
- [ ] 16.7 Document system-scope auth configuration
- [ ] 16.8 Create Playwright test guide for validating MiniBob control
- [ ] 16.9 Document improvisation and Ribosome learning loop
