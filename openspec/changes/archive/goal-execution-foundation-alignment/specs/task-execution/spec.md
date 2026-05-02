## MODIFIED Requirements

### Requirement: Per-task resolver requirements

Tasks SHALL be able to declare which resolvers and tools they require or exclude, enabling filtered tool provision to the LLM.

#### Scenario: Declare required tools
- **WHEN** a task specifies `resolverRequirements.requiredTools: ['read', 'write']`
- **THEN** at minimum these tools SHALL be available to the LLM
- **AND** other tools MAY also be available unless excluded

#### Scenario: Declare excluded tools
- **WHEN** a task specifies `resolverRequirements.excludeTools: ['bash']`
- **THEN** the `bash` tool SHALL NOT be provided to the LLM for this task
- **AND** all other tools SHALL remain available

#### Scenario: Declare preferred resolver
- **WHEN** a task specifies `resolverRequirements.preferredResolver: 'git'`
- **AND** the task also has `resolver: 'git'`
- **THEN** the system SHALL attempt resolver-based execution first
- **AND** fall back to LLM only if resolver fails or is unavailable

#### Scenario: Default behavior without requirements
- **WHEN** a task does not specify `resolverRequirements`
- **THEN** all available tools SHALL be provided to the LLM (current behavior)
- **AND** no tools SHALL be filtered

### Requirement: Tool filtering in LLM execution

The `executeWithLLM()` function SHALL filter tools based on task resolver requirements before calling the LLM.

#### Scenario: Filter tools based on requirements
- **WHEN** executing a task with `resolverRequirements.excludeTools`
- **THEN** the system SHALL call `getAllToolDefinitions()` and filter out excluded tools
- **AND** only provide filtered tool list to `completeWithTools()`

#### Scenario: Validate required tools available
- **WHEN** executing a task with `resolverRequirements.requiredTools`
- **AND** a required tool is not available
- **THEN** the system SHALL fail the task with error `'Required tool not available: {toolName}'`

#### Scenario: Log tool filtering
- **WHEN** tools are filtered for a task
- **THEN** the system SHALL log which tools were excluded
- **AND** include filtered tool list in execution trace metadata

### Requirement: Ribosome inference of resolver requirements

The template generator SHALL infer resolver requirements from execution traces.

#### Scenario: Infer required tools from tool calls
- **WHEN** assembling a template from execution
- **THEN** the system SHALL analyze `executedTask.toolCalls`
- **AND** populate `resolverRequirements.requiredTools` with tools actually used

#### Scenario: Infer excluded tools for safe tasks
- **WHEN** a task completed successfully without using certain dangerous tools (e.g., `bash`)
- **AND** the task has validation that doesn't require bash
- **THEN** the system MAY suggest `excludeTools: ['bash']` for safety

#### Scenario: Preserve resolver detection
- **WHEN** `inferResolver()` detects a deterministic resolver pattern (single git/bash/file)
- **THEN** the system SHALL set both `task.resolver` and `resolverRequirements.preferredResolver`

### Requirement: ActivityTask type extension

The `ActivityTask` interface SHALL include an optional `resolverRequirements` field.

#### Scenario: Type definition
- **WHEN** defining `ActivityTask` in `types.ts`
- **THEN** the interface SHALL include:
```typescript
resolverRequirements?: {
  requiredTools?: string[]
  excludeTools?: string[]
  preferredResolver?: string
}
```

#### Scenario: Backward compatible
- **WHEN** a task lacks `resolverRequirements`
- **THEN** the task SHALL execute with all tools available (current behavior)
- **AND** existing templates SHALL continue to work without modification
