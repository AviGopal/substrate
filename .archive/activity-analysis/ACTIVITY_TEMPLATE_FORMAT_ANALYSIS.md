# Activity Template Format Analysis

**Date**: February 6, 2026  
**Goal**: Ensure unified activity template format across all applications in repos/

## Executive Summary

We have **3 different activity template formats** currently in use:

1. **OpenCode Format** (metabob-opencode) - Modern, comprehensive with Zod validation
2. **Proto Bootstrap Format** (metabob-proto) - Lightweight, task_steps based
3. **Custom Template Format** (root templates/) - Hybrid format

**Critical Issue**: The formats are NOT compatible. We need a single unified format.

---

## Repository Applications & Goals

### 1. metabob-opencode
**Location**: `repos/metabob-opencode/`  
**Package**: `@opencode/opencode`  
**Language**: TypeScript  
**Purpose**: AI coding agent CLI with terminal UI

**Responsibilities**:
- Activity template execution engine (primary)
- Agent orchestration and session management
- MCP tool integration (including metabob-cli MCP server)
- Terminal UI and user interaction
- Cross-repo activity coordination via ACP delegation

**Template Location**: 
- Built-in: `packages/opencode/templates/built-in/`
- Distributed with CLI in all platform builds

**Template Format**: Modern OpenCode format with:
- Zod schema validation
- Rich context requirements
- Task dependencies
- Validation and retry logic
- Hooks (preActivity, postActivity, onError)
- Metabob integration
- Composition examples
- Learning feedback points

### 2. metabob-cli
**Location**: `repos/metabob-cli/`  
**Package**: `metabob-cli`  
**Language**: Python  
**Purpose**: MCP server providing Metabob code analysis tools

**Responsibilities**:
- Code quality analysis via Metabob backend
- MCP tool provider (search_codebase_issues, mark_problem_complete, etc.)
- CPG-based code analysis
- Background analysis engine
- Session-aware priority detection

**Template Interaction**: 
- **Does NOT execute activity templates**
- Provides tools that activities can use
- Consumed by metabob-opencode as MCP server

### 3. metabob-rpc-api
**Location**: `repos/metabob-rpc-api/`  
**Package**: `metabob-rpc-api`  
**Language**: Python (FastAPI)  
**Purpose**: Backend API for code analysis and activity storage

**Responsibilities**:
- FastAPI REST + WebSocket server
- Celery async job processing
- SurrealDB activity variant storage
- LLM inference (OpenAI or vLLM)
- Performance tracking and metrics
- Activity registration endpoint

**Template Interaction**:
- **Stores** activity variants in SurrealDB
- **Does NOT execute** activity templates
- Provides `/activity/register` endpoint for template registration
- Uses metabob-proto schemas for data models

### 4. metabob-proto
**Location**: `repos/metabob-proto/`  
**Package**: `@metabob/proto`  
**Language**: Protocol Buffers  
**Purpose**: Canonical data model definitions

**Responsibilities**:
- Proto definitions for all data models
- Bootstrap activity templates (seed data)
- Schema generation for SurrealDB
- Shared types across TypeScript and Python

**Template Location**: `activities/bootstrap/`  
**Template Format**: Proto-aligned format (task_steps, variables, hooks)

---

## Activity Template Format Comparison

### Format 1: OpenCode (Modern)
**File**: `repos/metabob-opencode/packages/opencode/templates/built-in/create-activity-template.json`

**Schema**: Zod-validated TypeScript schema

**Structure**:
```json
{
  "id": "template-id",
  "name": "Template Name",
  "version": 4,
  "description": "...",
  "category": "infrastructure",
  "contextRequirements": [
    {
      "key": "highQualityExamples",
      "hint": "...",
      "impulseTypes": ["toolOutput", "memo"],
      "required": true,
      "budgetRange": [5000, 8000]
    }
  ],
  "tasks": [
    {
      "id": "task-id",
      "subagent": "general",
      "description": "...",
      "dependencies": [],
      "impulseReferences": ["contextKey"],
      "prompt": {
        "template": "...",
        "maxTokens": 6000,
        "compressionStrategy": "filter",
        "variables": [...]
      },
      "validation": {
        "check": "command",
        "requiredFiles": [],
        "requiredPatterns": [],
        "forbiddenPatterns": [],
        "commands": [...]
      },
      "retry": {
        "max_attempts": 2,
        "strategy": "simple"
      }
    }
  ],
  "integration": {
    "preChecks": [],
    "postChecks": [],
    "qualityGates": []
  },
  "hooks": {
    "preActivity": {...},
    "postActivity": {...},
    "onError": {...}
  },
  "metabob": {...},
  "composition": {...},
  "learning": {...}
}
```

**Strengths**:
- Comprehensive validation
- Rich context injection
- Detailed learning feedback
- Type-safe with Zod
- Supports cross-repo execution (executionTarget)

**Weaknesses**:
- Complex structure
- Large JSON files
- Not yet aligned with proto

### Format 2: Proto Bootstrap
**File**: `repos/metabob-proto/activities/bootstrap/activity-create.json`

**Schema**: Protocol Buffer aligned

**Structure**:
```json
{
  "variant_id": "activity-create-v1",
  "activity_id": "activity-create",
  "variant_name": "v1-baseline",
  "version": 1,
  "description": "...",
  "task_steps": [
    {
      "step_id": "identify-pattern",
      "title": "...",
      "description": "...",
      "tools": ["read_file", "grep_search"],
      "guidance": ["...", "..."]
    }
  ],
  "variables": {
    "source_pattern": "",
    "activity_name": "",
    "target_category": ""
  },
  "prompt_strategy": "guided",
  "context_budget_tokens": 15000,
  "expected_duration_ms": 180000,
  "expected_cost": 0.20,
  "expected_quality_score": 0.75,
  "status": "active",
  "hooks": {
    "preActivity": {...},
    "postActivity": {...},
    "onError": {...}
  }
}
```

**Strengths**:
- Simpler structure
- Proto-aligned (can be stored in SurrealDB)
- Performance estimates
- Thompson sampling ready

**Weaknesses**:
- Less detailed validation
- No dependency graph
- No context requirements
- No learning feedback

### Format 3: Custom Template (Hybrid)
**File**: `templates/custom/jiggle-documentation.json`

**Structure**: Mix of OpenCode and Proto formats

```json
{
  "name": "Jiggle Documentation",
  "version": 1,
  "description": "...",
  "category": "refactor",
  "contextRequirements": [...],
  "tasks": [
    {
      "id": "task-id",
      "subagent": "general",
      "description": "...",
      "dependencies": [],
      "impulseReferences": [],
      "prompt": {
        "template": "...",
        "maxTokens": 8000,
        "compressionStrategy": "filter",
        "variables": [...]
      },
      "validation": {...},
      "retry": {...}
    }
  ],
  "integration": {...},
  "hooks": {...},
  "metabob": {...},
  "composition": {...},
  "learning": {...}
}
```

**Strengths**:
- Combines best of both formats
- Execution-ready for OpenCode
- Has learning feedback

**Weaknesses**:
- Not proto-aligned
- Can't be stored in SurrealDB directly
- Format inconsistency

---

## Format Incompatibilities

### Key Differences

| Feature | OpenCode | Proto | Custom |
|---------|----------|-------|--------|
| Task structure | `tasks[]` | `task_steps[]` | `tasks[]` |
| Task ID field | `id` | `step_id` | `id` |
| Variables | Inline in prompt | Top-level object | Inline in prompt |
| Dependencies | Array of task IDs | N/A | Array of task IDs |
| Validation | Detailed per task | N/A | Detailed per task |
| Retry | Per task | N/A | Per task |
| Context requirements | Explicit array | N/A | Explicit array |
| Agent assignment | `subagent` field | N/A | `subagent` field |
| Execution target | `executionTarget` | N/A | N/A |
| Learning | Detailed feedback | Implicit via metrics | Detailed feedback |

### Conversion Challenges

**Proto → OpenCode**:
- ✗ Missing task dependencies
- ✗ Missing validation rules
- ✗ Missing retry strategies
- ✗ Missing context requirements
- ✗ Variables need restructuring

**OpenCode → Proto**:
- ✗ Task dependencies need flattening
- ✗ Validation rules have no equivalent
- ✗ Context requirements have no equivalent
- ✗ Learning feedback has no equivalent
- ✓ Can extract performance estimates

---

## Recommended Unified Format

### Design Principles

1. **Single Source of Truth**: Proto defines the storage schema
2. **Execution Richness**: OpenCode adds execution-specific fields
3. **Backward Compatibility**: Support both formats during migration
4. **Validation Separation**: Validation logic in OpenCode, not in proto

### Proposed Unified Schema

**Proto Side** (metabob-proto):
```protobuf
message ActivityVariant {
  string variant_id = 1;
  string activity_id = 2;
  string variant_name = 3;
  int32 version = 4;
  string description = 5;
  
  // Core task structure
  repeated TaskStep task_steps = 6;
  
  // Variables as key-value pairs
  map<string, string> variables = 7;
  
  // Execution metadata
  PromptStrategy prompt_strategy = 8;
  int64 context_budget_tokens = 9;
  int64 expected_duration_ms = 10;
  double expected_cost = 11;
  double expected_quality_score = 12;
  
  // Status
  EntityStatus status = 13;
  
  // Hooks
  ActivityHooks hooks = 14;
  
  // Genealogy tracking
  Genealogy genealogy = 15;
}

message TaskStep {
  string step_id = 1;
  string title = 2;
  string description = 3;
  repeated string tools = 4;
  repeated string guidance = 5;
  
  // NEW: Execution extensions (optional, for OpenCode)
  TaskExecutionExtensions extensions = 6;
}

message TaskExecutionExtensions {
  repeated string dependencies = 1;
  string subagent = 2;
  TaskPromptConfig prompt_config = 3;
  // Validation stored as JSON (OpenCode-specific)
  string validation_json = 4;
  string retry_json = 5;
  repeated string impulse_references = 6;
}
```

**OpenCode Side** (metabob-opencode):
```typescript
// OpenCode can enrich proto with execution details
export const OpenCodeActivityTemplate = ProtoActivityVariant.extend({
  // Add OpenCode-specific fields
  contextRequirements: ContextRequirementsSchema.optional(),
  integration: IntegrationSchema.optional(),
  metabob: MetabobConfigSchema.optional(),
  composition: CompositionSchema.optional(),
  learning: LearningSchema.optional(),
  
  // Enrich tasks with execution details
  tasks: z.array(
    ProtoTaskStep.extend({
      validation: ValidationSchema,
      retry: RetrySchema,
      prompt: PromptConfigSchema,
    })
  ),
})
```

### Migration Strategy

**Phase 1**: Proto schema enhancement
- Add `TaskExecutionExtensions` to proto
- Generate Python and TypeScript code
- Update SurrealDB schema

**Phase 2**: Conversion utilities
- Create `proto-to-opencode` converter
- Create `opencode-to-proto` converter
- Validate round-trip conversion

**Phase 3**: Template migration
- Convert all proto bootstrap templates to unified format
- Convert all OpenCode templates to unified format
- Validate all templates

**Phase 4**: Execution engine update
- Update OpenCode executor to support both formats
- Add format detection and auto-conversion
- Deprecate old format support

---

## Separation of Concerns

### Execution vs Storage

**Execution** (OpenCode):
- Template parsing and validation
- Context requirement resolution
- Task dependency graph
- Agent orchestration
- Retry and error handling
- Cross-repo delegation

**Storage** (RPC API + SurrealDB):
- Activity variant persistence
- Performance metrics tracking
- Thompson sampling
- Template versioning
- Genealogy tracking

**Shared** (Proto):
- Data model definitions
- Schema validation
- Type generation
- Bootstrap templates

### Tool Provision vs Tool Usage

**Tool Providers**:
- metabob-cli: Provides MCP tools for code analysis
- metabob-opencode: Provides built-in tools (read, write, bash, etc.)

**Tool Consumers**:
- Activity templates: Use tools via agent delegation
- Agents: Execute tools based on prompts

### API Boundaries

**metabob-opencode ↔ metabob-cli**:
- Protocol: MCP (stdio)
- Direction: OpenCode calls CLI tools
- Data: Tool requests/responses

**metabob-opencode ↔ metabob-rpc-api**:
- Protocol: HTTP REST + WebSocket
- Direction: Bidirectional
- Data: Activity registration, code analysis jobs

**metabob-rpc-api ↔ SurrealDB**:
- Protocol: SurrealDB client
- Direction: API → DB
- Data: Activity variants, metrics, sessions

---

## Action Items

### Immediate (Today)
- [ ] Review this analysis
- [ ] Decide on unified format approach
- [ ] Create proto enhancement design

### This Week
- [ ] Implement proto schema enhancements
- [ ] Build conversion utilities
- [ ] Migrate bootstrap templates
- [ ] Update OpenCode executor

### Next Week
- [ ] Test unified format across all applications
- [ ] Document format specification
- [ ] Create template authoring guide
- [ ] Deprecate old formats

---

## Success Criteria

✓ Single activity template format across all repos  
✓ All applications can read/execute templates  
✓ Templates can be stored in SurrealDB  
✓ Templates can be executed by OpenCode  
✓ Clear separation of concerns documented  
✓ Migration path for existing templates  
✓ Backward compatibility during transition  

