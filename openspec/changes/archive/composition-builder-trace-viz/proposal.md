## Why

The workbench currently lacks interactive tools for building activity compositions and visualizing execution traces in real-time. Users must manually edit JSON templates or rely on automatic Thompson Sampling, missing opportunities for teaching the system through demonstration and understanding execution behavior as it happens.

## What Changes

- Add interactive node-based composition builder using React Flow
- Implement real-time trace visualization with timeline and flame graph views
- Create live execution monitoring with WebSocket streaming
- Add visual validation for impulse shape compatibility between activities
- Enable composition export as reusable activity templates
- Implement state diff viewer for before/after comparisons

## Capabilities

### New Capabilities

- `node-composition-editor`: Visual drag-and-drop editor for wiring activities together with real-time shape validation and graph serialization
- `execution-timeline-viz`: Gantt-style timeline visualization showing task durations, tool calls, and impulse resolutions with color-coded status
- `execution-flame-graph`: Hierarchical flame graph visualization for cost and duration analysis across resolvers and tasks
- `live-execution-monitor`: Real-time execution progress streaming via WebSocket with task-by-task updates and log viewing
- `state-diff-viewer`: Side-by-side diff visualization showing file changes and state transitions during execution

### Modified Capabilities

- `template-editor`: Enhanced to support launching composition builder and importing composed graphs as templates
- `execution-details`: Extended with timeline and flame graph tabs alongside existing task list view

## Impact

**Frontend (workbench):**
- New dependencies: `reactflow`, `react-diff-viewer-continued`, `d3` (for flame graphs)
- New pages: `/compositions/builder`, `/executions/:id/timeline`
- New components: ~15 new components in `src/components/composition/` and `src/components/visualizations/`
- Modified: `ExecutionDetails.tsx`, `TemplatesPage.tsx`

**Backend (activity-api):**
- New endpoint: `POST /v2/activities/validate-composition` - Real-time composition validation
- Modified: WebSocket broadcaster to support fine-grained task progress events

**Data model:**
- No schema changes required - uses existing ExecutionTrace with `impulse_resolutions` field

**Integration:**
- WebSocket protocol extended with new event types: `task.progress`, `tool.call`
