# Unified Activity Template Architecture - Proto-First Design

**Date**: February 6, 2026  
**Goal**: Single activity template format across all repos with application-specific extensions  
**Approach**: Proto-first with extension messages for each application's needs

---

## Design Philosophy

### Core Insight: Activities as Intent Drivers

**From your description**:
> Activities are prompt sequences, but they are supposed to be **intent/instruction drivers** for managing **algorithmic operations**. We want to associate **sequences of data operations** with **sequences of task/instructional operations** and align the two via iterative refinement.

**Translation**:
- **Activity** = High-level intent (what to accomplish)
- **Tasks** = Instructional operations (prompts, guidance)
- **Data flow** = Algorithmic operations (code execution, data transformations)
- **Goal**: Align instruction sequences with data sequences through learning

### Application-Specific Needs

Each application in `repos/` has different concerns:

#### 1. **metabob-opencode** (Execution Engine)
- **Needs**: Session memory hints, impulse loading, context requirements
- **Purpose**: Execute activities by orchestrating agents with right context
- **Data flow**: Prompt → Agent → Tool calls → Results → Next prompt

#### 2. **metabob-rpc-api** (Backend/Storage)
- **Needs**: Metrics tracking, A/B testing, variant selection, performance optimization
- **Purpose**: Store, serve, and optimize activity variants
- **Data flow**: Request → Select variant (MAB) → Return template → Record metrics

#### 3. **metabob-cli** (Admin/Registration)
- **Needs**: Template validation, registration, evolution triggering
- **Purpose**: Manage activity lifecycle (create, register, evolve, deprecate)
- **Data flow**: Template file → Validate → Transform → Register → Backend

#### 4. **metabob-proto** (Schema Definition)
- **Needs**: Canonical schema, cross-language compatibility, versioning
- **Purpose**: Single source of truth for all applications
- **Data flow**: .proto file → Generate code → All apps use generated types

---

## The Unified Architecture

### Proto-First Design

```
metabob-proto/proto/metabob/activity/
├── variant.proto           # Core ActivityVariant message (shared)
├── execution.proto         # Execution-specific extensions (OpenCode)
├── optimization.proto      # Optimization extensions (RPC API)
└── admin.proto            # Admin/management extensions (CLI)
```

### Core Message (All Applications Use This)

**File**: `repos/metabob-proto/proto/metabob/activity/variant.proto`

```protobuf
syntax = "proto3";

package metabob.activity;

import "metabob/common/types.proto";
import "google/protobuf/struct.proto";
import "google/protobuf/timestamp.proto";

// =============================================================================
// Core ActivityVariant - Used by ALL applications
// =============================================================================

message ActivityVariant {
  // ==========================================================================
  // Identity (ALL APPS)
  // ==========================================================================
  
  string variant_id = 1;           // Content-addressed: {activity_id}-{hash}
  string activity_id = 2;          // Stable identifier: "bug-fix", "feature-impl"
  string variant_name = 3;         // Human-readable: "v1-baseline"
  string description = 4;          // What this variant does
  int32 version = 5;               // Incremental version number
  
  // ==========================================================================
  // Genealogy (ALL APPS)
  // ==========================================================================
  
  metabob.common.Genealogy genealogy = 6;
  
  // ==========================================================================
  // Implementation (ALL APPS)
  // ==========================================================================
  
  repeated TaskStep task_steps = 7;           // Ordered execution steps
  map<string, string> variables = 8;          // Variable definitions
  string prompt_strategy = 9;                 // "guided", "minimal", "detailed"
  int32 context_budget_tokens = 10;           // Token budget
  
  // ==========================================================================
  // Performance Expectations (ALL APPS)
  // ==========================================================================
  
  int32 expected_duration_ms = 11;
  double expected_cost = 12;
  double expected_quality_score = 13;
  
  // ==========================================================================
  // Status & Metadata (ALL APPS)
  // ==========================================================================
  
  metabob.common.EntityStatus status = 14;    // DRAFT, TESTING, ACTIVE, DEPRECATED
  google.protobuf.Timestamp created_at = 15;
  google.protobuf.Timestamp updated_at = 16;
  
  // ==========================================================================
  // Application-Specific Extensions (OPTIONAL per app)
  // ==========================================================================
  
  // OpenCode execution extensions
  ExecutionConfig execution_config = 20;
  
  // RPC API optimization extensions  
  OptimizationConfig optimization_config = 21;
  
  // CLI admin extensions
  AdminConfig admin_config = 22;
}

// =============================================================================
// TaskStep - Used by ALL applications
// =============================================================================

message TaskStep {
  // Core fields (ALL APPS)
  string id = 1;
  string subagent = 2;
  string description = 3;
  repeated string dependencies = 4;
  
  // Prompt configuration
  TaskPrompt prompt = 5;
  
  // Validation rules
  TaskValidation validation = 6;
  
  // Retry configuration
  TaskRetry retry = 7;
  
  // Historical metrics
  TaskMetrics metrics = 8;
  
  // Optional fields
  repeated string guidance = 9;
  repeated string expected_actions = 10;
  TaskTools tools = 11;
  TaskComplexity complexity = 12;
  
  // Execution-specific extensions (OpenCode)
  TaskExecutionConfig execution_config = 20;
}

// ... (TaskPrompt, TaskValidation, TaskRetry, TaskMetrics, TaskTools, TaskComplexity unchanged)
```

### Execution Extensions (OpenCode-Specific)

**File**: `repos/metabob-proto/proto/metabob/activity/execution.proto`

```protobuf
syntax = "proto3";

package metabob.activity;

import "google/protobuf/struct.proto";

// =============================================================================
// Execution Configuration - OpenCode-specific needs
// =============================================================================

// Activity-level execution configuration
message ExecutionConfig {
  // Context requirements for session memory agent
  repeated ContextRequirement context_requirements = 1;
  
  // Integration hooks (pre/post checks, quality gates)
  IntegrationConfig integration = 2;
  
  // Metabob integration settings
  MetabobIntegrationConfig metabob = 3;
  
  // Impulse management hints
  ImpulseManagementConfig impulse_management = 4;
}

// =============================================================================
// Context Requirements - Session Memory Agent Hints
// =============================================================================

message ContextRequirement {
  // Unique key for this context requirement
  string key = 1;
  
  // Hint to session memory agent about what to load
  string hint = 2;
  
  // Types of impulses this context needs
  repeated ImpulseType impulse_types = 3;
  
  // Is this context required or optional?
  bool required = 4;
  
  // Token budget range for this context
  int32 budget_min = 5;
  int32 budget_max = 6;
  
  // Priority (higher = load first when budget limited)
  int32 priority = 7;
  
  // Query/filter for impulse selection
  string impulse_query = 8;
}

enum ImpulseType {
  IMPULSE_TYPE_UNSPECIFIED = 0;
  IMPULSE_TYPE_MEMO = 1;
  IMPULSE_TYPE_FILE = 2;
  IMPULSE_TYPE_COMPONENT = 3;
  IMPULSE_TYPE_COMMIT = 4;
  IMPULSE_TYPE_METABOB_ISSUE = 5;
  IMPULSE_TYPE_METABOB_ANNOTATION = 6;
  IMPULSE_TYPE_ACTIVITY_OUTPUT = 7;
  IMPULSE_TYPE_BASH_OUTPUT = 8;
  IMPULSE_TYPE_ACTIVITY_RECOMMENDATION = 9;
  IMPULSE_TYPE_CUSTOM = 10;
}

// =============================================================================
// Integration Configuration - Pre/Post Checks, Quality Gates
// =============================================================================

message IntegrationConfig {
  // Shell commands to run before activity execution
  repeated string pre_checks = 1;
  
  // Shell commands to run after activity execution
  repeated string post_checks = 2;
  
  // Quality gates that must pass for activity to succeed
  repeated QualityGate quality_gates = 3;
}

message QualityGate {
  string name = 1;
  string command = 2;
  bool required = 3;
  string error_message = 4;
}

// =============================================================================
// Metabob Integration Configuration
// =============================================================================

message MetabobIntegrationConfig {
  // Enable Metabob analysis integration
  bool enabled = 1;
  
  // Enable learning from Metabob feedback
  bool learning_mode = 2;
  
  // Target context tokens for Metabob issues
  int32 target_context_tokens = 3;
  
  // Annotation strategy
  AnnotationStrategy annotation_strategy = 4;
}

enum AnnotationStrategy {
  ANNOTATION_STRATEGY_UNSPECIFIED = 0;
  ANNOTATION_STRATEGY_ALL = 1;                // Annotate all components
  ANNOTATION_STRATEGY_KEY_COMPONENTS = 2;     // Only key/modified components
  ANNOTATION_STRATEGY_FAILURES_ONLY = 3;      // Only on task failures
}

// =============================================================================
// Impulse Management Configuration
// =============================================================================

message ImpulseManagementConfig {
  // Automatic impulse creation rules
  repeated ImpulseCreationRule creation_rules = 1;
  
  // Impulse compression settings
  ImpulseCompressionConfig compression = 2;
  
  // Impulse reference tracking
  bool track_impulse_references = 3;
  
  // Automatic cleanup rules
  ImpulseCleanupConfig cleanup = 4;
}

message ImpulseCreationRule {
  // When to create impulse
  ImpulseCreationTrigger trigger = 1;
  
  // What type of impulse to create
  ImpulseType impulse_type = 2;
  
  // Impulse properties
  string impulse_id_pattern = 3;  // e.g., "{task_id}-output"
  int32 budget = 4;
  bool persistent = 5;
}

enum ImpulseCreationTrigger {
  IMPULSE_CREATION_TRIGGER_UNSPECIFIED = 0;
  IMPULSE_CREATION_TRIGGER_TASK_START = 1;
  IMPULSE_CREATION_TRIGGER_TASK_COMPLETE = 2;
  IMPULSE_CREATION_TRIGGER_TASK_ERROR = 3;
  IMPULSE_CREATION_TRIGGER_ACTIVITY_START = 4;
  IMPULSE_CREATION_TRIGGER_ACTIVITY_COMPLETE = 5;
}

message ImpulseCompressionConfig {
  // Enable compression
  bool enabled = 1;
  
  // Compression strategy
  string strategy = 2;  // "summarize", "filter", "truncate"
  
  // Compression threshold (bytes)
  int32 threshold_bytes = 3;
}

message ImpulseCleanupConfig {
  // Clean up impulses after activity completes
  bool cleanup_on_completion = 1;
  
  // Keep impulses matching these patterns
  repeated string keep_patterns = 2;
  
  // Delete impulses after N seconds
  int32 ttl_seconds = 3;
}

// =============================================================================
// Task-Level Execution Configuration
// =============================================================================

message TaskExecutionConfig {
  // Context to pass to this task
  repeated string impulse_refs = 1;  // IDs of impulses to load
  
  // Agent-specific configuration
  google.protobuf.Struct agent_config = 2;
  
  // Working directory for this task
  string working_directory = 3;
  
  // Environment variables for this task
  map<string, string> environment = 4;
  
  // Timeout override (ms)
  int32 timeout_ms = 5;
}
```

### Optimization Extensions (RPC API-Specific)

**File**: `repos/metabob-proto/proto/metabob/activity/optimization.proto`

```protobuf
syntax = "proto3";

package metabob.activity;

import "google/protobuf/timestamp.proto";

// =============================================================================
// Optimization Configuration - RPC API needs for A/B testing
// =============================================================================

message OptimizationConfig {
  // Thompson Sampling configuration
  ThompsonSamplingConfig thompson_sampling = 1;
  
  // Traffic allocation rules
  TrafficAllocationConfig traffic_allocation = 2;
  
  // Performance thresholds
  PerformanceThresholds performance_thresholds = 3;
  
  // Auto-promotion rules
  AutoPromotionConfig auto_promotion = 4;
}

// =============================================================================
// Thompson Sampling Configuration
// =============================================================================

message ThompsonSamplingConfig {
  // Initial alpha (prior successes + 1)
  double initial_alpha = 1;
  
  // Initial beta (prior failures + 1)
  double initial_beta = 2;
  
  // Exploration weight (0.0 = exploit only, 1.0 = explore freely)
  double exploration_weight = 3;
  
  // Minimum impressions before participating in MAB
  int32 min_impressions = 4;
}

// =============================================================================
// Traffic Allocation
// =============================================================================

message TrafficAllocationConfig {
  // Minimum traffic percentage for this variant (0.0-1.0)
  double min_traffic = 1;
  
  // Maximum traffic percentage for this variant (0.0-1.0)
  double max_traffic = 2;
  
  // Sticky session (same user gets same variant)
  bool sticky_sessions = 3;
  
  // Ramp-up schedule
  repeated TrafficRampStep ramp_schedule = 4;
}

message TrafficRampStep {
  // When to apply this traffic level
  google.protobuf.Timestamp start_time = 1;
  
  // Traffic percentage at this step (0.0-1.0)
  double traffic_percentage = 2;
}

// =============================================================================
// Performance Thresholds
// =============================================================================

message PerformanceThresholds {
  // Minimum success rate to remain active (0.0-1.0)
  double min_success_rate = 1;
  
  // Maximum cost per execution (USD)
  double max_cost = 2;
  
  // Maximum duration (ms)
  int32 max_duration_ms = 3;
  
  // Minimum quality score (0.0-1.0)
  double min_quality_score = 4;
  
  // Auto-deprecate if thresholds not met after N executions
  int32 evaluation_window = 5;
}

// =============================================================================
// Auto-Promotion Configuration
// =============================================================================

message AutoPromotionConfig {
  // Enable automatic promotion from TESTING → ACTIVE
  bool enabled = 1;
  
  // Minimum executions before eligible for promotion
  int32 min_executions = 2;
  
  // Required success rate for promotion (0.0-1.0)
  double required_success_rate = 3;
  
  // Required quality score for promotion (0.0-1.0)
  double required_quality_score = 4;
  
  // Automatically deprecate underperforming ACTIVE variants
  bool auto_deprecate_losers = 5;
}
```

### Admin Extensions (CLI-Specific)

**File**: `repos/metabob-proto/proto/metabob/activity/admin.proto`

```protobuf
syntax = "proto3";

package metabob.activity;

import "google/protobuf/timestamp.proto";

// =============================================================================
// Admin Configuration - CLI management needs
// =============================================================================

message AdminConfig {
  // Authoring metadata
  AuthoringMetadata authoring = 1;
  
  // Validation rules for registration
  ValidationRules validation = 2;
  
  // Documentation metadata
  DocumentationMetadata documentation = 3;
  
  // Deployment configuration
  DeploymentConfig deployment = 4;
}

// =============================================================================
// Authoring Metadata
// =============================================================================

message AuthoringMetadata {
  // Original author
  string author = 1;
  
  // Contributors
  repeated string contributors = 2;
  
  // Source repository
  string source_repo = 3;
  
  // Source file path
  string source_file = 4;
  
  // Tags for categorization
  repeated string tags = 5;
  
  // License
  string license = 6;
}

// =============================================================================
// Validation Rules
// =============================================================================

message ValidationRules {
  // Require specific fields to be present
  repeated string required_fields = 1;
  
  // Minimum number of tasks
  int32 min_tasks = 2;
  
  // Maximum number of tasks
  int32 max_tasks = 3;
  
  // Allowed categories
  repeated string allowed_categories = 4;
  
  // Custom validation commands
  repeated ValidationCommand custom_validations = 5;
}

message ValidationCommand {
  string name = 1;
  string command = 2;
  string error_message = 3;
}

// =============================================================================
// Documentation Metadata
// =============================================================================

message DocumentationMetadata {
  // Long-form documentation
  string long_description = 1;
  
  // Usage examples
  repeated UsageExample examples = 2;
  
  // Common failure modes
  repeated FailureMode failure_modes = 3;
  
  // Best practices
  repeated string best_practices = 4;
  
  // Related activities
  repeated string related_activities = 5;
}

message UsageExample {
  string name = 1;
  string description = 2;
  map<string, string> variables = 3;
  string expected_outcome = 4;
}

message FailureMode {
  string symptom = 1;
  string cause = 2;
  string solution = 3;
}

// =============================================================================
// Deployment Configuration
// =============================================================================

message DeploymentConfig {
  // Deployment strategy
  DeploymentStrategy strategy = 1;
  
  // Rollback configuration
  RollbackConfig rollback = 2;
  
  // Notification settings
  NotificationConfig notifications = 3;
}

enum DeploymentStrategy {
  DEPLOYMENT_STRATEGY_UNSPECIFIED = 0;
  DEPLOYMENT_STRATEGY_IMMEDIATE = 1;      // Deploy immediately
  DEPLOYMENT_STRATEGY_GRADUAL = 2;        // Gradual rollout
  DEPLOYMENT_STRATEGY_CANARY = 3;         // Canary deployment
  DEPLOYMENT_STRATEGY_MANUAL_APPROVAL = 4; // Requires approval
}

message RollbackConfig {
  // Enable automatic rollback on errors
  bool auto_rollback = 1;
  
  // Error threshold for rollback (0.0-1.0)
  double error_threshold = 2;
  
  // Evaluation window for rollback (executions)
  int32 evaluation_window = 3;
}

message NotificationConfig {
  // Notify on deployment
  repeated string notify_on_deploy = 1;
  
  // Notify on errors
  repeated string notify_on_error = 2;
  
  // Notification channels (email, slack, etc.)
  repeated NotificationChannel channels = 3;
}

message NotificationChannel {
  string type = 1;  // "email", "slack", "webhook"
  string destination = 2;
}
```

---

## Implementation Plan

### Phase 1: Extend Proto (Week 1)

**Day 1-2**: Add extension messages
```bash
cd repos/metabob-proto

# Create new files
touch proto/metabob/activity/execution.proto
touch proto/metabob/activity/optimization.proto
touch proto/metabob/activity/admin.proto

# Update variant.proto to include extensions
# Add fields: execution_config, optimization_config, admin_config
```

**Day 3-4**: Set up code generation
```bash
# Install buf
brew install bufbuild/buf/buf

# Create buf.gen.yaml
cat > buf.gen.yaml << 'EOF'
version: v1
plugins:
  - plugin: buf.build/protocolbuffers/js:v3.21.2
    out: gen/js
    opt:
      - import_style=commonjs
      - binary
  - plugin: buf.build/protocolbuffers/python:v3.21.2
    out: gen/python
  - plugin: buf.build/community/stephenh-ts-proto:v1.156.1
    out: gen/typescript
    opt:
      - esModuleInterop=true
      - outputClientImpl=false
EOF

# Generate code
buf generate proto
```

**Day 5**: Publish generated code
```bash
# Create @metabob/proto-gen package
mkdir -p gen/typescript
cd gen/typescript

cat > package.json << 'EOF'
{
  "name": "@metabob/proto-gen",
  "version": "0.1.0",
  "main": "index.js",
  "types": "index.d.ts"
}
EOF

npm publish --access=public
```

### Phase 2: Migrate metabob-rpc-api (Week 2)

**Goal**: Backend uses proto directly, no custom schemas

```bash
cd repos/metabob-rpc-api

# Install generated proto package
npm install @metabob/proto-gen

# Replace custom types
# Before: server/models/activity_variant.py
# After:  from metabob_proto_gen.activity import ActivityVariant

# Update routes to use proto types
# Before: Dict[str, Any]
# After:  ActivityVariant

# Test serialization
pytest tests/test_activity_variants.py
```

### Phase 3: Migrate metabob-cli (Week 2-3)

**Goal**: CLI uses proto for validation and registration

```bash
cd repos/metabob-cli

# Install proto package
pip install metabob-proto-gen

# Update registration
# Before: Custom validation + transformation
# After:  Parse to ActivityVariant proto → validate → send

# Update commands
# metabob-cli register-template → uses proto validation
# metabob-cli activity evolve → creates proto-compliant variants
```

### Phase 4: Migrate metabob-opencode (Week 3-4)

**Goal**: OpenCode uses proto with execution extensions

```bash
cd repos/metabob-opencode

# Install proto package
npm install @metabob/proto-gen

# Delete adapter
rm packages/opencode/src/session/activity-schema-adapter.ts

# Update types
# Before: import { OpenCodeTemplate } from './activity-schema-adapter'
# After:  import { ActivityVariant } from '@metabob/proto-gen/activity/variant_pb'

# Use execution extensions
import { ExecutionConfig } from '@metabob/proto-gen/activity/execution_pb'

// Activity with context requirements
const activity: ActivityVariant = {
  // ... core fields ...
  executionConfig: {
    contextRequirements: [
      {
        key: "documentationFiles",
        hint: "Find all markdown documentation files",
        impulseTypes: [ImpulseType.IMPULSE_TYPE_FILE],
        required: true,
        budgetMin: 2000,
        budgetMax: 4000,
      }
    ],
    integration: {
      preChecks: ["git status"],
      qualityGates: [
        {
          name: "summary-exists",
          command: "test -f doc-jiggle-summary.md",
          required: true,
        }
      ]
    }
  }
}
```

### Phase 5: Update jiggle-documentation (Week 4)

**Goal**: Convert to unified proto format

```typescript
// jiggle-documentation.proto format
{
  "variant_id": "jiggle-documentation-772b239e",
  "activity_id": "jiggle-documentation",
  "variant_name": "v1-baseline",
  "description": "Systematically sort docs by date, percolate details, archive obsolete",
  "version": 1,
  "genealogy": {
    "content_hash": "772b239e",
    "evolution_type": "ROOT",
    "evolution_note": "Initial jiggle-documentation template"
  },
  "task_steps": [...],
  "execution_config": {
    "context_requirements": [
      {
        "key": "documentationFiles",
        "hint": "Find all markdown files and timestamps",
        "impulse_types": ["IMPULSE_TYPE_FILE"],
        "required": true,
        "budget_min": 2000,
        "budget_max": 4000
      }
    ],
    "integration": {
      "pre_checks": ["git status"],
      "quality_gates": [...]
    },
    "metabob": {
      "enabled": true,
      "learning_mode": true,
      "annotation_strategy": "KEY_COMPONENTS"
    }
  },
  "optimization_config": {
    "thompson_sampling": {
      "initial_alpha": 1.0,
      "initial_beta": 1.0,
      "min_impressions": 5
    }
  }
}
```

---

## Data Flow Alignment

### Your Goal: Associate Instruction Sequences with Data Sequences

**Current Problem**:
```
Instruction Sequence (prompts):
  Task 1 → Task 2 → Task 3
  
Data Sequence (actual code):
  ??? (not tracked)
  
Alignment: NONE
```

**Solution with Proto Extensions**:

```protobuf
message TaskStep {
  // Instructional operation
  string id = 1;
  TaskPrompt prompt = 5;
  
  // Data operation tracking
  TaskExecutionConfig execution_config = 20;
}

message TaskExecutionConfig {
  // Data inputs (impulses to load)
  repeated string impulse_refs = 1;
  
  // Data outputs (impulses to create)
  repeated ImpulseCreationRule output_impulses = 2;
  
  // Code component tracking
  repeated string touched_components = 3;
  
  // Data transformations
  repeated DataTransformation transformations = 4;
}

message DataTransformation {
  string name = 1;                    // "filter_docs", "sort_by_date"
  string input_data = 2;              // Input data reference
  string output_data = 3;             // Output data reference
  string code_component = 4;          // Which code executed this
  int32 duration_ms = 5;             // How long it took
}
```

**Result**:
```
Instruction Sequence:
  Task 1: "Analyze docs by date"
    ↓
  Data Sequence:
    - Load: documentationFiles impulse
    - Transform: filter_markdown_files() → 45 files
    - Transform: get_file_timestamps() → timestamp_map
    - Transform: categorize_by_age() → 4 categories
    - Create: doc-analysis impulse
  
Instruction Sequence:
  Task 2: "Percolate content"
    ↓
  Data Sequence:
    - Load: doc-analysis impulse (from Task 1)
    - Transform: identify_foundational_docs() → 3 docs
    - Transform: extract_recent_details() → 12 sections
    - Transform: merge_content() → updated_docs
    - Create: percolation-plan impulse
    
ALIGNED: Each instruction maps to specific data operations
```

### Iterative Refinement

```protobuf
message TaskMetrics {
  // Existing fields...
  
  // Data operation metrics
  repeated DataOperationMetric data_operations = 10;
}

message DataOperationMetric {
  string transformation_name = 1;
  int32 execution_count = 2;
  double avg_duration_ms = 3;
  double success_rate = 4;
  repeated string common_errors = 5;
  
  // Correlation with task success
  double correlation_with_success = 6;
}
```

**Learning Loop**:
```
1. Execute activity
   ↓
2. Track: Which data operations ran, how long, success/failure
   ↓
3. Store metrics: Associate data ops with task success
   ↓
4. Analyze: "filter_markdown_files() succeeds 95%, but categorize_by_age() only 60%"
   ↓
5. Evolve: Refine categorize_by_age() logic in next variant
   ↓
6. Test: New variant has better categorization
   ↓
7. Promote: Better variant wins via MAB
```

---

## Benefits of Unified Proto Format

### 1. **Single Source of Truth**
- Proto defines canonical schema
- All repos use generated code
- Guaranteed compatibility

### 2. **Application-Specific Extensions**
- OpenCode gets `execution_config` for session memory hints
- RPC API gets `optimization_config` for A/B testing
- CLI gets `admin_config` for validation
- **Each app uses what it needs, ignores the rest**

### 3. **No Conversion Bugs**
- No adapters
- No manual field mapping
- Serialization handled by protobuf (proven, battle-tested)

### 4. **Evolution Works**
- Evolved templates are proto-compliant
- Genealogy tracks lineage
- Can round-trip through all systems

### 5. **Data Flow Tracking**
- `TaskExecutionConfig` tracks data operations
- Metrics correlate instructions with data transformations
- Enables iterative refinement based on data flow analysis

---

## Migration Checklist

### Week 1: Proto Foundation
- [ ] Create execution.proto, optimization.proto, admin.proto
- [ ] Update variant.proto with extension fields
- [ ] Set up buf code generation
- [ ] Publish @metabob/proto-gen package
- [ ] Test generated TypeScript/Python

### Week 2: Backend Migration
- [ ] Install proto-gen in metabob-rpc-api
- [ ] Replace custom schemas with proto
- [ ] Update routes to use ActivityVariant
- [ ] Test database serialization
- [ ] Verify task_steps arrays populated

### Week 3: CLI Migration
- [ ] Install proto-gen in metabob-cli
- [ ] Update register-template to validate proto
- [ ] Update evolution to create proto variants
- [ ] Test end-to-end registration

### Week 4: OpenCode Migration
- [ ] Install proto-gen in metabob-opencode
- [ ] Delete activity-schema-adapter.ts
- [ ] Update types to use proto
- [ ] Implement ExecutionConfig usage
- [ ] Test activity execution with context requirements

### Week 5: Validation & Testing
- [ ] Convert jiggle-documentation to proto format
- [ ] Register and execute jiggle-documentation
- [ ] Test evolution system
- [ ] Verify data flow tracking
- [ ] Document migration

---

## Success Criteria

✅ **All repos use same ActivityVariant proto**  
✅ **No adapter code exists**  
✅ **task_steps arrays populated in database**  
✅ **jiggle-documentation executes successfully**  
✅ **Evolution creates proto-compliant variants**  
✅ **Data operations tracked and correlated with task success**  
✅ **Session memory agent receives correct impulse hints**  
✅ **Instruction sequences aligned with data sequences**  

---

**Conclusion**: Proto-first with application-specific extensions gives us **single format across all repos** while preserving each application's **unique needs**. The extension messages enable **data flow tracking** and **instruction/data alignment** for iterative refinement.

This is the architecture that should have existed from the start.
