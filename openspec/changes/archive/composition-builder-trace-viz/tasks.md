## 1. Backend WebSocket Events & Validation (Commit 1)

- [ ] 1.1 Extend activity-monitor WebSocket broadcaster to emit `task.started`, `task.completed`, `tool.call` events
- [ ] 1.2 Add event sequence numbering to WebSocket messages for catchup protocol
- [ ] 1.3 Implement `POST /v2/activities/validate-composition` endpoint in metabob-activity-api
- [ ] 1.4 Add composition validation logic (cycle detection, impulse shape compatibility)
- [ ] 1.5 Add integration test for WebSocket event streaming during execution
- [ ] 1.6 Add integration test for composition validation endpoint with valid/invalid graphs
- [ ] 1.7 Deploy to canary and validate WebSocket events with manual client

## 2. Node-Based Composition Builder (Commit 2)

- [ ] 2.1 Add `reactflow` dependency to workbench package.json
- [ ] 2.2 Create `/compositions/builder` route in workbench
- [ ] 2.3 Implement `CompositionCanvas.tsx` component with React Flow integration
- [ ] 2.4 Create `ActivityNode.tsx` custom node component showing input/output ports
- [ ] 2.5 Implement `ActivityPalette.tsx` component with drag-and-drop activity list
- [ ] 2.6 Add edge validation logic (check impulse shape compatibility on connect)
- [ ] 2.7 Implement composition serialization to/from JSON format
- [ ] 2.8 Add localStorage auto-save with restore on page load
- [ ] 2.9 Implement "Export as Template" functionality with validation check
- [ ] 2.10 Add minimap, zoom controls, and auto-layout button
- [ ] 2.11 Update `TemplatesPage.tsx` to add "Open Composition Builder" button
- [ ] 2.12 Add integration test for composition builder UI (E2E with Playwright)

## 3. Live Execution Monitor & Timeline Visualization (Commit 3)

- [ ] 3.1 Create `LiveExecutionMonitor.tsx` component with WebSocket connection management
- [ ] 3.2 Implement WebSocket reconnection logic with exponential backoff
- [ ] 3.3 Add event catchup protocol (request missed events by sequence number)
- [ ] 3.4 Create `ExecutionTimeline.tsx` component with Gantt chart rendering
- [ ] 3.5 Implement time ruler with configurable tick intervals and zoom levels
- [ ] 3.6 Add task bar rendering with color-coding by status (success/failure/in-progress)
- [ ] 3.7 Implement expand/collapse for nested tool calls within task bars
- [ ] 3.8 Add impulse resolution markers on timeline with resolver tier labels
- [ ] 3.9 Implement tooltip on hover showing task details (duration, cost, status)
- [ ] 3.10 Add minimap overview for long executions with viewport indicator
- [ ] 3.11 Create new "Timeline" tab in `ExecutionDetails.tsx` page
- [ ] 3.12 Integrate live monitor with timeline for real-time progress updates
- [ ] 3.13 Add integration test for live execution monitoring with WebSocket events

## 4. Flame Graph Visualization (Commit 4)

- [ ] 4.1 Add `d3` dependency to workbench package.json
- [ ] 4.2 Create `ExecutionFlameGraph.tsx` component with D3.js rendering
- [ ] 4.3 Implement hierarchical data transformation (execution trace → flame graph nodes)
- [ ] 4.4 Add flame graph bar rendering with width proportional to cost/duration
- [ ] 4.5 Implement color intensity highlighting for expensive operations (threshold-based)
- [ ] 4.6 Add resolver tier color coding (green=deterministic, yellow=pattern, blue=LLM)
- [ ] 4.7 Implement metric toggle (switch between cost and duration visualization)
- [ ] 4.8 Add drill-down interaction (click task to expand tool calls)
- [ ] 4.9 Implement hover tooltip with start/end timestamps and resource consumption
- [ ] 4.10 Add export functionality (PNG and SVG download)
- [ ] 4.11 Implement time-aware flame chart mode with horizontal time ruler
- [ ] 4.12 Create new "Flame Graph" tab in `ExecutionDetails.tsx` page
- [ ] 4.13 Add integration test for flame graph rendering with sample execution trace

## 5. State Diff Viewer (Commit 5)

- [ ] 5.1 Add `react-diff-viewer-continued` dependency to workbench package.json
- [ ] 5.2 Create `StateDiffViewer.tsx` component with split/unified view modes
- [ ] 5.3 Implement file list navigation sidebar with modified file paths and change counts
- [ ] 5.4 Add diff rendering with syntax highlighting for known file types (.ts, .tsx, .js, .json)
- [ ] 5.5 Implement line-by-line diff markers (green=added, red=removed, default=unchanged)
- [ ] 5.6 Add grouping by task with expandable sections labeled by task ID
- [ ] 5.7 Implement "Show final diff only" toggle (cumulative vs incremental diffs)
- [ ] 5.8 Add automatic collapsing of large unchanged blocks (>50 lines threshold)
- [ ] 5.9 Implement expand button for collapsed sections
- [ ] 5.10 Add view mode toggle (split view vs unified view)
- [ ] 5.11 Integrate diff viewer into `ExecutionDetails.tsx` as new section
- [ ] 5.12 Add integration test for state diff viewer with multi-file execution trace
