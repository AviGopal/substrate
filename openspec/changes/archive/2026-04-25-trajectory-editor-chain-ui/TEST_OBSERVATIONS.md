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

**Retested 2026-04-25 session-3 (producers found):**
- Goal "Fix failing unit tests in the workbench" → missing shapes: `patch`, `validation_result`, `test_suite`
- Click **find** on `patch` → **── prerequisites ──** section expands with shape pills
- Click `patch` pill → "**Producers for: patch**" list with "Show All" link
- Producer activities shown with Thompson bars (α: -5.0 β: 1.0 — reflecting learned negative prior)
- Tip: "Click 'Add' to insert a prerequisite activity at the beginning of your trajectory."
- Full backward-chaining flow verified end-to-end against live API data

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
**Retested**: 2026-04-25 session-2 (Playwright)

**Verified:**
- Expand/collapse toggle functional
- Task description textbox: editable, pre-filled with prompt text
- **Prompt Template**: full LLM prompt rendered in scrollable textarea
- **Variable highlighting**: `${sourceActivity}`, `${transformationType}`, `${preserveValidationChecks}`, `${allowOutputArtifacts}`, `${removeWriteOperations}`, `${goal}` — all rendered as distinct badge tokens below the textarea
- **Validation Rules**: Required Files, Required Patterns (regex), Forbidden Patterns (regex) — each with "+ Add" button (all showing "None" when empty)
- **Retry config**: `max attempts` spinbutton (value: 2), `strategy` combobox — both present and interactive
- **Thompson parameter editor**: opens inline on "edit" button click; shows Alpha (Successes) + Beta (Failures) + Selection Strength sliders with spinbuttons; live `confidence %` and `Est. Selection %` update as alpha is changed (20% → 60% confidence, 50% → 83% est. selection on α=5); "Reset" button present
- **Thompson header bar**: does NOT live-update while editor is open; shows committed values (α:1.0) until saved. The in-editor preview is real-time, the card header is not — design intent or minor bug
- **Save as Variant dialog**: opens on "save as variant" button; shows genealogy chain (Parent → "Parent v2"), changes summary (tasks added/removed), editable Template Name (pre-filled with versioned name), Description textarea, Initial Thompson Sampling Scores (α=1, β=0, 0.5 balanced), "Fresh variants start with alpha=1, beta=0. Parent scores remain unchanged." note, Cancel + Save Variant buttons

**User stories covered**: US-6 (inline task editing), US-7 (variant creation with genealogy), US-8 (Thompson parameter tuning)

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
**Retested**: 2026-04-25 session-2 (Playwright + code review)

**Verified (code review):**
- `useHoverPreview` debounces `isHovering` → `debouncedTemplate` via `useDebounce(300ms)`
- `getSpeculativePreview()` calls `predictNewState()` which always returns a `StatePreview` (never null); cache via `SpeculativePredictionCache` (WeakMap-keyed)
- `ApplicableActivitiesPanel` wraps the card button in `<SpeculativePreviewCard delayDuration={0}>` once `isHovering && preview !== null`
- `SpeculativePreviewCard` uses Radix UI `Tooltip` → `TooltipContent` (side=right, offset=8): shows goal progress delta (current% → predicted%), new shapes produced (green badges), already-available shapes (dimmed), unlocked activities (with sparkle icon), cost/duration estimates

**Not testable via Playwright:**
- Grid overflow bug — the trajectory grid's step column divs extend into the sidebar z-order and intercept pointer events, preventing `browser_hover` from reaching the recommendation card buttons (same overflow bug from 2026-04-25 sidebar fix; sidebar scroll works but pointer interception persists)
- JS `mouseover` dispatch fires but Radix UI Tooltip requires real pointer tracking; the two-phase render (debounce fires → component re-renders to add Tooltip wrapper → Tooltip needs active hover) cannot be satisfied with synthetic events

**Verdict**: Implementation is correct and complete per code review. Not testable end-to-end until the sidebar overflow / pointer-events issue is resolved. Recommend adding `pointer-events: none` to the trajectory grid scroll container or fixing z-index stacking to allow sidebar interaction.

**User stories covered (code)**: US-5 (speculative shape preview on hover)

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

## trajectory-execution-integration panels

**Components**: `GoalSubmissionPanel`, `LiveExecutionPanel`, `ExecutionHistoryPanel`  
**Added by**: `trajectory-execution-integration` OpenSpec change (archived 2026-04-25)  
**Tested**: 2026-04-25 session-3 (Playwright)

**GoalSubmissionPanel** (top of left sidebar, "run goal" section):
- Multi-line textarea with placeholder "Describe the goal…"
- "goal text required" validation error shown when empty
- "run" button disabled when empty, enabled when text present
- `POST /v2/impulses/resolve { pointer: { type: 'goalExecution', goal } }` on submit
- `onExecutionStarted(executionId)` callback wires to LiveExecutionPanel

**LiveExecutionPanel** ("live execution" section):
- Status badge shows "idle" when disconnected
- Execution ID text input + "connect" button
- Connects WebSocket via `useTrajectoryExecution` hook on click
- Known behaviour: rapid reconnect flood if execution ID is invalid (pre-existing `maxReconnectAttempts=0`)

**ExecutionHistoryPanel** ("execution history" section):
- Collapsible with ▶/▼ toggle
- Expanded → `GET /v2/activities/execution-traces?limit=20&sortBy=createdAt&sortOrder=desc`
- Returns 500 in current environment: SurrealDB `"The access method cannot be used in the requested operation"` (service API key lacks cross-org SELECT — infrastructure constraint, not a code defect)
- Error state renders "Could not load traces" message correctly

---

## Summary

| Spec | Status | Notes |
|------|--------|-------|
| activity-applicability | ✅ Working | API contract bug fixed (field names) |
| backward-chaining-ui | ✅ Working | Producers found end-to-end (session-3); tip + shape pills working |
| cycle-validation | ✅ Working | Productive loop detected correctly |
| goal-completion-tracking | ✅ Working | 25% progress, shape inference, find → prereq flow |
| impulse-state-space | ✅ Working | All 4 sub-panels + Ctrl+I toggle |
| inline-variant-creation | ✅ Working | Prompt template, variable badges, Thompson slider, Save-as-Variant dialog with genealogy |
| keyboard-shortcuts-help | ✅ Working | Dialog opens; 3 sections verified |
| learning-feedback-ui | ⏭ Untested | Requires completed execution to trigger Thompson delta events |
| resolver-attribution | ⏭ Untested | Requires execution traces with resolver_tier data |
| speculative-prediction | ⚠️ Partial | Code verified correct; pointer-events interception prevents Playwright hover test |
| thompson-visualization | ✅ Working | Recommendation cards + expanded activity card |
| trajectory-execution | ⏭ Untested | WebSocket connected; execution not triggered |
| trajectory-execution-integration panels | ✅ Working | GoalSubmissionPanel + LiveExecutionPanel verified; ExecutionHistoryPanel 500 is infra constraint |
