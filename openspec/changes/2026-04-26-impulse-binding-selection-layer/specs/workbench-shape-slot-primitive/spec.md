## ADDED Requirements

### Requirement: Slot states are bound, bindable, or unbindable
Each task-input slot in the trajectory editor SHALL render in exactly one of three states: `bound` (an impulse with the required shape exists in the column's pool with a lineage edge to a prior task), `bindable` (an impulse with the shape exists without lineage, or `discover-by-shapes` returns a non-empty producer list), or `unbindable` (no candidate impulse and no producer in scope). State computation SHALL live in the trajectory store; rendering primitives SHALL consume the computed state via props.

#### Scenario: Slot with lineage match renders bound
- **WHEN** a task declares `inputShapes: ["errorLog"]` and a prior task produced an impulse with `shape: "errorLog"` linked by lineage to the current column
- **THEN** the slot renders in the `bound` state

#### Scenario: Slot with candidate but no lineage renders bindable
- **WHEN** an impulse with the required shape exists in the pool without a lineage edge
- **THEN** the slot renders in the `bindable` state

#### Scenario: Slot with no candidate but available producer renders bindable
- **WHEN** the pool contains no impulse with the required shape but `discover-by-shapes` returns at least one producer for that shape
- **THEN** the slot renders in the `bindable` state

#### Scenario: Slot with no candidate and no producer renders unbindable
- **WHEN** the pool contains no impulse with the required shape and `discover-by-shapes` returns no producer
- **THEN** the slot renders in the `unbindable` state

### Requirement: ResolverTierBadge accepts a slotState prop
`repos/workbench/src/components/trajectory/ResolverTierBadge.tsx` SHALL accept an optional `slotState?: "bound" | "bindable" | "unbindable"` prop. When the prop is set, the badge SHALL display a colour band corresponding to the state: green for `bound`, gradient for `bindable`, red for `unbindable`. When the prop is absent, the badge SHALL render unchanged.

#### Scenario: bound state renders green band
- **WHEN** the badge is rendered with `slotState: "bound"`
- **THEN** the badge includes a green band styling

#### Scenario: prop absent preserves existing behaviour
- **WHEN** the badge is rendered without `slotState`
- **THEN** rendering output matches the pre-change snapshot

### Requirement: ShapeCompatibilityIndicator differentiates bound and bindable
`repos/workbench/src/components/trajectory/ShapeCompatibilityIndicator.tsx` SHALL differentiate `bound` (solid green, lineage match) from `bindable` (gradient or dashed green, candidates without lineage). The existing red treatment for incompatible shapes SHALL remain.

#### Scenario: Lineage-match slot renders solid green
- **WHEN** the indicator is rendered for a `bound` slot
- **THEN** the visual treatment is solid green

#### Scenario: Candidate-only slot renders gradient/dashed green
- **WHEN** the indicator is rendered for a `bindable` slot
- **THEN** the visual treatment is gradient or dashed green and is visually distinct from the `bound` treatment

### Requirement: ImpulseStatePanel surfaces candidates for bindable slots
`repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx` SHALL render an inline "candidates" expansion when the user clicks a `bindable` slot. The expansion SHALL list candidate impulses with their `impulseRelevance` α and β and a "use this one" button per row. Clicking the button SHALL invoke `impulseRelevance_write` to bias future selections toward the chosen candidate.

#### Scenario: Click bindable slot expands candidate list
- **WHEN** the user clicks a slot rendered in the `bindable` state
- **THEN** the panel renders a list of candidate impulses with α/β values

#### Scenario: Use this one writes impulseRelevance
- **WHEN** the user clicks "use this one" on a candidate
- **THEN** the workbench dispatches an `impulseRelevance_write` request for that `(impulse_id, taskId, shape)` triple with a positive α delta

#### Scenario: bound slots do not expand
- **WHEN** the user clicks a `bound` slot
- **THEN** the panel does NOT show a candidate expansion (the binding is already determined)

### Requirement: ApplicableActivitiesPanel surfaces escalation for unbindable slots
`repos/workbench/src/components/trajectory/ApplicableActivitiesPanel.tsx` SHALL display an "escalate to goal-creation" button when the selected slot is in the `unbindable` state. The button's click handler SHALL invoke the entry point of the sibling `shape-provider-goal-creation` capability. This spec defines only the placement and visibility of the button; the click target's behaviour is owned by the sibling spec.

#### Scenario: Escalate button visible for unbindable slot
- **WHEN** the user selects a slot in the `unbindable` state
- **THEN** the panel shows an "escalate to goal-creation" button

#### Scenario: Escalate button hidden for bound and bindable slots
- **WHEN** the user selects a slot in the `bound` or `bindable` state
- **THEN** the panel does NOT show the escalate button

### Requirement: Manual override persists as training signal
When the user manually selects a candidate via the `bindable` candidate expansion, the override SHALL be persisted via `impulseRelevance_write` so that subsequent runs of `impulse_pool_selection` for the same `(shape, taskId)` see the boosted score. The override SHALL NOT be local-only state.

#### Scenario: Override survives page reload
- **WHEN** the user selects candidate C for slot S, then reloads the page
- **THEN** on the next render, `impulseRelevance` for C reflects the boosted α and `impulse_pool_selection` is more likely to choose C
