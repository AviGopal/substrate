## 1. Backend Infrastructure

- [x] 1.1 Implement WebSocket route in activity-api `src/index.ts` (mount `/ws` endpoint with upgrade handshake) ✅
- [x] 1.2 Create `POST /v2/activities/discover-by-shapes` endpoint for bidirectional discovery ✅
- [x] 1.3 Enhance `/v2/goal-paths/recommend` to return confidence intervals and endpoint predictions ✅
- [x] 1.4 Add state transition tracking to composition graph queries ✅
- [x] 1.5 Test WebSocket reconnection with catchup protocol (simulate network failures) ✅

**Implementation Complete:** See `PHASE1_IMPLEMENTATION.md` for details.

## 2. State Space Computation (Frontend Core)

- [x] 2.1 Add `computeAvailableShapes()` function to trajectory store (memoized with useMemo) ✅
- [x] 2.2 Implement `ImpulseStateSpace` type with timeline tracking ✅
- [x] 2.3 Create `getApplicableActivities()` function filtering by shape compatibility ✅
- [x] 2.4 Add `predictNewState()` function for speculative computation ✅
- [x] 2.5 Implement speculative prediction cache using WeakMap ✅

**Implementation Complete:** See `repos/workbench/src/lib/state-space.ts` and `repos/workbench/src/stores/trajectoryStore.ts`

## 3. Impulse State Panel Components

- [x] 3.1 Create `ImpulseStatePanel` component (right sidebar, collapsible) ✅
- [x] 3.2 Implement `AccumulatedShapesView` showing current shapes with badges ✅
- [x] 3.3 Add `ShapeProvenanceTree` displaying which activity produced each shape ✅
- [x] 3.4 Create `GoalProgressIndicator` with percentage and missing shapes ✅
- [x] 3.5 Implement `StateTimelineView` showing shape evolution per column ✅

**Implementation Complete:** See `repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx` and related components. Panel integrated into TrajectoryEditorPage with Ctrl+I toggle.

## 4. Activity Applicability Panel

- [x] 4.1 Create `ApplicableActivitiesPanel` component replacing path suggestions ✅
- [x] 4.2 Implement `ActivityFilterService` with three sections: Applicable, Blocked, Newly Unlocked ✅
- [x] 4.3 Add `ThompsonScoreCard` displaying alpha/beta and confidence intervals ✅
- [x] 4.4 Create `ShapeCompatibilityIndicator` showing input shape matches ✅
- [ ] 4.5 Implement drag-to-add from applicable activities list (click-to-add works; drag deferred)

**Implementation Complete:** See `repos/workbench/src/components/trajectory/ApplicableActivitiesPanel.tsx` and `docs/PHASE_4_ACTIVITY_APPLICABILITY.md`. Three-section filtering with Thompson Sampling visualization working.

## 5. Speculative Prediction UI

- [x] 5.1 Create `SpeculativePreviewCard` component (shown on hover)
- [x] 5.2 Implement hover detection with 300ms debounce
- [x] 5.3 Add predicted state changes visualization (new shapes highlighted)
- [x] 5.4 Show unlocked activities in preview
- [x] 5.5 Display goal progress delta (current % → predicted %)
- [x] 5.6 Add cost/duration estimates from historical metrics

## 6. Thompson Sampling Visualization

- [x] 6.1 Create `useThompsonScores` hook fetching variant scores via useQueries ✅
- [x] 6.2 Implement `ConfidenceInterval` component with horizontal bar + shaded region ✅
- [x] 6.3 Add Thompson parameters display to activity cards (α, β, success rate) ✅
- [x] 6.4 Create `VariantComparisonPanel` showing competition between variants ✅
- [x] 6.5 Implement shape-conditioned scores display (success rate by input context) ✅

**Implementation Complete:** See `repos/workbench/PHASE_6_IMPLEMENTATION.md` and `docs/THOMPSON_SAMPLING_VISUALIZATION.md`. Math utilities with 29 passing tests, parallel variant score fetching, full visualization suite.

## 7. Real-Time Execution Integration

- [x] 7.1 Update `TrajectoryEditorPage` to accept `executionId` prop
- [x] 7.2 Integrate `useWebSocket` hook with execution ID
- [x] 7.3 Create `LiveExecutionOverlay` component layered over trajectory grid
- [x] 7.4 Implement task progress bars with current task highlighting
- [x] 7.5 Add pulse animation for active activity card
- [x] 7.6 Update impulse state panel to show realized vs speculative impulses
- [x] 7.7 Handle `task.started`, `task.completed`, `impulse.resolved` WebSocket events

## 8. Learning Feedback Panel

- [x] 8.1 Create `LearningFeedbackPanel` component (shown post-execution) ✅
- [x] 8.2 Fetch learning impact data from `/v2/executions/:id/learning-impact` ✅
- [x] 8.3 Display Thompson parameter deltas (α before → after) ✅
- [x] 8.4 Show variant creation notifications with "View" button ✅
- [x] 8.5 Display composition edge updates (success rate changes) ✅
- [x] 8.6 Add collapsible sections for each learning signal type ✅

## 9. Resolver Attribution Display

- [x] 9.1 Create `ResolverTierBadge` component with color coding (green/yellow/purple) ✅
- [x] 9.2 Add resolver tier to task cards when expanded (via ImpulseStatePanel integration) ✅
- [x] 9.3 Implement `CostBreakdownPanel` showing cost by tier (deterministic/pattern/LLM) ✅
- [x] 9.4 Display resolver latency and vessel attribution per impulse resolution ✅
- [x] 9.5 Add resolver performance metrics to execution summary (CostBreakdownPanel in ImpulseStatePanel) ✅

## 10. Goal Completion Tracking

- [x] 10.1 Implement `inferExpectedShapes()` function using keyword extraction ✅
- [x] 10.2 Create `GoalCompletionBar` component with progress visualization ✅
- [x] 10.3 Add missing shapes indicator (⊗ icon for missing, ✓ for present) ✅
- [x] 10.4 Display "N of M shapes complete" text ✅
- [x] 10.5 Allow users to manually edit expected shapes ✅

**Implementation Complete:** See `repos/workbench/CHANGELOG_PHASES_10_11.md` and `docs/GOAL_COMPLETION_TRACKING.md`. Keyword-based shape inference, visual progress tracking, manual shape editing all working.

## 11. Backward Chaining UI

- [x] 11.1 Create `BackwardChainingPanel` component ✅
- [x] 11.2 Implement `queryPrerequisites()` function calling discover-by-shapes endpoint ✅
- [x] 11.3 Display dependency tree visualization showing prerequisite chain ✅
- [x] 11.4 Add "Find Producer" button on missing shape indicators ✅
- [x] 11.5 Implement "Add Prerequisite" action inserting activity before current ✅

**Implementation Complete:** See `repos/workbench/docs/BACKWARD_CHAINING_UI.md` and `docs/PHASES_10_11_ARCHITECTURE.md`. React Query integration, dependency tree visualization, prerequisite insertion all working.

## 12. Cycle Detection

- [x] 12.1 Implement `detectCycles()` function using DFS algorithm
- [x] 12.2 Create `CycleIndicator` component with warning badge
- [x] 12.3 Add `validateLoopProductivity()` function checking for new shapes
- [x] 12.4 Display productive vs infinite loop distinction
- [x] 12.5 Add execution blocker for infinite loops with override option

## 13. Inline Variant Creation

- [x] 13.1 Add edit mode to `ActivityCard` component
- [x] 13.2 Create `TaskPromptEditor` with syntax highlighting for variables
- [x] 13.3 Implement `ValidationRulesEditor` for required files/patterns
- [x] 13.4 Add "Save as Variant" button creating new variant with genealogy
- [x] 13.5 Show variant comparison after creation with Thompson parameters

## 14. Store Enhancements

- [x] 14.1 Add `impulseStateSpace` field to trajectory store
- [x] 14.2 Implement `executionState` tracking for live execution
- [x] 14.3 Add `learningFeedback` field for post-execution data
- [x] 14.4 Create `speculativeCache` with WeakMap for predictions
- [x] 14.5 Implement `computeStateAtColumn()` helper function
- [x] 14.6 Add localStorage schema versioning (trajectory_v2 with v1 fallback)

## 15. Integration & Polish

- [x] 15.1 Update `TrajectoryEditorPage` layout to include new panels ✅ (all panels wired; confirmed in Playwright testing 2026-04-24)
- [ ] 15.2 Implement responsive breakpoints (collapse panels on small screens)
- [x] 15.3 Add keyboard shortcuts (toggle panels, add activity, execute) ✅ (Ctrl+I toggles ImpulseStatePanel; confirmed working in Playwright testing)
- [ ] 15.4 Implement feature flags for each major capability
- [x] 15.5 Add loading states and error boundaries ✅ (Loader2 spinners and Alert error states in all major panels)
- [ ] 15.6 Create tooltip help text for all new UI elements

## 16. Testing

- [ ] 16.1 Unit tests for state space computation functions
- [ ] 16.2 Unit tests for cycle detection algorithm
- [ ] 16.3 Unit tests for speculative prediction with cache
- [ ] 16.4 Integration tests for WebSocket reconnection
- [ ] 16.5 E2E test: Create trajectory → Execute → View learning feedback
- [ ] 16.6 E2E test: Speculative exploration → Add activity → Verify state update
- [ ] 16.7 Performance test with 50+ activity trajectory
- [ ] 16.8 Accessibility audit (keyboard nav, screen readers)

## 17. Documentation

- [ ] 17.1 Update `INDEX.md` with new capabilities overview
- [ ] 17.2 Create user guide for trajectory editor workflow
- [ ] 17.3 Document keyboard shortcuts in help overlay
- [ ] 17.4 Add inline code comments for complex state computations
- [ ] 17.5 Create example trajectories demonstrating each feature
