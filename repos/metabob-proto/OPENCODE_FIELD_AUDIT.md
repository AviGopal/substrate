# OpenCode Field Audit for Proto Extensions

**Purpose**: Map OpenCode-specific activity template fields to proto extensions to enable proper backend storage and cross-tool compatibility.

**Files Analyzed**:
- `repos/metabob-opencode/packages/opencode/src/session/activity-schema-adapter.ts` (OpenCode format)
- `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts` (Full schema)
- `repos/metabob-proto/proto/metabob/activity/variant.proto` (Proto variant)
- `repos/metabob-proto/proto/metabob/activity/execution.proto` (Proto execution)
- `jiggle-documentation.json` (Real-world usage example)

---

## Executive Summary

### Fields Analysis
- **23 OpenCode-specific fields** not in proto
- **12 fields to ADD** to proto as execution extensions
- **6 fields to ADD** as proto core fields
- **5 fields to KEEP** as OpenCode-only (transient/computed)

### Architecture Decision
Proto should define the **execution contract** (what backend needs to track), while OpenCode extends with **runtime-specific execution logic** (how to execute locally).

---

## 1. Fields to ADD to Proto (Execution Extensions)

### 1.1 contextRequirements
**Current Type**: 
```typescript
Array<{
  key: string
  hint: string
  impulseTypes: Array<"memo" | "file" | "component" | ...>
  required: boolean
  budgetRange: [number, number]
}>
```

**Purpose**: Declares what context impulses the activity needs before execution. The session memory agent uses these hints to prepare relevant impulses.

**Proto Decision**: ✅ **ADD to execution.proto as ContextRequirement message**

**Rationale**: 
- Core to OpenCode's execution model
- Backend needs to track this for activity recommendations ("this activity needs error context")
- CLI/Dashboard can show context requirements to users
- Enables data flow tracking across activities

**Proposed Proto**:
```protobuf
message ContextRequirement {
  string key = 1;                    // Unique key (impulse ID hint)
  string hint = 2;                   // Human-readable hint
  repeated string impulse_types = 3; // Accepted pointer types
  bool required = 4;                 // Must be fulfilled?
  TokenBudgetRange budget_range = 5; // Min/max tokens
}

message TokenBudgetRange {
  int32 min_tokens = 1;
  int32 max_tokens = 2;
}
```

---

### 1.2 integration
**Current Type**:
```typescript
{
  preChecks: string[]        // Shell commands before activity
  postChecks: string[]       // Shell commands after activity  
  qualityGates: Array<{
    name: string
    command: string
    required: boolean
  }>
}
```

**Purpose**: Pre/post shell commands for validation. Used in jiggle-documentation.json:
```json
{
  "preChecks": ["git status"],
  "postChecks": ["ls -la doc-*.md"],
  "qualityGates": [{"name": "summary-exists", "command": "test -f doc-jiggle-summary.md", "required": true}]
}
```

**Proto Decision**: ✅ **ADD to execution.proto as IntegrationConfig message**

**Rationale**:
- Execution-specific (not needed by backend analytics)
- CLI needs this to run validation commands
- Part of execution contract, not template definition

**Proposed Proto**:
```protobuf
message IntegrationConfig {
  repeated string pre_checks = 1;      // Shell commands before activity
  repeated string post_checks = 2;     // Shell commands after activity
  repeated QualityGate quality_gates = 3;
}

message QualityGate {
  string name = 1;
  string command = 2;
  bool required = 3;
}
```

---

### 1.3 metabob
**Current Type**:
```typescript
{
  enabled: boolean
  learningMode: boolean
  targetContextTokens: number
  annotationStrategy: "all" | "key-components" | "failures-only"
}
```

**Purpose**: Controls Metabob code quality integration during execution. Used in jiggle-documentation.json:
```json
{
  "enabled": true,
  "learningMode": true,
  "targetContextTokens": 4000,
  "annotationStrategy": "key-components"
}
```

**Proto Decision**: ✅ **ADD to execution.proto as MetabobConfig message**

**Rationale**:
- Execution-time configuration (OpenCode-specific runtime)
- Backend doesn't need this for storage/analytics
- CLI can use defaults if not provided

**Proposed Proto**:
```protobuf
message MetabobConfig {
  bool enabled = 1;
  bool learning_mode = 2;
  int32 target_context_tokens = 3;
  enum AnnotationStrategy {
    ANNOTATION_STRATEGY_UNSPECIFIED = 0;
    ANNOTATION_STRATEGY_ALL = 1;
    ANNOTATION_STRATEGY_KEY_COMPONENTS = 2;
    ANNOTATION_STRATEGY_FAILURES_ONLY = 3;
  }
  AnnotationStrategy annotation_strategy = 4;
}
```

---

### 1.4 hooks
**Current Type**:
```typescript
{
  preActivity: { workingDirectory, loadImpulses, environment, commands }
  preTask: { loadTaskImpulses, validateTools, commands }
  postTask: { unloadLargeImpulses, captureOutputs, commands }
  postActivity: { cleanup, extractFiles, persistImpulses, createSummary, commands }
  onError: { captureEnvironment, captureLogs, createDiagnosticImpulse, cleanup }
}
```

**Purpose**: Lifecycle hooks for workspace setup, impulse management, and cleanup. Used in jiggle-documentation.json:
```json
{
  "preActivity": {
    "workingDirectory": {"type": "current", "cleanup": "never"},
    "environment": {}
  },
  "postActivity": {
    "cleanup": false,
    "createSummary": true
  },
  "onError": {
    "captureEnvironment": true,
    "captureLogs": {"tail": 50},
    "createDiagnosticImpulse": true,
    "cleanup": false
  }
}
```

**Proto Decision**: ✅ **ADD to execution.proto as ActivityHooks message**

**Rationale**:
- Critical for OpenCode execution flow
- Defines workspace management contract
- Backend doesn't execute these (OpenCode-only), but should store for portability
- CLI/Dashboard need this to execute activities correctly

**Proposed Proto**:
```protobuf
message ActivityHooks {
  PreActivityHook pre_activity = 1;
  PreTaskHook pre_task = 2;
  PostTaskHook post_task = 3;
  PostActivityHook post_activity = 4;
  ErrorHook on_error = 5;
}

message PreActivityHook {
  WorkingDirectoryConfig working_directory = 1;
  repeated string load_impulses = 2;
  map<string, string> environment = 3;
  repeated ValidationCommand commands = 4;
}

message WorkingDirectoryConfig {
  oneof config {
    CurrentDirectory current = 1;
    TemporaryDirectory temporary = 2;
    CustomDirectory custom = 3;
  }
}

message CurrentDirectory {
  optional string path = 1;
}

message TemporaryDirectory {
  string prefix = 1;
  enum CleanupPolicy {
    CLEANUP_POLICY_UNSPECIFIED = 0;
    CLEANUP_POLICY_ALWAYS = 1;
    CLEANUP_POLICY_ON_SUCCESS = 2;
    CLEANUP_POLICY_ON_ERROR = 3;
    CLEANUP_POLICY_NEVER = 4;
  }
  CleanupPolicy cleanup = 2;
}

message CustomDirectory {
  string path = 1;
}

// Additional messages for PreTaskHook, PostTaskHook, PostActivityHook, ErrorHook...
```

---

### 1.5 contextNegotiation
**Current Type**:
```typescript
{
  prompt: string     // Initial prompt to calling agent
  maxRounds: number  // Max negotiation rounds (default: 3)
}
```

**Purpose**: Configuration for context negotiation with calling agent when context requirements aren't met.

**Proto Decision**: ✅ **ADD to execution.proto as ContextNegotiation message**

**Rationale**:
- Part of execution protocol for context gathering
- OpenCode runtime feature, but portable concept
- Backend doesn't need for analytics, but should store

**Proposed Proto**:
```protobuf
message ContextNegotiation {
  string prompt = 1;      // Initial negotiation prompt
  int32 max_rounds = 2;   // Maximum negotiation attempts
}
```

---

### 1.6 discoveryPhase
**Current Type**:
```typescript
{
  required: boolean
  searchTemplates: boolean
  searchCodebase: boolean
  minSimilarityChecks: number
  similarityThreshold: number
}
```

**Purpose**: Configuration for discovery phase that checks for existing similar functionality before implementing.

**Proto Decision**: ✅ **ADD to execution.proto as DiscoveryPhase message**

**Rationale**:
- OpenCode execution optimization strategy
- Controls pre-execution similarity checks
- Backend doesn't execute, but should store for reuse

**Proposed Proto**:
```protobuf
message DiscoveryPhase {
  bool required = 1;
  bool search_templates = 2;
  bool search_codebase = 3;
  int32 min_similarity_checks = 4;
  int32 similarity_threshold = 5;  // Percentage 0-100
}
```

---

### 1.7 memoryManagement
**Current Type**:
```typescript
{
  strategy: "conservative" | "balanced" | "aggressive"
  unloadLowPriority: boolean
  keepHighPriority: boolean
  optimizationThreshold: number
}
```

**Purpose**: Memory optimization strategy for managing impulse loading/unloading during execution.

**Proto Decision**: ✅ **ADD to execution.proto as MemoryManagement message**

**Rationale**:
- Runtime execution optimization
- OpenCode-specific, but portable concept
- Part of execution contract

**Proposed Proto**:
```protobuf
message MemoryManagement {
  enum Strategy {
    STRATEGY_UNSPECIFIED = 0;
    STRATEGY_CONSERVATIVE = 1;
    STRATEGY_BALANCED = 2;
    STRATEGY_AGGRESSIVE = 3;
  }
  Strategy strategy = 1;
  bool unload_low_priority = 2;
  bool keep_high_priority = 3;
  double optimization_threshold = 4;  // 0.0-1.0
}
```

---

### 1.8 repositories
**Current Type**:
```typescript
map<string, {
  name: string
  connection: string     // ACP connection (docker://container or ssh://host)
  workingDirectory: string
  description: string
}>
```

**Purpose**: Repository mappings for cross-repository activity execution via ACP delegation.

**Proto Decision**: ✅ **ADD to execution.proto as RepositoryMapping message**

**Rationale**:
- Part of execution topology (where tasks run)
- Backend should track for activity portability
- CLI/Dashboard need this to delegate tasks

**Proposed Proto**:
```protobuf
message RepositoryMapping {
  string name = 1;
  string connection = 2;           // ACP connection string
  optional string working_directory = 3;
  optional string description = 4;
}
```

---

### 1.9 Task.executionTarget
**Current Type**:
```typescript
{
  type: "local" | "remote"
  connection?: string           // For remote: ACP connection
  repository?: string          // Repository identifier
  workingDirectory?: string
  shareImpulses?: boolean
  syncSessionState?: boolean
  syncActivityState?: boolean
}
```

**Purpose**: Specifies where a task should execute (local or remote via ACP).

**Proto Decision**: ✅ **ADD to execution.proto as TaskExecutionTarget message**

**Rationale**:
- Execution topology information
- Critical for cross-repo activities
- Backend needs for tracking where tasks ran

**Proposed Proto**:
```protobuf
message TaskExecutionTarget {
  oneof target {
    LocalExecution local = 1;
    RemoteExecution remote = 2;
  }
}

message LocalExecution {}

message RemoteExecution {
  string connection = 1;            // ACP connection string
  optional string repository = 2;
  optional string working_directory = 3;
  bool share_impulses = 4;
  bool sync_session_state = 5;
  bool sync_activity_state = 6;
}
```

---

### 1.10 Task.impulseReferences
**Current Type**: `Array<string>` (impulse IDs)

**Purpose**: Which impulses this task needs by ID (context requirements). Used in jiggle-documentation.json tasks:
```json
{
  "impulseReferences": ["documentationFiles", "repoStructure"]
}
```

**Proto Decision**: ✅ **ADD to variant.proto TaskStep**

**Rationale**:
- Part of task execution contract
- Links tasks to required context
- Backend needs for data flow tracking

**Proposed Proto**:
```protobuf
// In TaskStep message:
repeated string impulse_references = 13;  // Impulse IDs needed
```

---

### 1.11 Task.impulseAdjustment
**Current Type**:
```typescript
{
  prompt: string              // Prompt for adjusting impulses
  beforeExecution: boolean    // Run adjustment before execution
}
```

**Purpose**: Configuration for adjusting impulses before task execution (context refinement).

**Proto Decision**: ✅ **ADD to execution.proto as ImpulseAdjustment message**

**Rationale**:
- Execution-time context optimization
- Part of impulse management protocol
- Backend doesn't execute, but should store

**Proposed Proto**:
```protobuf
message ImpulseAdjustment {
  string prompt = 1;
  bool before_execution = 2;
}
```

---

### 1.12 Task.agentImpulses
**Current Type**: `Array<string>` (impulse IDs for agent behavior)

**Purpose**: Impulse IDs that define agent behavior (instructions, tools, constraints) instead of using named subagents.

**Proto Decision**: ✅ **ADD to variant.proto TaskStep**

**Rationale**:
- Replaces hardcoded subagent names with dynamic agent composition
- Part of new architecture pattern
- Backend should track for analytics

**Proposed Proto**:
```protobuf
// In TaskStep message:
repeated string agent_impulses = 14;  // Impulse IDs defining agent behavior
```

---

## 2. Fields to ADD to Proto Core (variant.proto)

### 2.1 composition
**Current Type**:
```typescript
{
  standalone: boolean
  composesWith: Array<{
    templateId: string
    relationship: "prerequisite" | "complement" | "alternative" | "extends"
    description: string
    example: string
  }>
  examples: Array<{
    name: string
    description: string
    sequence: Array<{ template: string, variables: object, reason: string }>
    outcome: string
  }>
}
```

**Purpose**: Template composition patterns showing how templates combine. Used in jiggle-documentation.json:
```json
{
  "standalone": true,
  "composesWith": ["commit-organized-changes"],
  "examples": [
    {
      "name": "Jiggle All Documentation (Dry Run)",
      "sequence": [{"template": "jiggle-documentation", "variables": {...}}],
      "outcome": "Analysis reports created..."
    }
  ]
}
```

**Proto Decision**: ✅ **ADD to variant.proto as Composition message**

**Rationale**:
- **Core to backend recommendation system** - backend needs to suggest template sequences
- Not execution-specific, but template metadata
- Dashboard can show composition patterns to users
- Analytics track which compositions succeed

**Proposed Proto**:
```protobuf
message Composition {
  bool standalone = 1;
  repeated CompositionRelation composes_with = 2;
  repeated CompositionExample examples = 3;
}

message CompositionRelation {
  string template_id = 1;
  enum Relationship {
    RELATIONSHIP_UNSPECIFIED = 0;
    RELATIONSHIP_PREREQUISITE = 1;
    RELATIONSHIP_COMPLEMENT = 2;
    RELATIONSHIP_ALTERNATIVE = 3;
    RELATIONSHIP_EXTENDS = 4;
  }
  Relationship relationship = 2;
  string description = 3;
  string example = 4;
}

message CompositionExample {
  string name = 1;
  string description = 2;
  repeated CompositionStep sequence = 3;
  string outcome = 4;
}

message CompositionStep {
  string template = 1;
  google.protobuf.Struct variables = 2;
  string reason = 3;
}
```

---

### 2.2 learning
**Current Type**:
```typescript
{
  enabled: boolean
  captureStrategy: "detailed" | "summary" | "minimal"
  feedbackPoints: Array<{
    taskId: string
    metrics: Record<string, string>
    improvementHints: Record<string, string>
  }>
  aggregation?: {
    successPatterns: string[]
    failurePatterns: string[]
    optimization_opportunities: string[]
  }
}
```

**Purpose**: Learning mechanism for feedback capture. Used in jiggle-documentation.json with extensive feedback points per task.

**Proto Decision**: ✅ **ADD to variant.proto as Learning message**

**Rationale**:
- **Core to backend learning system** - backend aggregates feedback across executions
- Not execution-specific, but variant metadata
- Backend uses for Thompson sampling optimization
- Analytics track learning effectiveness

**Proposed Proto**:
```protobuf
message Learning {
  bool enabled = 1;
  enum CaptureStrategy {
    CAPTURE_STRATEGY_UNSPECIFIED = 0;
    CAPTURE_STRATEGY_DETAILED = 1;
    CAPTURE_STRATEGY_SUMMARY = 2;
    CAPTURE_STRATEGY_MINIMAL = 3;
  }
  CaptureStrategy capture_strategy = 2;
  repeated FeedbackPoint feedback_points = 3;
  optional Aggregation aggregation = 4;
}

message FeedbackPoint {
  string task_id = 1;
  map<string, string> metrics = 2;
  map<string, string> improvement_hints = 3;
}

message Aggregation {
  repeated string success_patterns = 1;
  repeated string failure_patterns = 2;
  repeated string optimization_opportunities = 3;
}
```

---

### 2.3 componentAgents
**Current Type**:
```typescript
Array<{
  componentPattern: string        // Glob pattern for component files
  impulseSpecs: Array<{
    type: "metabobAnnotation" | "metabobIssue" | "file" | "custom"
    budget: number
    priority: "high" | "medium" | "low"
    resolver?: string
  }>
  agentInstructions: string
  consistencyRules?: string[]
  isolationBoundary?: string
}>
```

**Purpose**: Dynamic component-specific agent generation based on file patterns.

**Proto Decision**: ✅ **ADD to variant.proto as ComponentAgentSpec message**

**Rationale**:
- Part of variant definition (not execution-time)
- Backend analytics track effectiveness
- Portable concept (CLI could use for local execution)

**Proposed Proto**:
```protobuf
message ComponentAgentSpec {
  string component_pattern = 1;  // Glob pattern
  repeated ImpulseSpec impulse_specs = 2;
  string agent_instructions = 3;
  repeated string consistency_rules = 4;
  optional string isolation_boundary = 5;
}

message ImpulseSpec {
  string type = 1;
  int32 budget = 2;
  string priority = 3;
  optional string resolver = 4;
}
```

---

### 2.4 expectedOutcomes
**Current Type**:
```typescript
{
  componentPatterns: string[]  // Glob patterns for expected modifications
  estimatedDuration: number    // Minutes
  estimatedCost: number        // Dollars
  useCochangePrediction: boolean
}
```

**Purpose**: Expected outcomes for closed-loop effectiveness tracking.

**Proto Decision**: ✅ **ADD to variant.proto as ExpectedOutcomes message**

**Rationale**:
- **Core to backend analytics** - backend compares actual vs expected
- Used for variant performance tracking
- Part of variant metadata, not execution

**Proposed Proto**:
```protobuf
message ExpectedOutcomes {
  repeated string component_patterns = 1;
  int32 estimated_duration_minutes = 2;
  double estimated_cost = 3;
  bool use_cochange_prediction = 4;
}
```

---

### 2.5 trailblazing
**Current Type**:
```typescript
{
  enabled: boolean
  maxCostPerTask: number
  maxTotalCost: number
  maxRecoveryAttempts: number
  baseTemplateId?: string
}
```

**Purpose**: Template-level trailblazing configuration for failure recovery.

**Proto Decision**: ✅ **ADD to variant.proto as Trailblazing message**

**Rationale**:
- Part of variant configuration
- Backend tracks trailblazing usage for analytics
- Not execution-specific, but variant policy

**Proposed Proto**:
```protobuf
message Trailblazing {
  bool enabled = 1;
  double max_cost_per_task = 2;
  double max_total_cost = 3;
  int32 max_recovery_attempts = 4;
  optional string base_template_id = 5;
}
```

---

### 2.6 Task.trailblazing
**Current Type**:
```typescript
{
  enabled: boolean
  continuationAttempts: Array<{
    failureContext: string
    prompt: string
    toolCalls: unknown[]
    success: boolean
    cost: number
    tokens: { input, output, cache }
    timestamp: number
  }>
}
```

**Purpose**: Task-level trailblazing tracking (records continuation attempts).

**Proto Decision**: ✅ **ADD to variant.proto TaskStep as TaskTrailblazing message**

**Rationale**:
- Backend needs for learning from trailblazing attempts
- Part of task history (how task evolved during execution)
- Analytics track effectiveness of continuations

**Proposed Proto**:
```protobuf
message TaskTrailblazing {
  bool enabled = 1;
  repeated ContinuationAttempt continuation_attempts = 2;
}

message ContinuationAttempt {
  string failure_context = 1;
  string prompt = 2;
  repeated google.protobuf.Any tool_calls = 3;
  bool success = 4;
  double cost = 5;
  metabob.common.TokenUsage tokens = 6;
  google.protobuf.Timestamp timestamp = 7;
}
```

---

## 3. Fields Already in Proto (Keep as-is)

### 3.1 id vs variant_id
- **OpenCode uses**: `id` (string)
- **Proto uses**: `variant_id` + `activity_id` (both strings)
- **Decision**: ✅ **Keep proto's dual ID system**
- **Migration**: Map OpenCode's `id` → proto's `activity_id` in adapter

### 3.2 Genealogy fields
- **OpenCode has**: `version` (object) + `genealogy` (object)
- **Proto has**: `genealogy` (message) + `version` (int32)
- **Decision**: ✅ **Keep proto's Genealogy message**
- **Migration**: Adapter maps OpenCode version/genealogy to proto Genealogy

### 3.3 Metrics fields
- **OpenCode has**: `executions`, `successRate`, `avgDuration`, `avgCost`, `avgTokens`
- **Proto has**: These in `ActivityVariant` via `estimated_metrics` and `VariantPerformanceMetrics` table
- **Decision**: ✅ **Keep proto's metrics system**
- **Migration**: Adapter populates from OpenCode metrics

### 3.4 Task validation/retry/metrics
- **OpenCode has**: Nested objects for validation, retry, metrics
- **Proto has**: `TaskValidation`, `TaskRetry`, `TaskMetrics` messages
- **Decision**: ✅ **Keep proto's messages**
- **Migration**: Adapter maps OpenCode nested objects to proto messages

### 3.5 Category field
- **OpenCode uses**: String enum `"feature" | "bugfix" | "refactor" | "tool" | "infrastructure"`
- **Proto uses**: `ActivityCategory` enum
- **Decision**: ✅ **Keep proto's enum**
- **Migration**: Adapter maps strings to proto enum values

---

## 4. Fields to REMOVE (Not Needed)

### 4.1 avgTokens breakdown (Template-level)
**Current Type**:
```typescript
{
  input: number
  output: number
  cache: number
}
```

**Proto Decision**: ❌ **REMOVE - Use proto's TokenUsage**

**Rationale**:
- Proto has `metabob.common.TokenUsage` message with same fields
- Backend tracks this in `VariantPerformanceMetrics`
- OpenCode doesn't need to duplicate

**Migration**: Adapter reads from proto's `TokenUsage`, doesn't store separate field

---

### 4.2 Task.guidance (array of strings)
**Current Type**: `string[]`

**Proto Decision**: ❌ **REMOVE - Redundant with prompt.template**

**Rationale**:
- Guidance can be embedded in prompt template
- Not tracked separately by backend
- OpenCode-specific hint system, not portable

**Migration**: Move guidance into prompt template during migration

---

### 4.3 Task.expected_actions (array of strings)
**Current Type**: `string[]`

**Proto Decision**: ❌ **REMOVE - Redundant with validation**

**Rationale**:
- Expected actions should be validation rules
- Not tracked separately by backend
- OpenCode-specific, not portable

**Migration**: Convert expected_actions to validation patterns

---

### 4.4 createdAt / updatedAt (unix timestamps)
**Current Type**: `number` (unix timestamp)

**Proto Decision**: ❌ **KEEP IN PROTO - But as google.protobuf.Timestamp**

**Rationale**:
- Proto has `created_at` as `google.protobuf.Timestamp`
- Backend manages timestamps, not OpenCode
- OpenCode reads from proto, doesn't write

**Migration**: Adapter converts unix timestamp ↔ proto Timestamp

---

### 4.5 Task.subagent (deprecated)
**Current Type**: `string` (deprecated, optional)

**Proto Decision**: ❌ **REMOVE - Replaced by agentImpulses**

**Rationale**:
- Explicitly deprecated in OpenCode schema
- Replaced by `agentImpulses` (impulse-based agents)
- Not needed in proto

**Migration**: Ignore during proto serialization

---

## 5. Fields that are OpenCode-Only (Don't Store in Proto)

These fields are transient, computed, or OpenCode runtime state. They should NOT be in proto.

### 5.1 Task.metrics (computed)
- **Current Type**: `{ successRate, avgTokens, avgDuration, commonFailures }`
- **Reason**: Computed from execution history by backend
- **Decision**: ✅ **OpenCode reads from proto VariantPerformanceMetrics, doesn't write**

### 5.2 Task.tools (execution hint)
- **Current Type**: `{ required: string[], optional: string[], disabled: string[] }`
- **Reason**: Execution-time configuration
- **Decision**: ⚠️ **ADD to execution.proto as TaskTools** (see 1.12 above)

### 5.3 Task.complexity (execution optimization)
- **Current Type**: Complex object with tier, reasoning, characteristics
- **Reason**: OpenCode model selection optimization
- **Decision**: ⚠️ **Proto has TaskComplexity** - Keep both, OpenCode uses for local optimization

### 5.4 Task.prompt.variables (prompt metadata)
- **Current Type**: Array of PromptVariable definitions
- **Reason**: Part of prompt template metadata
- **Decision**: ✅ **Keep in proto** - Proto TaskPrompt has `variables` field

---

## 6. Implementation Checklist

### Phase 1: Add Execution Extensions (execution.proto)
- [ ] Add `ContextRequirement` message
- [ ] Add `IntegrationConfig` message  
- [ ] Add `MetabobConfig` message
- [ ] Add `ActivityHooks` message (with sub-messages)
- [ ] Add `ContextNegotiation` message
- [ ] Add `DiscoveryPhase` message
- [ ] Add `MemoryManagement` message
- [ ] Add `RepositoryMapping` message
- [ ] Add `TaskExecutionTarget` message
- [ ] Add `ImpulseAdjustment` message

### Phase 2: Extend variant.proto Core
- [ ] Add `Composition` message
- [ ] Add `Learning` message
- [ ] Add `ComponentAgentSpec` message
- [ ] Add `ExpectedOutcomes` message
- [ ] Add `Trailblazing` message (template-level)
- [ ] Add `TaskTrailblazing` message (task-level)
- [ ] Add `impulse_references` field to TaskStep
- [ ] Add `agent_impulses` field to TaskStep

### Phase 3: Update ActivityVariant Message
- [ ] Add `context_requirements` field (repeated ContextRequirement)
- [ ] Add `integration` field (IntegrationConfig)
- [ ] Add `metabob_config` field (MetabobConfig)
- [ ] Add `hooks` field (ActivityHooks)
- [ ] Add `context_negotiation` field (ContextNegotiation)
- [ ] Add `discovery_phase` field (DiscoveryPhase)
- [ ] Add `memory_management` field (MemoryManagement)
- [ ] Add `repositories` field (map<string, RepositoryMapping>)
- [ ] Add `composition` field (Composition)
- [ ] Add `learning` field (Learning)
- [ ] Add `component_agents` field (repeated ComponentAgentSpec)
- [ ] Add `expected_outcomes` field (ExpectedOutcomes)
- [ ] Add `trailblazing` field (Trailblazing)

### Phase 4: Update Adapter
- [ ] Update `toCanonical()` to map new proto fields → OpenCode
- [ ] Update `fromCanonical()` to map OpenCode → new proto fields
- [ ] Add validation for required execution extensions
- [ ] Update tests to cover new field mappings

### Phase 5: Backend Integration
- [ ] Update SurrealDB schema to store new ActivityVariant fields
- [ ] Update metabob-rpc-api to serialize/deserialize extended proto
- [ ] Update recommendation system to use composition patterns
- [ ] Update learning system to capture feedback points

---

## 7. Summary Tables

### Fields to Add to Proto

| Field | Location | Type | Reason |
|-------|----------|------|--------|
| contextRequirements | variant.proto | repeated ContextRequirement | Data flow tracking |
| integration | execution.proto | IntegrationConfig | Execution validation |
| metabob | execution.proto | MetabobConfig | Runtime configuration |
| hooks | execution.proto | ActivityHooks | Lifecycle management |
| contextNegotiation | execution.proto | ContextNegotiation | Context gathering protocol |
| discoveryPhase | execution.proto | DiscoveryPhase | Pre-execution checks |
| memoryManagement | execution.proto | MemoryManagement | Runtime optimization |
| repositories | execution.proto | map<string, RepositoryMapping> | Cross-repo execution |
| composition | variant.proto | Composition | Template relationships |
| learning | variant.proto | Learning | Feedback capture |
| componentAgents | variant.proto | repeated ComponentAgentSpec | Dynamic agents |
| expectedOutcomes | variant.proto | ExpectedOutcomes | Performance tracking |
| trailblazing | variant.proto | Trailblazing | Failure recovery |
| Task.executionTarget | execution.proto | TaskExecutionTarget | Execution topology |
| Task.impulseReferences | variant.proto | repeated string | Context links |
| Task.impulseAdjustment | execution.proto | ImpulseAdjustment | Context refinement |
| Task.agentImpulses | variant.proto | repeated string | Dynamic agent behavior |
| Task.trailblazing | variant.proto | TaskTrailblazing | Task evolution tracking |

**Total: 18 new proto messages/fields**

### Fields to Keep from Proto

| Field | OpenCode | Proto | Mapping |
|-------|----------|-------|---------|
| id | id (string) | activity_id (string) | Direct map |
| version | version (object) | version (int32) + genealogy | Adapter converts |
| metrics | executions, successRate, etc. | VariantPerformanceMetrics | Backend computes |
| tasks | tasks (array) | task_steps (repeated) | Adapter maps |
| category | category (string) | category (enum) | Enum conversion |

### Fields to Remove

| Field | Reason |
|-------|--------|
| avgTokens (template) | Use proto TokenUsage |
| Task.guidance | Redundant with prompt |
| Task.expected_actions | Redundant with validation |
| Task.subagent | Deprecated, use agentImpulses |

---

## 8. Proto File Structure Recommendation

```
proto/metabob/activity/
├── variant.proto          # Core variant definition
│   ├── ActivityVariant
│   ├── TaskStep
│   ├── Composition
│   ├── Learning
│   └── ...
├── execution.proto        # Execution configuration
│   ├── IntegrationConfig
│   ├── MetabobConfig
│   ├── ActivityHooks
│   ├── ContextRequirement
│   └── ...
└── common.proto           # Shared types
    ├── TokenUsage
    ├── Genealogy
    └── ...
```

**Rationale**: Separate execution config from variant definition. Backend stores both, but execution config is OpenCode-specific.

---

## 9. Next Steps

1. **Review this audit** with backend team (metabob-rpc-api)
2. **Implement Phase 1-2** (execution.proto and variant.proto extensions)
3. **Generate proto code** for Go (backend) and TypeScript (OpenCode)
4. **Update adapter** (activity-schema-adapter.ts) to use new proto fields
5. **Test end-to-end**: Create template → Save to backend → Load in OpenCode → Execute
6. **Update jiggle-documentation.json** to use new proto-backed format

---

**Author**: OpenCode Field Audit Bot  
**Date**: 2026-02-06  
**Version**: 1.0  
**Status**: Ready for Review
