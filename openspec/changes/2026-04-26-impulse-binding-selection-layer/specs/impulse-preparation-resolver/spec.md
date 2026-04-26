## ADDED Requirements

### Requirement: impulse_preparation resolver registered in MiniBob
MiniBob SHALL register a template-dispatchable resolver under the key `impulse_preparation` in `ActivityExecutor.initializeResolvers()`. The resolver SHALL accept `config: { operation: "synthesise_from_variables" | "agent_fill", task: TaskRef, variables: Record<string, unknown>, missingShapes: string[], impulses: ImpulseRef[] }`.

#### Scenario: Resolver is registered at startup
- **WHEN** `ActivityExecutor` initialises
- **THEN** the registry contains an entry under the key `impulse_preparation`

#### Scenario: Unknown operation rejected
- **WHEN** the resolver is invoked with `config.operation: "invalid_op"`
- **THEN** the resolver returns a typed error response and does NOT throw

### Requirement: synthesise_from_variables operation matches the legacy synthesizer byte-for-byte
The `synthesise_from_variables` operation SHALL produce identical impulses (same ids, same metadata.shape, same memo-pointer construction) to the legacy `synthesizeShapeImpulsesFromVariables` method previously located at `repos/minibob/src/activity.ts:4172`. Given the same inputs, the resolver and the legacy method SHALL be functionally equivalent.

#### Scenario: Single shape, matching variable
- **WHEN** the operation runs with `missingShapes: ["goal"]` and `variables: { goal: "fix auth bug" }`
- **THEN** the response includes one impulse with `metadata.shape: "goal"` and a memo pointer wrapping `"fix auth bug"`

#### Scenario: Shape with no matching variable produces nothing
- **WHEN** `missingShapes: ["errorLog"]` and `variables: { goal: "x" }`
- **THEN** the response includes no impulse for `errorLog`

### Requirement: agent_fill operation invokes SessionMemoryAgent
The `agent_fill` operation SHALL construct or retrieve `SessionMemoryAgent` from the shared `ImpulseStateManager` singleton (mirroring the lazy-construction pattern used by `ImpulseStateAnalysisResolver`) and SHALL invoke its missing-shapes-fill method with the supplied task, variables, missingShapes, and current impulse pool. Returned impulses SHALL be passed through to the resolver response.

#### Scenario: Agent returns impulses for some shapes
- **WHEN** the agent's fill method returns two impulses for shapes `errorLog` and `gitDiff`
- **THEN** the resolver response includes both impulses

#### Scenario: Agent returns empty
- **WHEN** the agent's fill method returns no impulses (e.g. no relevant memory)
- **THEN** the resolver response includes an empty impulse list and does NOT throw

### Requirement: Resolver does not depend on ActivityExecutor private state
The `impulse_preparation` resolver SHALL operate without holding a reference to the calling `ActivityExecutor` instance. All state required to execute SHALL be provided via `config` or retrieved from singletons (`ImpulseStateManager`, `MCPClient`).

#### Scenario: Resolver works when called from a nested execution
- **WHEN** the resolver is dispatched from `slot-binding` running as a nested execution under a parent executor
- **THEN** the resolver completes without requiring access to the parent executor's private fields

### Requirement: Hardcoded synthesizer call sites in ActivityExecutor are removed
The inline call sites at `repos/minibob/src/activity.ts:4949-4997` (the block that invokes `synthesizeShapeImpulsesFromVariables` and `fillMissingShapesViaMemoryAgent` directly) SHALL be removed once the `slot-binding` meta-activity is registered and tested. The path that handles `task.impulseReferences` (currently at `:4944-4945`) SHALL remain unchanged.

#### Scenario: Inline synthesizer block deleted
- **WHEN** the spec is implemented
- **THEN** `repos/minibob/src/activity.ts` no longer contains the call sites at the original lines, and no other call site in `activity.ts` invokes `synthesizeShapeImpulsesFromVariables` or `fillMissingShapesViaMemoryAgent`

#### Scenario: Behaviour preserved through resolver path
- **WHEN** an activity with declared `inputShapes` and matching `variables` runs after the deletion
- **THEN** the same supplemental impulses appear in the pool (now via the `slot-binding` nested execution rather than the inline call)
