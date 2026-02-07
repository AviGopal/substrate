# Architecture & Separation of Concerns

**Date**: February 6, 2026  
**Status**: Reference Document

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Interaction Layer                       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  metabob-opencode (Terminal UI + CLI)                      │ │
│  │  - Activity template executor                              │ │
│  │  - Agent orchestration                                     │ │
│  │  - MCP client                                              │ │
│  │  - Cross-repo coordination (ACP)                           │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
              │                          │
              │ MCP (stdio)              │ HTTP/WebSocket
              ▼                          ▼
┌─────────────────────────┐    ┌──────────────────────────┐
│  metabob-cli            │    │  metabob-rpc-api         │
│  (MCP Server)           │    │  (Backend API)           │
│                         │    │                          │
│  Tools:                 │    │  Services:               │
│  - search_codebase_     │    │  - Activity registration │
│    issues               │    │  - Code analysis jobs    │
│  - mark_problem_        │    │  - WebSocket updates     │
│    complete             │    │  - Celery workers        │
│  - annotate_component   │    │  - LLM inference         │
│  - analyze_change_      │    │                          │
│    impact               │    │                          │
│  - (+ 4 more tools)     │    │                          │
│                         │    │                          │
│  Backend:               │    │                          │
│  - Background analysis  │    │                          │
│  - CPG inference        │    │                          │
│  - Priority detection   │    │                          │
└─────────────────────────┘    └──────────────────────────┘
              │                          │
              │ HTTP API calls           │ SurrealDB client
              ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│  metabob-rpc-api Backend                                │
│  (Shared by both CLI and direct API calls)              │
└─────────────────────────────────────────────────────────┘
              │
              │ SurrealDB protocol
              ▼
┌─────────────────────────────────────────────────────────┐
│  SurrealDB                                              │
│  - Activity variants                                    │
│  - Execution records                                    │
│  - Performance metrics                                  │
│  - User sessions                                        │
└─────────────────────────────────────────────────────────┘
              ▲
              │ Schema definitions
              │
┌─────────────────────────────────────────────────────────┐
│  metabob-proto (Data Models)                            │
│  - Proto definitions                                    │
│  - Bootstrap templates                                  │
│  - Schema generation                                    │
│  - TypeScript/Python codegen                            │
└─────────────────────────────────────────────────────────┘
```

## Application Responsibilities

### metabob-opencode (Execution Engine)

**What it does**:
- ✓ Parses and validates activity templates
- ✓ Resolves context requirements → impulses
- ✓ Executes task dependency graphs
- ✓ Delegates tasks to specialized agents
- ✓ Coordinates cross-repo activities via ACP
- ✓ Integrates MCP tools from metabob-cli
- ✓ Provides terminal UI for user interaction
- ✓ Manages session state and conversation history

**What it does NOT do**:
- ✗ Store activity templates in database
- ✗ Perform code analysis (delegates to metabob-cli)
- ✗ Run LLM inference (uses AI SDK with provider APIs)
- ✗ Manage backend infrastructure

**Data Flow**:
```
User → OpenCode CLI → Parse Template → Execute Tasks → Call Tools
                                              ↓
                                    MCP Tools (metabob-cli)
                                              ↓
                                    Return Results → User
```

### metabob-cli (Tool Provider)

**What it does**:
- ✓ Provides MCP server for code analysis tools
- ✓ Runs background analysis engine
- ✓ Maintains CPG (Code Property Graph)
- ✓ Detects priority issues based on session context
- ✓ Caches analysis results for instant queries
- ✓ Calls metabob-rpc-api for actual analysis

**What it does NOT do**:
- ✗ Execute activity templates
- ✗ Orchestrate agents
- ✗ Manage user sessions
- ✗ Store activity variants

**Data Flow**:
```
OpenCode MCP Client → metabob-cli MCP Server
                            ↓
                    Check cache (instant)
                            ↓
                    If miss: metabob-rpc-api
                            ↓
                    Return results → OpenCode
```

### metabob-rpc-api (Backend Service)

**What it does**:
- ✓ Stores activity variants in SurrealDB
- ✓ Processes code analysis jobs (Celery)
- ✓ Provides WebSocket real-time updates
- ✓ Manages LLM inference (OpenAI/vLLM)
- ✓ Tracks performance metrics
- ✓ Implements Thompson sampling for A/B testing
- ✓ Provides /activity/register endpoint

**What it does NOT do**:
- ✗ Execute activity templates directly
- ✗ Provide terminal UI
- ✗ Orchestrate multi-step workflows
- ✗ Manage MCP servers

**Data Flow**:
```
POST /activity/register → Validate → Store in SurrealDB
POST /submit → Create Celery job → LLM inference → Results
WebSocket /ws/job → Subscribe → Real-time updates
```

### metabob-proto (Data Model)

**What it does**:
- ✓ Defines canonical data models (Proto)
- ✓ Generates TypeScript code for OpenCode
- ✓ Generates Python code for RPC API and CLI
- ✓ Generates SurrealDB schema
- ✓ Stores bootstrap activity templates
- ✓ Provides schema migration tools

**What it does NOT do**:
- ✗ Execute anything
- ✗ Store runtime data
- ✗ Provide APIs or services

**Data Flow**:
```
Proto files → Codegen → TypeScript/Python types
           → Schema gen → SurrealDB schema
           → Bootstrap → Seed templates
```

## Protocol Boundaries

### 1. MCP (Model Context Protocol)

**Between**: metabob-opencode ↔ metabob-cli

**Transport**: stdio (standard input/output)

**Message Format**: JSON-RPC 2.0

**Flow**:
```typescript
// OpenCode calls MCP tool
const result = await mcpClient.call("search_codebase_issues", {
  query: "authentication bug",
  limit: 10
})

// metabob-cli MCP server handles request
// Returns: { issues: [...], context: {...} }
```

**Configuration** (opencode.json):
```json
{
  "mcp": {
    "metabob": {
      "command": "metabob-cli",
      "args": ["mcp", "--transport", "stdio"],
      "enabled": true
    }
  }
}
```

### 2. HTTP REST + WebSocket

**Between**: metabob-opencode ↔ metabob-rpc-api

**Transport**: HTTP/HTTPS, WebSocket

**Endpoints**:
- `POST /activity/register` - Register activity template
- `POST /submit` - Submit code analysis job
- `GET /analysis?job=<id>` - Fetch analysis results
- `WS /ws/job?token=<token>` - Real-time job updates

**Flow**:
```typescript
// OpenCode registers template
await fetch("http://localhost:8080/activity/register", {
  method: "POST",
  body: JSON.stringify(template),
  headers: { "Content-Type": "application/json" }
})

// OpenCode subscribes to job updates
const ws = new WebSocket("ws://localhost:8080/ws/job?token=...")
ws.send(JSON.stringify({
  action: "subscribe",
  data: { jobId: "123", includeResults: false }
}))
```

### 3. ACP (Agent Client Protocol)

**Between**: metabob-opencode ↔ devbob containers

**Transport**: Docker exec, SSH (future)

**Purpose**: Cross-repo task delegation

**Flow**:
```typescript
// OpenCode delegates task to remote repo
const result = await acpDelegate({
  target: "docker://devbob-rpc-api",
  taskDescription: "Implement API endpoint",
  prompt: "Create POST /users endpoint...",
  shareImpulses: ["designDoc", "apiSchema"],
  timeout: 600
})
```

### 4. SurrealDB Protocol

**Between**: metabob-rpc-api ↔ SurrealDB

**Transport**: WebSocket (native SurrealDB protocol)

**Purpose**: Data persistence

**Flow**:
```python
# RPC API stores activity variant
db.create("activity_variants", {
  "variant_id": "bug-fix-v1",
  "task_steps": [...],
  "status": "active"
})

# RPC API queries with Thompson sampling
variants = db.query("""
  SELECT * FROM activity_variants
  WHERE activity_id = $activity_id
  AND status = 'active'
  ORDER BY expected_quality_score DESC
""")
```

## Data Model Alignment

### Proto → TypeScript (OpenCode)

**Generator**: `@bufbuild/protoc-gen-es` or `ts-proto`

**Usage**:
```typescript
import { ActivityVariant } from "@metabob/proto/activity/variant"

const variant: ActivityVariant = {
  variantId: "bug-fix-v1",
  activityId: "bug-fix",
  taskSteps: [...],
  status: "active"
}
```

### Proto → Python (RPC API & CLI)

**Generator**: `betterproto`

**Usage**:
```python
from metabob.proto.activity.variant import ActivityVariant

variant = ActivityVariant(
    variant_id="bug-fix-v1",
    activity_id="bug-fix",
    task_steps=[...],
    status="active"
)
```

### Proto → SurrealDB Schema

**Generator**: Custom Python script (`generate_surreal_schema.py`)

**Output**:
```sql
DEFINE TABLE activity_variants SCHEMAFULL;
DEFINE FIELD variant_id ON activity_variants TYPE string;
DEFINE FIELD activity_id ON activity_variants TYPE string;
DEFINE FIELD task_steps ON activity_variants TYPE array;
DEFINE INDEX unique_variant ON activity_variants FIELDS variant_id UNIQUE;
```

## Execution Flow: Activity Template

### Step-by-Step Flow

**1. User invokes activity**:
```bash
opencode activity run bug-fix-complete \
  --var bugDescription="Auth timeout after 5min"
```

**2. OpenCode loads template**:
- Check built-in templates: `packages/opencode/templates/built-in/`
- Parse JSON and validate with Zod schema
- Resolve variables

**3. Context requirements → Impulses**:
```typescript
// Template specifies context requirements
contextRequirements: [
  {
    key: "similarBugs",
    hint: "search_codebase_issues('authentication timeout')",
    impulseTypes: ["metabobIssues"],
    required: true,
    budgetRange: [2000, 4000]
  }
]

// OpenCode creates impulse
const impulse = await createImpulse({
  id: "similarBugs",
  pointer: {
    type: "toolOutput",
    tool: "search_codebase_issues",
    args: { query: "authentication timeout" }
  },
  budget: 3000
})

// Calls metabob-cli MCP tool
const issues = await mcp.call("search_codebase_issues", ...)
```

**4. Execute task graph**:
```typescript
for (const task of topologicalSort(tasks)) {
  // Check dependencies completed
  if (!dependenciesComplete(task)) continue
  
  // Build prompt with impulse context
  const prompt = buildPrompt(task, impulses)
  
  // Delegate to agent
  const result = await executeSubagent(task.subagent, prompt)
  
  // Validate
  if (!validate(result, task.validation)) {
    retry(task)
  }
  
  // Store result
  storeTaskResult(task.id, result)
}
```

**5. Post-activity hooks**:
```typescript
// Create summary
if (hooks.postActivity.createSummary) {
  const summary = summarizeActivity(results)
  createImpulse({ type: "memo", content: summary })
}

// Mark completion
activity.status = "completed"
```

**6. Learning feedback** (optional):
```typescript
// OpenCode sends execution metrics to RPC API
await fetch("http://localhost:8080/activity/feedback", {
  method: "POST",
  body: JSON.stringify({
    variantId: "bug-fix-v1",
    executionId: "exec-123",
    duration: 45000,
    cost: 0.12,
    success: true,
    metrics: { tasks_completed: 5, tests_passed: 12 }
  })
})

// RPC API updates Thompson sampling stats
```

## Template Format Unification Strategy

### Current State
- **OpenCode format**: Rich execution metadata, not proto-aligned
- **Proto format**: Storage-friendly, missing execution details
- **Custom format**: Hybrid, inconsistent

### Target State
- **Single format**: Proto-based with OpenCode extensions
- **Backward compatibility**: Support old formats during migration
- **Clear boundaries**: Proto for storage, OpenCode for execution

### Approach

**1. Enhance Proto**:
```protobuf
message TaskStep {
  string step_id = 1;
  string title = 2;
  string description = 3;
  repeated string tools = 4;
  repeated string guidance = 5;
  
  // NEW: Execution extensions
  TaskExecutionExtensions extensions = 6;
}

message TaskExecutionExtensions {
  repeated string dependencies = 1;
  string subagent = 2;
  string prompt_template = 3;
  int64 max_tokens = 4;
  string validation_json = 5;  // Stores OpenCode validation as JSON
  string retry_json = 6;        // Stores OpenCode retry as JSON
  repeated string impulse_references = 7;
}
```

**2. OpenCode Extension Layer**:
```typescript
// OpenCode loads proto template and enriches it
const protoTemplate = await loadProtoTemplate("bug-fix-v1")

// Convert to OpenCode execution format
const executableTemplate = convertProtoToOpenCode(protoTemplate)

// Add OpenCode-specific metadata (not in proto)
executableTemplate.contextRequirements = [...]
executableTemplate.learning = [...]
executableTemplate.composition = [...]
```

**3. Registration Flow**:
```typescript
// User creates template in OpenCode format
const openCodeTemplate = { ... }

// OpenCode validates
validateOpenCodeTemplate(openCodeTemplate)

// Convert to proto for storage
const protoVariant = convertOpenCodeToProto(openCodeTemplate)

// Register with backend
await registerActivity(protoVariant)

// Backend stores in SurrealDB
```

### Migration Path

**Week 1**:
- Define `TaskExecutionExtensions` proto message
- Generate TypeScript/Python code
- Update SurrealDB schema

**Week 2**:
- Build conversion utilities
- Test round-trip conversion
- Migrate bootstrap templates

**Week 3**:
- Update OpenCode executor to support both formats
- Add format auto-detection
- Migrate all OpenCode built-in templates

**Week 4**:
- Test end-to-end
- Document new format
- Deprecate old formats

## Success Metrics

✅ **Single Source of Truth**: metabob-proto defines all data models  
✅ **Clear Boundaries**: Each app has distinct responsibilities  
✅ **Interoperability**: All apps can work with same templates  
✅ **Backward Compatibility**: Old templates work during migration  
✅ **Type Safety**: Proto → codegen ensures consistency  
✅ **Execution Rich**: OpenCode has all metadata for execution  
✅ **Storage Friendly**: Proto templates fit in SurrealDB  

## Next Steps

1. ✅ Document current state (this file)
2. ⏳ Define unified proto schema
3. ⏳ Build conversion utilities
4. ⏳ Migrate templates
5. ⏳ Update executors
6. ⏳ Test and validate

