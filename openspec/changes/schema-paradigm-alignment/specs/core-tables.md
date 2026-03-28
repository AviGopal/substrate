# Core Tables Specification

## Overview

This spec defines the 4 core tables that implement the impulse/activity/vessel paradigm:

1. **impulse** - All data with pointer + metadata
2. **activity** - All state transitions with input/output shapes
3. **execution** - All traces linking inputs to outputs
4. **vessel** - All execution environments

## Table: `impulse`

### Purpose

Store all data as impulses with pointers and metadata. Replaces:
- `impulse_data`
- Goal-related data from `goal_execution_paths`
- Inline trace data

### Schema

```sql
DEFINE TABLE IF NOT EXISTS impulse SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      org_id = $auth.org_id
      AND (project_id IS NONE OR project_id IN $auth.project_ids)
    FOR create WHERE $auth.org_id != NONE
    FOR update WHERE
      org_id = $auth.org_id
      AND ($auth.role = 'admin' OR created_by = $auth.id)
    FOR delete WHERE
      org_id = $auth.org_id
      AND ($auth.role = 'admin' OR created_by = $auth.id);

-- Identity
DEFINE FIELD IF NOT EXISTS id ON impulse TYPE string
  ASSERT $value != NONE
  COMMENT "Unique impulse identifier (uuid or semantic: goal-{hash}, trace-{id})";

-- Pointer: WHERE the data is
DEFINE FIELD IF NOT EXISTS pointer ON impulse TYPE object
  ASSERT $value != NONE
  COMMENT "Pointer structure varies by type";

-- Shape: WHAT the data looks like
DEFINE FIELD IF NOT EXISTS shape ON impulse TYPE string
  ASSERT $value != NONE
  COMMENT "Semantic type for activity matching";

-- Summary: Human/LLM readable
DEFINE FIELD IF NOT EXISTS summary ON impulse TYPE option<string>
  COMMENT "Brief description (<100 chars)";

-- Token estimate
DEFINE FIELD IF NOT EXISTS token_estimate ON impulse TYPE option<int>
  COMMENT "Estimated tokens when loaded";

-- Content: Actual data (nullable)
DEFINE FIELD IF NOT EXISTS content ON impulse TYPE option<string>
  COMMENT "Materialized content (null = not loaded)";

-- Multi-tenancy
DEFINE FIELD IF NOT EXISTS org_id ON impulse TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;

DEFINE FIELD IF NOT EXISTS project_id ON impulse TYPE option<record<projects>>
  VALUE $value OR $auth.project_id;

DEFINE FIELD IF NOT EXISTS vessel_id ON impulse TYPE option<string>
  COMMENT "Vessel that created this impulse";

DEFINE FIELD IF NOT EXISTS created_by ON impulse TYPE option<record<users> | record<minibob_instance>>
  VALUE $value OR $auth.id;

-- Lifecycle
DEFINE FIELD IF NOT EXISTS created_at ON impulse TYPE datetime
  VALUE $value OR time::now();

DEFINE FIELD IF NOT EXISTS expires_at ON impulse TYPE option<datetime>;

-- Indexes
DEFINE INDEX IF NOT EXISTS idx_impulse_id ON impulse FIELDS id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_impulse_shape ON impulse FIELDS shape;
DEFINE INDEX IF NOT EXISTS idx_impulse_org ON impulse FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_impulse_org_shape ON impulse FIELDS org_id, shape;
DEFINE INDEX IF NOT EXISTS idx_impulse_org_project ON impulse FIELDS org_id, project_id;
DEFINE INDEX IF NOT EXISTS idx_impulse_vessel ON impulse FIELDS vessel_id;
DEFINE INDEX IF NOT EXISTS idx_impulse_expires ON impulse FIELDS expires_at;
DEFINE INDEX IF NOT EXISTS idx_impulse_pointer_type ON impulse FIELDS pointer.type;
```

### Pointer Types

| Type | Structure | Resolver |
|------|-----------|----------|
| `file` | `{ type: "file", path: string, offset?: int, limit?: int }` | Vessel (filesystem) |
| `memo` | `{ type: "memo", content: string }` | Inline |
| `trace` | `{ type: "trace", execution_id: string }` | Backend |
| `activity` | `{ type: "activity", activity_id: string }` | Backend |
| `goal` | `{ type: "goal", text: string, category?: string }` | Inline |
| `error` | `{ type: "error", message: string, stack?: string }` | Inline |

### Shape Types

| Shape | Description | Typical Pointer Types |
|-------|-------------|----------------------|
| `goal` | User intent/request | `goal`, `memo` |
| `source_code` | Code content | `file` |
| `error` | Error information | `error`, `memo` |
| `trace` | Execution trace | `trace` |
| `recommendation` | Activity suggestion | `memo` |
| `analysis` | Analysis result | `memo` |
| `patch` | Code diff | `memo` |
| `test_result` | Test outcome | `memo` |

### Examples

```typescript
// Goal impulse
{
  id: "goal-abc123",
  pointer: { type: "goal", text: "Fix the authentication bug", category: "bugfix" },
  shape: "goal",
  summary: "Fix auth bug - null pointer in login flow",
  token_estimate: 50,
  content: null,
  org_id: "organizations:acme",
  created_at: "2026-03-26T10:00:00Z"
}

// File impulse
{
  id: "file-auth-ts",
  pointer: { type: "file", path: "/src/auth.ts", offset: 40, limit: 100 },
  shape: "source_code",
  summary: "Auth module (lines 40-140)",
  token_estimate: 1200,
  content: null,
  org_id: "organizations:acme",
  created_at: "2026-03-26T10:00:00Z"
}

// Trace impulse (references execution)
{
  id: "trace-exec-789",
  pointer: { type: "trace", execution_id: "exec-789" },
  shape: "trace",
  summary: "Previous debug attempt (failed)",
  token_estimate: 2000,
  content: null,
  org_id: "organizations:acme",
  created_at: "2026-03-26T09:00:00Z"
}
```

---

## Table: `activity`

### Purpose

Store all state transitions (templates, tools, compositions). Replaces:
- `activity_template`
- `activity_registry`
- `goal_execution_paths` (as compositions)
- Tool definitions

### Schema

```sql
DEFINE TABLE IF NOT EXISTS activity SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      (scope = 'global' AND public = true)
      OR (org_id = $auth.org_id)
      OR (scope = 'project' AND project_id IN $auth.project_ids)
    FOR create WHERE $auth.org_id != NONE
    FOR update WHERE
      org_id = $auth.org_id
      AND ($auth.role = 'admin' OR created_by = $auth.id)
    FOR delete WHERE
      org_id = $auth.org_id
      AND $auth.role = 'admin';

-- Identity
DEFINE FIELD IF NOT EXISTS id ON activity TYPE string
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS name ON activity TYPE string
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS description ON activity TYPE option<string>;

-- Input/Output Shapes
DEFINE FIELD IF NOT EXISTS input_shapes ON activity TYPE array<string>
  VALUE $value OR []
  COMMENT "Required impulse shapes";

DEFINE FIELD IF NOT EXISTS output_shapes ON activity TYPE array<string>
  VALUE $value OR []
  COMMENT "Produced impulse shapes";

-- Execution definition
DEFINE FIELD IF NOT EXISTS execution_type ON activity TYPE string
  ASSERT $value IN ['template', 'tool', 'composition', 'vessel_function'];

-- Template-specific
DEFINE FIELD IF NOT EXISTS tasks ON activity TYPE option<array>
  COMMENT "Task steps array";

-- Tool-specific
DEFINE FIELD IF NOT EXISTS tool_name ON activity TYPE option<string>;

-- Composition-specific
DEFINE FIELD IF NOT EXISTS child_activities ON activity TYPE option<array<string>>;

-- Vessel function-specific
DEFINE FIELD IF NOT EXISTS source_location ON activity TYPE option<object>;

-- Lineage
DEFINE FIELD IF NOT EXISTS extracted_from ON activity TYPE option<string>;
DEFINE FIELD IF NOT EXISTS variant_of ON activity TYPE option<string>;

-- Scope
DEFINE FIELD IF NOT EXISTS scope ON activity TYPE string
  ASSERT $value IN ['global', 'org', 'project', 'vessel']
  VALUE $value OR 'org';

DEFINE FIELD IF NOT EXISTS public ON activity TYPE bool
  VALUE $value OR false;

-- Multi-tenancy
DEFINE FIELD IF NOT EXISTS org_id ON activity TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;

DEFINE FIELD IF NOT EXISTS project_id ON activity TYPE option<record<projects>>;

DEFINE FIELD IF NOT EXISTS created_by ON activity TYPE option<record<users> | record<minibob_instance>>
  VALUE $value OR $auth.id;

-- Timestamps
DEFINE FIELD IF NOT EXISTS created_at ON activity TYPE datetime
  VALUE $value OR time::now();

DEFINE FIELD IF NOT EXISTS updated_at ON activity TYPE datetime
  VALUE time::now();

-- Indexes
DEFINE INDEX IF NOT EXISTS idx_activity_id ON activity FIELDS id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_activity_name ON activity FIELDS name;
DEFINE INDEX IF NOT EXISTS idx_activity_type ON activity FIELDS execution_type;
DEFINE INDEX IF NOT EXISTS idx_activity_scope ON activity FIELDS scope;
DEFINE INDEX IF NOT EXISTS idx_activity_public ON activity FIELDS public, scope;
DEFINE INDEX IF NOT EXISTS idx_activity_org ON activity FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_activity_org_type ON activity FIELDS org_id, execution_type;
DEFINE INDEX IF NOT EXISTS idx_activity_variant_of ON activity FIELDS variant_of;
```

### Execution Types

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `template` | LLM-executed task sequence | `tasks` |
| `tool` | Single tool invocation | `tool_name` |
| `composition` | Ordered activity sequence | `child_activities` |
| `vessel_function` | Codebase function | `source_location` |

### Examples

```typescript
// Template activity
{
  id: "debug-null-pointer",
  name: "Debug Null Pointer Error",
  description: "Analyze and fix null pointer exceptions",
  input_shapes: ["goal", "error", "source_code"],
  output_shapes: ["source_code", "trace"],
  execution_type: "template",
  tasks: [
    {
      id: "analyze",
      description: "Analyze the error and identify root cause",
      resolver: "llm",
      prompt: "Given the error: {{error}}, analyze..."
    },
    {
      id: "fix",
      description: "Generate fix for the identified issue",
      resolver: "llm",
      prompt: "Based on analysis, generate fix..."
    }
  ],
  scope: "global",
  public: true,
  org_id: "organizations:metabob"
}

// Tool activity
{
  id: "tool-bash",
  name: "Execute Bash Command",
  input_shapes: ["command"],
  output_shapes: ["output", "error"],
  execution_type: "tool",
  tool_name: "bash",
  scope: "global",
  public: true,
  org_id: "organizations:metabob"
}

// Composition activity (was goal_execution_path)
{
  id: "path-fix-and-test",
  name: "Fix Bug and Run Tests",
  input_shapes: ["goal", "error"],
  output_shapes: ["source_code", "test_result"],
  execution_type: "composition",
  child_activities: ["debug-null-pointer", "run-tests"],
  scope: "org",
  org_id: "organizations:acme"
}
```

---

## Table: `execution`

### Purpose

Store all execution traces. Replaces:
- `activity_execution_traces`
- `activity_executions`
- `tool_usage`
- `execution_sequences`

### Schema

```sql
DEFINE TABLE IF NOT EXISTS execution SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      org_id = $auth.org_id
      AND (project_id IS NONE OR project_id IN $auth.project_ids)
    FOR create WHERE $auth.org_id != NONE
    FOR update WHERE
      org_id = $auth.org_id
      AND ($auth.role = 'admin' OR created_by = $auth.id)
    FOR delete WHERE
      org_id = $auth.org_id
      AND $auth.role = 'admin';

-- Identity
DEFINE FIELD IF NOT EXISTS id ON execution TYPE string
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS activity_id ON execution TYPE string
  ASSERT $value != NONE;

-- Core trace data
DEFINE FIELD IF NOT EXISTS input_impulses ON execution TYPE array<string>
  VALUE $value OR [];

DEFINE FIELD IF NOT EXISTS output_impulses ON execution TYPE array<string>
  VALUE $value OR [];

-- Outcome
DEFINE FIELD IF NOT EXISTS success ON execution TYPE bool
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS error ON execution TYPE option<object>;

-- Metrics
DEFINE FIELD IF NOT EXISTS duration_ms ON execution TYPE int
  ASSERT $value >= 0;

DEFINE FIELD IF NOT EXISTS cost_usd ON execution TYPE float
  ASSERT $value >= 0;

DEFINE FIELD IF NOT EXISTS tokens_in ON execution TYPE int
  VALUE $value OR 0;

DEFINE FIELD IF NOT EXISTS tokens_out ON execution TYPE int
  VALUE $value OR 0;

-- Composition
DEFINE FIELD IF NOT EXISTS parent_execution_id ON execution TYPE option<string>;

-- Detailed trace
DEFINE FIELD IF NOT EXISTS trace ON execution TYPE option<object> FLEXIBLE;

-- Multi-tenancy
DEFINE FIELD IF NOT EXISTS org_id ON execution TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;

DEFINE FIELD IF NOT EXISTS project_id ON execution TYPE option<record<projects>>
  VALUE $value OR $auth.project_id;

DEFINE FIELD IF NOT EXISTS vessel_id ON execution TYPE option<string>;

DEFINE FIELD IF NOT EXISTS created_by ON execution TYPE option<record<users> | record<minibob_instance>>
  VALUE $value OR $auth.id;

-- Timestamps
DEFINE FIELD IF NOT EXISTS executed_at ON execution TYPE datetime
  VALUE $value OR time::now();

DEFINE FIELD IF NOT EXISTS created_at ON execution TYPE datetime
  VALUE $value OR time::now();

-- Indexes
DEFINE INDEX IF NOT EXISTS idx_execution_id ON execution FIELDS id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_execution_activity ON execution FIELDS activity_id;
DEFINE INDEX IF NOT EXISTS idx_execution_success ON execution FIELDS success;
DEFINE INDEX IF NOT EXISTS idx_execution_parent ON execution FIELDS parent_execution_id;
DEFINE INDEX IF NOT EXISTS idx_execution_org ON execution FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_execution_org_activity ON execution FIELDS org_id, activity_id;
DEFINE INDEX IF NOT EXISTS idx_execution_vessel ON execution FIELDS vessel_id;
DEFINE INDEX IF NOT EXISTS idx_execution_executed_at ON execution FIELDS executed_at;
```

### Examples

```typescript
// Template execution
{
  id: "exec-abc123",
  activity_id: "debug-null-pointer",
  input_impulses: ["goal-xyz", "error-123", "file-auth-ts"],
  output_impulses: ["file-auth-ts-fixed", "trace-abc123"],
  success: true,
  duration_ms: 45000,
  cost_usd: 0.12,
  tokens_in: 5000,
  tokens_out: 1200,
  trace: {
    tasks: [
      { id: "analyze", success: true, duration_ms: 20000 },
      { id: "fix", success: true, duration_ms: 25000 }
    ],
    state_transition: {
      before: { "auth.ts": "hash-abc" },
      after: { "auth.ts": "hash-def" }
    }
  },
  org_id: "organizations:acme",
  vessel_id: "minibob-001",
  executed_at: "2026-03-26T10:05:00Z"
}

// Tool execution
{
  id: "exec-tool-456",
  activity_id: "tool-bash",
  input_impulses: ["cmd-run-tests"],
  output_impulses: ["output-test-results"],
  success: true,
  duration_ms: 3000,
  cost_usd: 0,
  tokens_in: 0,
  tokens_out: 0,
  parent_execution_id: "exec-abc123",
  org_id: "organizations:acme",
  executed_at: "2026-03-26T10:04:30Z"
}
```

---

## Table: `vessel`

### Purpose

Store execution environments. Replaces:
- `minibob_instance`

### Schema

```sql
DEFINE TABLE IF NOT EXISTS vessel SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      id = $auth.id
      OR (org_id = $auth.org_id AND $auth.role = 'admin')
    FOR create, update WHERE
      $auth.role = 'admin'
      AND org_id = $auth.org_id
    FOR delete WHERE
      $auth.role = 'admin'
      AND org_id = $auth.org_id;

-- Identity
DEFINE FIELD IF NOT EXISTS id ON vessel TYPE string
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS name ON vessel TYPE string
  ASSERT $value != NONE;

-- Capabilities
DEFINE FIELD IF NOT EXISTS resolves ON vessel TYPE array<string>
  VALUE $value OR ['file', 'memo']
  COMMENT "Impulse types this vessel resolves";

-- Authentication
DEFINE FIELD IF NOT EXISTS api_key_hash ON vessel TYPE string
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS is_active ON vessel TYPE bool
  VALUE $value OR true;

-- Multi-tenancy
DEFINE FIELD IF NOT EXISTS org_id ON vessel TYPE record<organizations>
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS project_id ON vessel TYPE option<record<projects>>;

-- Timestamps
DEFINE FIELD IF NOT EXISTS created_at ON vessel TYPE datetime
  VALUE $value OR time::now();

DEFINE FIELD IF NOT EXISTS last_active_at ON vessel TYPE option<datetime>;

DEFINE FIELD IF NOT EXISTS expires_at ON vessel TYPE option<datetime>;

-- Indexes
DEFINE INDEX IF NOT EXISTS idx_vessel_id ON vessel FIELDS id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_vessel_org ON vessel FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_vessel_active ON vessel FIELDS is_active;
```

### Example

```typescript
{
  id: "minibob-001",
  name: "MiniBob Local Dev",
  resolves: ["file", "memo", "git"],
  api_key_hash: "argon2:...",
  is_active: true,
  org_id: "organizations:metabob_internal",
  created_at: "2026-03-26T00:00:00Z",
  last_active_at: "2026-03-26T10:00:00Z"
}
```

---

## Backward Compatibility Views

```sql
-- Map old activity_registry queries to activity table
DEFINE TABLE IF NOT EXISTS view_activity_registry AS
  SELECT
    id,
    id AS variant_id,
    name,
    description,
    execution_type AS execution_format,
    tasks AS task_steps,
    input_shapes AS typical_inputs,
    output_shapes AS typical_outputs,
    scope,
    public,
    org_id,
    project_id,
    created_by,
    created_at,
    updated_at
  FROM activity;

-- Map old activity_execution_traces queries to execution table
DEFINE TABLE IF NOT EXISTS view_activity_execution_traces AS
  SELECT
    id AS execution_id,
    activity_id,
    activity_id AS variant_id,
    success,
    (IF success THEN 'success' ELSE 'failure' END) AS status,
    duration_ms,
    cost_usd,
    tokens_in AS tokens_input,
    tokens_out AS tokens_output,
    error.message AS error_message,
    error.type AS error_type,
    error.task_id AS failed_task_id,
    input_impulses AS impulses_used,
    trace AS execution_trace,
    org_id,
    project_id,
    executed_at,
    created_at
  FROM execution;

-- Map old impulse_data queries to impulse table
DEFINE TABLE IF NOT EXISTS view_impulse_data AS
  SELECT
    id AS impulse_id,
    pointer AS impulse_data,
    pointer.type AS impulse_type,
    pointer,
    content,
    token_estimate AS budget,
    shape AS priority,
    (content IS NOT NONE) AS loaded,
    org_id,
    project_id,
    created_by,
    created_at,
    expires_at
  FROM impulse;
```
