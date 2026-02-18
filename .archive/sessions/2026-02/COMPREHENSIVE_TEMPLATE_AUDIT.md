# Comprehensive Activity Template Audit

**Date**: 2026-02-11  
**Objective**: Map current state of activity templates across all systems before alignment

---

## Executive Summary

### Current State: INCONSISTENT ⚠️

1. **Proto definitions** (source of truth): ✅ Correct and comprehensive
2. **Backend API** (metabob-rpc-api): ✅ Returns correct format with `subagent`
3. **Bootstrap templates** (metabob-proto): ⚠️ **8/9 templates MISSING `subagent` field**
4. **Container examples** (devbob-opencode): ❌ Wrong format (missing nested structures)
5. **Backend Pydantic models**: ✅ Correct (proto-aligned)

### Critical Finding

The **bootstrap templates in metabob-proto** are themselves incomplete! They have:
- ✅ Nested `prompt`, `validation`, `retry`, `metrics` objects
- ✅ `task_steps` field name
- ❌ **MISSING `subagent` field** (required by proto)
- ❌ **MISSING `impulse_refs` field** (critical for learning)

This means the "source of truth" templates need fixing first.

---

## Detailed Audit Results

### A. Proto Definitions (metabob-proto)

**Location**: `repos/metabob-proto/proto/metabob/activity/`

**Proto Files**:
- `variant.proto` - Main activity variant and TaskStep definition
- `execution.proto` - Execution configuration
- `optimization.proto` - A/B testing configuration  
- `admin.proto` - Administrative configuration

**TaskStep Proto Schema** (from variant.proto lines 26-92):

```protobuf
message TaskStep {
  string id = 1;                        // ✅ REQUIRED
  string subagent = 2;                  // ✅ REQUIRED - "general", "tool", "config"
  string description = 3;               // ✅ REQUIRED
  repeated string dependencies = 4;     // ✅ REQUIRED (can be empty)
  
  TaskPrompt prompt = 5;                // ✅ REQUIRED (nested object)
  TaskValidation validation = 6;        // ✅ REQUIRED (nested object)
  TaskRetry retry = 7;                  // ✅ REQUIRED (nested object)
  TaskMetrics metrics = 8;              // ✅ REQUIRED (nested object)
  
  repeated string guidance = 9;         // ☑️  Optional
  repeated string expected_actions = 10; // ☑️ Optional
  TaskTools tools = 11;                 // ☑️  Optional
  TaskComplexity complexity = 12;       // ☑️  Optional
  
  repeated ImpulseReference impulse_refs = 21; // ⚠️ CRITICAL for learning
}
```

**Status**: ✅ Proto definitions are correct and comprehensive

---

### B. Bootstrap Templates (metabob-proto/activities/bootstrap/)

**Templates Audited**: 9 files

| Template | Uses | Has `subagent` | Has `impulse_refs` | Proto-aligned |
|----------|------|----------------|-------------------|---------------|
| activity-create.json | task_steps | ❌ NO | ❌ NO | ⚠️ PARTIAL |
| activity-debug.json | task_steps | ❌ NO | ❌ NO | ⚠️ PARTIAL |
| activity-evolve.json | task_steps | ❌ NO | ❌ NO | ⚠️ PARTIAL |
| boredom-task-processor.json | task_steps | ❌ NO | ❌ NO | ⚠️ PARTIAL |
| bug-fix.json | task_steps | ❌ NO | ❌ NO | ⚠️ PARTIAL |
| code-analysis.json | task_steps | ❌ NO | ❌ NO | ⚠️ PARTIAL |
| feature-impl.json | task_steps | ❌ NO | ❌ NO | ⚠️ PARTIAL |
| refactor.json | task_steps | ❌ NO | ❌ NO | ⚠️ PARTIAL |
| jiggle-documentation.json | tasks | ✅ YES | ⚠️ partial | ✅ MOSTLY |

**Example - feature-impl.json task structure**:
```json
{
  "id": "understand-requirements",
  "description": "Clarify what the feature should do",
  "dependencies": [],
  "prompt": {                          // ✅ Nested object
    "template": "...",
    "max_tokens": 8000,
    "compression_strategy": "filter",
    "variables": []
  },
  "validation": {                       // ✅ Nested object
    "required_files": [],
    "required_patterns": [],
    "forbidden_patterns": [],
    "commands": []
  },
  "retry": {                            // ✅ Nested object
    "max_attempts": 3,
    "strategy": "simple",
    "fallback_prompt": ""
  },
  "metrics": {                          // ✅ Nested object
    "success_rate": 0,
    "avg_tokens": 0,
    "avg_duration": 0,
    "common_failures": []
  },
  "guidance": [],
  "tools": {
    "required": [],
    "optional": ["read", "grep", "glob"],
    "disabled": []
  }
  // ❌ MISSING: "subagent" field
  // ❌ MISSING: "impulse_refs" field
}
```

**Status**: ⚠️ **8/9 templates need `subagent` field added**

---

### C. Backend API (metabob-rpc-api)

**Location**: `repos/metabob-rpc-api/server/`

**Pydantic Models** (server/models/proto_task_step.py):

```python
class ProtoTaskStep(BaseModel):
    """Proto-aligned task step model"""
    
    # Required fields
    id: str
    subagent: str                    # ✅ Required
    description: str
    dependencies: List[str]
    
    # Nested configurations
    prompt: TaskPrompt              # ✅ Nested object
    validation: TaskValidation      # ✅ Nested object
    retry: TaskRetry               # ✅ Nested object
    metrics: TaskMetrics           # ✅ Nested object
    
    # Optional fields
    impulse_refs: List[ImpulseReference] = []  # ✅ Present
    guidance: List[str] = []
    expected_actions: List[str] = []
    tools: Optional[TaskTools] = None
    complexity: Optional[TaskComplexity] = None
```

**API Endpoint**: `/v2/activities/templates`

**Test - Actual Database Content**:
```bash
curl http://localhost:8080/v2/activities/templates
```

**Result**: Backend returns templates with:
- ✅ `subagent` field present
- ✅ `prompt` as nested object
- ✅ `validation`, `retry`, `metrics` as nested objects
- ✅ `impulse_refs` array present
- ✅ Both `task_steps` and `tasks` fields (backend populates both)

**Status**: ✅ Backend is correct and working

---

### D. CLI (metabob-cli)

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/`

**Activity Manager** (activity_manager.py):

The CLI fetches templates from backend and uses them as-is. Since the backend returns correct format, the CLI receives correct format.

**MCP Tools** (activity_tools.py):

The `create_activity_template` tool constructs templates and registers them. Need to verify it creates proper format.

**Status**: ✅ CLI consumes correct format from backend

---

### E. OpenCode (metabob-opencode)

**Location**: Checked via container inspection (devbob-opencode)

**Container Examples** (devbob-opencode:/workspace/):

Files found:
- `test-greeting-activity.json` - ❌ Wrong format (flat prompt)
- `test-template.json` - ❌ Wrong format
- `test-hello-world.json` - ❌ Wrong format (created by agent)

**Example of WRONG format** (test-greeting-activity.json):
```json
{
  "tasks": [
    {
      "id": "print_greeting",
      "agent": "general",              // ❌ Wrong: should be "subagent"
      "prompt": "Print greeting...",   // ❌ Wrong: should be nested object
      "success_criteria": []
    }
  ]
}
```

**Status**: ❌ Container has incorrect example templates

---

## Field-by-Field Comparison

### Required Fields (per proto)

| Field | Proto | Backend | Bootstrap | Container | Status |
|-------|-------|---------|-----------|-----------|--------|
| `id` | ✅ Required | ✅ Present | ✅ Present | ✅ Present | ✅ ALIGNED |
| `subagent` | ✅ Required | ✅ Present | ❌ **MISSING** | ❌ Uses `agent` | ❌ **MISALIGNED** |
| `description` | ✅ Required | ✅ Present | ✅ Present | ✅ Present | ✅ ALIGNED |
| `dependencies` | ✅ Required | ✅ Present | ✅ Present | ⚠️ Varies | ⚠️ PARTIAL |
| `prompt` (object) | ✅ Required | ✅ Nested | ✅ Nested | ❌ Flat string | ❌ **MISALIGNED** |
| `validation` (object) | ✅ Required | ✅ Nested | ✅ Nested | ❌ Missing | ❌ **MISALIGNED** |
| `retry` (object) | ✅ Required | ✅ Nested | ✅ Nested | ❌ Missing | ❌ **MISALIGNED** |
| `metrics` (object) | ✅ Required | ✅ Nested | ✅ Nested | ❌ Missing | ❌ **MISALIGNED** |

### Critical Fields (for learning)

| Field | Proto | Backend | Bootstrap | Container | Status |
|-------|-------|---------|-----------|-----------|--------|
| `impulse_refs` | ⚠️ Critical | ✅ Present | ❌ **MISSING** | ❌ Missing | ❌ **MISALIGNED** |

### Optional Fields

| Field | Proto | Backend | Bootstrap | Container |
|-------|-------|---------|-----------|-----------|
| `guidance` | ☑️ Optional | ✅ Present | ✅ Present | ❌ Missing |
| `expected_actions` | ☑️ Optional | ✅ Present | ⚠️ Sometimes | ❌ Missing |
| `tools` | ☑️ Optional | ✅ Present | ✅ Present | ❌ Missing |
| `complexity` | ☑️ Optional | ⚠️ Sometimes | ❌ Missing | ❌ Missing |

---

## Root Cause Analysis

### Why Bootstrap Templates Are Missing `subagent`

Looking at the bootstrap templates, they appear to have been created **before the proto schema was finalized**. The proto clearly requires `subagent`, but the templates don't have it.

**Hypothesis**: The templates were created when the field might have been called something else or wasn't yet added to the proto.

### Why Backend Still Works

The backend has **defaulting logic** that:
1. Accepts templates without `subagent`
2. Defaults to `"general"` if missing
3. Populates both `task_steps` and `tasks` fields for compatibility

**Evidence**: Templates in database have `subagent` even though bootstrap files don't.

### Why Container Examples Are Wrong

The container examples were created **manually as test fixtures** and never updated to match proto schema.

---

## Fix Priority

### Priority 1: Fix Bootstrap Templates (HIGH IMPACT) 🔴

**Impact**: These are the source of truth that agents learn from

**Fix Required**:
1. Add `subagent: "general"` to all task_steps in 8 templates
2. Add `impulse_refs: []` to all task_steps
3. Validate against proto schema
4. Test with backend registration

**Files to Fix**:
- activity-create.json
- activity-debug.json
- activity-evolve.json
- boredom-task-processor.json
- bug-fix.json
- code-analysis.json
- feature-impl.json
- refactor.json

### Priority 2: Fix Container Examples (HIGH IMPACT) 🔴

**Impact**: Agents directly learn from these examples

**Fix Required**:
1. Remove incorrect examples (test-greeting-activity.json, etc.)
2. Copy validated bootstrap templates from metabob-proto
3. Add README explaining the format

**Container**: devbob-opencode

### Priority 3: Add Validation (MEDIUM IMPACT) 🟡

**Impact**: Prevents future drift

**Fix Required**:
1. Create validation script in metabob-proto
2. Add pre-commit hooks
3. Add CI/CD validation
4. Add runtime validation to backend

### Priority 4: Documentation (LOW IMPACT) 🟢

**Impact**: Helps developers understand the format

**Fix Required**:
1. Document proto → JSON mapping
2. Add examples to proto comments
3. Create developer guide

---

## Success Criteria

### Phase 1: Immediate Fixes (This Week)
- ✅ All 8 bootstrap templates have `subagent` field
- ✅ All bootstrap templates have `impulse_refs` array
- ✅ All bootstrap templates validate against proto
- ✅ Container examples replaced with validated templates

### Phase 2: Validation (Next Week)
- ✅ Validation script exists and works
- ✅ CI/CD catches invalid templates
- ✅ Backend validates on registration
- ✅ Clear error messages

### Phase 3: Complete Alignment (Month 1)
- ✅ 100% of templates proto-aligned
- ✅ Zero schema drift incidents
- ✅ Agent-created templates work first time
- ✅ Documentation complete

---

## Next Steps

1. **Create fix script** to add missing fields to bootstrap templates
2. **Validate** all templates against proto schema
3. **Deploy** fixed templates to container
4. **Test** agent template creation with new examples
5. **Document** the process

---

## Appendix: Proto Field Requirements

From `variant.proto` message TaskStep:

**REQUIRED** (will fail without):
- `id` (string)
- `subagent` (string) - Values: "general", "tool", "config", "session"
- `description` (string)
- `dependencies` (repeated string, can be empty [])
- `prompt` (TaskPrompt object)
- `validation` (TaskValidation object)
- `retry` (TaskRetry object)
- `metrics` (TaskMetrics object)

**CRITICAL** (system works but learning breaks without):
- `impulse_refs` (repeated ImpulseReference)

**OPTIONAL** (nice to have):
- `guidance` (repeated string)
- `expected_actions` (repeated string)
- `tools` (TaskTools object)
- `complexity` (TaskComplexity object)
- `execution_config` (TaskExecutionConfig object)
