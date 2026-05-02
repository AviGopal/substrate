## ADDED Requirements

### Requirement: BackwardChainingPanel SHALL surface a Spawn sub-goal affordance when no in-scope producer exists
`BackwardChainingPanel` (at `repos/workbench/src/components/trajectory/BackwardChainingPanel.tsx`) SHALL render a "Spawn sub-goal" button beside each missing-shape row when one of these conditions is met: (a) `discoveryData.activities.length === 0`, OR (b) every returned producer has `confidence < 0.4`. The button SHALL NOT appear when at least one in-scope producer with `confidence >= 0.4` is available.

#### Scenario: No producers returned shows button
- **WHEN** the panel renders for missing shape `sourceCode` and `usePrerequisiteDiscovery` returns `{ activities: [] }`
- **THEN** a "Spawn sub-goal" button is visible in the row for `sourceCode`

#### Scenario: Only low-confidence producers shows button
- **WHEN** the panel renders for missing shape `sourceCode` and the returned producers all have Thompson Sampling `confidence < 0.4`
- **THEN** a "Spawn sub-goal" button is visible alongside the low-confidence producer list

#### Scenario: At least one high-confidence producer hides button
- **WHEN** the panel renders for missing shape `sourceCode` and at least one producer has `confidence >= 0.4`
- **THEN** the "Spawn sub-goal" button is NOT rendered (the existing add-prerequisite affordance is sufficient)

### Requirement: Clicking Spawn sub-goal SHALL dispatch create-shape-provider-goal via useSpawnSubgoal
A new hook `useSpawnSubgoal` (at `repos/workbench/src/hooks/useSpawnSubgoal.ts`) SHALL provide a TanStack Query mutation that POSTs to the activity dispatch endpoint with `template_id: "create-shape-provider-goal"` and the slot-derived inputs: `target_shape`, `parent_goal_text` (from the active trajectory's goal), `available_shapes` (current accumulated impulse shapes), `parent_execution_id` (when running inside a live execution), `parent_depth` (read from the trajectory editor's recursion-depth state, default 0), and `remaining_budget_usd` (when known).

#### Scenario: Mutation fires with correct payload
- **WHEN** the user clicks the Spawn sub-goal button on a row for shape `markdown_document` in a trajectory whose goal text is "summarize logs" and whose accumulated shapes are `['log_lines', 'time_range']`
- **THEN** the mutation POSTs `{ template_id: "create-shape-provider-goal", inputs: { target_shape: "markdown_document", parent_goal_text: "summarize logs", available_shapes: ["log_lines", "time_range"], ... } }`

#### Scenario: Mutation surface area
- **WHEN** consumers import `useSpawnSubgoal`
- **THEN** the hook returns `{ mutate, mutateAsync, data, isPending, error }` from TanStack Query (consistent with sibling hooks in `repos/workbench/src/hooks/`)

### Requirement: SpawnSubgoalPreview SHALL render the emitted goal impulse before confirm-dispatch
A new component `SpawnSubgoalPreview` (at `repos/workbench/src/components/trajectory/SpawnSubgoalPreview.tsx`) SHALL render the goal-shaped output impulse returned by `create-shape-provider-goal` before the user confirms downstream dispatch. The preview SHALL display: composed goal text, `endpoint_output_shapes` as a chip list, `depth`, a summary of which signals (1-5) contributed (counts of producers, prior paths, related concepts, co-occurrence rankings, cost outliers), and a prominent banner when `human_in_the_loop_required: true`. The preview SHALL include a Confirm Dispatch button and a Cancel button.

#### Scenario: Preview renders all body fields
- **WHEN** `useSpawnSubgoal` resolves with a goal impulse `{ text: "...", endpoint_output_shapes: ["markdown_document"], depth: 1, human_in_the_loop_required: false, ... }`
- **THEN** the preview shows the text, a chip for `markdown_document`, the depth indicator `depth: 1`, and no warning banner

#### Scenario: Human-in-the-loop banner appears
- **WHEN** the resolved goal has `human_in_the_loop_required: true`
- **THEN** a banner is shown above the Confirm Dispatch button stating that the system flagged this sub-goal for human review

#### Scenario: Cancel discards the goal
- **WHEN** the user clicks Cancel
- **THEN** the preview closes and no downstream dispatch occurs; the spawned goal impulse is retained as a trace artifact (the preview does not delete it) but is not auto-executed

### Requirement: Confirm Dispatch SHALL propagate the sub-goal id to the parent trajectory
When the user clicks Confirm Dispatch in `SpawnSubgoalPreview`, the parent trajectory editor SHALL receive a callback with the new sub-goal's id and the slot context. The slot in the trajectory grid SHALL transition to an "awaiting sub-goal completion" visual state until the sub-goal's terminal output of `target_shape` becomes available in the impulse pool.

#### Scenario: Slot transitions to awaiting state
- **WHEN** Confirm Dispatch is clicked
- **THEN** the missing-shape slot in the trajectory grid renders with the awaiting-completion visual treatment (icon + tooltip indicating the sub-goal id and target shape)

#### Scenario: Slot resolves when sub-goal output appears
- **WHEN** the dispatched sub-goal completes and an impulse of shape `target_shape` is added to the pool
- **THEN** the slot transitions out of the awaiting state and the binding cascade re-runs (rung 1 succeeds with the newly-available impulse)

### Requirement: The Spawn sub-goal affordance SHALL be visually distinct from direct-add prerequisites
The Spawn sub-goal button SHALL render with a visual treatment that distinguishes it from the existing add-prerequisite button in `BackwardChainingPanel` (different icon, distinct label, or a small tag indicating "recursive"). This is to prevent users from confusing direct prerequisite addition with recursive sub-goal escalation.

#### Scenario: Distinct icon or label
- **WHEN** both buttons appear in the panel for the same row (e.g., the panel displays a low-confidence producer alongside the spawn affordance)
- **THEN** the two buttons have visibly different icons or labels; a tag, badge, or distinct color indicates the recursive nature of the spawn affordance
