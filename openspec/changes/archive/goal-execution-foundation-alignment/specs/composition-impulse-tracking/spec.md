## ADDED Requirements

### Requirement: Track impulse flow in composition graph

The system SHALL track which impulses flow between parent and child activities in the composition graph, enabling pattern learning based on impulse presence.

#### Scenario: Record input impulse shapes
- **WHEN** recording a composition edge (parent calls child)
- **THEN** the system SHALL include `inputImpulseShapes: string[]` containing shapes of impulses loaded by the child activity

#### Scenario: Record output impulse shapes
- **WHEN** recording a composition edge
- **THEN** the system SHALL include `outputImpulseShapes: string[]` containing shapes of impulses created by the child activity

#### Scenario: Record impulse IDs for detailed tracking
- **WHEN** recording a composition edge
- **THEN** the system SHALL include `inputImpulseIds: string[]` and `outputImpulseIds: string[]`
- **AND** these SHALL be stored in `composition_impulse_flow` table for detailed analysis

### Requirement: Enhanced MCP recordComposition payload

The MCP client SHALL support extended composition recording with impulse flow data.

#### Scenario: Extended composition fields
- **WHEN** calling `recordComposition`
- **THEN** the client SHALL accept:
  - `inputImpulseIds?: string[]`
  - `inputImpulseShapes?: string[]`
  - `outputImpulseIds?: string[]`
  - `outputImpulseShapes?: string[]`
  - `durationMs?: number`
  - `costUsd?: number`
  - `tokensInput?: number`
  - `tokensOutput?: number`
  - `depth?: number`
  - `compositionChain?: string[]`

#### Scenario: Extract impulse data from execution result
- **WHEN** an activity completes and composition is recorded
- **THEN** the system SHALL extract impulse data from:
  - `result.impulses[]` for input impulses
  - `result.executionTrace.impulsesCreated[]` for output impulses
  - `result.metrics` for timing and cost data

### Requirement: Composition impulse flow table

The backend SHALL maintain a `composition_impulse_flow` table for per-impulse composition tracking.

#### Scenario: Per-impulse tracking records
- **WHEN** a composition edge with impulse data is recorded
- **THEN** the backend SHALL create records in `composition_impulse_flow` with:
  - `edge_id`: reference to composition graph record
  - `execution_id`: execution identifier
  - `impulse_id`: the specific impulse
  - `direction`: `'input'` or `'output'`
  - `shape`: the impulse shape
  - `execution_succeeded`: whether the composition succeeded

#### Scenario: Enable impulse-conditioned success queries
- **WHEN** sufficient composition data is collected
- **THEN** the system SHALL support queries like:
  - "Success rate when parent X calls child Y with shape Z loaded"
  - "Which input shapes correlate with composition success?"
  - "Which output shapes indicate successful completion?"

### Requirement: Impulse evolution in composition

The system SHALL track impulse evolution (created/modified/deleted) through composition edges.

#### Scenario: Track impulse evolution
- **WHEN** recording a composition edge
- **THEN** the system MAY include `impulseEvolution`:
  - `created: string[]` - impulses created during child execution
  - `modified: string[]` - impulses modified during child execution
  - `deleted: string[]` - impulses deleted during child execution

#### Scenario: Learn transformation patterns
- **WHEN** sufficient evolution data is collected
- **THEN** the system SHALL be able to identify patterns like:
  - "Activity X typically creates [patch, test_result] impulses"
  - "Activity Y consumes [error_log] and produces [fix_recommendation]"
