## Why

The current composition builder uses React Flow for graph-based activity composition, but this doesn't match the natural mental model of activity execution: linear sequences with parallel branches. Users struggle to understand execution flow, can't easily create variants from failed traces, and lack a simple way to teach the system new patterns through trajectory editing. A horizontal grid-based trajectory editor aligned with the impulse-activity model will enable intuitive template creation, variant tuning, and trace-based learning.

## What Changes

- Replace React Flow composition builder with CSS Grid horizontal trajectory editor
- Add three distinct editing flows: create from goal, create variant, inspect trace
- Implement inline expandable task editors using react-collapsed
- Add side-by-side diff view comparing execution traces to templates
- Integrate Thompson Sampling path recommendations into editor
- Add grid-based layout with columns (sequential) and rows (parallel execution)
- Remove ~700 LOC of React Flow specific code, add ~600 LOC of trajectory editor
- Keep existing composition builder initially for A/B testing, deprecate after validation

## Capabilities

### New Capabilities

- `trajectory-grid-editor`: Horizontal grid-based interface for editing activity sequences with column/row positioning for sequential/parallel execution
- `goal-to-trajectory`: Initialize trajectory from goal text using Thompson Sampling to generate prospective activity chain
- `inline-task-editor`: Expandable inline editing of task prompts, validation rules, and retry configuration without leaving trajectory view
- `trace-diff-viewer`: Side-by-side comparison of execution traces vs templates with highlighted differences and projected impact
- `variant-creation-flow`: Create activity variants by loading template, modifying tasks/scores, and saving with genealogy tracking
- `shape-flow-visualization`: Visual representation of impulse shapes flowing between activities with validation indicators

### Modified Capabilities

- `template-editor`: Enhanced to support launching trajectory editor and importing trajectories as templates
- `execution-details`: Extended with "Edit as Trajectory" button to load traces into trajectory editor

## Impact

**Frontend (workbench):**
- New dependencies: `@dnd-kit/core` (~15KB), `zustand` (~1KB), `react-diff-viewer-continued` (~30KB)
- New route: `/trajectories/:traceId/edit` or `/trajectories/new`
- New components: ~600 LOC in `src/components/trajectory/`
- Modified: `ExecutionDetails.tsx` (+button), `TemplatesPage.tsx` (+button)
- Deprecated (phased removal): `CompositionCanvas.tsx`, `CompositionGraph.tsx` (~700 LOC)
- Reused: `ActivityPalette.tsx`, `ActivityNode.tsx`, validation logic (~400 LOC)

**Backend (activity-api):**
- New endpoint (P1): `POST /v2/activities/discover-by-shapes` - Shape-based activity discovery
- Enhanced: `/goal-paths/recommend` already exists, may need minor adjustments for trajectory context
- No breaking changes - all new endpoints are additive

**Data model:**
- No schema changes required
- Uses existing: `activity_template`, `execution`, `goal_execution_paths`, `activity_composition_graph`

**Integration:**
- Trajectory editor operates on same data as composition builder
- Templates created by either editor are interchangeable
- Execution traces are the source of truth for variant creation
