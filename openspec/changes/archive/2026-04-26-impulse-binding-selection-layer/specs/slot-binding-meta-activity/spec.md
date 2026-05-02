## ADDED Requirements

### Requirement: slot-binding embedded template subscribes to lifecycle:task:preBinding
A new embedded template `slot-binding.json` SHALL be added to `repos/minibob/src/embedded-templates/` and registered via `repos/minibob/src/embedded-templates/index.ts`. The template SHALL declare `subscription: { shape: "lifecycle:task:preBinding" }` so the executor's lifecycle pipeline picks it up automatically.

#### Scenario: Template loads at startup
- **WHEN** MiniBob initialises and loads embedded templates
- **THEN** `slot-binding` is present in the template registry with `subscription.shape === "lifecycle:task:preBinding"`

#### Scenario: Template fires on lifecycle emission
- **WHEN** the executor emits `lifecycle:task:preBinding` and the lifecycle subscription pipeline matches
- **THEN** `slot-binding` runs as a nested execution before the parent's `canExecuteTask` gate

### Requirement: slot-binding chains impulse_preparation, selection, and fallback
The `slot-binding` template SHALL declare three tasks chained in order:

1. `prepare_pool` — `resolver: "impulse_preparation"`, `config: { operation: "synthesise_from_variables" }`
2. `select_or_produce` — for each remaining missing shape, dispatches `impulse_pool_selection` (when candidates exist for that shape) or `producer_selection` (when none do). Producer-selection results with `unbindable: true` emit a `shape:unbindable` impulse
3. `agent_fill_fallback` — `resolver: "impulse_preparation"`, `config: { operation: "agent_fill" }`. Runs only when `select_or_produce` left at least one shape unbound and producer-selection returned no producer

#### Scenario: All shapes bind via variable synthesis
- **WHEN** `prepare_pool` covers all missing shapes
- **THEN** `select_or_produce` runs only `impulse_pool_selection` for shapes that already have candidates and `agent_fill_fallback` is skipped

#### Scenario: Missing shape with no producer falls through to agent_fill
- **WHEN** `prepare_pool` does not cover shape S, `producer_selection` for S returns `unbindable: true`, and no other producer succeeds
- **THEN** `agent_fill_fallback` runs for S

#### Scenario: shape:unbindable emitted for unbindable shape
- **WHEN** `producer_selection` returns `unbindable: true` for shape S
- **THEN** `slot-binding` emits an impulse with shape `shape:unbindable` carrying `{ shape: S, taskId, templateId }` payload

### Requirement: slot-binding outputs are merged via the existing lifecycle pipeline
Output impulses produced by `slot-binding` tasks SHALL be returned through the standard nested-execution output path. The lifecycle pipeline is responsible for merging them into the parent task's pool. `slot-binding` SHALL NOT directly mutate the parent executor's impulse store.

#### Scenario: Supplemental impulse appears in parent pool
- **WHEN** `slot-binding` produces a supplemental impulse during `prepare_pool`
- **THEN** the parent task's impulse pool contains that impulse before `canExecuteTask` runs

### Requirement: slot-binding does not run for tasks without inputShapes
Because the executor only emits `lifecycle:task:preBinding` when `inputShapes` is non-empty, `slot-binding` SHALL NOT fire for tasks with no declared shapes. This invariant SHALL hold without `slot-binding` itself filtering on the payload.

#### Scenario: Task without inputShapes
- **WHEN** an activity executes a task that declares no `inputShapes`
- **THEN** `slot-binding` does not appear in the trace as a nested execution for that task

### Requirement: slot-binding is variant-friendly
The template SHALL be structured so that new variants (e.g. cost-weighted producer selection, alternative agent_fill resolvers) can be created via the existing variant mechanism without editing `slot-binding.json` itself. Selection between variants SHALL use the existing Thompson Sampling on `subscription`-matched activities.

#### Scenario: Variant ranks alongside base via Thompson
- **WHEN** a variant `slot-binding-cost-weighted` is registered with the same subscription
- **THEN** the lifecycle pipeline ranks both variants and selects one per the existing Thompson selection path
