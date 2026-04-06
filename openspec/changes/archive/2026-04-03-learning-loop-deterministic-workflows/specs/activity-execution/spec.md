## MODIFIED Requirements

### Requirement: Create argument impulses after tool calls
After LLM task execution completes, the activity executor SHALL extract tool call arguments as typed impulses.

#### Scenario: Argument impulses created for each tool call
- **WHEN** LLM task completes with 3 tool calls (read, bash, write)
- **THEN** system creates 3 argument impulses with shapes `file_read_args`, `bash_args`, `file_write_args`

#### Scenario: Argument impulses have stable IDs
- **WHEN** creating argument impulse for `read({path: "src/index.ts"})`
- **THEN** impulse ID is `arg:read:src/index.ts` (deterministic)

#### Scenario: Argument impulses stored in impulse store
- **WHEN** argument impulse is created
- **THEN** impulse is available via `getImpulseStore().get(impulseId)`

### Requirement: Record patterns for successful executions
After successful task execution, the activity executor SHALL record tool argument patterns to backend.

#### Scenario: Patterns recorded on success
- **WHEN** LLM task completes successfully with tool calls
- **THEN** system calls `mcp.recordToolArgumentPattern()` for each tool call

#### Scenario: Patterns not recorded on failure
- **WHEN** LLM task fails
- **THEN** system does not record patterns (to avoid learning from failures)

#### Scenario: Pattern recording includes execution metrics
- **WHEN** recording pattern
- **THEN** payload includes `execution_ms` from task result

### Requirement: Shape-based routing in executor
The activity executor SHALL check shape availability before routing to resolvers.

#### Scenario: Check shapes before resolver execution
- **WHEN** task has `resolver` field and `inputShapes` field
- **THEN** executor calls `canExecuteTask()` before `executeWithResolver()`

#### Scenario: Resolve impulses by shape for resolver
- **WHEN** task can execute (shapes available)
- **THEN** executor calls `resolveImpulsesByShape()` to get impulses for resolver

#### Scenario: Fall back to LLM when shapes missing
- **WHEN** `canExecuteTask()` returns `{canExecute: false, missing: [...]}`
- **THEN** executor logs missing shapes and calls `executeWithLLM()` instead
