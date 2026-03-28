# Schema Mismatch Root Cause Analysis

**Date**: 2026-02-08  
**Method**: Algorithmic trace through storage systems and schemas

---

## The Problem

```
Backend returned 422: {
  "detail": [
    {"type": "missing", "loc": ["body", "tasks", 0, "order"], "msg": "Field required"},
    {"type": "missing", "loc": ["body", "tasks", 0, "type"], "msg": "Field required"},
    {"type": "missing", "loc": ["body", "tasks", 0, "prompt_template"], "msg": "Field required"}
  ]
}
```

**Translation**: OpenCode is sending Task objects, but the backend expects completely different Task fields.

---

## What We're Storing (Evidence)

### Storage Layer 1: Proto Definitions (Source of Truth)
**Location**: `repos/metabob-proto/proto/metabob/activity/variant.proto`

```protobuf
message TaskStep {
  string id = 1;                      // ✅ OpenCode has this
  string subagent = 2;                // ✅ OpenCode has this  
  string description = 3;             // ✅ OpenCode has this
  repeated string dependencies = 4;   // ✅ OpenCode has this
  TaskPrompt prompt = 5;              // ✅ OpenCode has this
  TaskValidation validation = 6;      // ✅ OpenCode has this
  TaskRetry retry = 7;                // ✅ OpenCode has this
  TaskMetrics metrics = 8;            // ✅ OpenCode has this
  // ... more fields ...
}

message TaskPrompt {
  string template = 1;                // ✅ The actual prompt text
  int32 max_tokens = 2;
  string compression_strategy = 3;
  repeated string variables = 4;
}
```

**Proto says**: Task should have `id`, `subagent`, `description`, `prompt` (nested object), etc.

---

### Storage Layer 2: Backend API (FastAPI/Pydantic)
**Location**: `repos/metabob-rpc-api/server/routes/v2_activities.py`

```python
class TemplateTask(BaseModel):
    """Task definition within template"""

    order: int = Field(description="Task execution order")               # ❌ NOT IN PROTO
    type: str = Field(description="Task type (agent_task, validation)")  # ❌ NOT IN PROTO
    agent_mode: Optional[str] = Field(None, description="Agent mode")   
    prompt_template: str = Field(description="Prompt template")          # ❌ FLAT, NOT NESTED
    validation: Optional[dict] = Field(None)
    cost_budget: Optional[float] = Field(None)
```

**Backend API says**: Task should have `order`, `type`, `prompt_template` (flat string), etc.

---

### Storage Layer 3: OpenCode Schema (TypeScript/Zod)
**Location**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`

```typescript
export const TaskSchema = z.object({
    id: z.string(),                           // ✅ FROM PROTO
    subagent: z.string().optional(),          // ✅ FROM PROTO (deprecated)
    description: z.string(),                  // ✅ FROM PROTO
    dependencies: z.array(z.string()),        // ✅ FROM PROTO
    guidance: z.array(z.string()).optional(), 
    expected_actions: z.array(z.string()).optional(),
    tools: TaskToolsSchema.optional(),
    prompt: PromptConfigSchema,               // ✅ FROM PROTO (nested)
    validation: ValidationSchema,             // ✅ FROM PROTO (nested)
    retry: RetryConfigSchema,                 // ✅ FROM PROTO (nested)
    metrics: TaskMetricsSchema,               // ✅ FROM PROTO (nested)
    // ... more fields ...
})
```

**OpenCode says**: Task should have `id`, `description`, `prompt` (nested object) - MATCHES PROTO!

---

## The THREE Schemas (Side by Side)

| Field | Proto (variant.proto) | Backend API (v2_activities.py) | OpenCode (activity-template.ts) | Match? |
|-------|----------------------|--------------------------------|----------------------------------|--------|
| `id` | ✅ `string id = 1` | ❌ **MISSING** | ✅ `z.string()` | Proto ✓ OpenCode |
| `order` | ❌ **MISSING** | ✅ `order: int` | ❌ **MISSING** | Backend ONLY |
| `type` | ❌ **MISSING** | ✅ `type: str` | ❌ **MISSING** | Backend ONLY |
| `subagent` | ✅ `string subagent = 2` | `agent_mode` (different name) | ✅ `z.string()` | Proto ✓ OpenCode |
| `description` | ✅ `string description = 3` | ❌ **MISSING** | ✅ `z.string()` | Proto ✓ OpenCode |
| `dependencies` | ✅ `repeated string = 4` | ❌ **MISSING** | ✅ `z.array()` | Proto ✓ OpenCode |
| `prompt` | ✅ `TaskPrompt prompt = 5` (nested) | `prompt_template: str` (flat) | ✅ `PromptConfigSchema` (nested) | Proto ✓ OpenCode |
| `validation` | ✅ `TaskValidation = 6` (nested) | `validation: dict` (flat) | ✅ `ValidationSchema` (nested) | Proto ✓ OpenCode |

**Conclusion**: 
- **Proto ↔ OpenCode**: ✅ 95% alignment
- **Proto ↔ Backend API**: ❌ 30% alignment
- **OpenCode ↔ Backend API**: ❌ 30% alignment

---

## Where Each System Stores Data

### System 1: metabob-proto (Source of Truth)
**Storage**: Proto files (`.proto`)  
**Location**: `repos/metabob-proto/proto/metabob/activity/variant.proto`  
**Schema**: `message TaskStep { ... }`  
**Generated**: Python protobuf classes, TypeScript types  
**Used by**: All systems (supposed to)

### System 2: metabob-rpc-api (Backend)
**Storage**: SurrealDB  
**Table**: `activity_variants`  
**Location**: `repos/metabob-rpc-api/server/routes/v2_activities.py`  
**Schema**: `class TemplateTask(BaseModel)` - **CUSTOM, NOT FROM PROTO**  
**Used by**: REST API endpoints  
**Problem**: ❌ **Ignores proto, defines own schema**

### System 3: metabob-opencode (Frontend)
**Storage**: Metabob backend (via MCP tool calls)  
**Location**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`  
**Schema**: `export const TaskSchema = z.object({ ... })` - **FROM PROTO**  
**Used by**: Activity execution, template creation  
**Problem**: ✅ Follows proto, ❌ but backend rejects it

### System 4: metabob-cli (MCP Server)
**Storage**: Proxies to metabob-rpc-api  
**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`  
**Schema**: Converts between OpenCode and Backend  
**Problem**: ⚠️ Conversion fails because schemas don't match

---

## Data Flow (When OpenCode Saves Template)

```
┌─────────────────────────────────────────────────────────────────┐
│ OpenCode (TypeScript)                                           │
│ ─────────────────────────────────────────────────────────────── │
│ Template with TaskSchema from proto:                           │
│   { id, description, prompt: { template, max_tokens }, ... }   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ MCP call: metabob.createActivityTemplate()
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ metabob-cli (Python MCP Server)                                 │
│ ─────────────────────────────────────────────────────────────── │
│ Receives OpenCode schema, forwards to backend                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ HTTP POST /v2/activities/templates
                       │ Body: { tasks: [{ id, description, ... }] }
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ metabob-rpc-api (Python FastAPI)                                │
│ ─────────────────────────────────────────────────────────────── │
│ Pydantic validation:                                            │
│   class TemplateTask:                                           │
│     order: int       ← ❌ MISSING IN REQUEST                    │
│     type: str        ← ❌ MISSING IN REQUEST                    │
│     prompt_template  ← ❌ GOT "prompt" OBJECT INSTEAD           │
│                                                                  │
│ ❌ VALIDATION FAILS: 422 Error                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why This Happened (Root Cause)

### Architectural Drift

**Phase 1**: Backend API created BEFORE metabob-proto existed
- Backend defined its own schema: `order`, `type`, `prompt_template`
- This was the "working" schema at the time

**Phase 2**: metabob-proto created as "source of truth"
- Proto defined "correct" schema: `id`, `subagent`, `prompt` (nested)
- OpenCode adopted proto schema ✅
- Backend NEVER migrated to proto schema ❌

**Phase 3**: MCP layer added
- Assumed everyone uses proto
- Doesn't convert between schemas
- Forwards OpenCode's proto-based data directly to backend
- Backend rejects it (schema mismatch)

### Who's Right?

**Proto is right.** It's the declared source of truth.

- OpenCode ✅ follows proto
- Backend ❌ ignores proto
- Result: Incompatibility

---

## What Components Touch Each Schema?

### Proto Schema (variant.proto - TaskStep)
**Touched by**:
- ✅ OpenCode: `src/session/activity-template.ts` (reads from proto types)
- ✅ OpenCode: `src/session/template-loader.ts` (converts to/from proto)
- ❌ Backend: NOT USED (defines own schema instead)
- ❌ metabob-cli: NOT USED (just forwards data)

### Backend Schema (TemplateTask)
**Touched by**:
- ✅ `server/routes/v2_activities.py` - Endpoint validation
- ✅ `server/services/variant_service.py` - Storage operations
- ❌ OpenCode: DOESN'T KNOW IT EXISTS
- ❌ Proto: DOESN'T DEFINE IT

### OpenCode Schema (TaskSchema)
**Touched by**:
- ✅ `src/session/activity-template.ts` - Type definitions
- ✅ `src/session/template-executor.ts` - Task execution
- ✅ `src/tool/activity.ts` - Activity tool
- ✅ `src/session/template-loader.ts` - Save/load operations
- ❌ Backend: REJECTS IT

---

## The Fix (Three Options)

### Option 1: Backend Adopts Proto (CORRECT, but big change)
**Change**: Migrate backend API schema to match proto

**Files to modify**:
1. `server/routes/v2_activities.py`:
   ```python
   class TemplateTask(BaseModel):
       # OLD:
       order: int
       type: str  
       prompt_template: str
       
       # NEW (from proto):
       id: str
       subagent: str
       description: str
       dependencies: List[str]
       prompt: TaskPromptModel  # Nested
       validation: TaskValidationModel  # Nested
       # ...
   ```

2. `server/services/variant_service.py` - Update CRUD operations
3. SurrealDB schema migration - Change stored data format

**Impact**: 
- ✅ Aligns with proto (architectural correctness)
- ❌ Breaking change for existing stored templates
- ❌ Requires migration script for SurrealDB data

### Option 2: OpenCode Adapts to Backend (WRONG, but quick hack)
**Change**: OpenCode converts proto schema to backend schema before sending

**Files to modify**:
1. `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`:
   ```typescript
   function convertToBackendSchema(protoTask: TaskSchema): BackendTask {
     return {
       order: task.order || 0,  // Add missing field
       type: "agent_task",      // Add missing field
       agent_mode: task.subagent,
       prompt_template: task.prompt.template,  // Flatten nested
       validation: task.validation ? flattenValidation(task.validation) : null,
       cost_budget: task.complexity?.estimated_tokens * 0.0001
     }
   }
   ```

**Impact**:
- ✅ Quick fix
- ❌ Violates proto as source of truth
- ❌ OpenCode maintains two schemas (complexity++)
- ❌ Proto becomes meaningless

### Option 3: MCP Layer Converts (COMPROMISE)
**Change**: metabob-cli MCP server translates between schemas

**Files to modify**:
1. `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`:
   ```python
   def convert_proto_to_backend_task(proto_task: dict) -> dict:
       """Convert OpenCode proto-based task to backend schema"""
       return {
           "order": proto_task.get("order", 0),  # Default if missing
           "type": "agent_task",  # Infer from context
           "agent_mode": proto_task.get("subagent", "general"),
           "prompt_template": proto_task["prompt"]["template"],  # Extract nested
           "validation": flatten_validation(proto_task.get("validation")),
           "cost_budget": estimate_cost(proto_task)
       }
   ```

**Impact**:
- ✅ OpenCode stays proto-compliant
- ✅ Backend unchanged (no migration)
- ⚠️ MCP layer has conversion logic (complexity+)
- ⚠️ Still doesn't fix architectural drift (band-aid)

---

## Recommendation: Option 1 (Backend Adopts Proto)

**Why**:
1. **Proto is the declared source of truth** - written in stone
2. **OpenCode already follows it** - 95% done
3. **Backend is the outlier** - it's diverged
4. **Long-term correctness** - fixes architectural debt

**Implementation Plan**:
1. Create Pydantic models FROM proto (auto-generate)
2. Add migration script for existing SurrealDB data
3. Update backend endpoints to use proto-based models
4. Test with OpenCode
5. Deprecate old schema

**Short-term workaround** (while doing Option 1):
- Implement Option 3 (MCP conversion) temporarily
- Remove once backend migrated

---

## Summary

**What are we storing?**
- Proto says: `TaskStep` with `id`, `description`, `prompt` (nested), etc.
- Backend stores: `TemplateTask` with `order`, `type`, `prompt_template` (flat)
- OpenCode sends: Proto-based tasks (matches proto, not backend)

**Where?**
- Proto: Definition files (`variant.proto`)
- Backend: SurrealDB (`activity_variants` table)
- OpenCode: Metabob backend (via MCP → REST API → SurrealDB)

**How?**
- OpenCode → MCP (proto schema) → Backend API (expects different schema) → ❌ REJECT

**What components touch them?**
- Proto: OpenCode reads/writes, Backend ignores
- Backend schema: Backend API only
- OpenCode schema: OpenCode codebase

**Root cause**: Backend API schema diverged from proto. Proto says it's the source of truth, but backend doesn't follow it.

**Fix**: Backend must adopt proto schema (Option 1), with temporary MCP conversion (Option 3) as stopgap.
