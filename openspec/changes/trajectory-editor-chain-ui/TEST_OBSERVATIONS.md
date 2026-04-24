# Test Observations — trajectory-editor-chain-ui

Tested 2026-04-24 against canary backend (`https://activity.metabob.com`) using Playwright.  
Workbench running at `http://localhost:5173/trajectory-editor`.  
Test trajectory: goal = "Write tests and fix authentication bugs, then generate a markdown report",  
1 activity ("LLM Code Review Script Generator") at column 0.

---

## activity-applicability

**Component**: `ApplicableActivitiesPanel` + `useApplicableActivities` hook  
**Endpoint**: `POST /v2/activities/recommend`

**Verified:**
- Toggle button "Show Applicable Activities" / "Hide Activities" works
- "Now Applicable (20)" section rendered with activities from the recommend endpoint
- Each recommendation shows `ThompsonScoreCard` with 95% CI, α/β values
- `ShapeCompatibilityIndicator` renders per card
- API call sends `task_description`, `impulse_shapes`, `expected_output_shapes`, `limit`

**Not verified (data-limited):**
- "Newly Unlocked" section — no shape-gated activities unlocked mid-session
- "Not Yet Applicable" (blocked) section — all 20 returned had empty `input_shapes`

**Bug fixed during testing:**  
Hook was sending `available_shapes`/`top_k`/`exclude_templates` and missing the required `task_description`. Fixed to use correct field names: `impulse_shapes`, `limit`, `exclude_activities`, `task_description`.

---

## backward-chaining-ui

**Component**: `BackwardChainingPanel` + `DependencyTree` + `usePrerequisiteDiscovery` hook  
**Endpoint**: `POST /v2/activities/discover-by-shapes` (mode: `forward`)

**Verified:**
- Panel renders with shape selection buttons for each missing shape
- Selecting a shape filters the query
- "No prerequisite activities found" correctly shown when no templates produce those shapes
- "Find" buttons on GoalCompletionBar correctly populate the BackwardChainingPanel

**Limitation:**
- No templates in canary backend have `patch`, `validation_result`, or `test_suite` in `output_shapes`, so the "producers found" scenario was not observable. The endpoint itself works (HTTP 200 with empty results) — confirmed by previous 500-fix session.

---

## cycle-validation

**Component**: `CycleIndicator`  
**Logic**: `state-space.ts` detectCycles + productivity analysis

**Verified:**
- "Productive loop detected" banner displayed with amber `Loop` badge
- Message: "A repeating pattern was found in columns 0–0. Each iteration produces new shapes, so this loop is considered productive and will not block execution."
- Productive loop (adds new shapes) correctly NOT blocking execution
- Component renders inline in the trajectory grid above the activity columns

**Not verified:**
- Infinite loop (no new shapes) warning — would require constructing a specific trajectory

---

## goal-completion-tracking

**Component**: `GoalCompletionBar` + `useAvailableShapes` + `goal-inference.ts`

**Verified:**
- Goal text "Write tests and fix authentication bugs, then generate a markdown report" inferred expected shapes: `patch`, `validation_result`, `test_suite` + `analysis` (from "fix" + "test" keywords)
- Progress bar at 25% (1 of 4 shapes complete)
- "Present (1): analysis ✓" — green checkmark on satisfied shape
- "Missing (3): patch ⊗, validation_result ⊗, test_suite ⊗" — each with "Find" button
- "Edit Expected Shapes" button present
- "Goal Not Reached" banner in trajectory grid with missing shapes listed
- "Current Output Shapes" banner: `analysis`, `tool_output`

---

## impulse-state-space

**Component**: `ImpulseStatePanel` (right panel) + `ShapeProvenanceTree` + `StateTimelineView`  
**Hook**: `useAvailableShapes`

**Verified:**
- Right panel "Impulse State" shown with chevron collapse button
- **Goal Completion**: 25% progress bar, "1 of 4 shapes complete"
- **Available/Missing** badges: `✓ analysis` (available), `⊗ patch`, `⊗ validation_result`, `⊗ test_suite` (missing)
- **Current Shapes**: `goal`, `directoryTree`, `analysis`, `tool_output` (4 shape badges)
- **Shape Provenance**:
  - "Initial Context (Column 0)" → `goal`, `directoryTree`
  - "LLM Code Review Script Generator (Col 0)" → `analysis`, `tool_output`
- **Shape Timeline**: "Column 0 (current)" — Added 2: `analysis`, `tool_output`, Total: 4 shapes
- **Ctrl+I keyboard shortcut**: collapses panel to vertical label, restoring horizontal space; second Ctrl+I expands again

---

## inline-variant-creation

**Component**: `TaskPromptEditor` inside expanded `ActivityCard`

**Verified (visual):**
- "Expand" button present on activity card
- Activity card shows task count (1 tasks), α/β parameters (α:2.0 β:1.0), success rate (100%)
- Expand/collapse toggle functional

**Not fully verified:**
- Full inline task editing with prompt editing, validation rules, variant save
- These UI elements are present but editing workflow not exercised in this test session

---

## learning-feedback-ui

**Component**: `LearningFeedbackPanel`

**Not verified:**
- Requires a completed execution to trigger Thompson parameter updates
- Component exists but no execution was run in this test session

---

## resolver-attribution

**Component**: `ResolverTierBadge`

**Not verified:**
- Requires active execution traces with resolver_tier data
- Component exists in codebase

---

## speculative-prediction

**Component**: `SpeculativePreviewCard` + `useHoverPreview` hook

**Verified (structural):**
- `SpeculativePreviewCard` wraps `ActivityRecommendationCard` in `ApplicableActivitiesPanel`
- Hover detection with 300ms debounce implemented via `useHoverPreview`

**Not verified:**
- Actual hover-triggered preview display — preview would require cached speculative computation
- The `preview` state from `useHoverPreview` was null in quick testing

---

## thompson-visualization

**Component**: `ThompsonScoreCard` + `ConfidenceInterval`

**Verified:**
- Activity card inline shows `α:2.0 β:1.0 100%` for "LLM Code Review Script Generator"
- `ThompsonScoreCard` in `ApplicableActivitiesPanel` shows "Thompson Sampling" header, 95% CI bar, `α: 3.0 → β: 1.0` format
- Confidence interval visualization (progress-style bar)
- Score pulls from `selection_metadata.alpha` / `selection_metadata.beta` from recommend endpoint

---

## trajectory-execution

**Component**: `LiveExecutionOverlay` + `useTrajectoryExecution` hook  
**Protocol**: WebSocket `wss://activity.metabob.com/ws`

**Not verified:**
- Requires triggering an actual execution
- WebSocket connection itself confirmed working (status bar shows "API Connected", "Last update: 04:44:37 PM")

---

## goal-path generation (GoalInputBox)

**Component**: `GoalInputBox`  
**Endpoint**: `POST /v2/goal-paths/recommend`

**Verified:**
- "Generate Path" button disabled when goal is empty, enabled when text entered
- API call fires on click
- Returns "No recommendations available for this goal" when backend has no matching paths — correct empty-state handling

---

## Summary

| Spec | Status | Notes |
|------|--------|-------|
| activity-applicability | ✅ Working | API contract bug fixed (field names) |
| backward-chaining-ui | ✅ Working | No test data produces target shapes |
| cycle-validation | ✅ Working | Productive loop detected correctly |
| goal-completion-tracking | ✅ Working | 25% progress, shape inference working |
| impulse-state-space | ✅ Working | All 4 sub-panels + Ctrl+I shortcut |
| inline-variant-creation | ⚠️ Partial | Card expand/collapse visible; editing not tested |
| learning-feedback-ui | ⏭ Untested | Requires execution |
| resolver-attribution | ⏭ Untested | Requires execution |
| speculative-prediction | ⚠️ Partial | Hook wired; preview render not triggered |
| thompson-visualization | ✅ Working | Both on card and in recommendation panel |
| trajectory-execution | ⏭ Untested | WebSocket connected; execution not triggered |
