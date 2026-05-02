## Context

The current workbench provides a React Flow-based composition builder (`repos/workbench/src/components/composition/`) that treats activity composition as a spatial graph problem. This misaligns with the actual execution model where activities run sequentially (columns) or in parallel (rows within a column). Users cannot easily:

1. Create templates from execution traces (no trace import)
2. Create variants by modifying existing activities (must edit JSON)
3. Understand the temporal flow of execution (graph doesn't show sequence)
4. Teach the system through demonstration (manual graph construction only)

**Current Implementation:**
- React Flow canvas with ~1,000 LOC across 5 components
- Drag-and-drop node positioning with shape validation
- localStorage persistence
- Export to activity template

**Research Findings:**
- Backend has `goal_execution_paths` with Thompson Sampling for complete paths
- Backend has `activity_composition_graph` tracking historical sequences
- Activities declare `input_shapes` and `output_shapes` for validation
- Missing: Dynamic path construction (only returns previously-seen paths)

**Stakeholders:**
- MiniBob developers creating activity templates
- Users inspecting failed executions and creating fixes
- Learning system consuming trajectories for Thompson Sampling

## Goals / Non-Goals

**Goals:**
- Replace graph-based composition with horizontal grid-based trajectory editor
- Support three distinct flows: goal→trajectory, variant creation, trace inspection
- Enable inline task editing without modal dialogs
- Provide AI-assisted activity recommendations via Thompson Sampling
- Show side-by-side diff between traces and templates
- Maintain backward compatibility with existing templates
- Reduce bundle size vs React Flow (~50KB → ~46KB)

**Non-Goals:**
- Support for non-linear workflows (conditional branches, loops) - defer to v2
- Real-time collaborative editing - single-user only
- Mobile optimization - desktop-first, responsive later
- Complex graph algorithms (Dijkstra, A*) - use simple sequence matching
- Replace all uses of React Flow (keep for other visualizations)

## Decisions

### Decision 1: CSS Grid vs React Flow

**Choice:** Use CSS Grid with @dnd-kit for horizontal layout instead of React Flow.

**Alternatives Considered:**
- **React Flow with horizontal layout**: Could configure React Flow to enforce horizontal positioning
- **vis-timeline**: Timeline library with Gantt-style visualization
- **Custom canvas**: Full control but high implementation cost

**Rationale:**
- CSS Grid is native, performant, and simple for 1D/2D grid layouts
- @dnd-kit provides drag-and-drop without React Flow dependency
- Trajectory editor is fundamentally different from graph editor (temporal vs spatial)
- Simpler mental model: columns = sequence, rows = parallel
- Bundle size: 46KB vs 50-60KB for React Flow
- Easier to add features like inline editing, diff view

**Trade-off:** Lose React Flow's graph features (minimap, edge routing), but these aren't needed for linear trajectories.

### Decision 2: Zustand vs React Query for State

**Choice:** Use Zustand for trajectory editor state, keep React Query for server data.

**Alternatives Considered:**
- **React Query only**: Treat trajectory as server state
- **Redux Toolkit**: More powerful but heavier
- **useState + Context**: Simpler but doesn't scale

**Rationale:**
- Trajectory editing is local transient state (not server data until export)
- Need undo/redo support later (Zustand middleware)
- Complex mutations across multiple activities in sequence
- Zustand is lightweight (1KB) and performant
- React Query still handles fetching templates, traces, recommendations

**Trade-off:** Two state management systems, but clear separation (server vs local).

### Decision 3: Inline Editing vs Modal/Sidebar

**Choice:** Use react-collapsed for inline expandable task editors within trajectory view.

**Alternatives Considered:**
- **Modal dialogs**: Edit task in overlay
- **Sidebar drawer**: Slide-out editor
- **Separate page**: Navigate to task edit page

**Rationale:**
- Inline editing preserves context (user sees surrounding activities)
- Faster workflow (no navigation or modal opening)
- react-collapsed is tiny (2KB) with smooth animations
- Accessibility built-in (aria-expanded)
- Follows "details/summary" pattern (familiar UX)

**Trade-off:** Limited vertical space for complex task editing, but acceptable for typical task configuration.

### Decision 4: Three Separate Flows vs Unified Interface

**Choice:** Build one editor component with three entry points (goal, variant, trace).

**Alternatives Considered:**
- **Three separate pages**: /goals/new, /variants/create, /traces/:id/edit
- **Wizard flow**: Multi-step guided process
- **Tabs interface**: Switch between modes within editor

**Rationale:**
- Core editing logic is identical (add/remove/reorder activities)
- Different flows are just different data sources (goal text vs trace vs template)
- Reduces code duplication (~600 LOC shared vs ~1,800 LOC separate)
- Single component to test and maintain
- Entry point determines initial state, rest is unified

**Trade-off:** Component complexity increases, but manageable with proper state design.

### Decision 5: Side-by-Side Diff vs Overlay Diff

**Choice:** Use side-by-side columns for trace vs template comparison.

**Alternatives Considered:**
- **Overlay diff**: Highlight changes in single view
- **Unified diff**: GitHub-style +/- lines
- **No diff**: Just show final state

**Rationale:**
- Side-by-side preserves full context of both trace and template
- Clear visual separation (expected vs actual)
- Familiar pattern from code review tools
- react-diff-viewer-continued supports this well
- Synchronized scrolling keeps comparison aligned

**Trade-off:** Requires horizontal space, less effective on narrow screens (but desktop-first).

### Decision 6: Shape Validation: Strict vs Permissive

**Choice:** Warn on shape mismatches but allow export anyway.

**Alternatives Considered:**
- **Strict blocking**: Prevent export if shapes don't match
- **Silent permissive**: No validation at all
- **Auto-fix**: Automatically insert missing activities

**Rationale:**
- Users may be experimenting or creating new patterns
- Strict blocking frustrates exploration
- Warnings educate without blocking
- Backend can still validate on execution
- Trust users to know what they're doing

**Trade-off:** Possible invalid templates exported, but caught at execution time.

### Decision 7: Backend Path Finding: Now vs Later

**Choice:** Build MVP without backend path finding, add `POST /v2/activities/discover-by-shapes` in Phase 2.

**Alternatives Considered:**
- **Full graph search now**: Implement A* pathfinding upfront
- **No backend changes**: Use only existing endpoints
- **Mock recommendations**: Fake path suggestions for prototype

**Rationale:**
- Existing `/goal-paths/recommend` already provides path suggestions (for known paths)
- Shape-based discovery is simple query wrapper (already implemented, just needs endpoint)
- Can validate editor UX before investing in complex graph algorithms
- Incremental delivery reduces risk

**Trade-off:** Limited recommendations initially (only historical paths), but acceptable for MVP.

## Risks / Trade-offs

### Risk: Performance with 50+ Activities in Trajectory

**Scenario:** User creates very long activity sequence, editor becomes sluggish.

**Mitigation:**
- Virtual scrolling if >100 activities (react-window)
- Lazy load task details (only expand when needed)
- Memoize activity card components (React.memo)
- Profile with large traces during testing
- Target: <100ms interaction latency for 50 activities

### Risk: Users Prefer Graph Editor Over Trajectory Editor

**Scenario:** After launch, users continue using React Flow composition builder.

**Mitigation:**
- Keep both editors for 2 weeks, A/B test
- Track usage metrics (which editor, time to export, success rate)
- User interviews to understand preferences
- Deprecate based on data, not assumptions
- Fallback: Enhance React Flow if trajectory editor fails

### Risk: Inline Editing Too Cramped for Complex Tasks

**Scenario:** Task configuration is too complex for inline expandable editor.

**Mitigation:**
- Provide "Open in full editor" button for complex tasks
- Detect complexity (>5 validation rules) and suggest full editor
- Use accordion sections within inline editor for better organization
- Test with real task configurations during development

### Risk: Diff View Confusing for Non-Identical Sequences

**Scenario:** Trace has different activity count than template, diff is unclear.

**Mitigation:**
- Use LCS (Longest Common Subsequence) algorithm to align activities
- Show insertions/deletions clearly (green/red highlights)
- Provide "Sync to template" button to realign trace
- Add summary: "3 activities added, 1 removed, 2 modified"

### Risk: Thompson Sampling Returns No Recommendations

**Scenario:** No historical paths match current impulse state.

**Mitigation:**
- Fall back to shape-based discovery (activities producing desired shapes)
- Show manual search with helpful filters
- Provide "I'll add manually" option (don't force recommendations)
- Log cases where recommendations fail for analysis

### Risk: Backend Shape Discovery Endpoint Missing

**Scenario:** Phase 2 blocked if endpoint not ready.

**Mitigation:**
- Endpoint implementation is trivial (query wrapper, <50 LOC)
- Can be added in parallel with frontend Phase 1
- Fallback to manual search if endpoint unavailable
- Not critical path for MVP (Phase 1 works without it)

## Migration Plan

### Phase 1: Parallel Deployment (Week 1)

1. **Deploy new trajectory editor** alongside existing composition builder
   - New route: `/trajectories/new`, `/trajectories/:traceId/edit`
   - Keep `/compositions/builder` unchanged
   - No breaking changes to existing features

2. **Add entry points** to existing pages
   - ExecutionDetails: "Edit as Trajectory" button
   - TemplatesPage: "Create from Trajectory" button
   - Link both to new and old builders

3. **Validation**
   - Smoke test: Create template via trajectory editor
   - Verify export produces valid template
   - Check React Flow builder still works

### Phase 2: A/B Testing (Week 2)

1. **Track metrics** for both editors
   - Time to create template
   - Export success rate
   - Feature usage (inline editing, diff view, recommendations)
   - User preference survey

2. **Iterate based on feedback**
   - Bug fixes for trajectory editor
   - UX improvements where users struggle
   - Add missing features if needed

### Phase 3: Deprecation Decision (Week 3)

1. **Analyze data**
   - If trajectory editor ≥80% adoption: Deprecate React Flow builder
   - If <50% adoption: Keep both, investigate why
   - If mixed: Support both long-term

2. **Graceful deprecation** (if proceeding)
   - Add banner to React Flow builder: "Try new trajectory editor"
   - Move React Flow to /compositions/legacy
   - Remove after 4 weeks if no issues

### Rollback Strategy

**If trajectory editor has critical bugs:**
1. Hide "Edit as Trajectory" and "Create from Trajectory" buttons
2. Users fall back to React Flow builder automatically
3. Fix bugs in trajectory editor offline
4. Re-enable once validated

**If data corruption:**
- Templates created by trajectory editor are standard JSON
- No special migration needed
- Can edit with React Flow if needed

## Open Questions

### 1. Should trajectory editor support branching (conditional activities)?

**Context:** Some executions have conditional logic (if error, do X, else Y).

**Options:**
- A) Defer to v2 - MVP is linear sequences only
- B) Add conditional branches with "if/else" rows
- C) Use goal impulses to represent branching (delegate to vessel)

**Decision needed by:** End of Phase 1 (if users request it)

**Recommendation:** Option A - keep MVP simple, add in v2 if needed.

### 2. How to handle parallel execution visualization?

**Context:** Multiple activities in same column execute in parallel.

**Options:**
- A) Stack vertically in same column (multiple rows)
- B) Show side-by-side with visual indicator (bracket)
- C) Use color coding (same color = parallel group)

**Decision needed by:** Before Phase 1 implementation

**Recommendation:** Option A - stacked rows, simplest to implement and understand.

### 3. Should we support undo/redo?

**Context:** Users may want to revert changes during editing.

**Options:**
- A) Add undo/redo in MVP (Zustand middleware ~20 LOC)
- B) Defer to v2
- C) Rely on browser back button + localStorage

**Decision needed by:** End of Phase 1

**Recommendation:** Option A if time permits, Option B if tight timeline.

### 4. What's the naming convention for trajectories?

**Context:** User creates trajectory, needs to name it on export.

**Options:**
- A) Auto-generate name from goal text ("fix-auth-bug-v1")
- B) Prompt user for name before export
- C) Use "Untitled Trajectory" and let user rename later

**Decision needed by:** Before Phase 3 implementation

**Recommendation:** Option B - prompt on export, pre-fill with generated name, allow editing.

### 5. Should trajectory editor be accessible via URL sharing?

**Context:** User might want to share trajectory URL with teammate.

**Options:**
- A) No URL persistence - trajectories are local only
- B) Save to backend on every change, shareable URL
- C) "Publish" button to save and share

**Decision needed by:** V2 planning

**Recommendation:** Option A for MVP, Option C for v2 (adds complexity).
