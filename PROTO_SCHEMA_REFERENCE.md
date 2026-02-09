# Proto Schema Reference for Phase 2

**Date**: 2026-02-09  
**Purpose**: Document proto definitions relevant to execution outcome tracking

---

## Key Finding: No ExecutionOutcome Message in Proto

**Important**: The proto files do NOT define an `ExecutionOutcome` or `ActivityOutcome` message.

Proto files contain:
- `execution.proto`: **ExecutionConfig** (how to execute, not outcomes)
- `variant.proto`: **ExpectedOutcome** (what should happen)
- `optimization.proto`: Metrics and Thompson Sampling configs

**Decision**: We must design ExecutionOutcome based on:
1. Existing backend `ActivityExecution` model
2. Proto naming conventions
3. Learning system requirements

---

## Relevant Proto Messages

### 1. ImpulseReference (from execution.proto)

**Location**: `repos/metabob-proto/proto/metabob/activity/execution.proto` (lines 618-651)

```protobuf
message ImpulseReference {
  // Impulse ID (key from contextRequirements or runtime ID).
  string impulse_id = 1;
  
  // Priority of this impulse for task execution.
  ImpulsePriority priority = 2;
  
  // Whether this impulse is required for task.
  bool required = 3;
  
  // Minimum token budget for this impulse.
  int32 min_tokens = 4;
  
  // Maximum token budget for this impulse.
  int32 max_tokens = 5;
  
  enum ImpulsePriority {
    IMPULSE_PRIORITY_UNSPECIFIED = 0;
    IMPULSE_PRIORITY_LOW = 1;
    IMPULSE_PRIORITY_MEDIUM = 2;
    IMPULSE_PRIORITY_HIGH = 3;
    IMPULSE_PRIORITY_CRITICAL = 4;
  }
}
```

**Usage in Phase 2**: Template defines which impulses it needs. Execution tracks which were actually used.

---

### 2. ExpectedOutcome (from variant.proto)

**Location**: `repos/metabob-proto/proto/metabob/activity/variant.proto` (lines 420-441)

```protobuf
message ExpectedOutcome {
  // Human-readable description of expected outcome
  string description = 1;
  
  // Verification method: "manual", "automated", "run-command", "check-files"
  string verification_method = 2;
  
  // Success criteria (conditions that must be met)
  repeated string success_criteria = 3;
  
  // Verification command (if verification_method = "run-command")
  optional string verification_command = 4;
  
  // Files that should exist or change (if verification_method = "check-files")
  repeated string expected_files = 5;
  
  // Whether this outcome is required for activity success (default: true)
  bool required = 6;
  
  // Weight of this outcome in overall success score (0.0-1.0)
  double weight = 7;
}
```

**Note**: This is what **should** happen, not what **did** happen.

---

### 3. VariantPerformanceMetrics (from variant.proto)

**Location**: `repos/metabob-proto/proto/metabob/activity/variant.proto` (lines 444+)

```protobuf
message VariantPerformanceMetrics {
  // Variant being tracked
  string variant_id = 1;
  string activity_id = 2;
  
  // Funnel Metrics
  int32 total_impressions = 3;
  int32 total_selections = 4;
  int32 total_conversions = 5;
  
  // Thompson Sampling (Beta distribution)
  double alpha = 6;  // Successes + initial_alpha
  double beta = 7;   // Failures + initial_beta
  
  // Success rate metrics
  double success_rate = 8;
  double confidence_interval_lower = 9;
  double confidence_interval_upper = 10;
  
  // Performance metrics
  double avg_duration_ms = 11;
  double avg_cost_usd = 12;
  double avg_tokens = 13;
  
  // ... more metrics
}
```

**Usage in Phase 2**: Updated automatically from execution outcomes.

---

## Proto Naming Conventions (IMPORTANT)

From reviewing proto files:

### Field Naming
- **snake_case**: All proto fields use snake_case (e.g., `variant_id`, `success_rate`)
- **NOT camelCase**: Never use camelCase in proto or Pydantic models that map to proto

### Message Naming
- **PascalCase**: Message names use PascalCase (e.g., `ImpulseReference`, `ExpectedOutcome`)
- **Descriptive**: Clear names indicating purpose

### Enums
- **SCREAMING_SNAKE_CASE**: Enum values use SCREAMING_SNAKE_CASE
- **Prefixed**: Enum values prefixed with enum name (e.g., `IMPULSE_PRIORITY_HIGH`)

---

## Proposed ExecutionOutcome Schema

**Status**: NOT in proto (we must design it)

**Proposed structure** (following proto conventions):

```protobuf
// PROPOSED: Not in proto yet, designed for Phase 2
message ExecutionOutcome {
  // Identity
  string execution_id = 1;
  string variant_id = 2;
  string activity_id = 3;
  string session_id = 4;
  
  // Basic outcome
  bool success = 5;
  int32 duration_ms = 6;
  double cost_usd = 7;
  int32 tokens_used = 8;
  optional string failure_reason = 9;
  
  // Impulse provenance (NEW - Phase 2)
  repeated ImpulseUsage impulses_used = 10;
  
  // Component tracking (NEW - Phase 2)
  repeated ComponentChange component_changes = 11;
  
  // Metadata
  google.protobuf.Timestamp timestamp = 12;
  
  // Context
  string org_id = 13;
  string project_id = 14;
  string user_id = 15;
}

message ImpulseUsage {
  // Which impulse was loaded
  string impulse_id = 1;
  
  // Content hash (for tracking versions)
  string content_hash = 2;
  
  // How many tokens this impulse consumed
  int32 tokens_used = 3;
  
  // Whether agent actually referenced/used it
  bool was_useful = 4;
  
  // When it was loaded
  google.protobuf.Timestamp loaded_at = 5;
}

message ComponentChange {
  // File and component identity
  string file_path = 1;
  string component_name = 2;
  string component_type = 3;  // "function", "class", "method"
  
  // What happened
  ChangeType change_type = 4;
  
  // Which impulses informed this change
  repeated string related_impulse_ids = 5;
  
  // Lines changed
  int32 lines_added = 6;
  int32 lines_removed = 7;
  
  enum ChangeType {
    CHANGE_TYPE_UNSPECIFIED = 0;
    CHANGE_TYPE_CREATED = 1;
    CHANGE_TYPE_MODIFIED = 2;
    CHANGE_TYPE_DELETED = 3;
    CHANGE_TYPE_RENAMED = 4;
  }
}
```

---

## Field Number Guidelines (Proto)

From proto3 specification:
- **1-15**: Single-byte encoding (most common fields)
- **16-2047**: Two-byte encoding (less common fields)
- **Reserved**: 19000-19999 (proto implementation)

**Best practice**: Assign most frequently accessed fields to 1-15.

---

## Data Types Mapping

| Proto Type | Python Type (Pydantic) | Notes |
|------------|------------------------|-------|
| `string` | `str` | UTF-8 encoded |
| `int32` | `int` | Signed 32-bit |
| `int64` | `int` | Signed 64-bit |
| `double` | `float` | 64-bit float |
| `bool` | `bool` | Boolean |
| `repeated X` | `List[X]` | Array/list |
| `map<K,V>` | `Dict[K,V]` | Map/dict |
| `optional X` | `Optional[X]` | May be None |
| `google.protobuf.Timestamp` | `datetime` | UTC timestamp |

---

## Existing Backend Models (Context)

**File**: `repos/metabob-rpc-api/server/models/activity_outcome.py`

Current models:
- `ActivityExpectation`: What we expect before execution
- `ActivityComparison`: Comparison of expected vs actual
- `AgentDecision`: Agent decision during execution
- `RecordOutcomeRequest`: API request format
- `TemplateEffectiveness`: Aggregate metrics

**Gap**: Missing `ImpulseUsage` and `ComponentChange` tracking!

---

## Design Decisions for Phase 2

### 1. ImpulseUsage Tracking
**What**: Track which impulses were loaded and whether they were useful
**Why**: Learn which context leads to success
**Storage**: Store as JSON in `activity_executions.impulses_used` (SurrealDB)

### 2. ComponentChange Tracking
**What**: Track which code components were modified
**Why**: Link code changes to impulses (learning loop)
**Storage**: Store as JSON in `activity_executions.component_changes` (SurrealDB)

### 3. Proto Compliance
**Constraint**: Even though ExecutionOutcome isn't in proto yet, follow proto naming
**Action**: Use snake_case, proper field numbering, descriptive names

### 4. Backward Compatibility
**Constraint**: Don't break existing `ActivityExecution` model
**Action**: Add new fields as optional, default to empty lists

---

## Next Steps

1. **Task 0.2**: Map existing backend execution tracking
   - Read `server/actions/activities.py`
   - Read `server/models/activity_outcome.py`
   - Document what exists vs what's needed

2. **Task 0.3**: Document Metabob CLI tools
   - List available MCP tools
   - Document input/output formats

3. **Task 0.4**: Assess OpenCode status
   - Check activity execution code
   - Determine what outcome reporting exists

---

## References

- Proto files: `repos/metabob-proto/proto/metabob/activity/`
- Backend models: `repos/metabob-rpc-api/server/models/`
- Existing execution: `repos/metabob-rpc-api/server/actions/activities.py`
