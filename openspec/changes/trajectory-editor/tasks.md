## 1. Foundation: Horizontal Grid Layout & State Management (Commit 1)

- [ ] 1.1 Add dependencies to workbench package.json (@dnd-kit/core, zustand, react-diff-viewer-continued)
- [ ] 1.2 Create trajectory store with Zustand (src/stores/trajectoryStore.ts)
- [ ] 1.3 Create TrajectoryEditorPage component with route /trajectories/new
- [ ] 1.4 Implement horizontal CSS Grid layout for activity sequence
- [ ] 1.5 Create ActivityCard component with expand/collapse using react-collapsed
- [ ] 1.6 Implement grid snapping for column/row positioning
- [ ] 1.7 Add localStorage auto-save and restore functionality
- [ ] 1.8 Create basic shape flow visualization (input/output badges on cards)
- [ ] 1.9 Add horizontal scrolling with keyboard navigation
- [ ] 1.10 Write unit tests for trajectory store and grid layout

## 2. Activity Editing: Add, Remove, Reorder (Commit 2)

- [ ] 2.1 Integrate ActivityPalette component (reuse from composition/)
- [ ] 2.2 Implement activity search and filtering in palette
- [ ] 2.3 Add drag-and-drop reordering with @dnd-kit
- [ ] 2.4 Create "+" insert buttons between activities
- [ ] 2.5 Add "×" remove buttons on activity cards with confirmation
- [ ] 2.6 Implement parallel execution (multiple rows in same column)
- [ ] 2.7 Add visual feedback during drag (drop zones, invalid indicators)
- [ ] 2.8 Implement shape validation (green checkmarks, red warnings)
- [ ] 2.9 Create validation error display component
- [ ] 2.10 Add integration tests for activity manipulation

## 3. Goal-to-Trajectory & Thompson Sampling Integration (Commit 3)

- [ ] 3.1 Create trajectory input box component at page header
- [ ] 3.2 Implement goal text parsing and normalization
- [ ] 3.3 Add "Generate Path" button with loading state
- [ ] 3.4 Integrate with POST /goal-paths/recommend endpoint
- [ ] 3.5 Display multiple path recommendations with confidence scores
- [ ] 3.6 Create path selection UI (choose from alternatives)
- [ ] 3.7 Implement goal endpoint prediction (check if shapes match goal)
- [ ] 3.8 Add "Suggest Next Activity" button for incremental building
- [ ] 3.9 Create "No recommendations" fallback with manual search
- [ ] 3.10 Add backend endpoint POST /v2/activities/discover-by-shapes (activity-api)
- [ ] 3.11 Write integration tests for goal-to-trajectory flow

## 4. Inline Task Editing & Variant Creation (Commit 4)

- [ ] 4.1 Create expandable task editor component within ActivityCard
- [ ] 4.2 Implement task prompt editing with textarea and syntax highlighting
- [ ] 4.3 Add variable validation (highlight ${variables}, check availability)
- [ ] 4.4 Create validation rules editor (required files, patterns, forbiddens)
- [ ] 4.5 Implement retry configuration UI (max attempts, strategy selector)
- [ ] 4.6 Add task reordering within activity via drag-and-drop
- [ ] 4.7 Create "Add Task" and "Remove Task" controls
- [ ] 4.8 Implement auto-save on blur for all inline edits
- [ ] 4.9 Create Thompson Sampling score adjustment UI (alpha/beta sliders)
- [ ] 4.10 Add selection strength slider (exploration vs exploitation)
- [ ] 4.11 Implement "Save as Variant" export with genealogy tracking
- [ ] 4.12 Create variant name generation and metadata dialog
- [ ] 4.13 Wire up POST /v2/activities/templates endpoint for export
- [ ] 4.14 Add unit tests for inline editing and variant creation

## 5. Trace Diff Viewer & Integration (Commit 5)

- [ ] 5.1 Create /trajectories/:traceId/edit route
- [ ] 5.2 Implement trace loading from GET /v2/activities/execution-traces/:id
- [ ] 5.3 Create side-by-side diff viewer component using react-diff-viewer-continued
- [ ] 5.4 Implement LCS algorithm for activity sequence alignment
- [ ] 5.5 Add difference highlighting (green=added, red=removed, yellow=modified)
- [ ] 5.6 Create failed task highlighting with error details tooltip
- [ ] 5.7 Implement "Accept" and "Reject" controls for individual changes
- [ ] 5.8 Add "Accept All Changes" bulk operation
- [ ] 5.9 Calculate and display projected cost/duration impact
- [ ] 5.10 Show Thompson Sampling confidence impact preview
- [ ] 5.11 Add "Edit as Trajectory" button to ExecutionDetails page
- [ ] 5.12 Add "Create from Trajectory" button to TemplatesPage header
- [ ] 5.13 Implement trace → variant export flow
- [ ] 5.14 Add synchronized scrolling between trace and template columns
- [ ] 5.15 Create E2E tests for trace diff and variant creation from failed execution
- [ ] 5.16 Write documentation for trajectory editor usage
