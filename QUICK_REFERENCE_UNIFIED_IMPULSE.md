# Quick Reference: Unified Impulse-Driven Architecture

## Core Concept

**Same mechanism, different impulses:**
```typescript
create_activity_goal_seeking({
  goalDescription: <what to achieve>,
  impulseRefs: [<context that varies>]
})
```

## Use Cases

| Workflow | Goal | Impulses |
|----------|------|----------|
| **Debugging** | "Debug failed authentication" | `["execution-trace", "error-log"]` |
| **Optimization** | "Improve template performance" | `["metrics", "best-execution"]` |
| **Creation** | "Add new feature" | `["requirements", "codebase"]` |

---

## Backend Endpoints

### 1. Resolve Impulse Pointer

**Request:**
```bash
POST /v2/impulses/resolve
Content-Type: application/json

{
  "pointer": {
    "type": "activityExecutionTrace",
    "executionId": "exec_123..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "content": "# Execution Trace: exec_123...\n\n..."
}
```

**Pointer Types:**
- `activityExecutionTrace` → Full trace with tasks, tool calls, state
- `activityTemplate` → Template structure with tasks
- `activityMetrics` → Performance metrics table

### 2. Store Execution Trace

**Request:**
```bash
POST /v2/activities/execution-traces
Content-Type: application/json

{
  "execution_id": "exec_123...",
  "template_id": "add-feature-complete",
  "status": "failure",
  "duration_ms": 45000,
  "cost_usd": 0.023,
  "execution_trace": {
    "tasks": [...],
    "impulsesCreated": [],
    "filesModified": ["src/auth.ts"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "execution_id": "exec_123...",
  "message": "Execution trace stored successfully"
}
```

### 3. Get Execution Trace

```bash
GET /v2/activities/execution-traces/:executionId
```

### 4. List Execution Traces

```bash
GET /v2/activities/execution-traces?status=failure&template_id=add-feature-complete&limit=10
```

---

## Debugging Flow

```
1. Activity FAILS
   ↓
2. POST /execution-traces (MiniBob)
   ↓
3. Create impulse (OpenCode):
   impulse_create({
     id: "failed-auth",
     pointer: { type: "activityExecutionTrace", executionId: "..." }
   })
   ↓
4. Goal-seeking:
   create_activity_goal_seeking({
     goalDescription: "Debug failed auth endpoint",
     impulseRefs: ["failed-auth"]
   })
   ↓
5. Agent resolves impulse → gets trace markdown
   ↓
6. Debug activity executes → fixes issue
   ↓
7. Ribosome extracts → new template
   ↓
8. Future failures → template reused
```

---

## State Capture

### Input State
```typescript
{
  filesAvailable: string[]      // Files in working directory
  environment: Record<k, v>     // Environment variables
  impulses: string[]            // Impulse IDs referenced
  variables: Record<k, v>       // Template variables (after interpolation)
}
```

### Output State
```typescript
{
  filesModified: string[]       // Files changed
  filesCreated: string[]        // Files created
  filesDeleted: string[]        // Files deleted
  exitCode?: number             // Exit code from bash
  stderr?: string               // Error output
}
```

### State Transition
```typescript
{
  before: Record<file, hash>    // File hashes before
  after: Record<file, hash>     // File hashes after
  workingDirectory: string      // Where execution happened
}
```

---

## MiniBob Integration

### Impulse Resolution
```typescript
// MiniBob delegates non-local resolution
export async function resolvePointer(
  pointer: ImpulsePointer,
  mcp?: MCPClient
): Promise<string> {
  switch (pointer.type) {
    case "memo":
      return pointer.content || ""
    case "file":
      return await readFileContent(pointer.file_path!)
    default:
      // Delegate to backend
      return await mcp.resolveImpulse(pointer)
  }
}
```

### Trace Storage
```typescript
// After activity completion
await mcp.storeExecutionTrace({
  execution_id: execution.id,
  template_id: execution.templateId,
  status: execution.status,
  duration_ms: execution.metrics.duration,
  cost_usd: execution.metrics.cost,
  execution_trace: execution.executionTrace
})
```

---

## Markdown Formats

### Execution Trace
```markdown
# Execution Trace: exec_123...
**Status**: failure
**Duration**: 45000ms
**Cost**: $0.0230

## Task: task-1
**Input State**: Files: 3, Impulses: requirements
**Tool Calls**: bash("npm test") → Error: Test failed
**Output State**: Modified: src/auth.ts, Stderr: ...
**Result**: failure
```

### Activity Template
```markdown
# Activity Template: Add Feature Complete
**Category**: feature

## Tasks
### task-1
**Variables**: featureName (string) *required*
**Prompt**: Implement {{featureName}}...
```

### Activity Metrics
```markdown
| Variant | Success Rate | Executions | Thompson α/β |
|---------|--------------|------------|-------------|
| v2      | 92.5%        | 40         | 38.0/4.0    |
```

---

## Database Schema

```sql
DEFINE TABLE execution_traces SCHEMAFULL;

DEFINE FIELD execution_id ON execution_traces TYPE string;
DEFINE FIELD template_id ON execution_traces TYPE string;
DEFINE FIELD status ON execution_traces TYPE string 
  ASSERT $value IN ["success", "failure", "partial"];
DEFINE FIELD duration_ms ON execution_traces TYPE number;
DEFINE FIELD cost_usd ON execution_traces TYPE number;
DEFINE FIELD execution_trace ON execution_traces TYPE object;
DEFINE FIELD stored_at ON execution_traces TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_execution_id ON execution_traces COLUMNS execution_id UNIQUE;
DEFINE INDEX idx_template_id ON execution_traces COLUMNS template_id;
DEFINE INDEX idx_status ON execution_traces COLUMNS status;
```

---

## Files Reference

| Component | File | Purpose |
|-----------|------|---------|
| **Backend Routes** | `repos/metabob-activity-api/src/routes/impulses.ts` | Impulse resolution endpoint |
| | `repos/metabob-activity-api/src/routes/activities.ts` | Execution traces endpoints |
| **Backend Schemas** | `repos/metabob-activity-api/src/models/schemas.ts` | TypeScript/Zod schemas |
| **Database** | `repos/metabob-activity-api/sql/004-execution-traces.surql` | Migration |
| **MiniBob Types** | `repos/minibob/src/types.ts` | State tracking types |
| **MiniBob Impulse** | `repos/minibob/src/impulse.ts` | Resolution delegation |
| **MiniBob MCP** | `repos/minibob/src/mcp.ts` | Backend communication |

---

## Testing Commands

### Start Backend
```bash
cd repos/metabob-activity-api
npm run dev
```

### Store Trace
```bash
curl -X POST http://localhost:3000/v2/activities/execution-traces \
  -H "Content-Type: application/json" \
  -d @test-trace.json
```

### Resolve Impulse
```bash
curl -X POST http://localhost:3000/v2/impulses/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "pointer": {
      "type": "activityExecutionTrace",
      "executionId": "exec_test_001"
    }
  }'
```

### List Failed Traces
```bash
curl http://localhost:3000/v2/activities/execution-traces?status=failure&limit=10
```

---

## Key Architectural Decisions

1. **No Custom Debug Templates**: Debugging uses goal-seeking + trace impulse
2. **Backend Extensibility**: Add new pointer types without MiniBob changes
3. **State Tracking**: Capture before/after for quality debugging
4. **Ribosome as Generator**: Extract patterns from successful executions
5. **Same Code Path**: One mechanism, different impulses

---

## Success Criteria

- ✅ Backend endpoints implemented
- ✅ Database schema created
- ✅ TypeScript types aligned
- ✅ Markdown formatting complete
- ⏳ Integration testing with MiniBob
- ⏳ End-to-end debugging workflow verified
- ⏳ Template extraction from successful debug

---

**Quick Start**: See `UNIFIED_IMPULSE_BACKEND_IMPLEMENTATION.md` for full documentation.
