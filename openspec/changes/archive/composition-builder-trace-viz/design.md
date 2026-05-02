## Context

The current workbench provides basic activity template management (list, create, edit) and execution viewing (task list, logs), but lacks two critical capabilities:

1. **Interactive Composition Building**: Users cannot visually wire activities together or validate impulse shape compatibility before execution. Template creation requires manual JSON editing with no real-time feedback on composition validity.

2. **Real-Time Execution Insight**: Execution monitoring is limited to polling-based task lists. Users cannot see live progress, understand temporal characteristics (when did tasks execute?), or analyze cost/performance patterns across resolvers.

**Current State:**
- `repos/workbench/src/pages/TemplatesPage.tsx`: List view with JSON editor modal
- `repos/workbench/src/pages/ExecutionDetails.tsx`: Static task list after execution completes
- WebSocket streaming exists but only broadcasts high-level `activity.completed` events
- No visual tooling for composition or trace analysis

**Stakeholders:**
- MiniBob developers (dogfooding composition for MiniBob development)
- Activity template authors (teaching patterns through demonstration)
- SREs/operators (debugging failed executions via trace analysis)

**Constraints:**
- Must use existing WebSocket infrastructure (`repos/activity-monitor/src/server.ts`)
- Must work with existing SurrealDB schema (no breaking changes)
- Must integrate with React 19 workbench architecture (Bun runtime, HTML imports)
- Must support real-time updates without breaking existing polling-based UI

## Goals / Non-Goals

**Goals:**
- Enable visual composition of activities with drag-drop node editor (React Flow)
- Validate impulse shape compatibility in real-time (prevent incompatible connections)
- Visualize execution traces temporally (timeline Gantt chart showing when tasks executed)
- Visualize execution costs hierarchically (flame graph showing resolver tier distribution)
- Stream live execution progress via WebSocket (task-by-task updates as execution runs)
- Show state transitions with before/after diffs (file changes per task)
- Export composed graphs as reusable activity templates

**Non-Goals:**
- Editing activities within the composition builder (use existing template editor)
- Collaborative real-time editing (single-user only)
- Version control for compositions (store in localStorage only, manual export)
- Advanced graph algorithms (cycle detection only, no auto-layout optimization)
- Custom resolver implementation UI (resolvers are code, not visual config)
- Historical trace comparison (single execution view only)

## Decisions

### Decision 1: React Flow for Node Editor

**Choice:** Use React Flow (formerly ReactFlow) library instead of building custom canvas.

**Alternatives Considered:**
- **Rete.js**: More opinionated framework with plugin system, but heavier bundle size and steeper learning curve
- **Flume**: Simpler API but less active maintenance and smaller ecosystem
- **Custom Canvas**: Full control but significant implementation cost (pan/zoom, edge routing, minimap)

**Rationale:**
- React Flow has largest community (1.15M weekly downloads), active development, and extensive documentation
- Built-in features we need: minimap, controls, background, edge routing, node dragging
- TypeScript-first with excellent type safety
- Easy integration with shadcn/ui components for node content
- Proven scalability (handles 100+ node graphs)

**Trade-off:** Adds ~200KB to bundle, but eliminates weeks of graph UI implementation work.

### Decision 2: Timeline as Gantt Chart (not event stream)

**Choice:** Visualize execution traces as horizontal Gantt chart with time ruler, not vertical event stream.

**Alternatives Considered:**
- **Vertical Event Stream**: Chronological list with timestamps (similar to GitHub Actions logs)
- **Tree View**: Nested task/tool hierarchy without time axis
- **Flamegraph Only**: Combined time + hierarchy visualization

**Rationale:**
- Gantt chart explicitly shows temporal relationships (parallel tasks, gaps, duration)
- Time ruler enables comparison of task durations at a glance
- Industry standard for execution timelines (Chrome DevTools, Jaeger tracing)
- Can expand/collapse to show tool calls while preserving time context

**Trade-off:** Requires horizontal scrolling for long executions (>5 min), but this is expected UX for timelines.

### Decision 3: Flame Graph for Cost/Duration Analysis

**Choice:** Use flame graph (hierarchical bars) for cost visualization, not treemap or sunburst.

**Alternatives Considered:**
- **Treemap**: Better space utilization but harder to see hierarchy depth
- **Sunburst**: Good for deep hierarchies but unfamiliar to most users
- **Bar Chart**: Simple but loses nesting information

**Rationale:**
- Flame graphs are standard for performance profiling (originated in systems tracing)
- Width = cost/duration, depth = nesting (activity → task → tool call → resolver)
- Easy to spot expensive outliers (wide bars)
- Can switch between cost and duration metrics with same visualization
- Color intensity highlights disproportionate resource consumption

**Trade-off:** Less effective for very deep hierarchies (>5 levels), but activity executions rarely exceed 3 levels.

### Decision 4: WebSocket for Live Execution Streaming

**Choice:** Extend existing WebSocket broadcaster with fine-grained events (`task.started`, `task.completed`, `tool.call`).

**Alternatives Considered:**
- **Server-Sent Events (SSE)**: Simpler protocol but uni-directional only
- **Polling**: No infrastructure changes but wasteful and introduces latency
- **GraphQL Subscriptions**: Overkill for simple event streaming

**Rationale:**
- WebSocket infrastructure already exists (`repos/activity-monitor/src/server.ts`)
- Bidirectional channel enables future interactivity (pause execution, inject impulses)
- Low latency (<100ms) for real-time feel
- Handles reconnection with exponential backoff (reliability)

**Trade-off:** More complex error handling than polling, but required for true real-time UX.

### Decision 5: Composition Validation on Backend

**Choice:** Add `POST /v2/activities/validate-composition` endpoint for server-side validation.

**Alternatives Considered:**
- **Client-Only Validation**: Check types in frontend using template metadata
- **No Validation**: Let users create invalid compositions and fail at execution time
- **Real-Time Validation via WebSocket**: Validate on every edge added

**Rationale:**
- Backend has authoritative source of activity templates and impulse shape definitions
- Type compatibility rules may evolve (backend-driven, not hardcoded in frontend)
- Validation requires checking if resolvers exist for required impulse types (backend knowledge)
- Frontend can provide instant feedback by calling validation endpoint on composition changes

**Trade-off:** Network latency (~50ms per validation), but acceptable for interactive editing (debounced).

### Decision 6: LocalStorage for Composition Persistence

**Choice:** Auto-save composition state to browser localStorage, no backend storage.

**Alternatives Considered:**
- **Backend Storage**: Create `composition` table in SurrealDB
- **No Persistence**: User must manually export before closing browser
- **IndexedDB**: More storage capacity but added complexity

**Rationale:**
- Compositions are drafts until exported as templates (ephemeral working state)
- Avoids schema changes and multi-tenant complexity (no org_id needed)
- Simple implementation (~20 LOC)
- 5MB localStorage limit sufficient for compositions (typically <50KB)

**Trade-off:** Lost on browser data clear, but user can export to JSON file for backup.

### Decision 7: State Diff Viewer with react-diff-viewer-continued

**Choice:** Use `react-diff-viewer-continued` library for side-by-side diff visualization.

**Alternatives Considered:**
- **Monaco Diff Editor**: Full-featured but heavy (~2MB bundle)
- **Custom Implementation**: Full control but reinventing wheel
- **Unified Diff Only**: Simpler but harder to see before/after context

**Rationale:**
- Lightweight (~50KB) with syntax highlighting support
- Side-by-side and unified modes out of the box
- Line-by-line diff with added/removed/unchanged styling
- Easy integration with existing file content from `stateTransition` field

**Trade-off:** Limited customization compared to Monaco, but sufficient for state diff viewing.

## Risks / Trade-offs

### Risk: WebSocket Connection Instability
**Scenario:** User's network drops during long execution, misses progress updates.

**Mitigation:**
- Implement exponential backoff reconnection (1s, 2s, 4s, 8s intervals)
- Backend assigns sequence numbers to events, client requests catchup on reconnect
- Fallback to polling `/v2/activities/execution-traces/:id` if WebSocket fails repeatedly

### Risk: React Flow Bundle Size
**Scenario:** Adding React Flow significantly increases initial page load time.

**Mitigation:**
- Lazy-load composition builder route (only load when user navigates to `/compositions/builder`)
- Code-split React Flow and D3 dependencies
- Target metric: <500ms additional load time on 3G connection

### Risk: Invalid Compositions Stored in LocalStorage
**Scenario:** User creates composition with now-deleted activity template, composition breaks.

**Mitigation:**
- Validate composition on load, show warning if references missing templates
- Provide "Fix Composition" UI to replace deleted activities with valid alternatives
- Auto-export composition to JSON file on each save (backup in downloads folder)

### Risk: Flame Graph Performance with Large Traces
**Scenario:** Execution with 1000+ tool calls causes flame graph to render slowly.

**Mitigation:**
- Limit initial render depth to 3 levels (activity → task → tool)
- Virtualize flame graph bars (only render visible portion)
- Provide "Collapse to Tasks" option to reduce complexity
- Target metric: <2s render time for 1000 nodes

### Risk: Timeline Horizontal Scrolling UX
**Scenario:** Long executions (>10 min) require excessive scrolling to see all tasks.

**Mitigation:**
- Provide zoom controls (fit to screen, zoom in/out)
- Minimap overview shows full timeline with viewport indicator
- Keyboard shortcuts for timeline navigation (arrow keys, Home/End)

### Risk: Backend Validation Endpoint Latency
**Scenario:** Validation requests create noticeable lag during composition editing.

**Mitigation:**
- Debounce validation calls (500ms after last change)
- Show cached validation results immediately, refresh in background
- Implement optimistic UI (show green checkmark, update if validation fails)

## Migration Plan

**Phase 1: Backend WebSocket Events (Week 1)**
1. Extend `repos/activity-monitor/src/server.ts` to broadcast `task.started`, `task.completed`, `tool.call` events
2. Add `POST /v2/activities/validate-composition` endpoint to `repos/metabob-activity-api`
3. Deploy to canary, validate event streaming with manual WebSocket client
4. **Rollback**: WebSocket backward compatible (existing clients ignore new events)

**Phase 2: Composition Builder UI (Week 2)**
1. Create `/compositions/builder` route with React Flow integration
2. Implement node palette (drag activities onto canvas)
3. Add edge validation (impulse shape compatibility checking)
4. Auto-save to localStorage with restore on page load
5. **Rollback**: Feature behind route (no impact on existing pages)

**Phase 3: Timeline Visualization (Week 3)**
1. Add `/executions/:id/timeline` tab to `ExecutionDetails.tsx`
2. Implement Gantt chart with time ruler and task bars
3. Add expand/collapse for tool calls and impulse resolutions
4. Integrate WebSocket streaming for live updates
5. **Rollback**: Tab-based UI (can hide timeline tab if broken)

**Phase 4: Flame Graph Visualization (Week 4)**
1. Add `/executions/:id/flamegraph` tab to `ExecutionDetails.tsx`
2. Implement hierarchical flame graph with D3.js
3. Add cost/duration metric toggle and export functionality
4. Color-code by resolver tier (deterministic/pattern/LLM)
5. **Rollback**: Tab-based UI (can hide flamegraph tab if broken)

**Phase 5: State Diff Viewer (Week 5)**
1. Add file diff section to execution details
2. Integrate `react-diff-viewer-continued` for side-by-side view
3. Group diffs by task with expand/collapse
4. Add unified/split view toggle
5. **Rollback**: Section-based UI (can hide diff section if broken)

**Deployment Strategy:**
- All changes deployed to canary first (`https://activity.metabob.com`)
- Each phase validated independently before proceeding
- No schema migrations required (uses existing ExecutionTrace fields)
- Frontend changes are non-breaking (new routes and components only)

**Rollback Strategy:**
- Backend: Helm rollback to previous release (`helm rollback activity-api -n activity-system`)
- Frontend: Git revert specific commit, redeploy workbench
- Data: No migrations, rollback safe

## Open Questions

1. **Should composition builder support importing existing templates as starting point?**
   - Pro: Easier to create variants of existing patterns
   - Con: Adds complexity to deserialization (template → graph conversion)
   - **Decision needed by**: End of Week 1 (before implementing import UI)

2. **Should flame graph support filtering by resolver tier?**
   - Pro: Focus on LLM costs separately from deterministic costs
   - Con: Adds UI complexity (filter controls, multiple views)
   - **Decision needed by**: Week 4 (before finalizing flame graph implementation)

3. **Should timeline show parallel task execution explicitly?**
   - Context: Current executor is sequential, but future may support parallelism
   - Pro: Prepares UI for future concurrent execution
   - Con: Timeline UX complexity (overlapping bars)
   - **Decision needed by**: Week 3 (before implementing timeline layout algorithm)

4. **Should WebSocket events include partial tool output (streaming)?**
   - Pro: Live log viewer can show tool output character-by-character
   - Con: High event volume (100s of events per second for verbose tools)
   - **Decision needed by**: Week 1 (before finalizing WebSocket protocol)

5. **Should compositions be sharable across users/orgs?**
   - Pro: Enable community-contributed composition patterns
   - Con: Requires backend storage, multi-tenant isolation, permissions
   - **Decision needed by**: Future (out of scope for initial implementation)
